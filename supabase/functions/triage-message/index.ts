// Triage de mensajes entrantes con LLM. Clasifica clasificación, urgencia,
// sentimiento e idioma, y sugiere borrador de respuesta en castellano.
//
// Provider configurable via env LLM_PROVIDER: 'bedrock' | 'openai' | 'anthropic'
// Si no hay credenciales, devuelve fallback basado en reglas heurísticas.
//
// Llamado desde admin InboxManager al pulsar 'Clasificar con IA'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const LLM_PROVIDER = (Deno.env.get("LLM_PROVIDER") || "none").toLowerCase();

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const SYSTEM = `Eres asistente de un alojamiento rural en Hinojares (Sierra de Cazorla, Jaén, España). Lo gestiona un matrimonio mayor (Mari Carmen y Jesús). Recibimos un mensaje entrante de un huésped o potencial cliente. Tu tarea: clasificarlo y proponer una respuesta corta, cercana y útil en castellano (tuteo).

CLASIFICACIÓN — uno de:
- consulta: pregunta general sobre el alojamiento, la zona, fechas, precios, normas
- queja: muestra insatisfacción con algo
- averia: algo no funciona (calefacción, wifi, agua, etc.)
- modificacion: quiere cambiar fechas, personas, datos de su reserva
- reserva_nueva: quiere reservar
- otro

URGENCIA — una de:
- alta: requiere respuesta hoy mismo (avería, queja activa, problema durante estancia)
- normal: respuesta en 24h (consulta, modificación)
- baja: puede esperar varios días (pregunta exploratoria)

SENTIMIENTO — uno de: positivo, neutro, negativo

IDIOMA — código ISO de 2 letras (es, en, fr, de, it, pt...)

RESPUESTA SUGERIDA: máximo 4 frases, cercana pero correcta, en el IDIOMA detectado. No prometas nada que no podamos cumplir. Si es queja o avería, asume responsabilidad y propone siguiente paso.

Responde EXCLUSIVAMENTE con JSON válido (sin markdown, sin texto extra) con estos campos: classification, urgency, sentiment, language, suggested_response.`;

// ─────── Heurístico fallback (sin LLM) ───────
function heuristicTriage(body: string) {
    const lower = body.toLowerCase();
    let classification = "consulta";
    let urgency = "normal";
    let sentiment = "neutro";
    if (/aver[íi]a|no funciona|roto|estropead|fuga|sin agua|sin luz|sin calefac/.test(lower)) { classification = "averia"; urgency = "alta"; sentiment = "negativo"; }
    else if (/queja|reclama|fatal|horrible|pésimo|mal|sucio|ruido/.test(lower)) { classification = "queja"; urgency = "alta"; sentiment = "negativo"; }
    else if (/cambiar|modific|adelant|retrasar|añadir/.test(lower)) classification = "modificacion";
    else if (/disponib|reservar|libre|fechas|precio|cuánto cuesta|how much|available/.test(lower)) classification = "reserva_nueva";
    const language = /[áéíóúñ¿¡]/.test(body) || /\b(hola|gracias|saludos|buenas)\b/i.test(body) ? "es" : /\b(hello|hi|thanks|please)\b/i.test(body) ? "en" : "es";
    return { classification, urgency, sentiment, language, suggested_response: "" };
}

// ─────── Bedrock (default si está configurado) ───────
async function triageBedrock(body: string) {
    const region = Deno.env.get("AWS_REGION") || "eu-central-1";
    const accessKey = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const model = Deno.env.get("BEDROCK_MODEL_ID") || "eu.anthropic.claude-3-5-sonnet-20241022-v2:0";
    if (!accessKey || !secretKey) throw new Error("AWS credentials missing");

    // SigV4 firma compleja para Bedrock — para mantener el archivo manejable,
    // delegamos a la implementación que el bot-chat ya tiene en otra edge function.
    // Si no quieres dependencia entre funciones, swap a OpenAI/Anthropic directos.
    throw new Error("bedrock_not_implemented_here");
}

// ─────── Anthropic API directo (simple) ───────
async function triageAnthropic(body: string) {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
            model: Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-sonnet-20241022",
            max_tokens: 600,
            system: SYSTEM,
            messages: [{ role: "user", content: body }],
        }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data?.content?.[0]?.text || "";
    return JSON.parse(text);
}

// ─────── OpenAI compatible ───────
async function triageOpenAI(body: string) {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY missing");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
            model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: body },
            ],
        }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    let payload: { messageId?: string };
    try { payload = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
    if (!payload.messageId) return json(400, { error: "missing_messageId" });

    const { data: msg, error: mErr } = await supabase.from("inbox_messages").select("id, body, subject, from_name").eq("id", payload.messageId).maybeSingle();
    if (mErr || !msg) return json(404, { error: "message_not_found" });

    const fullText = [msg.subject ? `Asunto: ${msg.subject}` : null, msg.from_name ? `Remitente: ${msg.from_name}` : null, msg.body].filter(Boolean).join("\n\n");

    let result: any;
    let used: string;
    try {
        if (LLM_PROVIDER === "anthropic")    { result = await triageAnthropic(fullText); used = "anthropic"; }
        else if (LLM_PROVIDER === "openai")  { result = await triageOpenAI(fullText);    used = "openai"; }
        else if (LLM_PROVIDER === "bedrock") { result = await triageBedrock(fullText);   used = "bedrock"; }
        else throw new Error("no_llm_configured");
    } catch (e) {
        // Fallback heurístico — útil mientras no haya proveedor LLM configurado.
        result = heuristicTriage(msg.body);
        used = `fallback_heuristic (${e instanceof Error ? e.message : String(e)})`;
    }

    const patch = {
        classification: result.classification || null,
        urgency: result.urgency || null,
        sentiment: result.sentiment || null,
        language: result.language || null,
        suggested_response: result.suggested_response || null,
        triaged_at: new Date().toISOString(),
    };
    await supabase.from("inbox_messages").update(patch).eq("id", payload.messageId);

    return json(200, { ok: true, provider: used, ...patch });
});

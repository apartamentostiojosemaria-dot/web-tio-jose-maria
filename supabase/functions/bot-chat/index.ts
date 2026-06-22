// Bot del asistente de huéspedes — RAG sobre kb_chunks + Claude vía Bedrock UE.
// =============================================================================
// Endpoint POST /functions/v1/bot-chat
// Body: { sessionId: string, message: string, history?: ChatTurn[], language?: string }
// Response: { reply: string, sources: Array<{ title, source_type }>, sessionId }
//
// Variables de entorno requeridas (Easypanel/Supabase secrets):
//   AWS_BEDROCK_ACCESS_KEY_ID
//   AWS_BEDROCK_SECRET_ACCESS_KEY
//   AWS_BEDROCK_SESSION_TOKEN (opcional, sólo si usas credenciales temporales)
//   BOT_RATE_LIMIT_PER_SESSION (opcional, default 30 turnos/sesión)
//
// Cumplimiento AI Act art.50: el disclaimer lo añade el cliente al iniciar la
// conversación. Aquí solo gestionamos el turno. Logging anonimizado (IP→país,
// UA→hash) en ai_interaction_logs, retención 12 meses (cron).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { embedText, chat, type ChatTurn } from "../_shared/bedrock.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AWS_KEY = Deno.env.get("AWS_BEDROCK_ACCESS_KEY_ID");
const AWS_SECRET = Deno.env.get("AWS_BEDROCK_SECRET_ACCESS_KEY");
const AWS_SESSION = Deno.env.get("AWS_BEDROCK_SESSION_TOKEN") || undefined;
const RATE_LIMIT = parseInt(Deno.env.get("BOT_RATE_LIMIT_PER_SESSION") || "30", 10);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT_ES = `Eres el asistente virtual de Apartamentos Rurales Tío José María, en Hinojares (Sierra de Cazorla, Jaén, España). Hablas con cariño y cercanía, como un anfitrión que conoce el pueblo de toda la vida, sin formalismos ni jerga corporativa. Respuestas breves (3-6 frases), útiles, en el idioma del huésped.

Reglas:
- Usa SOLO la información del CONTEXTO para responder lo concreto del alojamiento, la zona o las reservas. Si no aparece, di que no lo sabes y ofrece contactar por WhatsApp (+34 676 34 46 75) o email (apartamentostiojosemaria@gmail.com).
- No inventes precios, fechas, distancias ni datos. Si el huésped pregunta por una reserva concreta, no la confirmes: solo da información general y redirige a la página de reservas.
- Nunca pidas datos personales (DNI, tarjeta, etc.). Si el huésped los ofrece, le dices que no debe compartirlos por chat y que en la web hay un formulario seguro.
- Si la pregunta no tiene nada que ver con el alojamiento o la zona, responde con educación y devuelves a temas útiles (rutas, gastronomía, cómo llegar, qué hacer en Hinojares).
- Nunca te identifiques como humano. Si te preguntan si eres una IA, lo confirmas con naturalidad.`;

const sha256Hex = async (s: string) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

const countryFromHeaders = (req: Request): string | null => {
    // Cloudflare, Vercel y Supabase pasan country en headers distintos. Probamos varios.
    return req.headers.get("cf-ipcountry")
        || req.headers.get("x-vercel-ip-country")
        || req.headers.get("x-country")
        || null;
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "method_not_allowed" }), {
            status: 405, headers: { ...CORS_HEADERS, "content-type": "application/json" },
        });
    }
    if (!AWS_KEY || !AWS_SECRET) {
        return new Response(JSON.stringify({ error: "bedrock_not_configured" }), {
            status: 503, headers: { ...CORS_HEADERS, "content-type": "application/json" },
        });
    }

    const start = Date.now();
    let payload: { sessionId?: string; message?: string; history?: ChatTurn[]; language?: string };
    try {
        payload = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" },
        });
    }
    const sessionId = (payload.sessionId || "").trim();
    const userMessage = (payload.message || "").trim();
    const history = Array.isArray(payload.history) ? payload.history.slice(-10) : [];
    const language = payload.language || "es";

    if (!sessionId || sessionId.length < 8 || sessionId.length > 64) {
        return new Response(JSON.stringify({ error: "invalid_session_id" }), {
            status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" },
        });
    }
    if (!userMessage || userMessage.length > 2000) {
        return new Response(JSON.stringify({ error: "invalid_message" }), {
            status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" },
        });
    }

    // ---- Rate limit por sessionId (turnos/dia) ----
    const { count: turnsToday } = await supabase
        .from("ai_interaction_logs")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());

    if ((turnsToday ?? 0) >= RATE_LIMIT) {
        return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
            status: 429, headers: { ...CORS_HEADERS, "content-type": "application/json" },
        });
    }

    const creds = { accessKeyId: AWS_KEY, secretAccessKey: AWS_SECRET, sessionToken: AWS_SESSION };
    const sources: Array<{ chunk_id: string; title: string; source_type: string; similarity: number }> = [];
    let aiText = "";
    let tokensIn = 0, tokensOut = 0;
    let errorMsg: string | null = null;

    try {
        // 1. Embed de la pregunta
        const { embedding } = await embedText(userMessage, creds);

        // 2. Búsqueda top-K en kb_chunks (HNSW, similitud coseno)
        const { data: matches, error: searchErr } = await supabase.rpc("search_kb_chunks", {
            query_embedding: embedding,
            match_threshold: 0.25,
            match_count: 6,
            lang: language,
        });
        if (searchErr) throw new Error(`search_kb_chunks: ${searchErr.message}`);

        const chunks = (matches || []) as Array<{ id: string; title: string; content: string; source_type: string; similarity: number }>;
        chunks.forEach(c => sources.push({ chunk_id: c.id, title: c.title, source_type: c.source_type, similarity: c.similarity }));

        const context = chunks.length === 0
            ? "(no hay información específica indexada para esta consulta)"
            : chunks.map((c, i) => `[${i + 1}] ${c.title}\n${c.content}`).join("\n\n---\n\n");

        // 3. Claude con system prompt + contexto + historial
        const systemWithContext = `${SYSTEM_PROMPT_ES}\n\n--- CONTEXTO ---\n${context}\n--- FIN CONTEXTO ---`;

        const { text, tokensIn: tIn, tokensOut: tOut } = await chat({
            creds,
            system: systemWithContext,
            messages: [...history, { role: "user", content: userMessage }],
            maxTokens: 512,
            temperature: 0.4,
        });
        aiText = text;
        tokensIn = tIn;
        tokensOut = tOut;
    } catch (e) {
        errorMsg = e instanceof Error ? e.message : String(e);
        aiText = "Lo siento, ha habido un problema técnico. Vuelve a intentarlo en un momento o escríbenos por WhatsApp al +34 676 34 46 75.";
    }

    // ---- Logging anonimizado ----
    const ua = req.headers.get("user-agent") || "";
    const uaHash = ua ? await sha256Hex(ua) : null;
    const country = countryFromHeaders(req);

    const { count: turnIndexCount } = await supabase
        .from("ai_interaction_logs")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId);

    await supabase.from("ai_interaction_logs").insert({
        session_id: sessionId,
        turn_index: turnIndexCount ?? 0,
        user_message: userMessage,
        ai_response: aiText,
        model: "eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
        model_provider: "bedrock-eu-central-1",
        tokens_input: tokensIn || null,
        tokens_output: tokensOut || null,
        latency_ms: Date.now() - start,
        sources_used: sources,
        language,
        request_ip_country: country,
        user_agent_hash: uaHash,
        error: errorMsg,
    });

    return new Response(JSON.stringify({
        reply: aiText,
        sources: sources.map(s => ({ title: s.title, source_type: s.source_type })),
        sessionId,
    }), {
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
});

// parte-gerente · the door between TJM and its manager agent (fase 2, 16-oct-2026).
//
// The manager runs on the agents' VPS (Hermes' office). It never touches the database: it
// asks here. Two things only, behind a token that lives in this function's secrets
// (GERENTE_TOKEN) and in /etc/oficina on the VPS:
//   GET                                -> the business report (tjm_parte_gerente(): numbers and
//                                         booking codes, no guest names or contacts)
//   POST {accion:"avisar-familia", titulo, texto}
//                                      -> a notice to the family's phones (tjm_notificar_push),
//                                         at most 3 a day, logged in `envios`. Never to a guest.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TOKEN = Deno.env.get("GERENTE_TOKEN") ?? "";
const MAX_AVISOS_DIA = 3;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function iguales(a: string, b: string): boolean {
    if (!a || !b || a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

Deno.serve(async (req) => {
    const llave = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!TOKEN || !iguales(llave, TOKEN)) return json(401, { error: "no_autorizado" });

    if (req.method === "GET") {
        // fresh problems, not the hourly snapshot (0065)
        await sb.rpc("tjm_revisar");
        const { data, error } = await sb.rpc("tjm_parte_gerente");
        if (error) return json(500, { error: "fallo_interno", mensaje: error.message });
        return json(200, data);
    }

    if (req.method !== "POST") return json(405, { error: "metodo_no_permitido" });
    let cuerpo: Record<string, unknown> = {};
    try { cuerpo = await req.json(); } catch { /* empty body */ }
    if (cuerpo.accion !== "avisar-familia") return json(400, { error: "accion_desconocida" });

    const titulo = String(cuerpo.titulo ?? "").trim().slice(0, 80);
    const texto = String(cuerpo.texto ?? "").trim().slice(0, 600);
    if (titulo.length < 5 || texto.length < 5) return json(400, { error: "aviso_incompleto" });

    const { count } = await sb.from("envios").select("id", { count: "exact", head: true })
        .eq("tipo", "aviso-gerente").gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    if ((count ?? 0) >= MAX_AVISOS_DIA) return json(429, { error: "tope_diario", mensaje: `Ya van ${count} avisos del gerente en 24 h.` });

    const { error } = await sb.rpc("tjm_notificar_push", { p_titulo: titulo, p_texto: texto, p_url: "/panel" });
    await sb.from("envios").insert({
        canal: "push", tipo: "aviso-gerente", destinatario: "familia", asunto: titulo,
        estado: error ? "error_api" : "enviado", detalle: error ? error.message : texto.slice(0, 300),
    });
    if (error) return json(500, { error: "fallo_aviso", mensaje: error.message });
    return json(200, { ok: true });
});

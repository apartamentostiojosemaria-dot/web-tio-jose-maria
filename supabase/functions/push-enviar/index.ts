// Edge function: push-enviar
// ==========================
// Manda un aviso Web Push a todos los móviles apuntados en push_subscriptions
// (los de Mari Carmen y Jesús). La llama la BASE (tjm_notificar_push, migración
// 0041) con la llave del cron; también vale la clave de servicio. Nadie más.
//
// POST { titulo, texto, url? }
//
// Las claves VAPID y la llave se leen de Vault al arrancar (tjm_secretos_push),
// como los secretos del MIR: una sola fuente, nada copiado a mano. Si una
// suscripción ya no vale (410/404: el móvil quitó el permiso o reinstaló), se
// marca failed_at y no se vuelve a intentar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let secretos: { push_vapid_public?: string; push_vapid_private?: string; ses_cron_token?: string } | null = null;
async function cargarSecretos() {
    if (secretos) return secretos;
    const { data, error } = await admin.rpc("tjm_secretos_push");
    if (error) throw new Error("vault: " + error.message);
    secretos = (data || {}) as typeof secretos;
    return secretos!;
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    const s = await cargarSecretos();
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const rolDelJwt = (t: string) => { try { return (JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string }).role ?? null; } catch { return null; } };
    const autorizado = !!token && (token === SUPABASE_SERVICE_ROLE_KEY || rolDelJwt(token) === "service_role" || (!!s.ses_cron_token && token === s.ses_cron_token));
    if (!autorizado) return json(401, { error: "no_autorizado" });
    if (!s.push_vapid_public || !s.push_vapid_private) return json(503, { error: "faltan_claves_vapid" });

    let body: { titulo?: string; texto?: string; url?: string } = {};
    try { body = await req.json(); } catch { /* vacío */ }
    const titulo = String(body.titulo || "").trim().slice(0, 80);
    const texto = String(body.texto || "").trim().slice(0, 240);
    const url = String(body.url || "/panel").trim();
    if (!titulo) return json(400, { error: "falta_titulo" });

    webpush.setVapidDetails("mailto:apartamentostiojosemaria@gmail.com", s.push_vapid_public, s.push_vapid_private);

    const { data: subs, error } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .is("failed_at", null);
    if (error) return json(500, { error: error.message });

    const payload = JSON.stringify({ titulo, texto, url });
    let enviados = 0, caidos = 0;
    for (const sub of subs ?? []) {
        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
                { TTL: 60 * 60 * 6, urgency: "high" },
            );
            enviados++;
            await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", sub.id);
        } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            const motivo = `${status ?? ""} ${(e as Error).message ?? ""}`.trim().slice(0, 200);
            if (status === 404 || status === 410) {
                caidos++;
                await admin.from("push_subscriptions").update({ failed_at: new Date().toISOString(), fail_reason: motivo }).eq("id", sub.id);
            } else {
                console.error("push:", sub.id, motivo);
            }
        }
    }
    // Registro (migración 0043): el panel enseña qué avisos salieron y a cuántos móviles.
    await admin.from("envios").insert({
        canal: "push", tipo: "aviso", asunto: titulo, destinatario: `${enviados} móvil(es)`,
        estado: (subs?.length ?? 0) > 0 && enviados === 0 ? "fallido" : "entregado",
        detalle: `${enviados} entregados · ${caidos} dados de baja · ${subs?.length ?? 0} apuntados` + (texto ? ` — ${texto.slice(0, 160)}` : ""),
    });
    return json(200, { ok: true, enviados, caidos, total: subs?.length ?? 0 });
});

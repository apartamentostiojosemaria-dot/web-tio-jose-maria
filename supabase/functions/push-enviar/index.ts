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

    let body: { titulo?: string; texto?: string; url?: string; soloSuscripcion?: number } = {};
    try { body = await req.json(); } catch { /* vacío */ }
    // 5-nov-2026: se cortaba a media palabra («…de la reserva de Booking TJM-9F0»). Ahora por palabras y con «…».
    const recortar = (t: string, max: number) => {
        const s = t.replace(/\s+/g, " ").trim();
        if (s.length <= max) return s;
        const corte = s.slice(0, max - 1);
        const ultimo = corte.lastIndexOf(" ");
        return (ultimo > max * 0.6 ? corte.slice(0, ultimo) : corte).replace(/[\s,.;:·—-]+$/, "") + "…";
    };
    const titulo = recortar(String(body.titulo || ""), 80);
    const texto = recortar(String(body.texto || ""), 240);
    let url = String(body.url || "/panel").trim();
    if (!titulo) return json(400, { error: "falta_titulo" });

    // Si el aviso habla de una reserva (código TJM-XXXXXX) y no dice adónde ir, al pulsarlo se abre esa
    // reserva y no el panel en general (avisos del Ministerio y del gerente).
    if (url === "/panel" || url === "") {
        const codigo = `${titulo} ${texto}`.match(/TJM-[A-Za-z0-9]{6}/)?.[0];
        if (codigo) {
            const { data: r } = await admin.from("guest_bookings").select("id").eq("booking_code", codigo.toUpperCase()).maybeSingle();
            if (r?.id) url = `/panel?s=reserva&p=${encodeURIComponent(JSON.stringify({ reservaId: r.id }))}`;
        }
    }

    webpush.setVapidDetails("mailto:apartamentostiojosemaria@gmail.com", s.push_vapid_public, s.push_vapid_private);

    // `soloSuscripcion` (5-nov-2026): para probar un aviso en un solo móvil sin molestar a la familia.
    const solo = Number((body as { soloSuscripcion?: number }).soloSuscripcion || 0);
    let consulta = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").is("failed_at", null);
    if (solo > 0) consulta = consulta.eq("id", solo);
    const { data: subs, error } = await consulta;
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

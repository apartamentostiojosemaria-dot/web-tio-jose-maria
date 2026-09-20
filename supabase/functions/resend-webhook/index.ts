// Edge function: resend-webhook
// ============================
// Dos cosas, en una puerta:
//
//   POST /resend-webhook                → lo llama RESEND con cada evento de
//        correo (sent, delivered, delivery_delayed, bounced, complained,
//        failed). Firma Svix comprobada con RESEND_WEBHOOK_SECRET. Cada
//        evento va a `tjm_registrar_evento_correo` (migración 0043), que
//        mantiene la fila de `envios` y avisa si un correo no llega.
//
//   POST /resend-webhook?accion=vigilar → lo llama el cron `tjm-vigilar-correo`
//        (07:30 UTC) con la llave del sistema, o el panel de Jesús. Comprueba:
//          · el estado del dominio en Resend (GET /domains),
//          · que el TXT resend._domainkey resuelve en DNS (DoH de Google),
//          · cuántos correos han fallado en 24 h.
//        Guarda el resultado en `salud_correo`; si algo está mal, la base
//        avisa al móvil y abre una tarea en el panel.
//
// Por qué existe: el 20-sep-2026 el DKIM desapareció del DNS de Hostinger,
// Resend marcó «Failed» todo lo que salía y la API seguía contestando 200 con
// un id. Nadie lo habría visto sin entrar en resend.com.
//
// Se despliega con verify_jwt = false: Resend no manda JWT. La seguridad es
// la firma Svix (webhook) y la comparación exacta con la llave del cron
// (vigilar), leída de Vault con la clave de servicio.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DOMINIO = "tiojosemaria.com";
const ENDPOINT = `${SUPABASE_URL}/functions/v1/resend-webhook`;
const EVENTOS = ["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.complained", "email.failed"];

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// La firma del webhook: el secreto de entorno si existe; si no, Vault
// (`resend_webhook_secret`, que deja `alta-webhook`). Una vez por arranque.
let WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
async function cargarFirma(): Promise<string> {
    if (WEBHOOK_SECRET) return WEBHOOK_SECRET;
    const { data } = await sb.rpc("tjm_secreto_vault", { p_nombre: "resend_webhook_secret" });
    WEBHOOK_SECRET = typeof data === "string" ? data.trim() : "";
    return WEBHOOK_SECRET;
}
const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// ---------------------------------------------------------------------------
// Firma Svix (la que usa Resend): HMAC-SHA256 de "<id>.<timestamp>.<cuerpo>"
// con el secreto (base64 tras "whsec_"). La cabecera trae "v1,<firma>" y puede
// traer varias separadas por espacio.
// ---------------------------------------------------------------------------
async function firmaValida(req: Request, cuerpo: string): Promise<boolean> {
    if (!(await cargarFirma())) return false;
    const id = req.headers.get("svix-id") ?? "";
    const ts = req.headers.get("svix-timestamp") ?? "";
    const firmas = req.headers.get("svix-signature") ?? "";
    if (!id || !ts || !firmas) return false;
    // Cinco minutos de tolerancia contra repeticiones.
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

    const secreto = Uint8Array.from(atob(WEBHOOK_SECRET.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
    const clave = await crypto.subtle.importKey("raw", secreto, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(`${id}.${ts}.${cuerpo}`));
    const esperada = btoa(String.fromCharCode(...new Uint8Array(firma)));
    return firmas.split(" ").some((f) => f.split(",")[1] === esperada);
}

// ---------------------------------------------------------------------------
// Vigilar: dominio + DNS + fallos
// ---------------------------------------------------------------------------
async function estadoDominioEnResend(): Promise<{ estado: string | null; detalle: unknown }> {
    if (!RESEND_API_KEY) return { estado: null, detalle: "sin RESEND_API_KEY" };
    try {
        const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
        if (!r.ok) return { estado: null, detalle: `resend ${r.status}` };
        const lista = (await r.json()) as { data?: Array<{ name: string; status: string; id: string }> };
        const d = (lista.data ?? []).find((x) => x.name === DOMINIO);
        return { estado: d?.status ?? "no_encontrado", detalle: d ?? null };
    } catch (e) {
        return { estado: null, detalle: e instanceof Error ? e.message : String(e) };
    }
}

async function dkimEnDns(): Promise<{ ok: boolean; detalle: string }> {
    try {
        const r = await fetch(`https://dns.google/resolve?name=resend._domainkey.${DOMINIO}&type=TXT`, { headers: { accept: "application/dns-json" } });
        const d = (await r.json()) as { Status: number; Answer?: Array<{ data: string }> };
        const txt = (d.Answer ?? []).map((a) => a.data).join(" ");
        const ok = /p=MIG/.test(txt);
        return { ok, detalle: ok ? "resend._domainkey resuelve" : `sin respuesta (Status ${d.Status})` };
    } catch (e) {
        return { ok: false, detalle: e instanceof Error ? e.message : String(e) };
    }
}

async function vigilar() {
    const [dominio, dkim] = await Promise.all([estadoDominioEnResend(), dkimEnDns()]);
    const { count } = await sb.from("envios").select("id", { count: "exact", head: true })
        .in("estado", ["rebotado", "queja", "fallido", "error_api"])
        .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    const fallidos = count ?? 0;
    // Está bien si el dominio está verificado, el DKIM resuelve y no hay
    // fallos. Si Resend no contesta (estado null) no se da por malo: se
    // anota y se mira el DNS, que es lo que de verdad se rompió.
    const ok = (dominio.estado === "verified" || dominio.estado === null) && dkim.ok && fallidos === 0;
    const detalle = { dominio: dominio.detalle, dkim: dkim.detalle, fallidos_24h: fallidos };
    const { error } = await sb.rpc("tjm_anotar_salud_correo", {
        p_ok: ok, p_dominio: dominio.estado, p_dkim: dkim.ok, p_fallidos: fallidos, p_detalle: detalle,
    });
    return { ok, dominio: dominio.estado, dkim: dkim.ok, fallidos_24h: fallidos, detalle, guardado: !error, error: error?.message };
}

// ---------------------------------------------------------------------------
// Alta del webhook en Resend, por API. La firma que devuelve va al Vault y
// nunca sale de aquí. Idempotente: si ya hay uno con este endpoint, se deja.
// ---------------------------------------------------------------------------
async function altaWebhook() {
    if (!RESEND_API_KEY) return { ok: false, error: "sin RESEND_API_KEY" };
    const cab = { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" };
    const lista = await fetch("https://api.resend.com/webhooks", { headers: cab });
    if (lista.ok) {
        const l = (await lista.json()) as { data?: Array<{ id: string; endpoint: string; status?: string; events?: string[] }> };
        const ya = (l.data ?? []).find((w) => w.endpoint === ENDPOINT);
        if (ya) return { ok: true, ya_existia: true, id: ya.id, endpoint: ENDPOINT, estado: ya.status, eventos: ya.events, firma_en_vault: !!(await cargarFirma()) };
    }
    const r = await fetch("https://api.resend.com/webhooks", { method: "POST", headers: cab, body: JSON.stringify({ endpoint: ENDPOINT, events: EVENTOS }) });
    const cuerpo = await r.text();
    if (!r.ok) return { ok: false, error: `resend ${r.status}: ${cuerpo.slice(0, 300)}` };
    const creado = JSON.parse(cuerpo) as { id?: string; signing_secret?: string };
    let firmaGuardada = false;
    if (creado.signing_secret) {
        const { error } = await sb.rpc("tjm_guardar_secreto_vault", {
            p_nombre: "resend_webhook_secret", p_valor: creado.signing_secret,
            p_nota: "Firma (Svix) del webhook de Resend → resend-webhook. La dio de alta la propia función el " + new Date().toISOString().slice(0, 10),
        });
        firmaGuardada = !error;
        if (!error) WEBHOOK_SECRET = creado.signing_secret;
    }
    return { ok: firmaGuardada, id: creado.id, endpoint: ENDPOINT, eventos: EVENTOS, firma_en_vault: firmaGuardada };
}

// ---------------------------------------------------------------------------
// Puerta
// ---------------------------------------------------------------------------
let LLAVE_CRON: string | null = null;
async function llaveCron(): Promise<string> {
    if (LLAVE_CRON !== null) return LLAVE_CRON;
    const { data } = await sb.rpc("tjm_llave_cron");
    LLAVE_CRON = typeof data === "string" ? data : "";
    return LLAVE_CRON;
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return json(405, { error: "metodo_no_permitido" });
    const url = new URL(req.url);
    const accion = url.searchParams.get("accion");

    // ---- Vigilancia (cron o panel) y alta del webhook -----------------------
    if (accion === "vigilar" || accion === "alta-webhook") {
        const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        let autorizado = !!token && (token === SERVICE_KEY || token === (await llaveCron()));
        if (!autorizado && token) {
            // Desde el panel: sesión de quien gestiona.
            const { data } = await createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
                global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false },
            }).rpc("tjm_puede_gestionar");
            autorizado = data === true;
        }
        if (!autorizado) return json(401, { error: "no_autorizado" });
        return json(200, accion === "vigilar" ? await vigilar() : await altaWebhook());
    }

    // ---- Webhook de Resend ---------------------------------------------------
    const cuerpo = await req.text();
    if (!(await firmaValida(req, cuerpo))) return json(401, { error: "firma_no_valida" });

    let evento: { type?: string; created_at?: string; data?: Record<string, unknown> } = {};
    try { evento = JSON.parse(cuerpo); } catch { return json(400, { error: "json_no_valido" }); }

    const d = evento.data ?? {};
    const para = Array.isArray(d.to) ? (d.to as string[]).join(", ") : String(d.to ?? "");
    // El motivo, si lo hay: bounce.message / failed.reason, según el evento.
    const bounce = d.bounce as { message?: string; type?: string; subType?: string } | undefined;
    const failed = d.failed as { reason?: string } | undefined;
    const detalle = failed?.reason ?? (bounce ? [bounce.type, bounce.subType, bounce.message].filter(Boolean).join(" · ") : null);

    const { data, error } = await sb.rpc("tjm_registrar_evento_correo", {
        p_proveedor_id: String(d.email_id ?? ""),
        p_tipo: String(evento.type ?? ""),
        p_destinatario: para,
        p_asunto: String(d.subject ?? ""),
        p_detalle: detalle ? String(detalle).slice(0, 500) : null,
        p_cuando: evento.created_at ?? new Date().toISOString(),
    });
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true, estado: data });
});

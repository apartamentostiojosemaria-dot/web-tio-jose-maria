// Edge function: beds24-sync
// ==========================
// Tubería TJM <-> Beds24 (migración 0077). TJM es la verdad; Beds24 solo lleva los portales.
//
// Modos (POST JSON, todo opcional):
//   { "mode": "push", "apartmentId": 1 }  -> manda a Beds24 la disponibilidad de ese apartamento
//   { "mode": "pull" }                    -> lee las reservas de Beds24 cambiadas desde el cursor
//   { "mode": "all" }                     -> pull + push de todos (lo usa el cron cada 10 min)
//   { "dryRun": true }                    -> calcula y devuelve, no escribe ni manda nada
// Llave (0078): el disparador y el repaso mandan `Authorization: Bearer <beds24_cron_token de Vault>`.
// Sin llave solo se acepta el aviso de Beds24: NO nos fiamos de lo que traiga; dispara una
// relectura de reservas (pull) como mucho cada 30 s y responde {ok} sin detalles.
// Si fallan dos pasadas seguidas: correo al operador (una vez cada 6 h, channel_alerts 'beds24').
//
// Disponibilidad: noche ocupada = reserva hold/pending/confirmed en [check_in, check_out)
// o bloqueo en [start_date, end_date] (mismas reglas que ical-export). Se excluye lo que vino de
// Beds24 (external_uid 'beds24:%'), que Beds24 ya conoce. Se manda numAvail 0/1 por tramos.
//
// Reservas de Beds24: se guardan en `beds24_bookings` (espejo). Con `promover_reservas` = false
// (por defecto) no tocan guest_bookings: ni panel, ni correos, ni Ministerio.
//
// Secreto: BEDS24_REFRESH_TOKEN (secretos de la función). Nunca en el repo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REFRESH = Deno.env.get("BEDS24_REFRESH_TOKEN") || "";
const API = "https://api.beds24.com/v2";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let tokenCache: { token: string; hasta: number } | null = null;
let creditos = 0;

// El token de acceso dura 24 h y pedirlo gasta créditos: se guarda en Vault (`beds24_access_token`,
// formato "<caduca_ms>|<token>") y se reutiliza entre llamadas (0079).
async function token(): Promise<string> {
    if (tokenCache && tokenCache.hasta > Date.now()) return tokenCache.token;
    const { data: guardado } = await db.rpc("tjm_secreto_vault", { p_nombre: "beds24_access_token" });
    if (typeof guardado === "string" && guardado.includes("|")) {
        const [hasta, t] = [Number(guardado.split("|")[0]), guardado.slice(guardado.indexOf("|") + 1)];
        if (hasta > Date.now() && t) { tokenCache = { token: t, hasta }; return t; }
    }
    const r = await fetch(`${API}/authentication/token`, { headers: { refreshToken: REFRESH } });
    if (!r.ok) throw new Error(`token ${r.status}`);
    const j = await r.json();
    tokenCache = { token: j.token, hasta: Date.now() + (Number(j.expiresIn || 3600) - 600) * 1000 };
    await db.rpc("tjm_guardar_secreto_vault", {
        p_nombre: "beds24_access_token", p_valor: `${tokenCache.hasta}|${j.token}`,
        p_nota: "Token de acceso de Beds24 (24 h), lo renueva beds24-sync. Migración 0079.",
    });
    return j.token;
}

async function b24(method: string, path: string, body?: unknown, reintento = false): Promise<any> {
    const r = await fetch(`${API}${path}`, {
        method,
        headers: { token: await token(), accept: "application/json", "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 401 && !reintento) {  // token guardado caducado o revocado: se pide otro una vez
        tokenCache = null;
        await db.rpc("tjm_guardar_secreto_vault", { p_nombre: "beds24_access_token", p_valor: "", p_nota: "" });
        return b24(method, path, body, true);
    }
    creditos += Number(r.headers.get("x-request-cost") || 0);
    const text = await r.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* texto */ }
    if (!r.ok) throw new Error(`${method} ${path.split("?")[0]} ${r.status}: ${String(text).slice(0, 300)}`);
    return data;
}

async function config(): Promise<Record<string, any>> {
    const { data, error } = await db.from("beds24_config").select("clave, valor");
    if (error) throw new Error("config: " + error.message);
    return Object.fromEntries((data || []).map((r) => [r.clave, r.valor]));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const masDias = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

// ---------- TJM -> Beds24 ----------
async function calcularDisponibilidad(aptIds: number[], dias: number) {
    const hoy = iso(new Date());
    const fin = masDias(hoy, dias - 1);
    const ocupado = new Map<number, Set<string>>(aptIds.map((a) => [a, new Set()]));
    const marcar = (apt: number, desde: string, hastaIncl: string) => {
        let d = desde < hoy ? hoy : desde;
        const h = hastaIncl > fin ? fin : hastaIncl;
        while (d <= h) { ocupado.get(apt)?.add(d); d = masDias(d, 1); }
    };
    const { data: res, error: e1 } = await db.from("guest_bookings")
        .select("apartment_id, check_in, check_out, status, external_uid")
        .in("apartment_id", aptIds).in("status", ["hold", "pending", "confirmed"]).gt("check_out", hoy);
    if (e1) throw new Error("reservas: " + e1.message);
    for (const b of res || []) {
        if (String(b.external_uid || "").startsWith("beds24:")) continue;
        marcar(b.apartment_id, b.check_in, masDias(b.check_out, -1));
    }
    const { data: blq, error: e2 } = await db.from("blocked_dates")
        .select("apartment_id, start_date, end_date, external_uid")
        .in("apartment_id", aptIds).gte("end_date", hoy);
    if (e2) throw new Error("bloqueos: " + e2.message);
    for (const b of blq || []) {
        if (String(b.external_uid || "").startsWith("beds24:")) continue;
        marcar(b.apartment_id, b.start_date, b.end_date);
    }
    // Tramos consecutivos con el mismo valor
    const tramos = new Map<number, { from: string; to: string; numAvail: number }[]>();
    for (const apt of aptIds) {
        const lista: { from: string; to: string; numAvail: number }[] = [];
        let d = hoy;
        while (d <= fin) {
            const v = ocupado.get(apt)!.has(d) ? 0 : 1;
            const ult = lista[lista.length - 1];
            if (ult && ult.numAvail === v && masDias(ult.to, 1) === d) ult.to = d;
            else lista.push({ from: d, to: d, numAvail: v });
            d = masDias(d, 1);
        }
        tramos.set(apt, lista);
    }
    return { tramos, noches: Object.fromEntries([...ocupado].map(([a, s]) => [a, s.size])) };
}

async function push(aptIds: number[] | null, cfg: Record<string, any>, dryRun: boolean) {
    let q = db.from("apartments").select("id, name, beds24_room_id").not("beds24_room_id", "is", null);
    if (aptIds) q = q.in("id", aptIds.length ? aptIds : [-1]);
    const { data: apts, error } = await q;
    if (error) throw new Error("apartamentos: " + error.message);
    if (!apts?.length) return { enviados: 0, nota: "sin apartamentos enlazados" };
    const { tramos, noches } = await calcularDisponibilidad(apts.map((a) => a.id), Number(cfg.dias_adelante || 730));
    const cuerpo = apts.map((a) => ({ roomId: a.beds24_room_id, calendar: tramos.get(a.id) }));
    if (!dryRun && cfg.envio_activo !== false) {
        const r = await b24("POST", "/inventory/rooms/calendar", cuerpo);
        // Beds24 puede contestar 200 con fallos dentro (una habitación que no existe, una fecha mala)
        const malos = (Array.isArray(r) ? r : [r]).filter((x: any) => x && x.success === false);
        if (malos.length) throw new Error("Beds24 rechazó parte del envío: " + JSON.stringify(malos).slice(0, 300));
    }
    return { enviados: cuerpo.reduce((n, r) => n + (r.calendar?.length || 0), 0), nochesOcupadas: noches, dryRun };
}

// ---------- Cuadre (5-nov-2026): se comprueba el RESULTADO, no solo que el envío saliera ----------
// Lee lo que Beds24 tiene de verdad y lo compara noche a noche con lo nuestro (próximos 365 días).
//   peligro    = cerrada en TJM y abierta en Beds24 -> riesgo de vender dos veces (aviso alto).
//   sin_precio = noche sin precio en Beds24 -> Beds24 la cierra sola: venta perdida (aviso medio).
//   de_mas     = abierta en TJM y cerrada en Beds24 por otro motivo (informativo).
async function cuadre() {
    const { data: apts } = await db.from("apartments").select("id, name, beds24_room_id").not("beds24_room_id", "is", null);
    if (!apts?.length) return { comparadas: 0 };
    const { tramos } = await calcularDisponibilidad(apts.map((a) => a.id), 365);
    const hoy = iso(new Date()); const fin = masDias(hoy, 364);
    const r = await b24("GET", `/inventory/rooms/calendar?${new URLSearchParams({
        propertyId: String((await config()).property_id || 366113), startDate: hoy, endDate: fin,
        includeNumAvail: "true", includePrices: "true" })}`);
    const nuestro = new Map<string, number>();
    for (const a of apts) for (const t of tramos.get(a.id) || []) {
        let d = t.from; while (d <= t.to) { nuestro.set(`${a.beds24_room_id}|${d}`, t.numAvail); d = masDias(d, 1); }
    }
    let comparadas = 0, peligro = 0, sinPrecio = 0, deMas = 0;
    const ejemplos: string[] = [];
    const nombre = new Map(apts.map((a) => [a.beds24_room_id, a.name]));
    for (const room of r.data || []) {
        for (const c of room.calendar || []) {
            let d = c.from;
            while (d <= c.to) {
                const n = nuestro.get(`${room.roomId}|${d}`);
                if (n !== undefined) {
                    comparadas++;
                    const suyo = Number(c.numAvail ?? 0);
                    if (n === 0 && suyo > 0) { peligro++; if (ejemplos.length < 8) ejemplos.push(`${nombre.get(room.roomId)} ${d}: cerrada aquí, abierta en Beds24`); }
                    else if (n === 1 && !c.price1) sinPrecio++;
                    else if (n === 1 && suyo === 0) deMas++;
                }
                d = masDias(d, 1);
            }
        }
    }
    return { comparadas, peligro, sin_precio: sinPrecio, de_mas: deMas, ejemplos };
}

// ---------- Beds24 -> TJM (espejo) ----------
async function pull(cfg: Record<string, any>, dryRun: boolean) {
    const ahora = new Date();
    const cursor: string | null = cfg.cursor_modificadas || null;
    // 5 min de solape: lo que entre dos veces se reescribe igual (idempotente por beds24_id)
    const desde = cursor ? new Date(new Date(cursor).getTime() - 5 * 60_000) : null;
    const params = new URLSearchParams({ propertyId: String(cfg.property_id || 366113), includeGuests: "true" });
    for (const s of ["confirmed", "request", "new", "cancelled", "black", "inquiry"]) params.append("status", s);
    if (desde) params.set("modifiedFrom", desde.toISOString().slice(0, 19));
    else params.set("departureFrom", iso(ahora));

    const { data: apts } = await db.from("apartments").select("id, beds24_room_id").not("beds24_room_id", "is", null);
    const aptDe = new Map((apts || []).map((a) => [a.beds24_room_id, a.id]));

    const filas: any[] = [];
    let path: string | null = `/bookings?${params}`;
    for (let i = 0; path && i < 20; i++) {
        const r = await b24("GET", path);
        for (const b of r.data || []) {
            const nombre = [b.firstName, b.lastName].filter(Boolean).join(" ").trim();
            filas.push({
                beds24_id: b.id, room_id: b.roomId, apartment_id: aptDe.get(b.roomId) ?? null,
                status: b.status, channel: b.channel ?? null, api_source: b.apiSource ?? null, referer: b.referer ?? null,
                arrival: b.arrival, departure: b.departure, guest_name: nombre || null,
                guest_email: b.email || null, guest_phone: b.mobile || b.phone || null,
                num_adult: b.numAdult ?? null, num_child: b.numChild ?? null, price: b.price ?? null,
                api_reference: b.apiReference || null, booking_time: b.bookingTime || null,
                modified_time: b.modifiedTime || null, raw: b, last_seen_at: ahora.toISOString(),
            });
        }
        const next = r.pages?.nextPageLink as string | null;
        path = next ? next.replace(/^https?:\/\/[^/]+\/v2/, "") : null;
    }
    if (!dryRun) {
        if (filas.length) {
            const { error } = await db.from("beds24_bookings").upsert(filas, { onConflict: "beds24_id" });
            if (error) throw new Error("espejo: " + error.message);
        }
        await db.from("beds24_config").upsert({ clave: "cursor_modificadas", valor: ahora.toISOString(), updated_at: ahora.toISOString() });
    }
    return { leidas: filas.length, promover: cfg.promover_reservas === true, ids: filas.map((f) => `${f.beds24_id}:${f.status}`) };
}

// ---------- Llave (0078) ----------
let llaveCache: string | null = null;
async function llave(): Promise<string> {
    if (llaveCache !== null) return llaveCache;
    const { data } = await db.rpc("tjm_secreto_vault", { p_nombre: "beds24_cron_token" });
    llaveCache = (data as string) || "";
    return llaveCache;
}
function rolDelJwt(t: string): string | null {
    try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null; } catch { return null; }
}

// ---------- Aviso de fallo (una vez cada 6 h, como el vigilante de canales) ----------
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Tío José María <reservas@tiojosemaria.com>";
const OPERATOR_EMAIL = Deno.env.get("OPERATOR_EMAIL") || "apartamentostiojosemaria@gmail.com";
async function avisarFallo(msg: string): Promise<string> {
    // Solo si la pasada anterior también falló: un tropiezo suelto de la red no es noticia.
    const { data: ult } = await db.from("beds24_sync_log").select("ok").order("id", { ascending: false }).limit(2);
    if (!ult || ult.length < 2 || ult.some((r) => r.ok)) return "primer_fallo";
    const { data: prev } = await db.from("channel_alerts").select("id, last_sent_at")
        .is("apartment_id", null).eq("channel", "beds24").eq("kind", "fallo").maybeSingle();
    if (prev?.last_sent_at && Date.now() - new Date(prev.last_sent_at).getTime() < 6 * 3600_000) return "silenciado";
    let via = "sin_via";
    if (RESEND_API_KEY) {
        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                from: RESEND_FROM, to: [OPERATOR_EMAIL],
                subject: "[TJM canales] La conexión con Beds24 está fallando",
                text: `Dos pasadas seguidas de la conexión con Beds24 han fallado.\n\nÚltimo error: ${msg}\n\n` +
                    `Mientras dure, lo que se reserve en la web no se cierra en los portales conectados a Beds24.\n` +
                    `Detalle: tabla beds24_sync_log de Supabase.`,
            }),
        });
        via = r.ok ? "correo" : `correo_error_${r.status}`;
    }
    const row = { apartment_id: null, channel: "beds24", kind: "fallo", last_sent_at: new Date().toISOString(), last_via: via };
    if (prev) await db.from("channel_alerts").update(row).eq("id", prev.id);
    else await db.from("channel_alerts").insert(row);
    return via;
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    if (!REFRESH) return json(500, { error: "falta BEDS24_REFRESH_TOKEN" });
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    // Con llave (base, repaso o service role) se obedece el cuerpo. Sin llave, solo el aviso de
    // Beds24: relectura de reservas (pull), como mucho cada 30 s, y respuesta sin detalles.
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const k = await llave();
    const autorizado = !!bearer && ((!!k && bearer === k) || bearer === SUPABASE_SERVICE_ROLE_KEY || rolDelJwt(bearer) === "service_role");

    const conocido = autorizado && ["push", "pull", "all", "cuadre"].includes(body?.mode);
    const modo: string = conocido ? body.mode : (autorizado ? "all" : "pull");
    const origen: string = autorizado ? (body?.origen || "manual") : "aviso-beds24";
    const dryRun = autorizado && body?.dryRun === true;
    const aptId = conocido && body.apartmentId ? Number(body.apartmentId) : null;

    creditos = 0;
    const inicio = new Date().toISOString();
    const detalle: Record<string, unknown> = {};
    try {
        if (!autorizado) {
            const { data: ult } = await db.from("beds24_sync_log").select("ran_at")
                .eq("origen", "aviso-beds24").order("id", { ascending: false }).limit(1);
            if (ult?.[0] && Date.now() - new Date(ult[0].ran_at).getTime() < 30_000) return json(202, { ok: true });
        }
        const cfg = await config();
        const cfgEnvioActivo = cfg.envio_activo !== false;
        if (modo === "cuadre") detalle.cuadre = await cuadre();   // solo comprobar, sin mandar nada
        if (modo === "pull" || modo === "all") detalle.pull = await pull(cfg, dryRun);
        if (modo === "push" && body?.pendientes === true && autorizado) {
            // Cola (0079): se manda todo lo pendiente y solo se borra lo que no ha cambiado desde que se leyó
            const { data: pend } = await db.from("beds24_pendientes").select("apartment_id, desde, intentos");
            if (!pend?.length) return json(200, { ok: true, modo, origen, nada: "sin pendientes" });
            try {
                detalle.push = await push(pend.map((p) => p.apartment_id), cfg, dryRun);
                if (!dryRun) for (const p of pend) {
                    await db.from("beds24_pendientes").delete().eq("apartment_id", p.apartment_id).lte("desde", p.desde);
                }
            } catch (e) {
                if (!dryRun) for (const p of pend) {
                    await db.from("beds24_pendientes").update({ intentos: ((p as any).intentos ?? 0) + 1 }).eq("apartment_id", p.apartment_id);
                }
                throw e;
            }
        } else if (modo === "push" || modo === "all") {
            detalle.push = await push(modo === "push" && aptId ? [aptId] : null, cfg, dryRun);
        }
        if (!dryRun && modo === "all" && autorizado) {
            // Una pasada completa correcta deja la cola al día
            await db.from("beds24_pendientes").delete().lte("desde", inicio);
            // y se comprueba que Beds24 tiene lo que le hemos mandado (lo vigila tjm_revisar)
            if (cfgEnvioActivo) detalle.cuadre = await cuadre();
        }
        if (!dryRun) {
            await db.from("beds24_sync_log").insert({
                modo, origen, ok: true, creditos,
                enviados: (detalle.push as any)?.enviados ?? 0, leidas: (detalle.pull as any)?.leidas ?? 0, detalle,
            });
        }
        return autorizado ? json(200, { ok: true, modo, origen, creditos, ...detalle }) : json(200, { ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        let aviso = "";
        if (!dryRun) {
            await db.from("beds24_sync_log").insert({ modo, origen, ok: false, error: msg, creditos, detalle });
            aviso = await avisarFallo(msg).catch((x) => `aviso_error: ${x}`);
        }
        return autorizado ? json(500, { ok: false, error: msg, aviso }) : json(500, { ok: false });
    }
});

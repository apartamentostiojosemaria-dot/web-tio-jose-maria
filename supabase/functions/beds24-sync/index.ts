// Edge function: beds24-sync
// ==========================
// Tubería TJM <-> Beds24 (migración 0077). TJM es la verdad; Beds24 solo lleva los portales.
//
// Modos (POST JSON, todo opcional):
//   { "mode": "push", "apartmentId": 1 }  -> manda a Beds24 la disponibilidad de ese apartamento
//   { "mode": "pull" }                    -> lee las reservas de Beds24 cambiadas desde el cursor
//   { "mode": "all" }                     -> pull + push de todos (lo usa el cron cada 10 min)
//   { "dryRun": true }                    -> calcula y devuelve, no escribe ni manda nada
// Cualquier otra llamada con cuerpo de reserva (el aviso de Beds24) se trata como "all": NO nos
// fiamos de lo que traiga; solo dispara una relectura por la API con nuestro token.
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

async function token(): Promise<string> {
    if (tokenCache && tokenCache.hasta > Date.now()) return tokenCache.token;
    const r = await fetch(`${API}/authentication/token`, { headers: { refreshToken: REFRESH } });
    if (!r.ok) throw new Error(`token ${r.status}`);
    const j = await r.json();
    tokenCache = { token: j.token, hasta: Date.now() + (Number(j.expiresIn || 3600) - 300) * 1000 };
    return j.token;
}

async function b24(method: string, path: string, body?: unknown) {
    const r = await fetch(`${API}${path}`, {
        method,
        headers: { token: await token(), accept: "application/json", "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
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

async function push(aptId: number | null, cfg: Record<string, any>, dryRun: boolean) {
    let q = db.from("apartments").select("id, name, beds24_room_id").not("beds24_room_id", "is", null);
    if (aptId) q = q.eq("id", aptId);
    const { data: apts, error } = await q;
    if (error) throw new Error("apartamentos: " + error.message);
    if (!apts?.length) return { enviados: 0, nota: "sin apartamentos enlazados" };
    const { tramos, noches } = await calcularDisponibilidad(apts.map((a) => a.id), Number(cfg.dias_adelante || 730));
    const cuerpo = apts.map((a) => ({ roomId: a.beds24_room_id, calendar: tramos.get(a.id) }));
    if (!dryRun && cfg.envio_activo !== false) await b24("POST", "/inventory/rooms/calendar", cuerpo);
    return { enviados: cuerpo.reduce((n, r) => n + (r.calendar?.length || 0), 0), nochesOcupadas: noches, dryRun };
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

Deno.serve(async (req) => {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    if (!REFRESH) return json(500, { error: "falta BEDS24_REFRESH_TOKEN" });
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const conocido = ["push", "pull", "all"].includes(body?.mode);
    const modo: string = conocido ? body.mode : "all";
    const origen: string = conocido ? (body.origen || "manual") : "aviso-beds24";
    const dryRun = body?.dryRun === true;
    const aptId = conocido && body.apartmentId ? Number(body.apartmentId) : null;

    creditos = 0;
    const detalle: Record<string, unknown> = {};
    try {
        // Freno: la URL es pública. Un aviso o una pasada completa como mucho cada 5 s.
        if (modo === "all" && origen !== "cron" && !dryRun) {
            const { data: ult } = await db.from("beds24_sync_log").select("ran_at")
                .eq("modo", "all").order("ran_at", { ascending: false }).limit(1);
            if (ult?.[0] && Date.now() - new Date(ult[0].ran_at).getTime() < 5_000) {
                return json(202, { ok: true, omitido: "pasada reciente (<5 s)" });
            }
        }
        const cfg = await config();
        if (modo === "pull" || modo === "all") detalle.pull = await pull(cfg, dryRun);
        if (modo === "push" || modo === "all") detalle.push = await push(modo === "push" ? aptId : null, cfg, dryRun);
        if (!dryRun) {
            await db.from("beds24_sync_log").insert({
                modo, origen, ok: true, creditos,
                enviados: (detalle.push as any)?.enviados ?? 0, leidas: (detalle.pull as any)?.leidas ?? 0, detalle,
            });
        }
        return json(200, { ok: true, modo, origen, creditos, ...detalle });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!dryRun) await db.from("beds24_sync_log").insert({ modo, origen, ok: false, error: msg, creditos, detalle });
        return json(500, { ok: false, error: msg });
    }
});

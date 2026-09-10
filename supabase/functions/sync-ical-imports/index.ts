// Edge function: sync-ical-imports
// =================================
// Lee las URL de calendario de los CUATRO canales (Airbnb, Booking,
// EscapadaRural, CasasRurales.net) en cada apartamento, descarga el feed y
// reconcilia lo que hay en la base.
//
// Qué hace con cada evento del canal:
//   · Si trae NOMBRE de huésped (Booking a veces; Airbnb nunca) -> crea una
//     RESERVA de verdad en `guest_bookings` con su canal, localizador,
//     nombre, fechas y status 'confirmed'.
//   · Si no trae nada -> crea el BLOQUEO en `blocked_dates`, como hasta hoy.
//   · Si el evento choca con una reserva PROPIA -> no se aplica a ciegas:
//     se anota en `channel_sync_conflicts` y se avisa. El bloqueo sí se crea
//     (bloquear es el lado seguro; lo que provoca overbooking es NO bloquear).
//   · Si el evento desaparece del feed -> el bloqueo se retira y la reserva
//     importada se marca 'cancelled'. Nunca se borra una reserva.
//
// IDEMPOTENCIA: la clave es el UID del VEVENT, guardado en
// `blocked_dates.external_uid` y `guest_bookings.external_uid`. Reejecutar el
// cron no duplica nada. Los bloqueos que ya existían sin UID (los 43 de
// Airbnb) se emparejan por fechas la primera vez y se les rellena el UID sin
// borrar ni reinsertar: no se toca ni una fila real.
//
// VIGILANCIA: cada pasada escribe su RESULTADO en `channel_sync_log` (una
// fila por apartamento y canal, con insertados/retirados/errores). Se registra
// el resultado, no que el proceso corriera: un canal que no se puede
// descargar deja fila con ok=false. Y `?mode=watch` evalúa la ausencia de
// sincronización y dispara aviso — pensado para colgarlo de pg_cron, que vive
// en otro sitio que el cron de Trigger.dev, para que la caída se autodenuncie.
//
// DEGRADACIÓN: si las columnas/tablas nuevas todavía no están aplicadas
// (`supabase/migrations/_pendiente_canales.sql`), la función NO falla: hace
// exactamente lo de antes (bloqueos) y lo dice en la respuesta.
//
// Body (POST, todo opcional):
//   { "dryRun": true }        -> calcula y devuelve el plan, no escribe nada
//   { "apartmentId": 1 }      -> limita a un apartamento
//   { "channels": ["booking"] }
//   { "feedOverride": { "1:booking": "BEGIN:VCALENDAR..." } }
//        -> usa ese texto en vez de descargar. SOLO con la service role key.
//   { "selftest": true }      -> ejercita el parser dentro del runtime
//
// Invocada cada 15 min por tjm-jobs `sync-ical-channels`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { addDays, extractGuestInfo, parseIcal } from "./parse.ts";
import { runSelfTest } from "./selftest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Tío José María <reservas@tiojosemaria.com>";
const OPERATOR_EMAIL = Deno.env.get("OPERATOR_EMAIL") || "apartamentostiojosemaria@gmail.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body, null, 2), {
        status,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });

// ---------------------------------------------------------------------------
// Canales. El orden es el que se ve en el panel.
// ---------------------------------------------------------------------------
const CHANNELS = [
    { key: "airbnb", column: "airbnb_ical_url", label: "Airbnb" },
    { key: "booking", column: "booking_ical_url", label: "Booking" },
    { key: "escapada", column: "escapada_ical_url", label: "Escapada Rural" },
    { key: "casasrurales", column: "casasrurales_ical_url", label: "CasasRurales.net" },
] as const;

type ChannelKey = typeof CHANNELS[number]["key"];
const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(
    CHANNELS.map((c) => [c.key, c.label]),
);
const ALL_CHANNEL_KEYS = CHANNELS.map((c) => c.key) as string[];

/** Sin correo del canal usamos un dominio reservado (RFC 2606): nunca sale
 *  un correo a una dirección inventada que parezca buena. */
const PLACEHOLDER_EMAIL = "sin-correo@example.invalid";

/** Marcas de email ya enviado. Se ponen a now() al crear una reserva de canal
 *  para que `send-booking-reminders` NO le escriba al huésped: la
 *  confirmación se la mandó el canal, y escribirle desde TJM es una decisión
 *  de negocio que nadie ha tomado. Para activarlo algún día basta con dejar
 *  estas columnas a NULL. */
const EMAIL_FLAGS = [
    "confirmation_email_sent_at",
    "reminder_7d_email_sent_at",
    "reminder_24h_email_sent_at",
    "arrival_email_sent_at",
    "departure_email_sent_at",
    "reactivation_email_sent_at",
];

interface ApartmentRow {
    id: number;
    slug: string;
    name: string;
    [k: string]: unknown;
}

interface Caps {
    blockUid: boolean;        // blocked_dates.external_uid
    bookingUid: boolean;      // guest_bookings.external_uid
    bookingChannel: boolean;  // guest_bookings.channel + external_locator
    syncLog: boolean;         // tabla channel_sync_log
    conflicts: boolean;       // tabla channel_sync_conflicts
    alertDedup: boolean;      // tabla channel_alerts
    extraUrlCols: boolean;    // apartments.escapada_ical_url / casasrurales_ical_url
}

// ---------------------------------------------------------------------------
// Sondeo de capacidades: qué hay aplicado en la base ahora mismo.
// Se hace una vez por invocación y decide en qué modo trabajamos.
// ---------------------------------------------------------------------------
async function probeCaps(): Promise<Caps> {
    const has = async (table: string, cols: string) => {
        const { error } = await supabase.from(table).select(cols).limit(1);
        return !error;
    };
    return {
        blockUid: await has("blocked_dates", "external_uid"),
        bookingUid: await has("guest_bookings", "external_uid"),
        bookingChannel: await has("guest_bookings", "channel, external_locator"),
        syncLog: await has("channel_sync_log", "id"),
        conflicts: await has("channel_sync_conflicts", "id"),
        alertDedup: await has("channel_alerts", "id"),
        extraUrlCols: await has("apartments", "escapada_ical_url, casasrurales_ical_url"),
    };
}

// ---------------------------------------------------------------------------
// Descarga del feed. Timeout corto: un canal colgado no puede bloquear al
// resto (un vigilante que se cuelga en silencio ocupa el sitio del que
// funcionaría).
// ---------------------------------------------------------------------------
async function fetchFeed(url: string): Promise<{ text?: string; error?: string }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": "TJM-iCal-Sync/2.0 (+https://tiojosemaria.com)" },
            redirect: "follow",
            signal: ctrl.signal,
        });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const text = await res.text();
        if (!/BEGIN:VCALENDAR/i.test(text)) {
            return { error: "la URL responde, pero no es un calendario iCal" };
        }
        return { text };
    } catch (e) {
        const msg = (e as Error).name === "AbortError"
            ? "la URL no respondió en 20 segundos"
            : (e as Error).message;
        return { error: msg };
    } finally {
        clearTimeout(timer);
    }
}

/** Código de reserva determinista a partir del UID: reejecutar da el mismo. */
async function bookingCodeFromUid(uid: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(uid));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return `TJM-${hex.slice(0, 6).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Avisos. Primero la tabla `alertas` (la crea otro agente); si no existe o el
// esquema no cuadra, correo al operador con Resend, como hace notify-booking.
// Lo que detecta y no empuja a ningún sitio es decoración.
// ---------------------------------------------------------------------------
async function pushAlert(titulo: string, mensaje: string): Promise<string> {
    const intentos: Record<string, unknown>[] = [
        { tipo: "canal_ical", severidad: "alta", titulo, mensaje, origen: "sync-ical-imports" },
        { type: "canal_ical", severity: "high", title: titulo, message: mensaje, source: "sync-ical-imports" },
    ];
    for (const payload of intentos) {
        const { error } = await supabase.from("alertas").insert(payload);
        if (!error) return "alertas";
    }

    if (!RESEND_API_KEY) return "sin_via";
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                from: RESEND_FROM,
                to: [OPERATOR_EMAIL],
                subject: `[TJM canales] ${titulo}`,
                html: `<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6">${
                    mensaje.replace(/\n/g, "<br>")
                }</p><p style="font-size:12px;color:#888">Aviso automático de la sincronización de canales de Apartamentos Tío José María.</p>`,
            }),
        });
        return res.ok ? "email" : `email_fallo_${res.status}`;
    } catch {
        return "email_error";
    }
}

/** No repetir el mismo aviso cada 15 minutos. Sin la tabla de dedupe no se
 *  manda: mejor callado que convertirse en ruido que se acaba ignorando. */
async function alertOnce(
    caps: Caps, apartmentId: number, channel: string, kind: string,
    horas: number, titulo: string, mensaje: string,
): Promise<string> {
    if (!caps.alertDedup) return "sin_dedupe_no_enviado";

    const { data: prev } = await supabase
        .from("channel_alerts")
        .select("id, last_sent_at")
        .eq("apartment_id", apartmentId).eq("channel", channel).eq("kind", kind)
        .maybeSingle();

    const corte = Date.now() - horas * 3600_000;
    if (prev?.last_sent_at && new Date(prev.last_sent_at).getTime() > corte) return "silenciado";

    const via = await pushAlert(titulo, mensaje);
    const row = { apartment_id: apartmentId, channel, kind, last_sent_at: new Date().toISOString(), last_via: via };
    if (prev) await supabase.from("channel_alerts").update(row).eq("id", prev.id);
    else await supabase.from("channel_alerts").insert(row);
    return via;
}

// ---------------------------------------------------------------------------
// Sincronización de un (apartamento, canal)
// ---------------------------------------------------------------------------
interface SyncOutcome {
    channel: string;
    ok: boolean;
    fetched: boolean;
    events_parsed: number;
    blocks_inserted: number;
    blocks_removed: number;
    blocks_uid_backfilled: number;
    bookings_created: number;
    bookings_updated: number;
    bookings_cancelled: number;
    conflicts: number;
    conflict_detail: string[];
    error_message: string | null;
    duration_ms: number;
}

async function syncOne(
    apt: ApartmentRow, channel: ChannelKey, url: string, caps: Caps,
    opts: { dryRun: boolean; feedText?: string },
): Promise<SyncOutcome> {
    const t0 = Date.now();
    const out: SyncOutcome = {
        channel, ok: false, fetched: false, events_parsed: 0,
        blocks_inserted: 0, blocks_removed: 0, blocks_uid_backfilled: 0,
        bookings_created: 0, bookings_updated: 0, bookings_cancelled: 0,
        conflicts: 0, conflict_detail: [], error_message: null, duration_ms: 0,
    };

    let feed = opts.feedText;
    if (feed === undefined) {
        const r = await fetchFeed(url);
        if (r.error || !r.text) {
            out.error_message = r.error || "sin contenido";
            out.duration_ms = Date.now() - t0;
            return out;
        }
        feed = r.text;
    }
    out.fetched = true;

    const events = parseIcal(feed).filter((e) => e.status !== "CANCELLED");
    out.events_parsed = events.length;

    const { data: existingBlocks, error: ebErr } = await supabase
        .from("blocked_dates")
        .select(caps.blockUid ? "id, start_date, end_date, external_uid" : "id, start_date, end_date")
        .eq("apartment_id", apt.id)
        .eq("source", channel);

    if (ebErr) {
        out.error_message = `no se pudieron leer los bloqueos: ${ebErr.message}`;
        out.duration_ms = Date.now() - t0;
        return out;
    }
    const existing = (existingBlocks || []) as Array<
        { id: string; start_date: string; end_date: string; external_uid?: string | null }
    >;

    // ---- clasificar eventos --------------------------------------------
    const puedeReservar = caps.bookingChannel && caps.bookingUid;
    type Plan = {
        uid: string; start: string; endExclusive: string; endInclusive: string;
        guest: ReturnType<typeof extractGuestInfo>; asReservation: boolean;
    };
    const plans: Plan[] = events.map((e) => {
        const guest = extractGuestInfo(e);
        const endInclusive = addDays(e.end, -1);
        return {
            uid: e.uid, start: e.start, endExclusive: e.end, endInclusive,
            guest, asReservation: puedeReservar && guest.kind === "reservation",
        };
    }).filter((p) => p.start <= p.endInclusive);

    if (!puedeReservar && plans.some((p) => p.guest.kind === "reservation")) {
        out.error_message =
            "el feed trae huéspedes, pero guest_bookings aún no tiene channel/external_uid: " +
            "se crean bloqueos. Aplicar supabase/migrations/_pendiente_canales.sql.";
    }

    // ---- solapes con reservas propias -----------------------------------
    // Se comprueba SIEMPRE, también para los eventos que solo van a ser
    // bloqueo: un bloqueo de Booking encima de una reserva de la web es
    // exactamente el overbooking que hay que cazar.
    const hoy = new Date().toISOString().slice(0, 10);
    const futuros = plans.filter((p) => p.endInclusive >= hoy);

    if (futuros.length > 0) {
        const minStart = futuros.reduce((a, p) => (p.start < a ? p.start : a), futuros[0].start);
        const maxEnd = futuros.reduce((a, p) => (p.endExclusive > a ? p.endExclusive : a), futuros[0].endExclusive);

        const propiasCols = "id, guest_name, check_in, check_out, status, source" +
            (caps.bookingUid ? ", external_uid" : "") + (caps.bookingChannel ? ", channel" : "");
        const { data: propias } = await supabase
            .from("guest_bookings")
            .select(propiasCols)
            .eq("apartment_id", apt.id)
            .in("status", ["hold", "pending", "confirmed"])
            .lt("check_in", maxEnd)
            .gt("check_out", minStart);

        const candidatas = ((propias || []) as Array<Record<string, unknown>>).filter((b) => {
            // Una reserva de prueba (source='test') no es un overbooking: avisar
            // por ella gasta la credibilidad del aviso que sí importa.
            if (b.source === "test") return false;
            const ch = (b.channel ?? b.source) as string | undefined;
            // No es conflicto lo que viene de este mismo canal: es el propio evento.
            return ch !== channel;
        });

        for (const p of futuros) {
            const choque = candidatas.find(
                (b) => (b.check_in as string) < p.endExclusive && (b.check_out as string) > p.start,
            );
            if (!choque) continue;
            if (caps.bookingUid && choque.external_uid === p.uid) continue;

            out.conflicts++;
            const linea = `${CHANNEL_LABEL[channel]} ${p.start}->${p.endExclusive} pisa la reserva ` +
                `#${choque.id} de ${choque.guest_name} (${choque.check_in}->${choque.check_out}, ${choque.status})`;
            out.conflict_detail.push(linea);

            if (opts.dryRun || !caps.conflicts) continue;

            const { data: yaAbierto } = await supabase
                .from("channel_sync_conflicts")
                .select("id, notified_at")
                .eq("apartment_id", apt.id).eq("channel", channel).eq("external_uid", p.uid)
                .is("resolved_at", null)
                .maybeSingle();

            if (yaAbierto) {
                await supabase.from("channel_sync_conflicts")
                    .update({ last_seen_at: new Date().toISOString() }).eq("id", yaAbierto.id);
            } else {
                const { data: nuevo } = await supabase.from("channel_sync_conflicts").insert({
                    apartment_id: apt.id, channel, external_uid: p.uid,
                    start_date: p.start, end_date: p.endInclusive,
                    summary: linea, conflicting_booking_id: choque.id,
                }).select("id").maybeSingle();

                const via = await pushAlert(
                    `Posible overbooking en ${apt.name}`,
                    `${linea}\n\nRevísalo antes de que entren dos huéspedes la misma noche. ` +
                    `El bloqueo SÍ se ha aplicado (bloquear es el lado seguro); lo que hay que ` +
                    `decidir es cuál de las dos reservas se mantiene.`,
                );
                if (nuevo) {
                    await supabase.from("channel_sync_conflicts")
                        .update({ notified_at: new Date().toISOString() })
                        .eq("id", nuevo.id);
                }
                out.conflict_detail.push(`(aviso enviado por: ${via})`);
            }
        }
    }

    // ---- reservas de verdad ---------------------------------------------
    const reservas = plans.filter((p) => p.asReservation);
    const uidsReserva = new Set(reservas.map((p) => p.uid));

    if (puedeReservar) {
        const { data: yaImportadas } = await supabase
            .from("guest_bookings")
            .select("id, external_uid, check_in, check_out, guest_name, status, external_locator, internal_notes")
            .eq("apartment_id", apt.id)
            .eq("channel", channel)
            .not("external_uid", "is", null);

        const porUid = new Map<string, Record<string, unknown>>();
        for (const b of (yaImportadas || []) as Array<Record<string, unknown>>) {
            porUid.set(b.external_uid as string, b);
        }

        for (const p of reservas) {
            const noches = Math.round(
                (Date.parse(p.endExclusive) - Date.parse(p.start)) / 86400_000,
            );
            const previa = porUid.get(p.uid);

            if (previa) {
                const cambios: Record<string, unknown> = {};
                if (previa.check_in !== p.start) cambios.check_in = p.start;
                if (previa.check_out !== p.endExclusive) { cambios.check_out = p.endExclusive; cambios.nights = noches; }
                if (previa.guest_name !== p.guest.guestName) cambios.guest_name = p.guest.guestName;
                if (previa.status === "cancelled") cambios.status = "confirmed";
                if (p.guest.locator && previa.external_locator !== p.guest.locator) {
                    cambios.external_locator = p.guest.locator;
                }
                if (Object.keys(cambios).length > 0) {
                    out.bookings_updated++;
                    if (!opts.dryRun) {
                        cambios.updated_at = new Date().toISOString();
                        await supabase.from("guest_bookings").update(cambios).eq("id", previa.id);
                    }
                }
                continue;
            }

            out.bookings_created++;
            if (opts.dryRun) continue;

            const ahora = new Date().toISOString();
            const fila: Record<string, unknown> = {
                apartment_id: apt.id,
                guest_name: p.guest.guestName,
                guest_email: p.guest.guestEmail || PLACEHOLDER_EMAIL,
                guest_phone: p.guest.guestPhone || null,
                check_in: p.start,
                check_out: p.endExclusive,
                nights: noches,
                status: "confirmed",
                source: channel,
                channel,
                external_uid: p.uid,
                external_locator: p.guest.locator || null,
                booking_code: await bookingCodeFromUid(p.uid),
                payment_status: "pending",
                internal_notes: `Importada del calendario de ${CHANNEL_LABEL[channel]} el ` +
                    `${new Date().toLocaleDateString("es-ES")}. El importe no viaja por iCal: ` +
                    `hay que ponerlo a mano.`,
            };
            for (const f of EMAIL_FLAGS) fila[f] = ahora;

            const { error: insErr } = await supabase.from("guest_bookings").insert(fila);
            if (insErr) {
                out.bookings_created--;
                out.error_message = `no se pudo crear la reserva ${p.uid}: ${insErr.message}`;
            }
        }

        // Reserva importada que ya no está en el feed -> cancelada, nunca borrada.
        for (const [uid, b] of porUid) {
            if (uidsReserva.has(uid)) continue;
            if (b.status === "cancelled") continue;
            out.bookings_cancelled++;
            if (opts.dryRun) continue;
            await supabase.from("guest_bookings").update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
                internal_notes: `${b.internal_notes ?? ""}\nDesapareció del calendario de ` +
                    `${CHANNEL_LABEL[channel]} el ${new Date().toLocaleDateString("es-ES")}: ` +
                    `cancelada en el canal.`.trim(),
            }).eq("id", b.id);
        }
    }

    // ---- bloqueos --------------------------------------------------------
    // Todo evento produce bloqueo, también los que además son reserva: así el
    // calendario y la web quedan bien aunque la reserva se cancele por error.
    const porUidBloq = new Map<string, typeof existing[number]>();
    const porFechas = new Map<string, typeof existing[number][]>();
    for (const b of existing) {
        if (caps.blockUid && b.external_uid) porUidBloq.set(b.external_uid, b);
        else {
            const k = `${b.start_date}|${b.end_date}`;
            porFechas.set(k, [...(porFechas.get(k) || []), b]);
        }
    }

    const vistos = new Set<string>();
    const aInsertar: Record<string, unknown>[] = [];
    const aBackfill: Array<{ id: string; uid: string }> = [];
    const aMoverFechas: Array<{ id: string; start: string; end: string }> = [];

    for (const p of plans) {
        const yaPorUid = caps.blockUid ? porUidBloq.get(p.uid) : undefined;
        if (yaPorUid) {
            vistos.add(yaPorUid.id);
            if (yaPorUid.start_date !== p.start || yaPorUid.end_date !== p.endInclusive) {
                aMoverFechas.push({ id: yaPorUid.id, start: p.start, end: p.endInclusive });
            }
            continue;
        }
        // Fila antigua sin UID: se empareja por fechas y se le rellena el UID.
        // Así los 43 bloqueos reales de Airbnb NO se borran ni se reinsertan.
        const k = `${p.start}|${p.endInclusive}`;
        const cola = porFechas.get(k);
        const libre = cola?.find((b) => !vistos.has(b.id));
        if (libre) {
            vistos.add(libre.id);
            if (caps.blockUid) { aBackfill.push({ id: libre.id, uid: p.uid }); out.blocks_uid_backfilled++; }
            continue;
        }
        const fila: Record<string, unknown> = {
            apartment_id: apt.id, start_date: p.start, end_date: p.endInclusive, source: channel,
        };
        if (caps.blockUid) fila.external_uid = p.uid;
        aInsertar.push(fila);
    }

    const aRetirar = existing.filter((b) => !vistos.has(b.id)).map((b) => b.id);

    // Guardarraíl: si el feed viene vacío y aquí había bloqueos, no se arrasa.
    const feedVacioSospechoso = plans.length === 0 && existing.length > 0;
    if (feedVacioSospechoso) {
        out.error_message = (out.error_message ? out.error_message + " · " : "") +
            `el feed de ${CHANNEL_LABEL[channel]} llegó sin ningún evento y hay ` +
            `${existing.length} bloqueo(s) guardados: no se retira nada en esta pasada.`;
    }

    out.blocks_inserted = aInsertar.length;
    out.blocks_removed = feedVacioSospechoso ? 0 : aRetirar.length;

    if (!opts.dryRun) {
        if (aInsertar.length > 0) {
            const { error } = await supabase.from("blocked_dates").insert(aInsertar);
            if (error) {
                out.blocks_inserted = 0;
                out.error_message = `no se pudieron crear bloqueos: ${error.message}`;
            }
        }
        for (const b of aBackfill) {
            await supabase.from("blocked_dates").update({ external_uid: b.uid }).eq("id", b.id);
        }
        for (const m of aMoverFechas) {
            await supabase.from("blocked_dates")
                .update({ start_date: m.start, end_date: m.end }).eq("id", m.id);
        }
        if (!feedVacioSospechoso && aRetirar.length > 0) {
            const { error } = await supabase.from("blocked_dates").delete().in("id", aRetirar);
            if (error) { out.blocks_removed = 0; out.error_message = `no se pudieron retirar bloqueos: ${error.message}`; }
        }
    }

    out.ok = true;
    out.duration_ms = Date.now() - t0;
    return out;
}

// ---------------------------------------------------------------------------
// Vigilancia: canales configurados sin sincronización correcta reciente.
// ---------------------------------------------------------------------------
async function revisarAusencias(caps: Caps, horas = 2) {
    if (!caps.syncLog) {
        return { evaluado: false, motivo: "channel_sync_log no existe todavía", stale: [] as unknown[] };
    }
    const { data, error } = await supabase.from("v_channel_sync_status").select("*");
    if (error) return { evaluado: false, motivo: error.message, stale: [] as unknown[] };

    const stale = (data || []).filter((r: Record<string, unknown>) => r.is_stale === true);
    const avisos: unknown[] = [];
    for (const r of stale as Array<Record<string, unknown>>) {
        const mins = r.minutes_since_ok as number | null;
        const cuanto = mins == null
            ? "nunca se ha sincronizado correctamente"
            : `hace ${Math.round(mins / 60)} h que no se sincroniza bien`;
        const via = await alertOnce(
            caps, r.apartment_id as number, r.channel as string, "sin_sincronizar", 6,
            `${CHANNEL_LABEL[r.channel as string] || r.channel} parado en ${r.apartment_name}`,
            `El calendario de ${CHANNEL_LABEL[r.channel as string] || r.channel} de ` +
            `${r.apartment_name} ${cuanto}.\n` +
            `Último error registrado: ${r.error_message || "ninguno"}.\n\n` +
            `Mientras siga así, una reserva que entre por ese canal no bloquea las fechas ` +
            `en la web: hay riesgo de doble reserva.`,
        );
        avisos.push({ apartamento: r.apartment_name, canal: r.channel, cuanto, aviso: via });
    }
    return { evaluado: true, umbral_horas: horas, stale: avisos };
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(req.url);
    const auth = req.headers.get("authorization") || "";
    const esServicio = auth === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
        try { body = await req.json(); } catch { /* cron sin cuerpo */ }
    } else if (req.method !== "GET") {
        return json(405, { error: "method_not_allowed" });
    }

    // Prueba del parser dentro del runtime desplegado.
    if (body.selftest === true || url.searchParams.get("selftest") === "1") {
        return json(200, runSelfTest());
    }

    const caps = await probeCaps();

    // Modo vigilante: solo mira si falta sincronización y avisa. Pensado para
    // pg_cron, que corre en la base — otro sitio que el cron de Trigger.dev.
    if (body.mode === "watch" || url.searchParams.get("mode") === "watch") {
        return json(200, { mode: "watch", checkedAt: new Date().toISOString(), caps, ...await revisarAusencias(caps) });
    }

    const dryRun = body.dryRun === true;
    const soloApt = typeof body.apartmentId === "number" ? body.apartmentId : null;
    const soloCanales = Array.isArray(body.channels)
        ? (body.channels as string[]).filter((c) => ALL_CHANNEL_KEYS.includes(c))
        : null;
    const feedOverride = (esServicio && body.feedOverride && typeof body.feedOverride === "object")
        ? body.feedOverride as Record<string, string>
        : null;
    if (body.feedOverride && !esServicio) {
        return json(403, { error: "feedOverride exige la service role key" });
    }

    const cols = ["id", "slug", "name", "airbnb_ical_url", "booking_ical_url"];
    if (caps.extraUrlCols) cols.push("escapada_ical_url", "casasrurales_ical_url");

    let q = supabase.from("apartments").select(cols.join(", ")).eq("is_active", true).order("id");
    if (soloApt) q = q.eq("id", soloApt);
    const { data: apartments, error } = await q;
    if (error) return json(500, { error: error.message });

    const results: Array<Record<string, unknown>> = [];

    for (const apt of (apartments || []) as unknown as ApartmentRow[]) {
        const entry: Record<string, unknown> = { apartment: apt.slug, apartment_id: apt.id };
        for (const ch of CHANNELS) {
            if (soloCanales && !soloCanales.includes(ch.key)) continue;
            if (!caps.extraUrlCols && (ch.key === "escapada" || ch.key === "casasrurales")) continue;

            const override = feedOverride?.[`${apt.id}:${ch.key}`];
            const configurada = (apt[ch.column] as string | null) || null;
            if (!configurada && override === undefined) continue;

            const outcome = await syncOne(apt, ch.key, configurada || "", caps, { dryRun, feedText: override });
            entry[ch.key] = outcome;

            if (!dryRun && caps.syncLog) {
                await supabase.from("channel_sync_log").insert({
                    apartment_id: apt.id, channel: ch.key,
                    ok: outcome.ok, fetched: outcome.fetched,
                    events_parsed: outcome.events_parsed,
                    blocks_inserted: outcome.blocks_inserted,
                    blocks_removed: outcome.blocks_removed,
                    bookings_created: outcome.bookings_created,
                    bookings_updated: outcome.bookings_updated,
                    bookings_cancelled: outcome.bookings_cancelled,
                    conflicts: outcome.conflicts,
                    duration_ms: outcome.duration_ms,
                    error_message: outcome.error_message,
                });
            }

            // Un canal que no se puede descargar es un canal que deja de
            // proteger contra overbooking: se avisa, no solo se pinta.
            if (!dryRun && !outcome.fetched) {
                await alertOnce(
                    caps, apt.id, ch.key, "no_descarga", 6,
                    `No se pudo leer el calendario de ${ch.label} (${apt.name})`,
                    `Motivo: ${outcome.error_message}.\n\nRevisa que el enlace siga siendo válido ` +
                    `en el panel de ${ch.label}. Mientras tanto, una reserva que entre por ahí no ` +
                    `bloquea las fechas en la web.`,
                );
            }
        }
        results.push(entry);
    }

    const vigilancia = dryRun ? { evaluado: false, motivo: "dryRun" } : await revisarAusencias(caps);

    return json(200, {
        syncedAt: new Date().toISOString(),
        dryRun,
        caps,
        pendiente_sql: (caps.blockUid && caps.bookingChannel && caps.bookingUid && caps.syncLog &&
                        caps.conflicts && caps.alertDedup && caps.extraUrlCols)
            ? null
            : "Falta aplicar supabase/migrations/_pendiente_canales.sql. Mientras tanto se crean bloqueos, como antes; no se pierde nada.",
        vigilancia,
        results,
    });
});

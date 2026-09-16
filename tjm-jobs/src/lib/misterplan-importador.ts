// Importador de reservas desde los correos de MisterPlan.
// ========================================================
// Lee el Gmail del negocio por IMAP, reconoce los avisos de MisterPlan
// (ver misterplan-correo.ts) y los convierte en reservas del sistema:
//
//   reserva nueva de un canal   → guest_bookings (channel = booking/airbnb/…)
//   cancelación desde Booking   → status 'cancelled' de la reserva con ese localizador
//   modificación desde Booking  → fechas / importe / pax de esa reserva
//   confirmación del motor web  → guest_bookings (channel 'web') + cobro en booking_payments
//   pre-reserva                 → solo se registra (aún no hay dinero ni reserva firme)
//
// IDEMPOTENCIA: cada correo deja fila en mail_import_log por Message-ID; un
// correo ya registrado no se vuelve a tocar. Y cada reserva se busca antes de
// crearla (localizador del canal, referencia de MisterPlan, o misma persona en
// las mismas fechas apuntada a mano) para no duplicar lo que ya está.
//
// LO QUE NO SE HACE SOLO: si el apartamento no se reconoce, si las fechas
// chocan con otra reserva viva o si hay que cancelar algo que no existe, la
// fila queda con necesita_atencion = true y se manda un correo de aviso (por
// SMTP con la misma cuenta que se lee, así no hace falta otra clave). Lo que
// detecta y no empuja a ningún sitio es decoración.
//
// Env: CORREO_TJM_USER, CORREO_TJM_PASS (contraseña de aplicación de Google),
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AVISOS_A (opcional, coma-separado).

import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parsearCorreoMisterPlan, type CorreoParseado } from "./misterplan-correo.js";

export interface Opciones {
    dryRun?: boolean;
    /** Solo correos recibidos a partir de aquí (por defecto: último registrado − 2 días, o el 11-sep-2026). */
    desde?: string;
    /** Tope de correos por pasada. */
    limite?: number;
    log?: (msg: string, data?: unknown) => void;
}

export interface Resultado {
    leidos: number;
    procesados: number;
    acciones: Record<string, number>;
    atencion: Array<{ asunto: string; motivo: string }>;
    detalle: Array<Record<string, unknown>>;
}

const ARRANQUE_POR_DEFECTO = "2026-09-11"; // día del barrido manual de MisterPlan (§7 ter)
const REMITENTE = /ruralgest\.net|ruralgest\.com|misterplan/i;

/** Marcas de correo «ya enviado» para reservas de canal: la confirmación se la
 *  mandó el canal, TJM no le escribe encima (misma regla que sync-ical-imports). */
const EMAIL_FLAGS_CANAL = [
    "confirmation_email_sent_at", "reminder_7d_email_sent_at", "reminder_24h_email_sent_at",
    "arrival_email_sent_at", "departure_email_sent_at", "reactivation_email_sent_at",
];
const PLACEHOLDER_EMAIL = "sin-correo@example.invalid";

function env(nombre: string, obligatoria = true): string {
    const v = process.env[nombre];
    if (!v && obligatoria) throw new Error(`Falta la variable de entorno ${nombre}`);
    return v || "";
}

async function codigoReserva(semilla: string): Promise<string> {
    const { createHash } = await import("node:crypto");
    return "TJM-" + createHash("sha256").update(semilla).digest("hex").slice(0, 6).toUpperCase();
}

const hoyEs = () => new Date().toLocaleDateString("es-ES");

// ---------------------------------------------------------------------------
export async function importarCorreosMisterPlan(opts: Opciones = {}): Promise<Resultado> {
    const log = opts.log ?? (() => {});
    const dryRun = !!opts.dryRun;
    const user = env("CORREO_TJM_USER");
    const pass = env("CORREO_TJM_PASS");
    const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

    const res: Resultado = { leidos: 0, procesados: 0, acciones: {}, atencion: [], detalle: [] };
    const cuenta = (accion: string) => { res.acciones[accion] = (res.acciones[accion] || 0) + 1; };

    // Desde cuándo mirar: lo último registrado menos 2 días (por si un correo llegó tarde).
    let desde = opts.desde;
    if (!desde) {
        const { data } = await supabase.from("mail_import_log").select("received_at").order("received_at", { ascending: false }).limit(1).maybeSingle();
        const ult = (data as { received_at?: string } | null)?.received_at;
        desde = ult ? new Date(Date.parse(ult) - 2 * 86400_000).toISOString().slice(0, 10) : ARRANQUE_POR_DEFECTO;
    }

    // Apartamentos por slug.
    const { data: apts, error: aErr } = await supabase.from("apartments").select("id, slug, name");
    if (aErr) throw new Error(`apartments: ${aErr.message}`);
    const aptPorSlug = new Map((apts || []).map((a: { id: number; slug: string; name: string }) => [a.slug, a]));

    const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false });
    await client.connect();
    try {
        // Carpeta «Todos» de Gmail (nombre según idioma): la que tiene special-use \All.
        const carpetas = await client.list();
        const todos = carpetas.find((c) => c.specialUse === "\\All")?.path || "INBOX";
        const lock = await client.getMailboxLock(todos);
        try {
            const uids = await client.search({ since: new Date(desde + "T00:00:00Z") }, { uid: true });
            const candidatos = (uids || []).sort((a, b) => a - b);
            log(`[misterplan-correo] ${candidatos.length} correos desde ${desde} en ${todos}`);

            // Message-IDs ya registrados (solo los de la ventana, para no traer la tabla entera).
            const { data: yaVistos } = await supabase.from("mail_import_log").select("message_id").gte("received_at", desde);
            const vistos = new Set((yaVistos || []).map((r: { message_id: string }) => r.message_id));

            // Primero las cabeceras (una sola pasada IMAP), luego el cuerpo de los
            // que toca: no se pueden encadenar comandos dentro de la iteración.
            type Cab = { uid: number; envelope: FetchMessageObject["envelope"] };
            const cabeceras: Cab[] = [];
            if (candidatos.length > 0) {
                for await (const m of client.fetch(candidatos, { uid: true, envelope: true }, { uid: true })) {
                    cabeceras.push({ uid: m.uid, envelope: m.envelope });
                }
            }

            let n = 0;
            for (const msg of cabeceras) {
                const env_ = msg.envelope;
                const from = (env_?.from || []).map((f) => `${f.name || ""} <${f.address || ""}>`).join(", ");
                if (!REMITENTE.test(from)) continue;
                const messageId = env_?.messageId || `uid-${msg.uid}@${user}`;
                if (vistos.has(messageId)) continue;
                res.leidos++;
                if (opts.limite && n >= opts.limite) break;
                n++;

                const full = await client.fetchOne(String(msg.uid), { uid: true, source: true }, { uid: true });
                if (!full || !full.source) continue;
                const parsed = await simpleParser(full.source);
                const cuerpo = String(parsed.html || parsed.text || "");
                const asunto = parsed.subject || env_?.subject || "";
                const recibido = (parsed.date || env_?.date || new Date()).toISOString();

                const p = parsearCorreoMisterPlan(asunto, cuerpo);
                const fila: Record<string, unknown> = {
                    message_id: messageId, mail_uid: msg.uid, received_at: recibido, subject: asunto, sender: from,
                    kind: p.kind, channel: p.channel ?? null, locator: p.locator ?? null, misterplan_ref: p.misterplanRef ?? null,
                    booking_id: null, action: "ignorada", detail: {}, necesita_atencion: false,
                };
                try {
                    const r = await procesar(supabase, aptPorSlug, p, recibido, dryRun);
                    Object.assign(fila, r);
                } catch (e) {
                    fila.action = "error";
                    fila.necesita_atencion = true;
                    fila.detail = { error: (e as Error).message, parsed: p };
                }
                if (p.warnings.length) fila.detail = { ...(fila.detail as object), warnings: p.warnings };
                cuenta(String(fila.action));
                res.procesados++;
                res.detalle.push({ uid: msg.uid, asunto, kind: p.kind, action: fila.action, booking_id: fila.booking_id, locator: p.locator, ref: p.misterplanRef, nombre: p.guestName, fechas: p.checkIn && `${p.checkIn}→${p.checkOut}`, apto: p.apartment, total: p.total, atencion: fila.necesita_atencion, detail: fila.detail });
                if (fila.necesita_atencion) res.atencion.push({ asunto, motivo: JSON.stringify(fila.detail).slice(0, 300) });
                log(`[misterplan-correo] ${asunto} → ${fila.action}${fila.necesita_atencion ? " ⚠️" : ""}`);

                if (!dryRun) {
                    const { error } = await supabase.from("mail_import_log").insert(fila);
                    if (error) log(`[misterplan-correo] no se pudo registrar ${messageId}: ${error.message}`);
                }
            }
        } finally { lock.release(); }
    } finally { await client.logout().catch(() => {}); }

    if (!dryRun && res.atencion.length) {
        await avisar(user, pass, res.atencion, log);
    }
    return res;
}

// ---------------------------------------------------------------------------
type Apt = { id: number; slug: string; name: string };
type Accion = { action: string; booking_id: number | null; detail: Record<string, unknown>; necesita_atencion: boolean };

async function procesar(sb: SupabaseClient, apts: Map<string, Apt>, p: CorreoParseado, recibido: string, dryRun: boolean): Promise<Accion> {
    const ok = (action: string, booking_id: number | null, detail: Record<string, unknown> = {}): Accion => ({ action, booking_id, detail, necesita_atencion: false });
    const ojo = (action: string, booking_id: number | null, detail: Record<string, unknown>): Accion => ({ action, booking_id, detail, necesita_atencion: true });

    if (p.kind === "otro") return ok("ignorada", null, { motivo: "no es un aviso de reserva" });
    if (p.kind === "pre_reserva") return ok("ignorada", null, { motivo: "pre-reserva sin pago: se espera la confirmación", ref: p.misterplanRef, nombre: p.guestName, fechas: `${p.checkIn}→${p.checkOut}`, apto: p.apartment, total: p.total });

    // ---- cancelación desde Booking ------------------------------------------
    if (p.kind === "cancelacion_booking") {
        if (!p.locator) return ojo("error", null, { motivo: "cancelación sin localizador" });
        const viva = await porLocalizador(sb, p.locator);
        if (!viva) return ok("ignorada", null, { motivo: "cancelación de una reserva que no estaba en el sistema", locator: p.locator, nombre: p.guestName, fechas: `${p.checkIn}→${p.checkOut}` });
        if (viva.status === "cancelled") return ok("ya_existia", viva.id, { motivo: "ya estaba cancelada" });
        if (!dryRun) {
            const { error } = await sb.from("guest_bookings").update({
                status: "cancelled", updated_at: new Date().toISOString(),
                internal_notes: `${viva.internal_notes ?? ""}\nCancelada en Booking (aviso de MisterPlan del ${new Date(recibido).toLocaleDateString("es-ES")}, leído el ${hoyEs()}). Nada que devolver desde TJM: el cobro era de Booking.`.trim(),
            }).eq("id", viva.id);
            if (error) throw new Error(error.message);
            await sb.from("channel_sync_conflicts").update({ resolved_at: new Date().toISOString(), resolution: "La reserva se canceló en Booking (aviso de MisterPlan)." }).eq("conflicting_booking_id", viva.id).is("resolved_at", null);
        }
        return ok("cancelada", viva.id, { locator: p.locator, nombre: viva.guest_name, fechas: `${viva.check_in}→${viva.check_out}` });
    }

    // ---- lo demás crea o modifica: hace falta apartamento y fechas -------------
    const apt = p.apartment ? apts.get(p.apartment) : undefined;
    if (!apt) return ojo("error", null, { motivo: "apartamento no reconocido", texto: p.apartment, parsed: resumen(p) });
    if (!p.checkIn || !p.checkOut) return ojo("error", null, { motivo: "faltan fechas", parsed: resumen(p) });

    // ¿Ya existe? Por localizador del canal, por referencia de MisterPlan, o misma persona en las mismas fechas.
    let existente = p.locator ? await porLocalizador(sb, p.locator) : null;
    if (!existente && p.misterplanRef) existente = await porLocalizador(sb, p.misterplanRef); // «MisterPlan 1-…» o «RuralCloud_V2 / MisterPlan 1-…»
    if (!existente && p.guestName) existente = await porPersonaYFechas(sb, apt.id, p.guestName, p.checkIn, p.checkOut);

    if (p.kind === "modificacion_booking") {
        if (!existente) {
            // Una modificación de algo que no teníamos: se apunta como nueva con lo que trae.
            return crear(sb, apt, p, recibido, dryRun, "modificación de una reserva que no estaba: creada con los datos nuevos");
        }
        const cambios: Record<string, unknown> = {};
        if (existente.check_in !== p.checkIn) cambios.check_in = p.checkIn;
        if (existente.check_out !== p.checkOut) cambios.check_out = p.checkOut;
        if (p.total != null && Number(existente.total_price) !== p.total) cambios.total_price = p.total;
        if (p.pax && existente.pax_count !== p.pax) cambios.pax_count = p.pax;
        if (existente.apartment_id !== apt.id) cambios.apartment_id = apt.id;
        if (Object.keys(cambios).length === 0) return ok("ya_existia", existente.id, { motivo: "modificación sin cambios respecto a lo apuntado" });
        if (!dryRun) {
            const choque = await solape(sb, apt.id, p.checkIn, p.checkOut, existente.id);
            if (choque) return ojo("error", existente.id, { motivo: "las fechas nuevas chocan con otra reserva viva", choque, cambios });
            const { error } = await sb.from("guest_bookings").update({
                ...cambios, updated_at: new Date().toISOString(),
                internal_notes: `${existente.internal_notes ?? ""}\nModificada desde Booking (aviso de MisterPlan del ${new Date(recibido).toLocaleDateString("es-ES")}): ${Object.entries(cambios).map(([k, v]) => `${k} → ${v}`).join(", ")}.`.trim(),
            }).eq("id", existente.id);
            if (error) throw new Error(error.message);
        }
        return ok("modificada", existente.id, { cambios });
    }

    // reserva de canal o confirmación del motor web
    if (existente) {
        // Enlazar: si la apuntaron a mano sin localizador, se le pone; y se completan correo/teléfono si faltaban.
        const cambios: Record<string, unknown> = {};
        if (p.locator && !existente.external_locator) cambios.external_locator = p.locator;
        if (p.guestEmail && (!existente.guest_email || /@example\.invalid$|@tiojosemaria\.local$/.test(existente.guest_email))) cambios.guest_email = p.guestEmail;
        if (p.guestPhone && !existente.guest_phone) cambios.guest_phone = p.guestPhone;
        if (Object.keys(cambios).length === 0) return ok("ya_existia", existente.id, { nombre: existente.guest_name });
        if (!dryRun) {
            const { error } = await sb.from("guest_bookings").update({ ...cambios, updated_at: new Date().toISOString(),
                internal_notes: `${existente.internal_notes ?? ""}\nCompletada con el aviso de MisterPlan del ${new Date(recibido).toLocaleDateString("es-ES")}: ${Object.keys(cambios).join(", ")}.`.trim() }).eq("id", existente.id);
            if (error) throw new Error(error.message);
        }
        return ok("enlazada", existente.id, { cambios });
    }
    return crear(sb, apt, p, recibido, dryRun);
}

function resumen(p: CorreoParseado) {
    return { ref: p.misterplanRef, locator: p.locator, canal: p.channelLabel, nombre: p.guestName, fechas: `${p.checkIn}→${p.checkOut}`, apto: p.apartment, pax: p.pax, total: p.total, paid: p.paid };
}

async function crear(sb: SupabaseClient, apt: Apt, p: CorreoParseado, recibido: string, dryRun: boolean, nota = ""): Promise<Accion> {
    const choque = await solape(sb, apt.id, p.checkIn!, p.checkOut!, null);
    if (choque) return { action: "error", booking_id: null, necesita_atencion: true, detail: { motivo: "las fechas chocan con otra reserva viva del sistema (no se crea: hay que mirar cuál vale)", choque, parsed: resumen(p) } };

    const canal = p.channel || "otro";
    const esCanal = canal !== "web";
    const semilla = p.locator ? `${canal}:${p.locator}` : `misterplan:${p.misterplanRef}`;
    const ahora = new Date().toISOString();
    const fecha = new Date(recibido).toLocaleDateString("es-ES");
    const comision = canal === "booking" && p.total ? Math.round(p.total * 0.17 * 100) / 100 : null;

    const fila: Record<string, unknown> = {
        apartment_id: apt.id,
        guest_name: p.guestName,
        guest_email: p.guestEmail || PLACEHOLDER_EMAIL,
        guest_phone: p.guestPhone || null,
        pax_count: p.pax || 2,
        check_in: p.checkIn, check_out: p.checkOut,
        total_price: p.total ?? null,
        status: "confirmed",
        source: "manual",
        channel: canal,
        external_locator: p.locator || (p.misterplanRef ? `MisterPlan ${p.misterplanRef}` : null),
        payment_method: canal === "booking" ? "booking" : canal === "airbnb" ? "ota" : canal === "web" ? "transferencia" : null,
        payment_holder: canal === "airbnb" ? "Airbnb" : null,
        vcc_chargeable_from: p.vccChargeableFrom || null,
        commission_amount: comision ?? 0,
        payment_status: "pending",
        booking_code: await codigoReserva(semilla),
        created_by: "importacion-misterplan-correo",
        internal_notes: [
            `Traída del aviso de MisterPlan del ${fecha} (leído el ${hoyEs()})${p.misterplanRef ? `, reserva ${p.misterplanRef}` : ""}, canal ${p.channelLabel || canal}${p.locator ? ` ${p.locator}` : ""}.`,
            p.total != null ? `Importe ${p.total.toFixed(2)} €` + (p.nights ? ` por ${p.nights} noche(s)` : "") + (p.pax ? `, ${p.pax} persona(s)` : "") + "." : "",
            canal === "booking" ? `Booking: ${p.vccChargeableFrom ? `tarjeta virtual cargable desde el ${p.vccChargeableFrom}; ` : ""}pago a través de Booking.com (comisión estimada 17 %).` : "",
            canal === "airbnb" ? "Airbnb cobra al huésped y liquida: NO cobrar nada en persona." : "",
            canal === "web" ? `Motor web de MisterPlan: ${p.paid != null ? `${p.paid.toFixed(2)} € pagados por transferencia (anticipo).` : "sin dato de pago."} MisterPlan no da su correo; la confirmación se la mandó MisterPlan.` : "",
            p.arrivalTime ? `Hora de llegada indicada por el huésped: ${p.arrivalTime}.` : "",
            p.comments && !/^Comentario del Cliente: Has recibido una tarjeta/.test(p.comments) ? `Observaciones: ${p.comments.slice(0, 300)}` : "",
            nota,
        ].filter(Boolean).join(" "),
    };
    if (esCanal) for (const f of EMAIL_FLAGS_CANAL) fila[f] = ahora;
    else fila.confirmation_email_sent_at = ahora;

    if (dryRun) return { action: "creada", booking_id: null, necesita_atencion: false, detail: { dryRun: true, fila: { ...fila, internal_notes: undefined } } };

    const { data, error } = await sb.from("guest_bookings").insert(fila).select("id").single();
    if (error) throw new Error(`insert guest_bookings: ${error.message}`);
    const id = (data as { id: number }).id;

    if (canal === "web" && p.paid && p.paid > 0) {
        const { error: pErr } = await sb.from("booking_payments").insert({
            booking_id: id, amount: p.paid, method: "transferencia", paid_on: recibido.slice(0, 10),
            note: "Anticipo que consta pagado en la confirmación de MisterPlan; fecha = la del correo", created_by: "importacion-misterplan-correo",
        });
        if (pErr) return { action: "creada", booking_id: id, necesita_atencion: true, detail: { motivo: `reserva creada pero el cobro no se pudo apuntar: ${pErr.message}` } };
    }
    // Airbnb: si ya hay un bloqueo del iCal con exactamente esas noches, se enlaza por UID
    // para que el importador de canales la reconozca como el mismo evento.
    if (canal === "airbnb") {
        const { data: bloq } = await sb.from("blocked_dates").select("id, external_uid").eq("apartment_id", apt.id).eq("source", "airbnb")
            .eq("start_date", p.checkIn!).eq("end_date", new Date(Date.parse(p.checkOut! + "T00:00:00Z") - 86400_000).toISOString().slice(0, 10));
        if (bloq && bloq.length === 1 && bloq[0].external_uid) {
            await sb.from("guest_bookings").update({ external_uid: bloq[0].external_uid }).eq("id", id);
        }
    }
    return { action: "creada", booking_id: id, necesita_atencion: false, detail: resumen(p) };
}

type Reserva = { id: number; apartment_id: number; guest_name: string; guest_email: string | null; guest_phone: string | null; check_in: string; check_out: string; status: string; total_price: number | string | null; pax_count: number | null; external_locator: string | null; internal_notes: string | null };
const COLS = "id, apartment_id, guest_name, guest_email, guest_phone, check_in, check_out, status, total_price, pax_count, external_locator, internal_notes";

async function porLocalizador(sb: SupabaseClient, locator: string, exacto = false): Promise<Reserva | null> {
    let q = sb.from("guest_bookings").select(COLS);
    q = exacto ? q.eq("external_locator", locator) : q.or(`external_locator.eq.${locator},external_locator.ilike.%${locator}%`);
    const { data } = await q.order("id", { ascending: false }).limit(5);
    const filas = (data || []) as Reserva[];
    return filas.find((r) => r.status !== "cancelled") || filas[0] || null;
}

async function porPersonaYFechas(sb: SupabaseClient, aptId: number, nombre: string, ci: string, co: string): Promise<Reserva | null> {
    const { data } = await sb.from("guest_bookings").select(COLS).eq("apartment_id", aptId).eq("check_in", ci).eq("check_out", co).neq("status", "cancelled").limit(5);
    const primera = nombre.trim().split(/\s+/)[0].toLowerCase();
    const filas = (data || []) as Reserva[];
    return filas.find((r) => {
        const n = (r.guest_name || "").toLowerCase();
        return n.includes(primera) || nombre.toLowerCase().includes(n.split(/\s+/)[0]);
    }) || null;
}

async function solape(sb: SupabaseClient, aptId: number, ci: string, co: string, excluir: number | null) {
    let q = sb.from("guest_bookings").select("id, guest_name, check_in, check_out, status, channel").eq("apartment_id", aptId)
        .in("status", ["hold", "pending", "confirmed"]).lt("check_in", co).gt("check_out", ci).neq("source", "test");
    if (excluir) q = q.neq("id", excluir);
    const { data } = await q.limit(3);
    return data && data.length ? data : null;
}

// ---------------------------------------------------------------------------
async function avisar(user: string, pass: string, items: Array<{ asunto: string; motivo: string }>, log: (m: string) => void) {
    const a = (process.env.AVISOS_A || "jesusmartinezpadron@gmail.com").split(",").map((s) => s.trim()).filter(Boolean);
    try {
        const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
        const cuerpo = items.map((i) => `• ${i.asunto}\n   ${i.motivo}`).join("\n\n");
        await t.sendMail({
            from: `Apartamentos TJM (sistema) <${user}>`, to: a,
            subject: `[TJM] ${items.length} aviso(s) de MisterPlan que no he sabido apuntar`,
            text: `El job misterplan-correo ha leído estos correos y no ha podido apuntarlos solo:\n\n${cuerpo}\n\nQuedan marcados en mail_import_log con necesita_atencion = true. Míralo en el panel completo o en la base.`,
        });
        log(`[misterplan-correo] aviso enviado a ${a.join(", ")}`);
    } catch (e) {
        log(`[misterplan-correo] no se pudo enviar el aviso: ${(e as Error).message}`);
    }
}

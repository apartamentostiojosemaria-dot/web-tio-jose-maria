// Parser iCal del importador de canales.
// ======================================
// Módulo propio de `sync-ical-imports` (no toca `_shared/ical.ts`, que lo usa
// el exportador). Aquí hace falta bastante más que UID + fechas: hay que sacar
// el NOMBRE del huésped y el LOCALIZADOR cuando el canal los manda, porque de
// eso depende que el evento se convierta en una reserva de verdad o siga
// siendo un bloqueo mudo.
//
// Qué manda cada canal (medido en feeds reales y en su documentación):
//   Airbnb    SUMMARY "Reserved" / "Airbnb (Not available)";
//             DESCRIPTION con "Reservation URL: .../details/HMXXXXXXXX"
//             y "Phone Number (Last 4 Digits)". SIN nombre → bloqueo.
//   Booking   SUMMARY "CLOSED - Not available" o el nombre;
//             DESCRIPTION con líneas "CHECKIN:", "CHECKOUT:", "NAME:",
//             "EMAIL:", "PHONE:". CON nombre → reserva.
//   Otros     formatos variados; se cubren con las mismas reglas.
//
// Sin dependencias: se puede ejecutar tal cual con `node --test` (ver
// parse.test.ts) además de en Deno.

export interface IcalEvent {
    uid: string;
    start: string;        // YYYY-MM-DD  (primera noche ocupada)
    end: string;          // YYYY-MM-DD  (DTEND, EXCLUSIVO: día de salida)
    summary?: string;
    description?: string;
    status?: string;      // CONFIRMED | CANCELLED | TENTATIVE
}

export interface GuestInfo {
    /** 'reservation' solo cuando hay nombre de huésped fiable. */
    kind: "reservation" | "block";
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    locator?: string;
}

// ---------------------------------------------------------------------------
// 1. Desdoblado de líneas (RFC 5545 §3.1: una línea que empieza por espacio
//    o tabulador es continuación de la anterior).
// ---------------------------------------------------------------------------
function unfold(raw: string): string[] {
    const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const out: string[] = [];
    for (const line of lines) {
        if (out.length && /^[ \t]/.test(line)) {
            out[out.length - 1] += line.slice(1);
        } else {
            out.push(line);
        }
    }
    return out.filter((l) => l.length > 0);
}

// Los valores TEXT vienen escapados (RFC 5545 §3.3.11).
function unescapeText(s: string): string {
    return s
        .replace(/\\n/gi, "\n")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\");
}

// DTSTART/DTEND a YYYY-MM-DD. Acepta 20260620, 20260620T140000Z y
// 20260620T140000. En hospedaje los canales usan VALUE=DATE; si alguno manda
// DATE-TIME nos quedamos con la parte de fecha, que es lo que ocupa la noche.
function toIsoDate(raw: string): string | null {
    const m = (raw || "").trim().match(/^(\d{4})(\d{2})(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Suma días a un YYYY-MM-DD sin que se meta la zona horaria de por medio. */
export function addDays(ymd: string, days: number): string {
    const d = new Date(ymd + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 2. Parseo de VEVENTs
// ---------------------------------------------------------------------------
export function parseIcal(raw: string): IcalEvent[] {
    const lines = unfold(raw);
    const events: IcalEvent[] = [];
    let current: Partial<IcalEvent> | null = null;
    let depth = 0;   // para ignorar VALARM anidados dentro del VEVENT

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === "BEGIN:VEVENT") { current = {}; depth = 0; continue; }
        if (trimmed === "END:VEVENT") {
            // Algún canal manda DTSTART sin DTEND para una sola noche: se
            // completa aquí, ANTES de decidir si el evento entra o se tira.
            if (current?.uid && current.start && !current.end) {
                current.end = addDays(current.start, 1);
            }
            if (current?.uid && current.start && current.end) events.push(current as IcalEvent);
            current = null;
            continue;
        }
        if (!current) continue;
        if (/^BEGIN:/.test(trimmed)) { depth++; continue; }
        if (/^END:/.test(trimmed))   { depth = Math.max(0, depth - 1); continue; }
        if (depth > 0) continue;

        const colon = line.indexOf(":");
        if (colon < 0) continue;
        const name = line.slice(0, colon).split(";")[0].trim().toUpperCase();
        const value = line.slice(colon + 1);

        switch (name) {
            case "UID":         current.uid = value.trim(); break;
            case "DTSTART":     current.start = toIsoDate(value) ?? undefined; break;
            case "DTEND":       current.end = toIsoDate(value) ?? undefined; break;
            case "SUMMARY":     current.summary = unescapeText(value).trim(); break;
            case "DESCRIPTION": current.description = unescapeText(value).trim(); break;
            case "STATUS":      current.status = value.trim().toUpperCase(); break;
        }
    }

    return events;
}

// ---------------------------------------------------------------------------
// 3. ¿Este evento trae huésped, o es un bloqueo mudo?
// ---------------------------------------------------------------------------

// Frases que los canales usan para "ocupado, y no te digo quién". Si el SUMMARY
// es una de estas, no hay nombre que sacar de ahí.
const OPAQUE_SUMMARY = [
    "not available", "unavailable", "closed", "blocked", "block", "busy",
    "reserved", "reservation", "booked", "booking", "airbnb",
    "no disponible", "ocupado", "ocupada", "bloqueado", "bloqueada",
    "cerrado", "reservado", "reservada", "reserva", "external",
];

function summaryIsOpaque(summary: string): boolean {
    const s = summary.toLowerCase().replace(/[^a-z0-9áéíóúñ ]+/gi, " ").trim();
    if (!s) return true;
    return OPAQUE_SUMMARY.some((p) => s.includes(p));
}

// Una línea "CLAVE: valor" del DESCRIPTION, tolerando acentos y variantes.
function fieldFrom(description: string, keys: string[]): string | undefined {
    for (const line of description.split(/\n+/)) {
        const m = line.match(/^\s*([^:]{1,40}?)\s*:\s*(.+?)\s*$/);
        if (!m) continue;
        const key = m[1].toLowerCase().replace(/[^a-z0-9 ]+/gi, "").trim();
        if (keys.includes(key)) {
            const v = m[2].trim();
            if (v && v !== "-" && v.toLowerCase() !== "n/a") return v;
        }
    }
    return undefined;
}

const NAME_KEYS  = ["name", "guest", "guest name", "guestname", "nombre",
                    "cliente", "huesped", "husped", "titular"];
const EMAIL_KEYS = ["email", "e mail", "mail", "correo"];
const PHONE_KEYS = ["phone", "phone number", "telephone", "tel", "telefono",
                    "telfono", "movil", "mvil"];
const LOC_KEYS   = ["reservation id", "reservation number", "reservationid",
                    "booking id", "booking number", "confirmation code",
                    "confirmation number", "locator", "localizador",
                    "codigo de reserva", "cdigo de reserva", "numero de reserva",
                    "nmero de reserva", "reference", "referencia"];

// El nombre no puede ser cualquier cosa: descartamos correos, URLs, números
// sueltos y frases de relleno. Vale más quedarse en bloqueo que inventar
// una reserva a nombre de "Not available".
function looksLikeName(v: string): boolean {
    const s = v.trim();
    if (s.length < 3 || s.length > 80) return false;
    if (/[@\/]|https?:/i.test(s)) return false;
    if (!/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]{2}/.test(s)) return false;
    if (/^\d+$/.test(s)) return false;
    if (summaryIsOpaque(s)) return false;
    return true;
}

export function extractGuestInfo(ev: IcalEvent): GuestInfo {
    const desc = ev.description || "";
    const summary = (ev.summary || "").trim();

    // Localizador: primero el campo explícito; si no, el código que Airbnb
    // deja en la URL de la reserva (…/details/HMXXXXXXXX).
    let locator = fieldFrom(desc, LOC_KEYS);
    if (!locator) {
        const m = desc.match(/reservations?\/details\/([A-Z0-9]{6,20})/i);
        if (m) locator = m[1];
    }
    if (!locator) {
        const m = desc.match(/\b(?:reserva|reservation|booking)\s*(?:n[ºo.]?|#)\s*([A-Z0-9-]{5,20})\b/i);
        if (m) locator = m[1];
    }

    const email = fieldFrom(desc, EMAIL_KEYS);
    const phone = fieldFrom(desc, PHONE_KEYS);

    // Nombre: primero DESCRIPTION (fiable), luego SUMMARY si no es una de las
    // frases opacas. "Reserva: Carmen López" cuenta: se le quita el prefijo.
    let name = fieldFrom(desc, NAME_KEYS);
    if (name && !looksLikeName(name)) name = undefined;

    if (!name && summary) {
        const stripped = summary.replace(
            /^\s*(reserva|reservation|booking|booked by|cliente|huésped|huesped)\s*[:\-–]\s*/i, "",
        ).trim();
        const candidate = stripped !== summary ? stripped : summary;
        if (looksLikeName(candidate)) name = candidate;
    }

    if (name) {
        return { kind: "reservation", guestName: name, guestEmail: email, guestPhone: phone, locator };
    }
    return { kind: "block", guestEmail: email, guestPhone: phone, locator };
}

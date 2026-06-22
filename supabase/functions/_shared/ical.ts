// Parser y serializador iCal (RFC 5545) minimalistas.
// =====================================================
// No usamos librerías externas para mantener el bundle pequeño. Cubrimos lo
// que Booking, Airbnb y Vrbo emiten en sus feeds de reservas (VEVENT con
// DTSTART, DTEND, UID, SUMMARY, STATUS).
// Multi-día con DATE-only (más común en hospedaje); también aceptamos
// DATE-TIME por si algún canal lo manda así.

export interface IcalEvent {
    uid: string;
    start: string;   // YYYY-MM-DD
    end: string;     // YYYY-MM-DD (exclusivo en iCal)
    summary?: string;
    status?: string; // CONFIRMED | CANCELLED | TENTATIVE
}

// Desenvuelve líneas continuadas (RFC 5545: si línea empieza por espacio o tab, va con la anterior)
function unfold(raw: string): string[] {
    const lines = raw.replace(/\r\n/g, "\n").split("\n");
    const out: string[] = [];
    for (const line of lines) {
        if (out.length && /^[\s\t]/.test(line)) {
            out[out.length - 1] += line.slice(1);
        } else {
            out.push(line);
        }
    }
    return out.filter(l => l.length > 0);
}

// Convierte DTSTART/DTEND a YYYY-MM-DD. Acepta:
//   20260620          (DATE)
//   20260620T140000Z  (DATE-TIME UTC) -> tomamos la parte de fecha
//   20260620T140000   (DATE-TIME floating) -> idem
function toIsoDate(raw: string): string | null {
    if (!raw) return null;
    const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseIcal(raw: string): IcalEvent[] {
    const lines = unfold(raw);
    const events: IcalEvent[] = [];
    let current: Partial<IcalEvent> | null = null;
    let inEvent = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "BEGIN:VEVENT") {
            current = {};
            inEvent = true;
            continue;
        }
        if (trimmed === "END:VEVENT") {
            if (current && current.uid && current.start && current.end) {
                events.push(current as IcalEvent);
            }
            current = null;
            inEvent = false;
            continue;
        }
        if (!inEvent || !current) continue;

        // Cada línea de propiedad es NAME[;param=val][;param=val]:VALUE
        const colon = line.indexOf(":");
        if (colon < 0) continue;
        const left = line.slice(0, colon);
        const right = line.slice(colon + 1);
        const name = left.split(";")[0].toUpperCase();

        switch (name) {
            case "UID": current.uid = right.trim(); break;
            case "DTSTART": current.start = toIsoDate(right) ?? undefined; break;
            case "DTEND":   current.end = toIsoDate(right) ?? undefined; break;
            case "SUMMARY": current.summary = right.trim(); break;
            case "STATUS":  current.status = right.trim().toUpperCase(); break;
        }
    }
    return events;
}

// ============================================================
// Serializador iCal — para nuestro endpoint /ical/:slug.ics
// ============================================================

interface BookingForIcal {
    booking_code: string;
    check_in: string;     // YYYY-MM-DD
    check_out: string;    // YYYY-MM-DD
    status: string;
    guest_name?: string | null;
}

const escapeText = (s: string): string =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const dateStamp = (): string => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
};

const fmtDate = (iso: string): string => iso.replace(/-/g, "");

// Líneas largas a 75 chars (RFC 5545 fold)
function fold(line: string): string {
    if (line.length <= 75) return line;
    const out: string[] = [];
    let pos = 0;
    while (pos < line.length) {
        const chunk = line.slice(pos, pos + (pos === 0 ? 75 : 74));
        out.push(pos === 0 ? chunk : " " + chunk);
        pos += pos === 0 ? 75 : 74;
    }
    return out.join("\r\n");
}

export function buildIcalFeed(opts: {
    apartmentSlug: string;
    apartmentName: string;
    bookings: BookingForIcal[];
}): string {
    const stamp = dateStamp();
    const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Apartamentos Tio Jose Maria//ical-export//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        fold(`X-WR-CALNAME:${escapeText(opts.apartmentName)} — TJM`),
        "X-WR-TIMEZONE:Europe/Madrid",
    ];

    for (const b of opts.bookings) {
        const status = b.status === "confirmed" ? "CONFIRMED" : b.status === "hold" ? "TENTATIVE" : "CONFIRMED";
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${b.booking_code}@tiojosemaria.com`);
        lines.push(`DTSTAMP:${stamp}`);
        lines.push(`DTSTART;VALUE=DATE:${fmtDate(b.check_in)}`);
        lines.push(`DTEND;VALUE=DATE:${fmtDate(b.check_out)}`);
        lines.push(fold(`SUMMARY:Reservado — ${escapeText(opts.apartmentName)}`));
        lines.push(`STATUS:${status}`);
        lines.push("TRANSP:OPAQUE");
        lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
}

// Prueba del parser DENTRO del runtime desplegado.
// ================================================
// `node --test parse.test.ts` prueba el código del repo. Esto prueba el
// código que de verdad está corriendo en Supabase, que no siempre es lo
// mismo. Se invoca con  POST {"selftest": true}  o  ?selftest=1.
//
// No toca la base ni la red: solo feeds de mentira contra el parser.

import { addDays, extractGuestInfo, parseIcal } from "./parse.ts";

const CRLF = "\r\n";
const ics = (...l: string[]) => l.join(CRLF) + CRLF;

const FEED_AIRBNB = ics(
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261123",
    "UID:1234567890abcdef@airbnb.com", "SUMMARY:Reserved",
    "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservatio",
    " ns/details/HMABCD1234\\nPhone Number (Last 4 Digits): 6789",
    "END:VEVENT", "END:VCALENDAR",
);

const FEED_BOOKING = ics(
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Booking.com//Calendar//EN",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20260925", "DTEND;VALUE=DATE:20260927",
    "UID:5544332211@booking.com", "SUMMARY:CLOSED - Not available",
    "DESCRIPTION:CHECKIN: 2026-09-25\\nCHECKOUT: 2026-09-27\\nNAME: Carmen Lopez" +
    "\\nEMAIL: carmen.lopez@guest.booking.com\\nBOOKING ID: 4455667788",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261220", "DTEND;VALUE=DATE:20261222",
    "UID:cancelada-1@booking.com", "SUMMARY:CLOSED - Not available", "STATUS:CANCELLED",
    "END:VEVENT", "END:VCALENDAR",
);

interface Check { nombre: string; ok: boolean; esperado?: unknown; obtenido?: unknown }

export function runSelfTest() {
    const checks: Check[] = [];
    const eq = (nombre: string, obtenido: unknown, esperado: unknown) =>
        checks.push({ nombre, ok: obtenido === esperado, esperado, obtenido });

    const a = parseIcal(FEED_AIRBNB);
    eq("airbnb: 1 evento", a.length, 1);
    eq("airbnb: fecha de entrada", a[0]?.start, "2026-11-20");
    eq("airbnb: DTEND exclusivo", a[0]?.end, "2026-11-23");
    const ga = extractGuestInfo(a[0]);
    eq("airbnb: sin nombre -> bloqueo", ga.kind, "block");
    eq("airbnb: localizador de la URL desdoblada", ga.locator, "HMABCD1234");
    eq("airbnb: los 4 digitos NO son un telefono", ga.guestPhone, undefined);

    const b = parseIcal(FEED_BOOKING);
    eq("booking: 2 eventos", b.length, 2);
    const gb = extractGuestInfo(b[0]);
    eq("booking: con nombre -> reserva", gb.kind, "reservation");
    eq("booking: nombre", gb.guestName, "Carmen Lopez");
    eq("booking: correo", gb.guestEmail, "carmen.lopez@guest.booking.com");
    eq("booking: localizador", gb.locator, "4455667788");
    eq("booking: cancelada marcada", b[1]?.status, "CANCELLED");

    for (const s of ["Reserved", "CLOSED - Not available", "Airbnb (Not available)",
                     "Not available", "Blocked", "Ocupado", "No disponible", "Reservado"]) {
        const g = extractGuestInfo({ uid: "x", start: "2026-01-01", end: "2026-01-02", summary: s });
        eq(`opaco "${s}" no pasa por nombre`, g.kind, "block");
    }

    eq("addDays fin de mes", addDays("2026-02-28", 1), "2026-03-01");
    eq("addDays cambio de hora", addDays("2026-03-28", 2), "2026-03-30");
    eq("addDays fin de anio", addDays("2026-12-31", 1), "2027-01-01");

    const fallos = checks.filter((c) => !c.ok);
    return {
        selftest: true,
        total: checks.length,
        pasan: checks.length - fallos.length,
        fallan: fallos.length,
        ok: fallos.length === 0,
        fallos,
    };
}

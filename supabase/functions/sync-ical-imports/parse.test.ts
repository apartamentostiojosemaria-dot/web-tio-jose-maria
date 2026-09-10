// Pruebas del parser iCal del importador.
//
// Se ejecutan con Node (no hace falta Deno ni desplegar nada):
//     node --test supabase/functions/sync-ical-imports/parse.test.ts
//
// Los feeds de abajo son copias del formato real de cada canal, con datos
// inventados. Booking manda nombre → tiene que salir RESERVA. Airbnb no manda
// nombre → tiene que seguir saliendo BLOQUEO, como hasta hoy.

import test from "node:test";
import assert from "node:assert/strict";
import { parseIcal, extractGuestInfo, addDays } from "./parse.ts";

const CRLF = "\r\n";
const ics = (...lines: string[]) => lines.join(CRLF) + CRLF;

// --- Airbnb: bloqueo mudo, con URL de reserva pero sin nombre --------------
const FEED_AIRBNB = ics(
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261120",
    "DTEND;VALUE=DATE:20261123",
    "UID:1234567890abcdef@airbnb.com",
    "SUMMARY:Reserved",
    "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservatio",
    " ns/details/HMABCD1234\\nPhone Number (Last 4 Digits): 6789",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261201",
    "DTEND;VALUE=DATE:20261203",
    "UID:blocked-0001@airbnb.com",
    "SUMMARY:Airbnb (Not available)",
    "END:VEVENT",
    "END:VCALENDAR",
);

// --- Booking: reserva con nombre y localizador en DESCRIPTION --------------
const FEED_BOOKING = ics(
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Booking.com//Calendar//EN",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20260925",
    "DTEND;VALUE=DATE:20260927",
    "UID:5544332211@booking.com",
    "SUMMARY:CLOSED - Not available",
    "DESCRIPTION:CHECKIN: 2026-09-25\\nCHECKOUT: 2026-09-27\\nNAME: Carmen L" ,
    " opez Ruiz\\nEMAIL: carmen.lopez@guest.booking.com\\nPHONE: +34600111222" +
    "\\nBOOKING ID: 4455667788",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261113",
    "DTEND;VALUE=DATE:20261115",
    "UID:9988776655@booking.com",
    "SUMMARY:CLOSED - Not available",
    "DESCRIPTION:CHECKIN: 2026-11-13\\nCHECKOUT: 2026-11-15\\nNAME: \\nEMAIL:" ,
    " \\nPHONE: ",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261220",
    "DTEND;VALUE=DATE:20261222",
    "UID:cancelada-1@booking.com",
    "SUMMARY:CLOSED - Not available",
    "STATUS:CANCELLED",
    "END:VEVENT",
    "END:VCALENDAR",
);

// --- EscapadaRural: nombre directamente en el SUMMARY ----------------------
const FEED_ESCAPADA = ics(
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:er-77001@escapadarural.com",
    "DTSTART;VALUE=DATE:20261010",
    "DTEND;VALUE=DATE:20261013",
    "SUMMARY:Reserva: Antonio Ruiz Melero",
    "DESCRIPTION:Localizador: ER-77001",
    "END:VEVENT",
    "END:VCALENDAR",
);

test("Airbnb: parsea los dos eventos con UID y fechas", () => {
    const evs = parseIcal(FEED_AIRBNB);
    assert.equal(evs.length, 2);
    assert.equal(evs[0].uid, "1234567890abcdef@airbnb.com");
    assert.equal(evs[0].start, "2026-11-20");
    assert.equal(evs[0].end, "2026-11-23");        // DTEND exclusivo
});

test("Airbnb: sin nombre -> sigue siendo BLOQUEO, pero saca el localizador", () => {
    const [reserved, blocked] = parseIcal(FEED_AIRBNB);

    const a = extractGuestInfo(reserved);
    assert.equal(a.kind, "block", "'Reserved' no es un nombre de persona");
    assert.equal(a.locator, "HMABCD1234", "de la Reservation URL desdoblada");
    // "Phone Number (Last 4 Digits): 6789" NO es un telefono: son 4 digitos
    // sueltos. Guardarlo como telefono seria dar por bueno un dato falso.
    assert.equal(a.guestPhone, undefined);

    const b = extractGuestInfo(blocked);
    assert.equal(b.kind, "block");
    assert.equal(b.guestName, undefined);
});

test("Booking: con NAME -> RESERVA con nombre, email y localizador", () => {
    const evs = parseIcal(FEED_BOOKING);
    assert.equal(evs.length, 3);

    const g = extractGuestInfo(evs[0]);
    assert.equal(g.kind, "reservation");
    assert.equal(g.guestName, "Carmen Lopez Ruiz");
    assert.equal(g.guestEmail, "carmen.lopez@guest.booking.com");
    assert.equal(g.guestPhone, "+34600111222");
    assert.equal(g.locator, "4455667788");
});

test("Booking: NAME vacio -> bloqueo, no una reserva sin nombre", () => {
    const g = extractGuestInfo(parseIcal(FEED_BOOKING)[1]);
    assert.equal(g.kind, "block");
    assert.equal(g.guestName, undefined);
});

test("Booking: STATUS:CANCELLED se conserva para que el importador lo retire", () => {
    assert.equal(parseIcal(FEED_BOOKING)[2].status, "CANCELLED");
});

test("EscapadaRural: nombre en el SUMMARY con prefijo 'Reserva:'", () => {
    const g = extractGuestInfo(parseIcal(FEED_ESCAPADA)[0]);
    assert.equal(g.kind, "reservation");
    assert.equal(g.guestName, "Antonio Ruiz Melero");
    assert.equal(g.locator, "ER-77001");
});

test("Ningun SUMMARY opaco se cuela como nombre de huesped", () => {
    for (const s of ["Reserved", "CLOSED - Not available", "Airbnb (Not available)",
                     "Not available", "Blocked", "Ocupado", "No disponible",
                     "Reservado", "Busy", "External booking"]) {
        const g = extractGuestInfo({ uid: "x", start: "2026-01-01", end: "2026-01-02", summary: s });
        assert.equal(g.kind, "block", `"${s}" no debe pasar por nombre`);
    }
});

test("Lineas desdobladas y texto escapado", () => {
    const evs = parseIcal(FEED_AIRBNB);
    assert.match(evs[0].description!, /HMABCD1234/);
    assert.match(evs[0].description!, /\n/, "el \\n escapado se convierte en salto real");
});

test("DTEND ausente -> una noche", () => {
    const one = parseIcal(ics(
        "BEGIN:VCALENDAR", "BEGIN:VEVENT",
        "UID:solo-una@x", "DTSTART;VALUE=DATE:20260301",
        "SUMMARY:Ocupado", "END:VEVENT", "END:VCALENDAR",
    ));
    assert.equal(one.length, 1);
    assert.equal(one[0].end, "2026-03-02");
});

test("VALARM dentro del VEVENT no pisa el SUMMARY", () => {
    const evs = parseIcal(ics(
        "BEGIN:VCALENDAR", "BEGIN:VEVENT",
        "UID:con-alarma@x",
        "DTSTART;VALUE=DATE:20260401", "DTEND;VALUE=DATE:20260403",
        "SUMMARY:NAME: Lucia Pardo",
        "BEGIN:VALARM", "ACTION:DISPLAY", "SUMMARY:Recordatorio", "END:VALARM",
        "END:VEVENT", "END:VCALENDAR",
    ));
    assert.equal(evs[0].summary, "NAME: Lucia Pardo");
});

test("addDays no se descoloca en cambio de mes ni de horario de verano", () => {
    assert.equal(addDays("2026-02-28", 1), "2026-03-01");
    assert.equal(addDays("2026-03-28", 2), "2026-03-30");   // cambio de hora en Madrid
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-11-23", -1), "2026-11-22");
});

// Pruebas del parser de correos de MisterPlan.
//   node --import tsx --test src/lib/misterplan-correo.test.ts
// Muestras con la estructura EXACTA de los correos reales (16-sep-2026),
// datos inventados.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parsearCorreoMisterPlan, clasificar } from "./misterplan-correo.js";

const RESERVA_BOOKING = `<html><body><style>.x{}</style>
<table><tr><td class="DRB_texto_nombre">APARTAMENTOS RURALES TIO JOSE MARÍA</td></tr>
<tr><td class="DRB_texto_localizador">Reserva: 1-8060298</td></tr></table>
<!-- comentario --> --> <td>Booking.com</td>
<td>Localizador: 5978834073</td>
<td>Nombre Apellido Ficticio</td>
<td>ficticio.123@guest.booking.com</td>
<td>/ +34600000000</td>
<td>España</td>
<td>Observaciones:</td>
<td>---- 13/09/2026 17:08:27 ----</td>
<td>Comentario del Cliente: Has recibido una tarjeta de crédito virtual para esta reserva.Puedes hacer el cargo a partir del 2026-09-14.<br>Approximate time of arrival: between 15:00 and 16:00</td>
<td>--------</td>
<td>Importe Total: 135,00&euro;</td>
<td>APARTAMENTOS RURALES TIO JOSE MARÍA</td>
<td>18/09/2026 - 2 noches - 2 personas</td>
<td>1</td><td>Apartamento</td><td>para</td><td>2 Adultos</td><td>(TOMILLO)</td>
<td>WIFI u otro acceso a INTERNET, TV</td>
</body></html>`;

const RESERVA_AIRBNB = RESERVA_BOOKING
    .replace("Booking.com", "AIRBNB OTA").replace("Localizador: 5978834073", "Localizador: HM9QHEKSHM")
    .replace("<td>ficticio.123@guest.booking.com</td>", "").replace("(TOMILLO)", "(LAVANDA)")
    .replace("18/09/2026 - 2 noches - 2 personas", "30/07/2027 - 2 noches - 4 personas");

const CANCELACION = `<html><body>
<td>Cancelación de reserva desde Booking</td>
<td>Reserva desde Booking 5350082570</td>
<td>Fecha entrada: 25/09/2026</td><td>Nº noches: 2</td>
<td>Localizador Booking: 5350082570</td><td>Importe Total: 135 &euro;</td>
<td>Elementos de la reserva:</td><td>ALBAHACA.</td><td>2 pax</td><td>(Id Booking: 36471202)</td><td>67.5 &euro;.</td>
<td>Datos del cliente:</td><td>Nombre : Persona Ficticia</td><td>email : pf.111@guest.booking.com</td>
</body></html>`;

const MODIFICACION = `<html><body>
<td>Ha llegado una modificación de la reserva 6846069450 desde Booking</td>
<td>Fecha entrada: 03/08/2026</td><td>Nº noches: 3</td>
<td>Localizador Booking: 6846069450</td><td>Importe Total: 189 &euro;</td>
<td>Elementos de la reserva:</td><td>ALBAHACA.</td><td>2 pax</td>
<td>Nombre : Otra Persona</td><td>email : op.222@guest.booking.com</td><td>Teléfono : +34655000000</td>
<td>Comentario de la reserva:</td><td>Comentario del Cliente: Has recibido una tarjeta de crédito virtual para esta reserva.Puedes hacer el cargo a partir del 2026-07-27.</td>
</body></html>`;

const CONFIRMACION_WEB = `<html><body>
<td>Confirmación de reserva</td>
<td>Cliente: Cliente Web Ficticio</td><td>Teléfono: +34650000000</td>
<td>Fecha de reserva: 14/09/2026</td><td>Fecha entrada: 08/10/2026</td><td>Fecha salida: 12/10/2026</td><td>Nº personas: 4</td>
<td>Conceptos de la reserva</td><td>Nombre</td><td>Uds.</td><td>Días</td><td>Precio</td><td>IVA</td><td>Importe</td>
<td>ROMERO (08/10/2026)</td><td>4 Pax.</td><td>1</td><td>4</td><td>130,00 &euro;</td><td>Incluido.</td><td>520,00 &euro;</td>
<td>Total</td><td>520,00 &euro;</td><td>Anticipo Pagado</td><td>520,00 &euro;</td><td>Pagado</td><td>520,00 &euro;</td>
</body></html>`;

test("clasificar por asunto", () => {
    assert.equal(clasificar("Sistema RuralGest - Reserva [3225-8060298]"), "reserva");
    assert.equal(clasificar("Cancelación de reserva desde Booking"), "cancelacion_booking");
    assert.equal(clasificar("Modificación de reserva desde Booking"), "modificacion_booking");
    assert.equal(clasificar("Pre Reserva - APARTAMENTOS RURALES TIO JOSE MARÍA - 8074291"), "pre_reserva");
    assert.equal(clasificar("Confirmación de reserva -  - 8074291"), "confirmacion_web");
    assert.equal(clasificar("Han completado una valoración en su establecimiento - MisterPlan"), "otro");
    assert.equal(clasificar("Sincronización de datos RuralGest [570568] - Desactualizada"), "otro");
});

test("reserva de Booking", () => {
    const p = parsearCorreoMisterPlan("Sistema RuralGest - Reserva [3225-8060298]", RESERVA_BOOKING);
    assert.equal(p.kind, "reserva");
    assert.equal(p.misterplanRef, "1-8060298");
    assert.equal(p.channel, "booking");
    assert.equal(p.locator, "5978834073");
    assert.equal(p.guestName, "Nombre Apellido Ficticio");
    assert.equal(p.guestEmail, "ficticio.123@guest.booking.com");
    assert.equal(p.guestPhone, "+34600000000");
    assert.equal(p.country, "España");
    assert.equal(p.apartment, "tomillo");
    assert.equal(p.checkIn, "2026-09-18");
    assert.equal(p.checkOut, "2026-09-20");
    assert.equal(p.nights, 2);
    assert.equal(p.pax, 2);
    assert.equal(p.total, 135);
    assert.equal(p.vccChargeableFrom, "2026-09-14");
    assert.equal(p.arrivalTime, "15:00 and 16:00");
    assert.deepEqual(p.warnings, []);
});

test("reserva de Airbnb por MisterPlan (sin correo)", () => {
    const p = parsearCorreoMisterPlan("Sistema RuralGest - Reserva [4833-7839506]", RESERVA_AIRBNB);
    assert.equal(p.channel, "airbnb");
    assert.equal(p.locator, "HM9QHEKSHM");
    assert.equal(p.guestName, "Nombre Apellido Ficticio");
    assert.equal(p.guestEmail, undefined);
    assert.equal(p.guestPhone, "+34600000000");
    assert.equal(p.apartment, "lavanda");
    assert.equal(p.checkIn, "2027-07-30");
    assert.equal(p.pax, 4);
    assert.deepEqual(p.warnings, []);
});

test("cancelación desde Booking", () => {
    const p = parsearCorreoMisterPlan("Cancelación de reserva desde Booking", CANCELACION);
    assert.equal(p.kind, "cancelacion_booking");
    assert.equal(p.locator, "5350082570");
    assert.equal(p.checkIn, "2026-09-25");
    assert.equal(p.checkOut, "2026-09-27");
    assert.equal(p.apartment, "albahaca");
    assert.equal(p.pax, 2);
    assert.equal(p.total, 135);
    assert.equal(p.guestName, "Persona Ficticia");
    assert.deepEqual(p.warnings, []);
});

test("modificación desde Booking", () => {
    const p = parsearCorreoMisterPlan("Modificación de reserva desde Booking", MODIFICACION);
    assert.equal(p.kind, "modificacion_booking");
    assert.equal(p.locator, "6846069450");
    assert.equal(p.checkIn, "2026-08-03");
    assert.equal(p.checkOut, "2026-08-06");
    assert.equal(p.total, 189);
    assert.equal(p.guestPhone, "+34655000000");
    assert.equal(p.vccChargeableFrom, "2026-07-27");
    assert.deepEqual(p.warnings, []);
});

test("confirmación del motor web", () => {
    const p = parsearCorreoMisterPlan("Confirmación de reserva -  - 8074291", CONFIRMACION_WEB);
    assert.equal(p.kind, "confirmacion_web");
    assert.equal(p.channel, "web");
    assert.equal(p.misterplanRef, "1-8074291");
    assert.equal(p.guestName, "Cliente Web Ficticio");
    assert.equal(p.guestPhone, "+34650000000");
    assert.equal(p.apartment, "romero");
    assert.equal(p.checkIn, "2026-10-08");
    assert.equal(p.checkOut, "2026-10-12");
    assert.equal(p.nights, 4);
    assert.equal(p.pax, 4);
    assert.equal(p.total, 520);
    assert.equal(p.paid, 520);
    assert.deepEqual(p.warnings, []);
});

test("un correo que no es de reserva sale como otro", () => {
    const p = parsearCorreoMisterPlan("Han completado una valoración en su establecimiento - MisterPlan", "<html>lo que sea</html>");
    assert.equal(p.kind, "otro");
});

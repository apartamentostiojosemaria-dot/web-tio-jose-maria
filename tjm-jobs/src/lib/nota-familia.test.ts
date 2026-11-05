import { test } from "node:test";
import assert from "node:assert/strict";
import { notaFamilia, comentarioDelHuesped, recortar, notaCancelada, notaCambios, notaCompletada } from "./nota-familia.js";

test("cambios, cancelaciones y datos añadidos, en castellano y sin nombres internos", () => {
    const f = new Date("2026-11-05T12:00:00Z");
    assert.equal(notaCambios("booking", { check_in: "2026-12-05", total_price: 229.5, pax_count: 3, apartment_id: 1 }, (id) => (id === 1 ? "Albahaca" : "?"), f),
        "El 05/11 Booking la cambió: entrada el 05/12, importe 229,50 €, 3 personas, ahora en Albahaca.");
    assert.equal(notaCancelada("booking", f), "Cancelada en Booking el 05/11. No hay nada que devolver: el cobro era de Booking.");
    assert.equal(notaCompletada(["guest_email", "guest_phone"], f), "El 05/11 se añadió: correo, teléfono.");
    assert.doesNotMatch(notaCambios("booking", { check_out: "2026-12-08" }, () => "", f), /check_|total_price|→/);
});

// El caso real del 5-nov-2026 (Pedro E., Tomillo 4-7 dic, Booking 5222186144)
const OBS_REAL = "---- 05/11/2026 13:01:06 ---- Comentario del Cliente: Has recibido una tarjeta de crédito virtual para esta reserva.Puedes hacer el cargo a partir del 2026-11-27. Condiciones para la habitacion Apartamento de 1 dormitorio - General: El precio de esta habitación no incluye servicio de comidas. Condiciones de cancelación…";

test("el relleno de Booking no es un comentario del huésped", () => {
    assert.equal(comentarioDelHuesped(OBS_REAL), "");
    assert.equal(comentarioDelHuesped("Comentario del Cliente: Has recibido una tarjeta de crédito virtual para esta reserva.Puedes hacer el cargo a partir del 2026-07-27."), "");
});

test("lo que escribe el huésped sí se queda, y la hora de llegada en castellano", () => {
    assert.equal(comentarioDelHuesped("---- 01/10/2026 10:00:00 ---- Comentario del Cliente: Llegamos con un perro pequeño, ¿hay problema?"),
        "Llegamos con un perro pequeño, ¿hay problema?");
    assert.equal(comentarioDelHuesped("Comentario del Cliente: Has recibido una tarjeta de crédito virtual para esta reserva.Puedes hacer el cargo a partir del 2026-09-14. Approximate time of arrival: between 15:00 and 16:00"),
        "Llegada aproximada entre las 15:00 y las 16:00.");
});

test("nota del caso real: llana, sin jerga, sin repetir y sin cortar palabras", () => {
    const n = notaFamilia({ canal: "booking", locator: "5222186144", misterplanRef: "1-8327906", total: 229.5, nights: 3, pax: 2,
        vccChargeableFrom: "2026-11-27", comision: 39.02, comments: OBS_REAL });
    assert.equal(n, "Reserva de Booking · localizador 5222186144. 229,50 € por 3 noches, 2 personas. La paga Booking con tarjeta virtual: se puede cobrar desde el 27/11. Comisión de Booking ≈ 39,02 €. (En MisterPlan: 1-8327906)");
    assert.doesNotMatch(n, /Traída|leído|Comentario del Cliente|Condiciones|tarjeta de crédito virtual para esta reserva/);
});

test("el plazo de cancelación gratis de Booking (en inglés y con <br>) sale en castellano y no como palabras del huésped", () => {
    const obs = "Comentario del Cliente: Has recibido una tarjeta de crédito virtual para esta reserva.Puedes hacer el cargo a partir del 2026-09-20.<br>Reservation has a cancellation grace period. Do not charge if cancelled before 2026-09-20 23:52:16";
    assert.equal(comentarioDelHuesped(obs), "");
    const n = notaFamilia({ canal: "booking", locator: "6113650280", total: 378, nights: 3, pax: 4, vccChargeableFrom: "2026-09-20", comision: 64.26, comments: obs });
    assert.match(n, /Puede cancelar gratis hasta el 20\/09 a las 23:52: no cobrar antes\./);
    assert.doesNotMatch(n, /huésped dice|<br>|Reservation|Do not charge/);
});

test("la hora de llegada que viene en inglés sale en castellano", () => {
    assert.match(notaFamilia({ canal: "booking", arrivalTime: "15:00 and 16:00" }), /Llegará entre las 15:00 y las 16:00\./);
    assert.match(notaFamilia({ canal: "booking", arrivalTime: "18:30" }), /Hora de llegada que ha dicho: 18:30\./);
});

test("Airbnb, web y singulares", () => {
    assert.match(notaFamilia({ canal: "airbnb", total: 100, nights: 1, pax: 1 }), /^Reserva de Airbnb\. 100,00 € por 1 noche, 1 persona\. La cobra Airbnb: no hay que cobrar nada en persona\.$/);
    assert.match(notaFamilia({ canal: "web", paid: 50, total: 200 }), /Ha pagado 50,00 € de señal por transferencia/);
});

test("recortar corta por palabras y pone «…»", () => {
    const r = recortar("uno dos tres cuatro cinco seis siete ocho nueve diez", 20);
    assert.ok(r.endsWith("…") && r.length <= 20 && !/\w…$/.test(r.replace(/\s\S+…$/, "")));
    assert.equal(recortar("corto", 20), "corto");
});

test("reserva de varios apartamentos lo dice en la nota", () => {
    assert.match(notaFamilia({ canal: "booking", apartamentos: ["Romero", "Albahaca"] }), /Son 2 apartamentos: Romero y Albahaca/);
});

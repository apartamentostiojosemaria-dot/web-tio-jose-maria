// Tests for the Ministry rules of the travellers' report (audit 10-oct-2026, fase 1 16-oct).
// Run: deno test supabase/functions/submit-ses-hospedajes/parte-modelo.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
    completaTitularDesdeFicha, limpiaTexto, paisValido, pegasDelParte, soloLatino,
    type ContratoParte, type ViajeroParte,
} from "./parte-modelo.ts";

function viajero(extra: Partial<ViajeroParte> = {}): ViajeroParte {
    return {
        id: crypto.randomUUID(), esTitular: true, nombre: "Ana", apellido1: "García", apellido2: "López",
        sexo: "M", tipoDocumento: "PAS", numeroDocumento: "X1234567", soporteDocumento: null,
        nacionalidad: "FRA", fechaNacimiento: "1980-01-01", direccion: "Rue 1", municipio: "Lyon",
        codigoMunicipio: null, codigoPostal: "69001", pais: "FRA", telefonoFijo: null,
        telefonoMovil: "+33600000000", correo: null, parentesco: null, parentescoMenorId: null,
        firmaBase64: "x", edad: 46, ...extra,
    };
}
const faltas = (vs: ViajeroParte[], pax = 0) => pegasDelParte(vs, pax).map((p) => p.falta).join(" | ");

Deno.test("M1/F8: fewer forms than people booked blocks the report", () => {
    assert(faltas([viajero()], 2).includes("una ficha"));
    assert(!faltas([viajero()], 1).includes("ficha"));
});

Deno.test("M2: Spaniard aged 15 without document", () => {
    const menor = viajero({ esTitular: false, nacionalidad: "ESP", numeroDocumento: "", edad: 15, firmaBase64: "x" });
    assert(faltas([viajero(), menor]).includes("DNI"));
});

Deno.test("M4: postcode required abroad", () => {
    assert(faltas([viajero({ codigoPostal: "" })]).includes("código postal"));
});

Deno.test("M5: non-Latin names are flagged, accents are fine", () => {
    assert(soloLatino("José Ñúñez d'Ávila-Pérez"));
    assert(!soloLatino("Иван"));
    assert(faltas([viajero({ nombre: "王" })]).includes("letras latinas"));
});

Deno.test("M6: control characters and emoji are removed", () => {
    assertEquals(limpiaTexto("Ana\u0007 😀 García\n"), "Ana García");
});

Deno.test("M7: ISO alpha-3 only", () => {
    assert(paisValido("ESP"));
    assert(!paisValido("XXX"));
    assert(faltas([viajero({ nacionalidad: "XXX" })]).includes("nacionalidad"));
});

Deno.test("holder contact comes from the guest's own form when the platform hid it", () => {
    const contrato = {
        titularContrato: { nombre: "Fatima", apellido1: "", apellido2: null, correo: null, telefono: null, completo: false },
    } as unknown as ContratoParte;
    completaTitularDesdeFicha(contrato, [viajero({ nombre: "Fatima", apellido1: "Fernández", telefonoMovil: "+34600111222" })]);
    assertEquals(contrato.titularContrato.apellido1, "Fernández");
    assert(contrato.titularContrato.completo);
    assert(contrato.titularContrato.telefono);
});

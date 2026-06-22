// Edge function: submit-ses-hospedajes
// =====================================
// Itera traveler_records con submitted_at IS NULL (de bookings cuyo check_in
// ya ha ocurrido), genera el XML del Anexo III del RD 933/2021 y lo envía al
// API SES.HOSPEDAJES del Ministerio del Interior.
//
// Endpoint REAL del MIR (cuando el operador tenga alta + cert.cliente):
//   https://sede.mir.gob.es/ses-hospedajes/api/v1/comunicaciones
//
// Mientras el operador no tenga cert.cliente, esta función opera en STUB
// MODE: genera el XML, lo guarda en mir_response_payload con
// status='stub_no_credentials', y marca submitted_at. Cuando llegue el cert,
// se cambia SES_API_ENDPOINT a producción y SES_CLIENT_CERT_PEM/KEY al cert
// real, y los envíos van de verdad.
//
// Env vars:
//   SES_API_ENDPOINT      (opcional, default = stub)
//   SES_CLIENT_CERT_PEM   certificado X.509 PEM del titular
//   SES_CLIENT_KEY_PEM    clave privada PEM
//   SES_ESTABLISHMENT_CODE  código asignado por MIR al alojamiento
//
// Trigger: invocada diariamente por tjm-jobs daily-ses-submit (Sprint 7d).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SES_API_ENDPOINT = Deno.env.get("SES_API_ENDPOINT");
const SES_ESTABLISHMENT_CODE = Deno.env.get("SES_ESTABLISHMENT_CODE") || "PENDING_ALTA_MIR";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status, headers: { "content-type": "application/json" },
    });

const escapeXml = (s: string | null | undefined): string => {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
};

interface TravelerRow {
    id: string;
    booking_id: number;
    is_titular: boolean;
    apellido_primero: string;
    apellido_segundo: string | null;
    nombre: string;
    sexo: string;
    tipo_documento: string;
    numero_documento: string;
    soporte_documento: string | null;
    nacionalidad: string;
    fecha_nacimiento: string;
    direccion_via: string;
    direccion_municipio: string;
    direccion_cp: string;
    direccion_pais: string;
    telefono_fijo: string | null;
    telefono_movil: string | null;
    email: string | null;
    parentesco: string | null;
    firma_base64: string | null;
}

interface BookingRow {
    id: number;
    booking_code: string;
    check_in: string;
    check_out: string;
    apartment_id: number;
}

// Genera el XML del parte de viajero según RD 933/2021 Anexo III.
// Esquema simplificado en línea con lo publicado por el MIR para SES.HOSPEDAJES.
// La especificación oficial completa incluye namespaces y firma XAdES — al
// integrar con el cert.cliente real se ampliará.
function buildPartXml(opts: {
    establishmentCode: string;
    booking: BookingRow;
    travelers: TravelerRow[];
}): string {
    const { establishmentCode, booking, travelers } = opts;
    const now = new Date().toISOString();
    const titular = travelers.find(t => t.is_titular) || travelers[0];

    const viajerosXml = travelers.map(t => `
    <viajero>
      <rol>${t.is_titular ? "TITULAR" : "ACOMPANANTE"}</rol>
      <nombre>${escapeXml(t.nombre)}</nombre>
      <apellidoPrimero>${escapeXml(t.apellido_primero)}</apellidoPrimero>
      <apellidoSegundo>${escapeXml(t.apellido_segundo)}</apellidoSegundo>
      <sexo>${escapeXml(t.sexo)}</sexo>
      <documento>
        <tipo>${escapeXml(t.tipo_documento)}</tipo>
        <numero>${escapeXml(t.numero_documento)}</numero>
        <soporte>${escapeXml(t.soporte_documento)}</soporte>
        <nacionalidad>${escapeXml(t.nacionalidad)}</nacionalidad>
      </documento>
      <fechaNacimiento>${escapeXml(t.fecha_nacimiento)}</fechaNacimiento>
      <direccionHabitual>
        <via>${escapeXml(t.direccion_via)}</via>
        <municipio>${escapeXml(t.direccion_municipio)}</municipio>
        <codigoPostal>${escapeXml(t.direccion_cp)}</codigoPostal>
        <pais>${escapeXml(t.direccion_pais)}</pais>
      </direccionHabitual>
      <contacto>
        <telefonoFijo>${escapeXml(t.telefono_fijo)}</telefonoFijo>
        <telefonoMovil>${escapeXml(t.telefono_movil)}</telefonoMovil>
        <email>${escapeXml(t.email)}</email>
      </contacto>
      ${t.parentesco ? `<parentescoConTitular>${escapeXml(t.parentesco)}</parentescoConTitular>` : ""}
    </viajero>`).join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<parteViajeros xmlns="https://sede.mir.gob.es/ses-hospedajes/schemas/v1">
  <cabecera>
    <codigoEstablecimiento>${escapeXml(establishmentCode)}</codigoEstablecimiento>
    <referenciaInterna>${escapeXml(booking.booking_code)}</referenciaInterna>
    <fechaEntrada>${escapeXml(booking.check_in)}</fechaEntrada>
    <fechaSalida>${escapeXml(booking.check_out)}</fechaSalida>
    <fechaGeneracion>${escapeXml(now)}</fechaGeneracion>
    <numeroViajeros>${travelers.length}</numeroViajeros>
    <titular>${escapeXml(titular?.numero_documento || "")}</titular>
  </cabecera>
  <viajeros>${viajerosXml}
  </viajeros>
</parteViajeros>`;
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    // Cargar bookings con viajeros pendientes (submitted_at IS NULL) cuyo
    // check_in ya ha ocurrido o es hoy. Eso garantiza que solo enviamos al
    // MIR al inicio de la estancia (el RD 933/2021 exige transmisión en 24h
    // desde la entrada efectiva).
    const { data: pending, error } = await supabase
        .from("traveler_records")
        .select(`id, booking_id, is_titular,
                 apellido_primero, apellido_segundo, nombre, sexo,
                 tipo_documento, numero_documento, soporte_documento,
                 nacionalidad, fecha_nacimiento,
                 direccion_via, direccion_municipio, direccion_cp, direccion_pais,
                 telefono_fijo, telefono_movil, email, parentesco, firma_base64,
                 guest_bookings!inner(id, booking_code, check_in, check_out, apartment_id, status)`)
        .is("submitted_at", null)
        .lte("guest_bookings.check_in", new Date().toISOString().slice(0, 10))
        .in("guest_bookings.status", ["confirmed", "completed"]);

    if (error) return json(500, { error: error.message });

    if (!pending || pending.length === 0) return json(200, { sent: 0, message: "no_pending_records" });

    // Agrupar por booking_id
    const byBooking = new Map<number, { booking: BookingRow; travelers: TravelerRow[] }>();
    for (const row of pending) {
        const b = (row.guest_bookings as unknown as BookingRow);
        if (!byBooking.has(b.id)) byBooking.set(b.id, { booking: b, travelers: [] });
        byBooking.get(b.id)!.travelers.push(row as unknown as TravelerRow);
    }

    let sent = 0, errors = 0, stubbed = 0;
    const details: Array<{ bookingCode: string; status: string; xmlSize: number; mirRef?: string; error?: string }> = [];

    for (const [, group] of byBooking) {
        try {
            const xml = buildPartXml({
                establishmentCode: SES_ESTABLISHMENT_CODE,
                booking: group.booking,
                travelers: group.travelers,
            });

            let mirRef: string | null = null;
            let responseStatus = "stub_no_credentials";
            let responsePayload: Record<string, unknown> = { xml, stub: true };

            if (SES_API_ENDPOINT) {
                // Modo real (cuando el operador haya configurado endpoint + cert).
                // Nota: la negociación TLS mTLS desde Deno requiere Deno.connectTls
                // con cert/key; aquí dejamos el shape preparado. En la primera
                // integración real lo ajustamos al método exacto que pida el MIR.
                const res = await fetch(SES_API_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "content-type": "application/xml; charset=utf-8",
                        "accept": "application/xml",
                        "x-establishment-code": SES_ESTABLISHMENT_CODE,
                    },
                    body: xml,
                });
                const text = await res.text();
                if (res.ok) {
                    responseStatus = "ok";
                    // Heurística: extraer <referenciaMIR> del XML de respuesta
                    const m = text.match(/<referenciaMIR>([^<]+)<\/referenciaMIR>/);
                    mirRef = m?.[1] || null;
                    responsePayload = { xml, response: text, httpStatus: res.status };
                } else {
                    responseStatus = "error";
                    responsePayload = { xml, response: text, httpStatus: res.status };
                    throw new Error(`MIR HTTP ${res.status}: ${text.slice(0, 300)}`);
                }
            } else {
                stubbed++;
            }

            // Marcar todos los viajeros del booking como enviados (o stubbed)
            const ids = group.travelers.map(t => t.id);
            await supabase
                .from("traveler_records")
                .update({
                    submitted_at: new Date().toISOString(),
                    mir_reference: mirRef,
                    mir_response_status: responseStatus,
                    mir_response_payload: responsePayload,
                })
                .in("id", ids);

            sent++;
            details.push({ bookingCode: group.booking.booking_code, status: responseStatus, xmlSize: xml.length, mirRef: mirRef || undefined });
        } catch (e) {
            errors++;
            const msg = e instanceof Error ? e.message : String(e);
            const ids = group.travelers.map(t => t.id);
            await supabase
                .from("traveler_records")
                .update({
                    mir_response_status: "retry",
                    mir_response_payload: { error: msg, at: new Date().toISOString() },
                })
                .in("id", ids);
            details.push({ bookingCode: group.booking.booking_code, status: "error", xmlSize: 0, error: msg });
        }
    }

    return json(200, { sent, errors, stubbed, details: details.slice(0, 20) });
});

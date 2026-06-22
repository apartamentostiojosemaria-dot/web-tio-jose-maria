// Edge function: submit-verifactu
// =================================
// Envía el registro de facturación al sistema AEAT Verifactu (RD 1007/2023,
// obligatorio desde 2026). Modo STUB si no hay AEAT_VERIFACTU_ENDPOINT
// configurado: deja la factura con verifactu_status='stub' y un payload
// listo para auditoría.
//
// Cuando el operador disponga de cert.fiscal AEAT + alta en Verifactu,
// se configura AEAT_VERIFACTU_ENDPOINT + AEAT_FISCAL_CERT_PEM/KEY_PEM y
// los envíos van de verdad.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFACTU_ENDPOINT = Deno.env.get("AEAT_VERIFACTU_ENDPOINT");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } });

const escapeXml = (s: string | null | undefined): string =>
    (s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Genera el XML del RegistroFacturacionAlta según especificación Verifactu.
// Esquema simplificado conforme al RD 1007/2023 art. 14.
function buildVerifactuXml(invoice: Record<string, unknown>): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<RegistroFacturacionAlta xmlns="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/sii/fact/ws/RegFactuSistemaFacturacion.xsd">
  <IDFactura>
    <IDEmisorFactura>${escapeXml(invoice.emisor_nif as string)}</IDEmisorFactura>
    <NumSerieFactura>${escapeXml(invoice.serie as string)}-${escapeXml(String(invoice.numero))}</NumSerieFactura>
    <FechaExpedicionFactura>${escapeXml(invoice.fecha_emision as string)}</FechaExpedicionFactura>
  </IDFactura>
  <NombreRazonEmisor>${escapeXml(invoice.emisor_nombre as string)}</NombreRazonEmisor>
  <TipoFactura>${(invoice.tipo as string) === "simplificada" ? "F2" : "F1"}</TipoFactura>
  <DescripcionOperacion>${escapeXml(invoice.concepto as string)}</DescripcionOperacion>
  ${invoice.receptor_nif ? `<Destinatarios>
    <IDDestinatario>
      <NombreRazon>${escapeXml(invoice.receptor_nombre as string)}</NombreRazon>
      <NIF>${escapeXml(invoice.receptor_nif as string)}</NIF>
    </IDDestinatario>
  </Destinatarios>` : ""}
  <Desglose>
    <DetalleDesglose>
      <Impuesto>01</Impuesto>
      <ClaveRegimen>01</ClaveRegimen>
      <CalificacionOperacion>S1</CalificacionOperacion>
      <TipoImpositivo>${escapeXml(String(invoice.tipo_iva))}</TipoImpositivo>
      <BaseImponibleOimporteNoSujeto>${escapeXml(String(invoice.base_imponible))}</BaseImponibleOimporteNoSujeto>
      <CuotaRepercutida>${escapeXml(String(invoice.cuota_iva))}</CuotaRepercutida>
    </DetalleDesglose>
  </Desglose>
  <CuotaTotal>${escapeXml(String(invoice.cuota_iva))}</CuotaTotal>
  <ImporteTotal>${escapeXml(String(invoice.total))}</ImporteTotal>
  <Encadenamiento>
    <PrimerRegistro>${invoice.verifactu_hash_previo ? "N" : "S"}</PrimerRegistro>
    ${invoice.verifactu_hash_previo ? `<RegistroAnterior>
      <Huella>${escapeXml(invoice.verifactu_hash_previo as string)}</Huella>
    </RegistroAnterior>` : ""}
  </Encadenamiento>
  <SistemaInformatico>
    <NombreRazon>Tio Jose Maria — sistema propio</NombreRazon>
    <NIF>${escapeXml(invoice.emisor_nif as string)}</NIF>
    <NombreSistemaInformatico>TJM Reservation Engine</NombreSistemaInformatico>
    <IdSistemaInformatico>01</IdSistemaInformatico>
    <Version>1.0.0</Version>
    <NumeroInstalacion>001</NumeroInstalacion>
    <TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu>
    <TipoUsoPosibleMultiOT>N</TipoUsoPosibleMultiOT>
    <IndicadorMultiplesOT>N</IndicadorMultiplesOT>
  </SistemaInformatico>
  <FechaHoraHusoGenRegistro>${new Date().toISOString()}</FechaHoraHusoGenRegistro>
  <Huella>${escapeXml(invoice.verifactu_hash as string)}</Huella>
</RegistroFacturacionAlta>`;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    let body: { invoiceId?: string };
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
    const invoiceId = (body.invoiceId || "").trim();
    if (!invoiceId) return json(400, { error: "invalid_invoice_id" });

    const { data: invoice, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();
    if (error || !invoice) return json(404, { error: "invoice_not_found" });

    if (invoice.verifactu_sent_at) {
        return json(200, { ok: true, skipped: "already_sent", status: invoice.verifactu_status });
    }

    const xml = buildVerifactuXml(invoice);
    let responseStatus = "stub";
    let responsePayload: Record<string, unknown> = { xml, stub: true };
    let mirError: string | null = null;

    if (VERIFACTU_ENDPOINT) {
        try {
            const res = await fetch(VERIFACTU_ENDPOINT, {
                method: "POST",
                headers: { "content-type": "application/xml; charset=utf-8", accept: "application/xml" },
                body: xml,
            });
            const text = await res.text();
            if (res.ok) {
                responseStatus = "sent";
                responsePayload = { xml, response: text, httpStatus: res.status };
            } else {
                responseStatus = "error";
                responsePayload = { xml, response: text, httpStatus: res.status };
                mirError = `AEAT HTTP ${res.status}`;
            }
        } catch (e) {
            responseStatus = "retry";
            responsePayload = { xml, error: e instanceof Error ? e.message : String(e), at: new Date().toISOString() };
            mirError = e instanceof Error ? e.message : String(e);
        }
    }

    await supabase
        .from("invoices")
        .update({
            verifactu_sent_at: ["sent", "stub"].includes(responseStatus) ? new Date().toISOString() : null,
            verifactu_status: responseStatus,
            verifactu_response: responsePayload,
        })
        .eq("id", invoiceId);

    return json(200, { ok: !mirError, status: responseStatus, error: mirError, xmlSize: xml.length });
});

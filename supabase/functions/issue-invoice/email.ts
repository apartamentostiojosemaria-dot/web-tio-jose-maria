// Email de factura — Resend, con el PDF adjunto
// =============================================
// Plantilla propia (no toca `_shared/templates`, que usan otras funciones),
// con la misma piel visual que los emails transaccionales del alojamiento.

import { EMAIL_FROM, EMISOR, formatInvoiceNumber, eur, fechaCorta } from "./config.ts";
import type { InvoiceRow, CobroInfo } from "./invoice-core.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE_URL = "https://tiojosemaria.com";
const WHATSAPP_URL = "https://wa.me/34676344675";

const esc = (s: unknown) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function invoiceEmailHtml(invoice: InvoiceRow, cobro: CobroInfo | null, _aptName?: string | null): string {
    const numero = formatInvoiceNumber(invoice.serie, invoice.numero);
    const esRect = invoice.tipo === "rectificativa";
    const nombre = (invoice.receptor_nombre || "").trim().split(/\s+/)[0] || "hola";

    const intro = esRect
        ? `Te adjuntamos la factura rectificativa <strong>${esc(numero)}</strong>, que corrige la factura anterior.`
        : `Te adjuntamos la factura <strong>${esc(numero)}</strong> de tu estancia con nosotros. La tienes en PDF, en el archivo adjunto de este correo.`;

    const filas: Array<[string, string]> = [
        ["Nº de factura", numero],
        ["Fecha", fechaCorta(invoice.fecha_emision)],
        ["Concepto", invoice.concepto],
        ["Base imponible", eur(Number(invoice.base_imponible))],
        [`IVA ${Number(invoice.tipo_iva)} %`, eur(Number(invoice.cuota_iva))],
        ["Total", eur(Number(invoice.total))],
    ];

    const estado = cobro && !esRect
        ? (cobro.pendiente <= 0
            ? `<p style="margin:16px 0 0;padding:12px 16px;background:#F1F4EA;border-radius:10px;color:#556B2F;font-weight:700;">Está pagada. No tienes que hacer nada más.</p>`
            : `<p style="margin:16px 0 0;padding:12px 16px;background:#FFF7E8;border-radius:10px;color:#8A5A00;font-weight:700;">Queda pendiente de pago ${esc(eur(cobro.pendiente))}.</p>`)
        : "";

    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tu factura ${esc(numero)}</title></head>
<body style="margin:0;background:#FCFBF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2C3319;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FCFBF9;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #F0EDE6;border-radius:18px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#556B2F,#4A5D28);padding:28px 32px;color:#ffffff;">
        <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">Apartamentos Rurales</p>
        <h1 style="margin:6px 0 0;font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:700;">Tío José María</h1>
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <h2 style="margin:0 0 12px;font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#2C3319;">${esRect ? "Tu factura rectificativa" : "Tu factura"}</h2>
        <p style="margin:0 0 8px;">Hola ${esc(nombre)},</p>
        <p style="margin:0 0 8px;">${intro}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FCFBF9;border:1px solid #F0EDE6;border-radius:12px;margin:20px 0 0;">
          <tr><td style="padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
              ${filas.map(([k, v], i) => `<tr>
                <td style="padding:5px 0;color:#8C8468;vertical-align:top;">${esc(k)}</td>
                <td style="padding:5px 0;text-align:right;${i === filas.length - 1 ? "font-weight:700;color:#556B2F;font-size:16px;" : ""}">${esc(v)}</td>
              </tr>`).join("")}
            </table>
          </td></tr>
        </table>
        ${estado}
        <p style="margin:24px 0 0;color:#2C3319;">Un abrazo,<br>
          <strong style="font-family:'Playfair Display',Georgia,serif;font-size:17px;color:#556B2F;">Mari Carmen y Jesús</strong><br>
          <span style="font-size:12px;color:#8C8468;">${esc(EMISOR.alojamiento)}</span></p>
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #F0EDE6;background:#FCFBF9;font-size:12px;color:#8C8468;">
        <p style="margin:0 0 8px;">¿Cualquier cosa? Estamos a un mensaje: <a href="${WHATSAPP_URL}" style="color:#556B2F;">WhatsApp</a> · <a href="mailto:${EMISOR.email}" style="color:#556B2F;">email</a></p>
        <p style="margin:0;">${esc(EMISOR.direccion)} · ${esc(EMISOR.registroTuristico)} · <a href="${SITE_URL}/privacidad" style="color:#8C8468;">Privacidad</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function toBase64(bytes: Uint8Array): string {
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
}

/** Manda la factura al huésped con el PDF adjunto. Devuelve el id de Resend. */
export async function sendInvoiceEmail(opts: {
    to: string;
    invoice: InvoiceRow;
    cobro: CobroInfo | null;
    pdf: Uint8Array | null;
    aptName?: string | null;
}): Promise<string | null> {
    if (!RESEND_API_KEY) throw new Error("resend_not_configured");

    const numero = formatInvoiceNumber(opts.invoice.serie, opts.invoice.numero);
    const esRect = opts.invoice.tipo === "rectificativa";
    const body: Record<string, unknown> = {
        from: EMAIL_FROM,
        to: opts.to,
        subject: esRect
            ? `Factura rectificativa ${numero} — Tío José María`
            : `Tu factura ${numero} — Tío José María`,
        html: invoiceEmailHtml(opts.invoice, opts.cobro, opts.aptName),
    };
    if (opts.pdf) {
        body.attachments = [{ filename: `factura-${numero}.pdf`, content: toBase64(opts.pdf) }];
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 400)}`);
    const out = await res.json() as { id?: string };
    return out.id ?? null;
}

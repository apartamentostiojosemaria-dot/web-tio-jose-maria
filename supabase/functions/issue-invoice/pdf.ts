// PDF de la factura — sobrio, con la marca del alojamiento
// ========================================================
// pdf-lib puro (sin binarios ni headless Chrome): funciona en el runtime Deno
// de Supabase. Fuentes estándar Helvetica (codificación WinAnsi, que cubre
// acentos, ñ, ¿, ¡ y €).

import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { BRAND, EMISOR, formatInvoiceNumber, eur, fechaCorta } from "./config.ts";
import type { InvoiceRow, CobroInfo } from "./invoice-core.ts";

const A4 = { w: 595.28, h: 841.89 };
const M = 48;                       // margen

const verde = rgb(BRAND.verde.r, BRAND.verde.g, BRAND.verde.b);
const tinta = rgb(BRAND.verdeOscuro.r, BRAND.verdeOscuro.g, BRAND.verdeOscuro.b);
const arena = rgb(BRAND.arena.r, BRAND.arena.g, BRAND.arena.b);
const linea = rgb(BRAND.linea.r, BRAND.linea.g, BRAND.linea.b);
const crema = rgb(BRAND.crema.r, BRAND.crema.g, BRAND.crema.b);

/** WinAnsi no tiene todos los caracteres: sustituimos los que rompen. */
function winAnsi(s: string): string {
    return (s || "")
        .replace(/[–—]/g, "-")
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/…/g, "...")
        .replace(/ /g, " ")
        .replace(/[^\x20-\x7E -ÿ€]/g, "");
}

export interface PdfInput {
    invoice: InvoiceRow;
    cobro: CobroInfo | null;
    bookingCode?: string | null;
    aptName?: string | null;
}

export async function renderInvoicePdf(input: PdfInput): Promise<Uint8Array> {
    const { invoice, cobro } = input;
    const doc = await PDFDocument.create();
    const page = doc.addPage([A4.w, A4.h]);
    const reg = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const ital = await doc.embedFont(StandardFonts.HelveticaOblique);

    const esRect = invoice.tipo === "rectificativa";
    const numero = formatInvoiceNumber(invoice.serie, invoice.numero);

    const text = (
        s: string,
        x: number,
        y: number,
        opts: { size?: number; font?: typeof reg; color?: typeof tinta; align?: "left" | "right" } = {},
    ) => {
        const size = opts.size ?? 10;
        const font = opts.font ?? reg;
        const str = winAnsi(s);
        const px = opts.align === "right" ? x - font.widthOfTextAtSize(str, size) : x;
        page.drawText(str, { x: px, y, size, font, color: opts.color ?? tinta });
    };

    // ---------------------------------------------------------------- cabecera
    page.drawRectangle({ x: 0, y: A4.h - 118, width: A4.w, height: 118, color: verde });
    text("APARTAMENTOS RURALES", M, A4.h - 46, { size: 8, font: bold, color: rgb(1, 1, 1) });
    text("Tío José María", M, A4.h - 72, { size: 22, font: bold, color: rgb(1, 1, 1) });
    text(`Reg. turístico ${EMISOR.registroTuristico}  ·  Hinojares (Jaén)`, M, A4.h - 92, {
        size: 8, color: rgb(1, 1, 1),
    });

    text(esRect ? "FACTURA RECTIFICATIVA" : "FACTURA", A4.w - M, A4.h - 50, {
        size: 11, font: bold, color: rgb(1, 1, 1), align: "right",
    });
    text(numero, A4.w - M, A4.h - 72, { size: 18, font: bold, color: rgb(1, 1, 1), align: "right" });
    text(`Fecha: ${fechaCorta(invoice.fecha_emision)}`, A4.w - M, A4.h - 92, {
        size: 9, color: rgb(1, 1, 1), align: "right",
    });

    // ------------------------------------------------------- emisor / receptor
    let y = A4.h - 160;
    const colW = (A4.w - M * 2 - 24) / 2;

    const bloque = (x: number, titulo: string, lineas: string[]) => {
        text(titulo, x, y, { size: 8, font: bold, color: verde });
        let yy = y - 16;
        for (const l of lineas) {
            if (!l) continue;
            for (const trozo of wrap(l, reg, 9.5, colW)) {
                text(trozo, x, yy, { size: 9.5 });
                yy -= 13;
            }
        }
        return yy;
    };

    const yEmisor = bloque(M, "EMISOR", [
        EMISOR.nombre,
        `NIF ${EMISOR.nifDisplay}`,
        EMISOR.direccion,
        EMISOR.email,
    ]);
    const yReceptor = bloque(M + colW + 24, "CLIENTE", [
        invoice.receptor_nombre || "Cliente",
        invoice.receptor_nif ? `Documento ${invoice.receptor_nif}` : "",
        invoice.receptor_direccion || "",
        invoice.receptor_email || "",
    ]);

    y = Math.min(yEmisor, yReceptor) - 18;

    // -------------------------------------------------------------- concepto
    page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 1, color: linea });
    y -= 24;

    text("CONCEPTO", M, y, { size: 8, font: bold, color: verde });
    text("IMPORTE", A4.w - M, y, { size: 8, font: bold, color: verde, align: "right" });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.7, color: linea });
    y -= 20;

    const conceptoLines = wrap(invoice.concepto, reg, 10.5, colW * 1.5);
    const yConcepto = y;
    for (const l of conceptoLines) {
        text(l, M, y, { size: 10.5 });
        y -= 15;
    }
    text(eur(Number(invoice.base_imponible)), A4.w - M, yConcepto, { size: 10.5, align: "right" });

    if (input.bookingCode) {
        y -= 2;
        text(`Reserva ${input.bookingCode}`, M, y, { size: 8.5, font: ital, color: arena });
        y -= 14;
    }
    if (esRect && invoice.motivo_rectificacion) {
        for (const l of wrap(`Motivo: ${invoice.motivo_rectificacion}`, ital, 8.5, colW * 1.5)) {
            text(l, M, y, { size: 8.5, font: ital, color: arena });
            y -= 12;
        }
    }

    y -= 14;
    page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.7, color: linea });

    // ----------------------------------------------------------- totales
    y -= 30;
    const boxX = A4.w - M - 250;
    const boxTop = y + 18;
    const filas: Array<[string, string, boolean]> = [
        ["Base imponible", eur(Number(invoice.base_imponible)), false],
        [`IVA ${Number(invoice.tipo_iva)} %`, eur(Number(invoice.cuota_iva)), false],
        ["TOTAL", eur(Number(invoice.total)), true],
    ];
    const boxH = 18 + filas.length * 22;
    page.drawRectangle({ x: boxX, y: boxTop - boxH, width: 250, height: boxH, color: crema, borderColor: linea, borderWidth: 1 });

    let fy = boxTop - 26;
    for (const [etiqueta, valor, fuerte] of filas) {
        if (fuerte) {
            page.drawLine({ start: { x: boxX + 12, y: fy + 14 }, end: { x: boxX + 238, y: fy + 14 }, thickness: 0.7, color: linea });
        }
        text(etiqueta, boxX + 14, fy, { size: fuerte ? 11 : 9.5, font: fuerte ? bold : reg, color: fuerte ? verde : tinta });
        text(valor, boxX + 238, fy, { size: fuerte ? 12 : 9.5, font: fuerte ? bold : reg, color: fuerte ? verde : tinta, align: "right" });
        fy -= 22;
    }

    y = boxTop - boxH - 34;

    // ------------------------------------------------------ estado de cobro
    if (cobro && !esRect) {
        const pagada = cobro.pendiente <= 0;
        text(pagada ? "PAGADA" : "PENDIENTE DE COBRO", M, y, {
            size: 11, font: bold, color: pagada ? verde : rgb(0.72, 0.43, 0.04),
        });
        y -= 16;
        text(
            pagada
                ? `Cobrado ${eur(cobro.cobrado)}${cobro.formaPago !== "—" ? ` · ${cobro.formaPago}` : ""}`
                : `Cobrado ${eur(cobro.cobrado)} · Pendiente ${eur(cobro.pendiente)}${cobro.formaPago !== "—" ? ` · ${cobro.formaPago}` : ""}`,
            M, y, { size: 9.5, color: arena },
        );
        y -= 26;
    }

    // -------------------------------------------------------------- pie
    const pieY = 92;
    page.drawLine({ start: { x: M, y: pieY + 34 }, end: { x: A4.w - M, y: pieY + 34 }, thickness: 0.7, color: linea });

    const leyendas: string[] = [];
    if (invoice.tipo === "simplificada") {
        leyendas.push("Factura simplificada expedida conforme al art. 4 del RD 1619/2012.");
    }
    if (esRect) {
        leyendas.push("Factura rectificativa expedida conforme al art. 15 del RD 1619/2012.");
    }
    leyendas.push("IVA 10 % — servicios de alojamiento (art. 91.Uno.2.2.º Ley 37/1992).");

    let py = pieY + 20;
    for (const l of leyendas) {
        text(l, M, py, { size: 7.5, color: arena });
        py -= 11;
    }

    text(
        `${EMISOR.alojamiento} · ${EMISOR.direccion} · ${EMISOR.telefono} · ${EMISOR.email} · ${EMISOR.web}`,
        M, 40, { size: 7.5, color: arena },
    );
    if (invoice.verifactu_hash) {
        text(`Huella del registro: ${invoice.verifactu_hash.slice(0, 32)}…`, M, 28, { size: 6.5, color: linea });
    }

    return await doc.save();
}

/** Corta un texto a los anchos de la caja. */
function wrap(s: string, font: { widthOfTextAtSize(t: string, n: number): number }, size: number, maxW: number): string[] {
    const palabras = winAnsi(s).split(/\s+/);
    const out: string[] = [];
    let linea = "";
    for (const p of palabras) {
        const cand = linea ? `${linea} ${p}` : p;
        if (font.widthOfTextAtSize(cand, size) > maxW && linea) {
            out.push(linea);
            linea = p;
        } else {
            linea = cand;
        }
    }
    if (linea) out.push(linea);
    return out;
}

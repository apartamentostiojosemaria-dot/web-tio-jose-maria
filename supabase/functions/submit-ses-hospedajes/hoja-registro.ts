// Hoja de registro de viajeros — PDF
// ==================================
// El papel que se puede imprimir, guardar o mandar por correo mientras el
// alojamiento no tenga credenciales del servicio web del Ministerio.
// Contiene exactamente los mismos datos que se transmiten (art. 3 y anexo I
// del RD 933/2021), en el orden en que los pide el libro-registro.
//
// pdf-lib puro: funciona en el runtime Deno de Supabase, sin binarios.

import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { ESTABLECIMIENTO, MARCA } from "./config.ts";
import {
    etiquetaDocumento, etiquetaPago, etiquetaParentesco, etiquetaSexo,
    nombrePais, type ContratoParte, type ViajeroParte,
} from "./parte-modelo.ts";

const A4 = { w: 595.28, h: 841.89 };
const M = 42;

const verde = rgb(MARCA.verde.r, MARCA.verde.g, MARCA.verde.b);
const tinta = rgb(MARCA.verdeOscuro.r, MARCA.verdeOscuro.g, MARCA.verdeOscuro.b);
const arena = rgb(MARCA.arena.r, MARCA.arena.g, MARCA.arena.b);
const linea = rgb(MARCA.linea.r, MARCA.linea.g, MARCA.linea.b);
const blanco = rgb(1, 1, 1);

/** WinAnsi no tiene todos los caracteres: sustituimos los que romperían. */
function winAnsi(s: string): string {
    return (s || "")
        .replace(/[–—]/g, "-")
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/…/g, "...")
        .replace(/ /g, " ")
        .replace(/[^\x20-\x7E -ÿ€]/g, "");
}

function fechaLarga(iso: string | null | undefined): string {
    if (!iso) return "—";
    const [a, m, d] = String(iso).slice(0, 10).split("-");
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const mi = Number(m) - 1;
    if (!a || Number.isNaN(mi) || !meses[mi]) return String(iso).slice(0, 10);
    return `${Number(d)} de ${meses[mi]} de ${a}`;
}

function fechaCorta(iso: string | null | undefined): string {
    if (!iso) return "—";
    const [a, m, d] = String(iso).slice(0, 10).split("-");
    return a ? `${d}/${m}/${a}` : String(iso);
}

/** Hueco reservado en la maqueta donde luego se dibuja la firma. */
interface FirmaPendiente {
    viajero: ViajeroParte;
    // deno-lint-ignore no-explicit-any
    page: any;
    x: number; y: number; w: number; h: number;
}

export interface HojaInput {
    contrato: ContratoParte;
    viajeros: ViajeroParte[];
    /** Texto del pie que explica cómo se ha comunicado (o que está pendiente). */
    nota?: string | null;
}

export async function renderHojaRegistro(input: HojaInput): Promise<Uint8Array> {
    const { contrato, viajeros } = input;
    const doc = await PDFDocument.create();
    const reg = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const ital = await doc.embedFont(StandardFonts.HelveticaOblique);

    doc.setTitle(`Hoja de registro de viajeros ${contrato.referencia}`);
    doc.setCreator(ESTABLECIMIENTO.nombre);

    let page = doc.addPage([A4.w, A4.h]);
    let y = 0;
    let numPagina = 0;

    // Las firmas se incrustan al final (embedPng es asíncrono y la maqueta
    // de arriba tiene que quedarse síncrona). Local a la llamada: el runtime
    // reutiliza el proceso entre peticiones y un array de módulo se llenaría
    // con las firmas de la reserva anterior.
    const firmasPendientes: FirmaPendiente[] = [];

    const texto = (
        s: string, x: number, yy: number,
        o: { size?: number; font?: typeof reg; color?: typeof tinta; align?: "left" | "right" } = {},
    ) => {
        const size = o.size ?? 9.5;
        const font = o.font ?? reg;
        const str = winAnsi(s);
        const px = o.align === "right" ? x - font.widthOfTextAtSize(str, size) : x;
        page.drawText(str, { x: px, y: yy, size, font, color: o.color ?? tinta });
    };

    const cabecera = () => {
        numPagina += 1;
        page.drawRectangle({ x: 0, y: A4.h - 92, width: A4.w, height: 92, color: verde });
        texto("APARTAMENTOS RURALES", M, A4.h - 36, { size: 7.5, font: bold, color: blanco });
        texto("Tío José María", M, A4.h - 58, { size: 18, font: bold, color: blanco });
        texto(`${ESTABLECIMIENTO.municipio} · Registro turístico ${ESTABLECIMIENTO.registroTuristico}`,
            M, A4.h - 74, { size: 7.5, color: blanco });
        texto("HOJA DE REGISTRO DE VIAJEROS", A4.w - M, A4.h - 40, {
            size: 10, font: bold, color: blanco, align: "right",
        });
        texto(`Reserva ${contrato.referencia}`, A4.w - M, A4.h - 58, {
            size: 13, font: bold, color: blanco, align: "right",
        });
        texto(`Página ${numPagina}`, A4.w - M, A4.h - 74, { size: 7.5, color: blanco, align: "right" });
        y = A4.h - 122;
    };

    const nuevaPagina = () => {
        page = doc.addPage([A4.w, A4.h]);
        cabecera();
    };

    const sitio = (alto: number) => {
        if (y - alto < 78) nuevaPagina();
    };

    const titulo = (t: string) => {
        sitio(30);
        texto(t, M, y, { size: 8, font: bold, color: verde });
        y -= 7;
        page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.7, color: linea });
        y -= 16;
    };

    /** Rejilla de pares etiqueta/valor en dos columnas. */
    const pares = (items: Array<[string, string]>) => {
        const colW = (A4.w - M * 2) / 2;
        for (let i = 0; i < items.length; i += 2) {
            sitio(26);
            const fila = items.slice(i, i + 2);
            fila.forEach(([et, val], j) => {
                const x = M + j * colW;
                texto(et.toUpperCase(), x, y, { size: 6.5, font: bold, color: arena });
                texto(val || "—", x, y - 11, { size: 9.5 });
            });
            y -= 27;
        }
    };

    cabecera();

    // ---------------------------------------------------------- el contrato
    titulo("DATOS DEL ALOJAMIENTO Y DE LA ESTANCIA");
    pares([
        ["Establecimiento", ESTABLECIMIENTO.nombre],
        ["Titular / arrendador", `${ESTABLECIMIENTO.titular} · NIF ${ESTABLECIMIENTO.nifDisplay}`],
        ["Dirección del establecimiento", ESTABLECIMIENTO.direccion],
        ["Nº de registro turístico", ESTABLECIMIENTO.registroTuristico],
        ["Alojamiento reservado", contrato.alojamiento || "—"],
        ["Referencia de la reserva", contrato.referencia],
        ["Fecha del contrato", fechaLarga(contrato.fechaContrato)],
        ["Nº de personas", String(contrato.numPersonas)],
        ["Entrada", fechaLarga(contrato.fechaEntrada)],
        ["Salida", fechaLarga(contrato.fechaSalida)],
        ["Forma de pago", etiquetaPago(contrato.medioPago)],
        ["Fecha del pago", contrato.fechaPago ? fechaLarga(contrato.fechaPago) : "—"],
    ]);
    y -= 6;

    // ------------------------------------------------------------ viajeros
    viajeros.forEach((v, i) => {
        sitio(150);
        const rotulo = v.esTitular
            ? `VIAJERO ${i + 1} — TITULAR DEL CONTRATO`
            : `VIAJERO ${i + 1}`;
        titulo(rotulo);

        const nombreCompleto = [v.nombre, v.apellido1, v.apellido2].filter(Boolean).join(" ");
        const dir = [v.direccion, v.municipio, v.codigoPostal, nombrePais(v.pais)]
            .filter(Boolean).join(", ");

        pares([
            ["Nombre y apellidos", nombreCompleto],
            ["Sexo", etiquetaSexo(v.sexo)],
            ["Tipo de documento", v.numeroDocumento ? etiquetaDocumento(v.tipoDocumento) : "Sin documento propio"],
            ["Nº de documento", v.numeroDocumento || "—"],
            ["Nº de soporte del documento", v.soporteDocumento || "—"],
            ["Fecha de nacimiento", fechaCorta(v.fechaNacimiento)],
            ["Nacionalidad", nombrePais(v.nacionalidad)],
            ["Domicilio habitual", dir],
            ["Teléfono", [v.telefonoMovil, v.telefonoFijo].filter(Boolean).join(" · ") || "—"],
            ["Correo electrónico", v.correo || "—"],
            ["Parentesco con el titular", v.esTitular ? "—" : etiquetaParentesco(v.parentesco)],
        ]);

        // Firma
        sitio(84);
        texto("FIRMA", M, y, { size: 6.5, font: bold, color: arena });
        const cajaY = y - 66;
        page.drawRectangle({
            x: M, y: cajaY, width: 200, height: 58,
            borderColor: linea, borderWidth: 0.8, color: rgb(1, 1, 1),
        });
        y = cajaY - 14;
        firmasPendientes.push({ viajero: v, page, x: M + 6, y: cajaY + 5, w: 188, h: 48 });
    });

    for (const f of firmasPendientes) {
        const dato = f.viajero.firmaBase64;
        if (!dato) {
            f.page.drawText(winAnsi(f.viajero.edad < 14 ? "Menor de 14 anos: no firma" : "Sin firma en pantalla"), {
                x: f.x, y: f.y + 20, size: 8, font: ital, color: arena,
            });
            continue;
        }
        try {
            const limpio = dato.replace(/^data:image\/\w+;base64,/, "");
            const bytes = Uint8Array.from(atob(limpio), (c) => c.charCodeAt(0));
            const img = await doc.embedPng(bytes);
            const escala = Math.min(f.w / img.width, f.h / img.height, 1);
            f.page.drawImage(img, {
                x: f.x, y: f.y, width: img.width * escala, height: img.height * escala,
            });
        } catch {
            f.page.drawText(winAnsi("Firma guardada (no se puede dibujar aquí)"), {
                x: f.x, y: f.y + 20, size: 8, font: ital, color: arena,
            });
        }
    }

    // ------------------------------------------------------------- el pie
    const paginas = doc.getPages();
    paginas.forEach((p) => {
        p.drawLine({ start: { x: M, y: 62 }, end: { x: A4.w - M, y: 62 }, thickness: 0.7, color: linea });
        const pie = (s: string, yy: number, size = 6.8) => {
            p.drawText(winAnsi(s), { x: M, y: yy, size, font: reg, color: arena });
        };
        pie("Registro documental de viajeros conforme al Real Decreto 933/2021, de 26 de octubre. Datos tratados con la única "
            + "finalidad de cumplir esa obligación legal y", 50);
        pie("conservados el plazo legalmente exigido. Responsable: "
            + `${ESTABLECIMIENTO.titular} · ${ESTABLECIMIENTO.email}`, 40);
        if (input.nota) pie(input.nota, 30);
    });

    return await doc.save();
}

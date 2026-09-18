// Edge function: documento-admision
// =================================
// GET ?code=TJM-XXXXXX → PDF con el documento de admisión del art. 24 del
// Decreto 194/2010 (apartamentos turísticos de Andalucía): nombre, categoría y
// número de inscripción del establecimiento, apartamento, personas, fechas de
// entrada y salida y precio. Hay que entregárselo al huésped al recibirlo; con
// la ficha del huésped (/guia/<código>) lo tiene en el móvil y se lo puede
// descargar. Pública: el código de la reserva es la llave, como en la ficha, y
// solo sale para reservas vivas (misma regla que tjm_ficha_huesped).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Datos del establecimiento (docs/CHECKIN-LEGAL.md: A/JA/00060, apartamentos
// turísticos, conjunto rural, categoría 1 llave). Mismos que en config.ts del
// parte de viajeros; se repiten aquí porque cada función se despliega sola.
const ESTABLECIMIENTO = {
    nombre: "Apartamentos Rurales Tío José María",
    tipo: "Apartamentos turísticos · conjunto · rural",
    categoria: "1 llave",
    registro: "A/JA/00060 (Registro de Turismo de Andalucía)",
    titular: "Jesús Martínez Sánchez",
    nif: "26433801-Q",
    direccion: "Calle Baja 1, 23486 Hinojares (Jaén)",
    telefono: "676 34 46 75",
    email: "apartamentostiojosemaria@gmail.com",
};

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const texto = (status: number, body: string) => new Response(body, { status, headers: { ...CORS, "content-type": "text/plain; charset=utf-8" } });

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fecha = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split("-"); return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`; };
const euros = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "GET") return texto(405, "method_not_allowed");

    const code = (new URL(req.url).searchParams.get("code") || "").toUpperCase().trim();
    if (!/^TJM-[A-Z0-9]{6}$/.test(code)) return texto(400, "Código no válido.");

    // Misma regla de vida que la ficha: confirmada / terminada hace < 30 días.
    const { data: b } = await admin
        .from("guest_bookings")
        .select("booking_code, guest_name, pax_count, check_in, check_out, total_price, status, channel, apartments(name)")
        .eq("booking_code", code)
        .maybeSingle();
    if (!b) return texto(404, "No encontramos esa reserva.");
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const limite = new Date(b.check_out + "T00:00:00Z"); limite.setUTCDate(limite.getUTCDate() + 30);
    if (!["confirmed", "completed"].includes(b.status) || hoy > limite.toISOString().slice(0, 10)) {
        return texto(410, "Esta reserva no está en curso.");
    }
    const apt = (b.apartments as unknown as { name: string } | null)?.name || "Apartamento";
    const noches = Math.round((Date.parse(b.check_out + "T00:00:00Z") - Date.parse(b.check_in + "T00:00:00Z")) / 86400000);

    // ---------------------------------------------------------------- PDF
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Documento de admisión ${b.booking_code}`);
    pdf.setAuthor(ESTABLECIMIENTO.nombre);
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const verde = rgb(0.333, 0.42, 0.184);
    const tinta = rgb(0.17, 0.2, 0.1);
    const gris = rgb(0.45, 0.45, 0.45);
    const M = 56;
    let y = 841.89 - M;

    const linea = (t: string, opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; dy?: number } = {}) => {
        page.drawText(t, { x: M, y, size: opts.size ?? 11, font: opts.f ?? font, color: opts.color ?? tinta });
        y -= opts.dy ?? 16;
    };
    const par = (k: string, v: string) => {
        page.drawText(k, { x: M, y, size: 10.5, font, color: gris });
        page.drawText(v, { x: M + 170, y, size: 11, font: bold, color: tinta });
        y -= 18;
    };

    page.drawRectangle({ x: 0, y: 841.89 - 84, width: 595.28, height: 84, color: verde });
    page.drawText("APARTAMENTOS RURALES", { x: M, y: 841.89 - 36, size: 9, font, color: rgb(1, 1, 1) });
    page.drawText("Tío José María", { x: M, y: 841.89 - 62, size: 22, font: serif, color: rgb(1, 1, 1) });
    y = 841.89 - 84 - 40;

    linea("Documento de admisión", { size: 18, f: serif, dy: 12 });
    linea("Artículo 24 del Decreto 194/2010, de 20 de abril, de establecimientos de apartamentos turísticos (Andalucía).", { size: 9, color: gris, dy: 28 });

    linea("El establecimiento", { size: 12, f: bold, color: verde, dy: 20 });
    par("Nombre", ESTABLECIMIENTO.nombre);
    par("Tipo", ESTABLECIMIENTO.tipo);
    par("Categoría", ESTABLECIMIENTO.categoria);
    par("Nº de inscripción", ESTABLECIMIENTO.registro);
    par("Titular", `${ESTABLECIMIENTO.titular} · NIF ${ESTABLECIMIENTO.nif}`);
    par("Dirección", ESTABLECIMIENTO.direccion);
    par("Contacto", `${ESTABLECIMIENTO.telefono} · ${ESTABLECIMIENTO.email}`);
    y -= 12;

    linea("La estancia", { size: 12, f: bold, color: verde, dy: 20 });
    par("Persona usuaria", b.guest_name || "—");
    par("Unidad de alojamiento", `Apartamento ${apt}`);
    par("Personas", String(Math.max(Number(b.pax_count) || 1, 1)));
    par("Fecha de entrada", `${fecha(b.check_in)} (a partir de las 16:00)`);
    par("Fecha de salida", `${fecha(b.check_out)} (antes de las 12:00)`);
    par("Noches", String(noches));
    par("Precio de la estancia", b.channel && ["booking", "airbnb", "holidu"].includes(String(b.channel).toLowerCase())
        ? `${euros(Number(b.total_price))} (contratado a través de ${String(b.channel)[0].toUpperCase() + String(b.channel).slice(1)})`
        : `${euros(Number(b.total_price))}, IVA incluido`);
    par("Código de reserva", b.booking_code);
    y -= 14;

    const nota = [
        "El precio incluye agua, electricidad, recogida de basuras, limpieza a la salida y ropa de cama y baño (art. 26 del Decreto 194/2010).",
        "El reglamento de régimen interior y las hojas de quejas y reclamaciones están a disposición de las personas usuarias en el propio apartamento.",
        "Este documento se conserva a disposición de la inspección turística durante un año (art. 24.3).",
    ];
    for (const n of nota) {
        // envolver a ~95 caracteres
        const palabras = n.split(" "); let fila = "";
        for (const p of palabras) {
            if ((fila + " " + p).trim().length > 95) { linea(fila.trim(), { size: 9.5, color: gris, dy: 13 }); fila = p; }
            else fila = (fila + " " + p).trim();
        }
        if (fila) linea(fila, { size: 9.5, color: gris, dy: 17 });
    }
    y -= 10;
    linea(`Emitido el ${fecha(hoy)} en Hinojares.`, { size: 10, color: gris });

    const bytes = await pdf.save();
    return new Response(bytes, {
        headers: {
            ...CORS,
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="documento-admision-${b.booking_code}.pdf"`,
            "cache-control": "no-store",
        },
    });
});

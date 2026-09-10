// Configuración de facturación — ÚNICA FUENTE DE VERDAD
// =====================================================
// Todo lo que define cómo se numera, cómo se calcula el IVA y qué datos
// fiscales salen en la factura vive AQUÍ y sólo aquí.
//
// Decisión 10-sep-2026 (Jesús): se abre serie propia "A" para no chocar con la
// numeración heredada de MisterPlan (series "1-" y "3225-", que iba por el nº 7
// del ejercicio 2025). Numeración correlativa POR EJERCICIO empezando en 1.
//
//   Guardado en BD:  serie = "A2026", numero = 1, 2, 3…
//   Mostrado:        A-2026-0001
//
// Las rectificativas (facturas de abono) llevan serie propia "R":
//   Guardado en BD:  serie = "R2026", numero = 1, 2, 3…
//   Mostrado:        R-2026-0001

/** Prefijo de la serie ordinaria. Cambiar aquí cambia toda la numeración futura. */
export const SERIE_PREFIX = "A";

/** Prefijo de la serie de facturas rectificativas (abonos). */
export const SERIE_RECTIFICATIVA_PREFIX = "R";

/**
 * Tipo de IVA aplicable. Alojamiento turístico rural en España = 10 %
 * (Ley 37/1992, art. 91.Uno.2.2.º, servicios de hostelería y alojamiento).
 * Si algún día cambia el tipo, se cambia AQUÍ y nada más.
 */
export const IVA_RATE = 10.0;

/** Datos fiscales del emisor (titular del alojamiento). */
export const EMISOR = {
    nif: "26433801Q",
    nifDisplay: "26433801-Q",
    nombre: "Jesús Martínez Sánchez",
    direccion: "Calle Baja 1, 23486 Hinojares, Jaén, España",
    // Datos del establecimiento (no fiscales, pero van en el PDF)
    alojamiento: "Apartamentos Rurales Tío José María",
    registroTuristico: "VTAR/JA/00044",
    email: "apartamentostiojosemaria@gmail.com",
    telefono: "+34 676 344 675",
    web: "https://tiojosemaria.com",
} as const;

/** Remitente del email de factura (dominio ya verificado en Resend). */
export const EMAIL_FROM = "Tío José María <hola@tiojosemaria.com>";

/** Bucket privado de Storage donde se guardan los PDF. */
export const PDF_BUCKET = "invoices";

/** Segundos de validez de las URLs firmadas que se entregan al panel. */
export const SIGNED_URL_TTL = 60 * 60; // 1 h

/** Paleta de marca (la misma de la web y de los emails transaccionales). */
export const BRAND = {
    verde: { r: 0x55 / 255, g: 0x6b / 255, b: 0x2f / 255 },   // #556B2F
    verdeOscuro: { r: 0x2c / 255, g: 0x33 / 255, b: 0x19 / 255 }, // #2C3319
    crema: { r: 0xfc / 255, g: 0xfb / 255, b: 0xf9 / 255 },   // #FCFBF9
    arena: { r: 0x8c / 255, g: 0x84 / 255, b: 0x68 / 255 },   // #8C8468
    linea: { r: 0xf0 / 255, g: 0xed / 255, b: 0xe6 / 255 },   // #F0EDE6
} as const;

// ---------------------------------------------------------------------------
// Verifactu — HUECO PREPARADO, NO ACTIVO (decisión 10-sep-2026)
// ---------------------------------------------------------------------------
// `submit-verifactu` NO está desplegada y no se llama desde aquí. Lo único que
// hace esta función es dejar cada factura con `verifactu_status = 'pending'` y
// la cadena de hash ya calculada (hash_previo → hash), de forma que el día que
// haya certificado fiscal y toque el calendario AEAT, el envío se pueda hacer
// hacia atrás sin recalcular nada.
//
// Para activarlo: poner VERIFACTU_ENABLED = true y desplegar `submit-verifactu`
// con el certificado. Mientras esté en false, no se dispara ninguna llamada.
export const VERIFACTU_ENABLED = false;

// ---------------------------------------------------------------------------
// Helpers de presentación (compartidos por PDF, email y panel)
// ---------------------------------------------------------------------------

/** "A2026" + 1 → "A-2026-0001" */
export function formatInvoiceNumber(serie: string, numero: number | string): string {
    const m = /^([A-Z]+)(\d{4})$/.exec(serie);
    const n = String(numero).padStart(4, "0");
    return m ? `${m[1]}-${m[2]}-${n}` : `${serie}-${n}`;
}

/** Serie del ejercicio en curso: ("A", 2026) → "A2026" */
export function serieForYear(prefix: string, year: number): string {
    return `${prefix}${year}`;
}

export const eur = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);

const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const fechaLarga = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} de ${MESES[m - 1]} de ${y}`;
};

export const fechaCorta = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
};

/**
 * Concepto legible de la estancia, tal y como lo lee un humano:
 *   "Estancia en Albahaca, 2 noches, 25–27 de septiembre de 2026"
 *   "Estancia en Lavanda, 5 noches, 29 de septiembre – 4 de octubre de 2026"
 *   "Estancia en Romero, 10 noches, 28 de diciembre de 2026 – 7 de enero de 2027"
 */
export function conceptoEstancia(aptName: string, checkIn: string, checkOut: string, nights: number): string {
    const [y1, m1, d1] = checkIn.split("-").map(Number);
    const [y2, m2, d2] = checkOut.split("-").map(Number);
    let rango: string;
    if (y1 === y2 && m1 === m2) {
        rango = `${d1}–${d2} de ${MESES[m1 - 1]} de ${y1}`;
    } else if (y1 === y2) {
        rango = `${d1} de ${MESES[m1 - 1]} – ${d2} de ${MESES[m2 - 1]} de ${y1}`;
    } else {
        rango = `${d1} de ${MESES[m1 - 1]} de ${y1} – ${d2} de ${MESES[m2 - 1]} de ${y2}`;
    }
    const noches = nights === 1 ? "1 noche" : `${nights} noches`;
    return `Estancia en ${aptName}, ${noches}, ${rango}`;
}

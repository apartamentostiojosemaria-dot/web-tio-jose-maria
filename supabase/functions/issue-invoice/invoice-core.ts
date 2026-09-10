// Núcleo de facturación — cálculo, numeración y persistencia
// ==========================================================
// Toda la lógica fiscal vive aquí; la configuración, en `config.ts`.
// Se ejecuta SIEMPRE con service_role (la función edge es el único camino).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
    EMISOR, IVA_RATE, SERIE_PREFIX, SERIE_RECTIFICATIVA_PREFIX,
    serieForYear, conceptoEstancia, formatInvoiceNumber,
} from "./config.ts";

export interface BookingRow {
    id: number;
    booking_code: string;
    guest_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
    guest_address: string | null;
    check_in: string;
    check_out: string;
    nights: number | null;
    pax_count: number | null;
    total_price: number;
    status: string;
    source: string | null;
    payment_intent_id: string | null;
    payment_amount_paid: number | null;
    apartment_id: number;
    apartments?: { name: string } | null;
}

export interface InvoiceRow {
    id: string;
    booking_id: number | null;
    serie: string;
    numero: number;
    fecha_emision: string;
    tipo: string;
    rectifica_invoice_id: string | null;
    motivo_rectificacion: string | null;
    emisor_nif: string;
    emisor_nombre: string;
    emisor_direccion: string;
    receptor_nif: string | null;
    receptor_nombre: string | null;
    receptor_direccion: string | null;
    receptor_email: string | null;
    concepto: string;
    base_imponible: number;
    tipo_iva: number;
    cuota_iva: number;
    total: number;
    moneda: string;
    verifactu_hash: string | null;
    verifactu_hash_previo: string | null;
    verifactu_status: string | null;
    pdf_url: string | null;
    email_sent_at: string | null;
    created_at: string;
}

export interface Receptor {
    nif?: string | null;
    nombre?: string | null;
    direccion?: string | null;
    email?: string | null;
}

/** Estado de cobro de una reserva, según el contrato de `booking_payments`. */
export interface CobroInfo {
    total: number;
    cobrado: number;
    pendiente: number;
    /** "Pagada" | "Pendiente de cobro" */
    estado: string;
    /** Formas de pago usadas, en castellano llano, separadas por " + " */
    formaPago: string;
    /** De dónde salió el dato (para el informe y para depurar) */
    fuente: "booking_payments" | "guest_bookings.paid_amount" | "stripe_fallback";
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const toNum = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

const METODO_LABEL: Record<string, string> = {
    transferencia: "Transferencia",
    bizum: "Bizum",
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    stripe: "Tarjeta (web)",
    booking: "Lo paga Booking",
    ota: "Lo paga el portal",
    tpv: "TPV",
};

// ---------------------------------------------------------------------------
// Cobros
// ---------------------------------------------------------------------------

/**
 * Estado de cobro de la reserva. Contrato acordado con el agente que está
 * creando `booking_payments` (booking_id, amount, method, paid_on) y las
 * columnas `paid_amount` / `pending_amount` en `guest_bookings`.
 *
 * Se degrada con elegancia: si esas piezas todavía no existen en la base, cae
 * al importe cobrado por Stripe. Nunca revienta por eso.
 */
export async function getCobroInfo(sb: SupabaseClient, booking: BookingRow): Promise<CobroInfo> {
    const total = round2(toNum(booking.total_price));

    // 1) booking_payments — la fuente buena: dice cuánto y CÓMO
    const pagos = await sb
        .from("booking_payments")
        .select("amount, method, paid_on")
        .eq("booking_id", booking.id);

    if (!pagos.error && Array.isArray(pagos.data)) {
        const cobrado = round2(pagos.data.reduce((s: number, p: Record<string, unknown>) => s + toNum(p.amount), 0));
        const metodos = [...new Set(pagos.data.map((p: Record<string, unknown>) => String(p.method || "").toLowerCase()).filter(Boolean))];
        const pendiente = round2(total - cobrado);
        return {
            total,
            cobrado,
            pendiente,
            estado: pendiente <= 0 ? "Pagada" : "Pendiente de cobro",
            formaPago: metodos.length
                ? metodos.map((m) => METODO_LABEL[m] || m).join(" + ")
                : (booking.payment_intent_id ? "Tarjeta (web)" : "—"),
            fuente: "booking_payments",
        };
    }

    // 2) columnas paid_amount / pending_amount en guest_bookings
    const gb = await sb
        .from("guest_bookings")
        .select("paid_amount, pending_amount, payment_method")
        .eq("id", booking.id)
        .maybeSingle();

    if (!gb.error && gb.data) {
        const row = gb.data as Record<string, unknown>;
        const cobrado = round2(toNum(row.paid_amount));
        const pendiente = row.pending_amount === null || row.pending_amount === undefined
            ? round2(total - cobrado)
            : round2(toNum(row.pending_amount));
        const met = String(row.payment_method || "").toLowerCase();
        return {
            total,
            cobrado,
            pendiente,
            estado: pendiente <= 0 ? "Pagada" : "Pendiente de cobro",
            formaPago: met ? (METODO_LABEL[met] || met) : (booking.payment_intent_id ? "Tarjeta (web)" : "—"),
            fuente: "guest_bookings.paid_amount",
        };
    }

    // 3) Fallback: lo que dice Stripe hoy
    const cobrado = round2(toNum(booking.payment_amount_paid));
    const pendiente = round2(total - cobrado);
    return {
        total,
        cobrado,
        pendiente,
        estado: pendiente <= 0 ? "Pagada" : "Pendiente de cobro",
        formaPago: booking.payment_intent_id ? "Tarjeta (web)" : "—",
        fuente: "stripe_fallback",
    };
}

// ---------------------------------------------------------------------------
// Numeración y cadena de hash
// ---------------------------------------------------------------------------

/**
 * Hash de encadenamiento (hueco Verifactu, ver config.ts). Se calcula ya, para
 * que el día que se active el envío la cadena esté completa hacia atrás.
 * Encadena por ORDEN DE REGISTRO (todas las series), como pide el modelo AEAT.
 */
async function sha256Hex(input: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function huellaPayload(row: {
    hashPrevio: string | null; serie: string; numero: number;
    fecha: string; total: number; cuota: number;
}): string {
    return [
        row.hashPrevio || "", EMISOR.nif, row.serie, String(row.numero),
        row.fecha, row.total.toFixed(2), row.cuota.toFixed(2),
    ].join("|");
}

async function ultimoHash(sb: SupabaseClient): Promise<string | null> {
    const { data } = await sb
        .from("invoices")
        .select("verifactu_hash")
        .order("created_at", { ascending: false })
        .limit(1);
    return data?.[0]?.verifactu_hash ?? null;
}

async function siguienteNumero(sb: SupabaseClient, serie: string): Promise<number> {
    const { data } = await sb
        .from("invoices")
        .select("numero")
        .eq("serie", serie)
        .order("numero", { ascending: false })
        .limit(1);
    return Number(data?.[0]?.numero ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Emisión
// ---------------------------------------------------------------------------

/** Rellena los datos del receptor con lo que sepamos del huésped. */
export async function resolveReceptor(
    sb: SupabaseClient, booking: BookingRow, override: Receptor = {},
): Promise<Receptor> {
    let nif = override.nif ?? null;
    let nombre = override.nombre ?? null;
    let direccion = override.direccion ?? null;
    const email = override.email ?? booking.guest_email ?? null;

    // Si el huésped rellenó el precheckin, ya tenemos su documento y dirección
    if (!nif || !direccion) {
        const { data: tr } = await sb
            .from("traveler_records")
            .select("nombre, apellido_primero, apellido_segundo, numero_documento, direccion_via, direccion_municipio, direccion_cp, direccion_pais")
            .eq("booking_id", booking.id)
            .eq("is_titular", true)
            .limit(1)
            .maybeSingle();
        if (tr) {
            const t = tr as Record<string, string | null>;
            nif = nif || t.numero_documento || null;
            nombre = nombre || [t.nombre, t.apellido_primero, t.apellido_segundo].filter(Boolean).join(" ") || null;
            direccion = direccion || [t.direccion_via, t.direccion_cp, t.direccion_municipio, t.direccion_pais]
                .filter(Boolean).join(", ") || null;
        }
    }

    return {
        nif,
        nombre: nombre || booking.guest_name || "Cliente",
        direccion: direccion || booking.guest_address || null,
        email,
    };
}

/**
 * Emite la factura ordinaria de una reserva. IDEMPOTENTE: si ya existe una
 * factura no rectificativa para esa reserva, devuelve la que hay.
 */
export async function issueInvoice(
    sb: SupabaseClient, booking: BookingRow, receptorOverride: Receptor = {},
): Promise<{ invoice: InvoiceRow; created: boolean }> {
    const existing = await sb
        .from("invoices")
        .select("*")
        .eq("booking_id", booking.id)
        .neq("tipo", "rectificativa")
        .limit(1)
        .maybeSingle();
    if (existing.data) return { invoice: existing.data as InvoiceRow, created: false };

    const receptor = await resolveReceptor(sb, booking, receptorOverride);
    const aptName = booking.apartments?.name || "el apartamento";
    const nights = booking.nights ??
        Math.round((Date.parse(booking.check_out) - Date.parse(booking.check_in)) / 86400000);
    const concepto = conceptoEstancia(aptName, booking.check_in, booking.check_out, nights);

    const total = round2(toNum(booking.total_price));
    const base = round2(total / (1 + IVA_RATE / 100));
    const cuota = round2(total - base);

    const serie = serieForYear(SERIE_PREFIX, new Date().getUTCFullYear());
    const invoice = await insertWithNumber(sb, serie, {
        booking_id: booking.id,
        tipo: receptor.nif ? "completa" : "simplificada",
        receptor_nif: receptor.nif,
        receptor_nombre: receptor.nombre,
        receptor_direccion: receptor.direccion,
        receptor_email: receptor.email,
        concepto,
        base_imponible: base,
        tipo_iva: IVA_RATE,
        cuota_iva: cuota,
        total,
    });
    return { invoice, created: true };
}

/**
 * Emite una factura RECTIFICATIVA (abono) sobre una factura existente.
 * Serie propia "R". Importes en negativo: si se pasa `importeAbono` se abona
 * sólo esa parte; si no, se abona la factura entera.
 */
export async function issueRectificative(
    sb: SupabaseClient, original: InvoiceRow, motivo: string, importeAbono?: number,
): Promise<InvoiceRow> {
    const yaExiste = await sb
        .from("invoices")
        .select("*")
        .eq("rectifica_invoice_id", original.id)
        .limit(1)
        .maybeSingle();
    if (yaExiste.data) return yaExiste.data as InvoiceRow;

    const totalOriginal = round2(toNum(original.total));
    const abono = importeAbono != null ? round2(Math.abs(importeAbono)) : totalOriginal;
    if (abono > totalOriginal + 0.001) throw new Error("importe_abono_mayor_que_factura");

    const tipoIva = toNum(original.tipo_iva) || IVA_RATE;
    const base = round2(abono / (1 + tipoIva / 100));
    const cuota = round2(abono - base);

    const numOriginal = formatInvoiceNumber(original.serie, original.numero);
    const concepto = abono === totalOriginal
        ? `Rectificación total de la factura ${numOriginal} — ${original.concepto}`
        : `Rectificación parcial de la factura ${numOriginal} — ${original.concepto}`;

    const serie = serieForYear(SERIE_RECTIFICATIVA_PREFIX, new Date().getUTCFullYear());
    return await insertWithNumber(sb, serie, {
        booking_id: original.booking_id,
        tipo: "rectificativa",
        rectifica_invoice_id: original.id,
        motivo_rectificacion: motivo,
        receptor_nif: original.receptor_nif,
        receptor_nombre: original.receptor_nombre,
        receptor_direccion: original.receptor_direccion,
        receptor_email: original.receptor_email,
        concepto,
        base_imponible: -base,
        tipo_iva: tipoIva,
        cuota_iva: -cuota,
        total: -abono,
    });
}

/**
 * Inserta con numeración correlativa. El índice único (serie, numero) es el
 * árbitro: si dos emisiones compiten, una falla con 23505 y se reintenta.
 */
async function insertWithNumber(
    sb: SupabaseClient, serie: string, payload: Record<string, unknown>,
): Promise<InvoiceRow> {
    const fecha = new Date().toISOString().slice(0, 10);
    let lastErr: unknown = null;

    for (let intento = 0; intento < 6; intento++) {
        const numero = await siguienteNumero(sb, serie);
        const hashPrevio = await ultimoHash(sb);
        const hash = await sha256Hex(huellaPayload({
            hashPrevio, serie, numero, fecha,
            total: Number(payload.total), cuota: Number(payload.cuota_iva),
        }));

        const { data, error } = await sb
            .from("invoices")
            .insert({
                ...payload,
                serie,
                numero,
                fecha_emision: fecha,
                emisor_nif: EMISOR.nif,
                emisor_nombre: EMISOR.nombre,
                emisor_direccion: EMISOR.direccion,
                moneda: "EUR",
                verifactu_hash_previo: hashPrevio,
                verifactu_hash: hash,
                verifactu_status: "pending",
            })
            .select("*")
            .single();

        if (!error && data) return data as InvoiceRow;
        lastErr = error;
        if (error?.code !== "23505") break;   // sólo reintentamos colisión de número
        await new Promise((r) => setTimeout(r, 40 + intento * 60));
    }
    throw new Error(`no_se_pudo_numerar: ${JSON.stringify(lastErr)}`);
}

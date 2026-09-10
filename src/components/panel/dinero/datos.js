// Todo lo que la Ficha de reserva y la pantalla de Dinero leen y escriben.
//
// Tres normas que no se saltan:
//
// 1. Se escribe por función de la base (RPC) cuando existe. Esas funciones
//    NO revientan cuando algo no cuadra: contestan { ok: false, error: '…' }
//    y el cliente lo ve como si hubiera ido bien. Por eso hay que mirar
//    SIEMPRE el contenido de la respuesta, no solo el error de red.
// 2. Después de cada guardado se vuelve a leer de la base. Un permiso puede
//    rechazar una escritura sin dar error (0 filas y tan ancho): sin releer,
//    la pantalla diría "Guardado" y el dinero seguiría descuadrado.
// 3. Si una pieza todavía no está creada (la vista del parte, por ejemplo),
//    esta capa devuelve `null` y la pantalla lo enseña en gris. Nunca revienta.

import { supabase } from '../../../lib/supabase';

/** Reservas que siguen vivas y por tanto pueden deber dinero. Una cancelada nunca. */
export const ESTADOS_QUE_DEBEN = ['confirmed', 'pending', 'completed'];

// ───────────────────────── Traducción de errores ─────────────────────────

const esPermiso = (error) => {
    if (!error) return false;
    const codigo = error.code || '';
    const texto = `${error.message || ''}`.toLowerCase();
    return codigo === '42501' || codigo === 'PGRST301'
        || texto.includes('row-level security') || texto.includes('permission denied');
};

const faltaLaPieza = (error) => {
    if (!error) return false;
    const codigo = error.code || '';
    const texto = `${error.message || ''} ${error.details || ''}`.toLowerCase();
    return codigo === 'PGRST202' || codigo === 'PGRST205' || codigo === '42883' || codigo === '42P01'
        || texto.includes('could not find the') || texto.includes('does not exist');
};

const NO_GUARDADO = 'No se ha podido guardar: el sistema no me deja tocar esto. Avisa a Jesús y no lo intentes otra vez.';

const MOTIVOS = {
    no_autorizado: NO_GUARDADO,
    reserva_no_encontrada: 'No encuentro esa reserva. Vuelve atrás y ábrela otra vez.',
    importe_invalido: 'Ese importe no vale. Escribe cuánto te han pagado, en euros.',
    forma_de_pago_invalida: 'Elige cómo te lo han pagado.',
    fechas_invalidas: 'Esas fechas no cuadran: la entrada tiene que ir antes que la salida.',
    apartamento_no_encontrado: 'No encuentro ese apartamento. Vuelve a cargar la pantalla.',
    capacidad: 'En ese apartamento no caben tantas personas.',
    ocupado: 'Esas fechas ya están ocupadas en ese apartamento. Prueba con otras.',
    error_emision: 'No se ha podido hacer la factura. Avisa a Jesús.',
};

function traduce(error) {
    if (esPermiso(error)) return NO_GUARDADO;
    if (faltaLaPieza(error)) return 'Esta parte todavía no está terminada por dentro. Avisa a Jesús.';
    return 'No se ha podido guardar. Inténtalo otra vez dentro de un momento.';
}

/** Llama a una función de la base y devuelve su respuesta, o lanza un aviso en castellano. */
async function porFuncion(nombre, parametros) {
    const { data, error } = await supabase.rpc(nombre, parametros);
    if (error) throw new Error(traduce(error));
    if (data && data.ok === false) {
        throw new Error(MOTIVOS[data.error] || 'No se ha podido hacer. Vuelve a intentarlo y, si sigue igual, avisa a Jesús.');
    }
    return data || {};
}

// ───────────────────────── Lecturas ─────────────────────────

export async function cargarApartamentos() {
    const { data } = await supabase.from('apartments').select('id, name, capacity_people').order('name');
    return data || [];
}

export async function cargarReserva(id) {
    const { data, error } = await supabase
        .from('guest_bookings').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error('No se ha podido abrir la reserva. Vuelve a intentarlo.');
    return data || null;
}

export async function cargarCobros(bookingId) {
    const { data, error } = await supabase
        .from('booking_payments')
        .select('id, amount, method, paid_on, note, created_at')
        .eq('booking_id', bookingId)
        .order('paid_on', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
}

/**
 * Semáforo del parte de viajeros. Devuelve null si la vista todavía no
 * existe o si no hay fila: la pantalla lo pinta en gris y no se rompe.
 */
export async function cargarParte(bookingId) {
    try {
        const { data, error } = await supabase
            .from('v_parte_estado').select('*').eq('booking_id', bookingId).maybeSingle();
        if (error) return null;
        return data || null;
    } catch { return null; }
}

/** La factura principal de una reserva (no la rectificativa). null si no hay. */
export async function cargarFactura(bookingId) {
    try {
        const { data, error } = await supabase
            .from('invoices')
            .select('id, serie, numero, fecha_emision, tipo, total, pdf_url, email_sent_at, receptor_email')
            .eq('booking_id', bookingId)
            .neq('tipo', 'rectificativa')
            .order('created_at', { ascending: true })
            .limit(1).maybeSingle();
        if (error) return null;
        return data || null;
    } catch { return null; }
}

export async function cargarFacturasDe(bookingIds) {
    if (!bookingIds?.length) return {};
    try {
        const { data, error } = await supabase
            .from('invoices').select('id, booking_id, tipo').in('booking_id', bookingIds).neq('tipo', 'rectificativa');
        if (error) return {};
        const por = {};
        (data || []).forEach((f) => { por[f.booking_id] = f; });
        return por;
    } catch { return {}; }
}

// ───────────────────────── Escrituras ─────────────────────────

/**
 * Apuntar un cobro. Devuelve { paid_amount, pending_amount } RELEÍDOS de la
 * base: si el trigger no hubiera cuadrado, aquí se vería.
 */
export async function apuntarCobro({ bookingId, importe, forma, fecha, nota }) {
    const cantidad = Number(String(importe).replace(',', '.'));
    if (!Number.isFinite(cantidad) || cantidad === 0) {
        throw new Error('Ese importe no vale. Escribe cuánto te han pagado, en euros.');
    }
    await porFuncion('register_payment', {
        p_booking_id: bookingId,
        p_amount: Math.round(cantidad * 100) / 100,
        p_method: forma,
        p_paid_on: fecha || null,
        p_note: nota || null,
    });
    const reserva = await cargarReserva(bookingId);
    return reserva;
}

/** Cambiar fechas y/o apartamento. Devuelve { precio_sugerido, diferencia, total_price }. */
export async function moverReserva({ bookingId, apartamentoId, entrada, salida }) {
    return porFuncion('move_booking', {
        p_booking_id: bookingId,
        p_apartment_id: apartamentoId,
        p_check_in: entrada,
        p_check_out: salida,
    });
}

/** Cancelar. Devuelve { a_devolver, gratuita, cobrado }. */
export async function cancelarReserva({ bookingId, motivo }) {
    return porFuncion('cancel_booking', { p_booking_id: bookingId, p_reason: motivo || null });
}

/** El precio de una reserva movida no se cambia solo: lo decide quien gestiona. */
export async function ajustarPrecio(bookingId, nuevoTotal) {
    const { data, error } = await supabase
        .from('guest_bookings')
        .update({ total_price: nuevoTotal, updated_at: new Date().toISOString() })
        .eq('id', bookingId).select('id, total_price, pending_amount').maybeSingle();
    if (error) throw new Error(traduce(error));
    if (!data) throw new Error(NO_GUARDADO);
    return data;
}

export async function guardarNotas(bookingId, texto) {
    const limpio = (texto || '').trim() || null;
    const { data, error } = await supabase
        .from('guest_bookings')
        .update({ internal_notes: limpio, updated_at: new Date().toISOString() })
        .eq('id', bookingId).select('id, internal_notes').maybeSingle();
    if (error) throw new Error(traduce(error));
    if (!data) throw new Error(NO_GUARDADO);
    return data.internal_notes;
}

export async function marcarSinFactura(bookingId, valor) {
    const { data, error } = await supabase
        .from('guest_bookings')
        .update({ invoice_not_needed: !!valor, updated_at: new Date().toISOString() })
        .eq('id', bookingId).select('id, invoice_not_needed').maybeSingle();
    if (error) throw new Error(traduce(error));
    if (!data) throw new Error(NO_GUARDADO);
    return data.invoice_not_needed;
}

// ───────────────────────── Facturas ─────────────────────────
// La puerta es la función `issue-invoice`, que ya está desplegada. Se la
// llama tal cual: { action, bookingId, … }. Ella hace el PDF y el correo.

const FALLOS_FACTURA = {
    booking_not_found: 'No encuentro esa reserva.',
    booking_not_invoiceable: 'Esta reserva está cancelada: no se le puede hacer factura.',
    invoice_not_found: 'Esa factura ya no está.',
    invoice_not_found_for_booking: 'Esta reserva todavía no tiene factura. Hazla primero.',
    sin_email: 'Este huésped no tiene correo apuntado, así que no se le puede mandar. Apúntale el correo en su ficha.',
    ya_enviada: 'Esta factura ya se le mandó.',
    forbidden: NO_GUARDADO,
};

async function llamarFacturas(cuerpo) {
    const { data, error } = await supabase.functions.invoke('issue-invoice', { body: cuerpo });
    if (error) {
        // El cuerpo del error trae el motivo real; el mensaje de red no dice nada.
        let motivo = null;
        try { motivo = (await error.context?.json?.())?.error; } catch { /* sin cuerpo */ }
        throw new Error(FALLOS_FACTURA[motivo] || 'No se ha podido hacer la factura ahora mismo. Inténtalo en un momento.');
    }
    if (data?.error) throw new Error(FALLOS_FACTURA[data.error] || 'No se ha podido hacer la factura.');
    return data || {};
}

export const hacerFactura = (bookingId) => llamarFacturas({ action: 'issue', bookingId });

export async function mandarFactura(bookingId, { forzar = false } = {}) {
    const res = await llamarFacturas({ action: 'send', bookingId, force: forzar });
    if (res?.email && !res.email.sent) {
        const motivo = res.email.skipped || res.email.error;
        throw new Error(FALLOS_FACTURA[motivo] || 'No se ha podido mandar el correo. Inténtalo otra vez.');
    }
    return res;
}

/** Enlace firmado para ver el PDF de una factura ya hecha. */
export async function verFacturaPdf(invoiceId) {
    const res = await llamarFacturas({ action: 'pdf_url', invoiceId });
    if (!res?.url) throw new Error('No se ha podido abrir la factura. Inténtalo otra vez.');
    return res.url;
}

// ───────────────────────── Enlace para pagar ─────────────────────────

/**
 * Pide a la web un enlace de pago para esta reserva.
 *
 * Hoy la función solo sabe hacerlo mientras la reserva está recién apartada
 * desde la web. Para una reserva ya confirmada todavía no está montado (es
 * el paquete P1.8 del plan). Cuando no puede, devuelve { url: null, motivo }
 * y la pantalla lo dice en cristiano en vez de dejar un botón muerto.
 */
export async function pedirEnlaceDePago(bookingCode) {
    if (!bookingCode) return { url: null, motivo: 'sin_codigo' };
    try {
        const { data, error } = await supabase.functions.invoke('create-payment-session', {
            body: { bookingCode },
        });
        if (error) {
            let motivo = 'no_disponible';
            try { motivo = (await error.context?.json?.())?.error || motivo; } catch { /* sin cuerpo */ }
            return { url: null, motivo };
        }
        if (data?.url) return { url: data.url, motivo: null };
        return { url: null, motivo: data?.error || 'no_disponible' };
    } catch {
        return { url: null, motivo: 'no_disponible' };
    }
}

export const MOTIVOS_SIN_ENLACE = {
    nothing_pending: 'Esta reserva ya está cobrada del todo: no hay nada pendiente.',
    booking_not_payable: 'Esta reserva no admite enlace de pago (está cancelada o ya terminada). Si te tiene que pagar, dile que lo haga por transferencia o Bizum y apúntalo aquí cuando llegue.',
    hold_expired: 'Esta reserva ya no está a la espera de pago por la web. Cóbralo por transferencia, Bizum o efectivo y apúntalo aquí.',
    stripe_not_configured: 'Los pagos por la web no están disponibles ahora mismo. Avisa a Jesús.',
    sin_codigo: 'Esta reserva no tiene código, así que no se le puede hacer un enlace de pago.',
    no_disponible: 'No se ha podido crear el enlace de pago. Cóbralo por otra vía y apúntalo aquí.',
};

// ───────────────────────── La pantalla de Dinero ─────────────────────────

/** Todo lo que falta por cobrar, lo que llega antes primero. Sin canceladas. */
export async function cargarPendientes() {
    const [{ data: reservas, error }, apartamentos] = await Promise.all([
        supabase.from('guest_bookings').select('*')
            .in('status', ESTADOS_QUE_DEBEN)
            .gt('pending_amount', 0)
            .order('check_in', { ascending: true }),
        cargarApartamentos(),
    ]);
    if (error) throw new Error('No se ha podido leer lo que falta por cobrar. Vuelve a intentarlo.');
    const nombre = {};
    apartamentos.forEach((a) => { nombre[a.id] = a.name; });
    return (reservas || []).map((r) => ({ ...r, apartamento: nombre[r.apartment_id] || 'Apartamento' }));
}

/** Los cobros apuntados dentro de un mes, con el nombre de quién los hizo. */
export async function cargarCobrosDelMes({ desde, hasta }) {
    const { data, error } = await supabase
        .from('booking_payments')
        .select('id, booking_id, amount, method, paid_on, note, guest_bookings(id, guest_name, booking_code, check_in, apartment_id, status)')
        .gte('paid_on', desde).lte('paid_on', hasta)
        .order('paid_on', { ascending: false });
    if (error) throw new Error('No se ha podido leer lo cobrado. Vuelve a intentarlo.');
    return data || [];
}

/**
 * Reservas con dinero cobrado que no tienen factura y no están marcadas
 * como que no hace falta. Para que la lista no engañe.
 */
export async function cargarSinFactura() {
    const { data, error } = await supabase.from('guest_bookings')
        .select('id, guest_name, booking_code, check_in, check_out, total_price, paid_amount, apartment_id, channel, invoice_not_needed, status')
        .in('status', ESTADOS_QUE_DEBEN)
        .eq('invoice_not_needed', false)
        .gt('paid_amount', 0)
        .order('check_in', { ascending: false })
        .limit(60);
    if (error) return [];
    const reservas = data || [];
    if (!reservas.length) return [];
    const facturas = await cargarFacturasDe(reservas.map((r) => r.id));
    return reservas.filter((r) => !facturas[r.id]);
}

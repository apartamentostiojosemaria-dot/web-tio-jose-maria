// ============================================================
// datos.js — todo lo que "Apuntar reserva" le pide a la base
// ============================================================
// Aquí no hay nada de pantalla. Cada función devuelve datos ya masticados
// para que los componentes no tengan que saber cómo se llaman las cosas
// por dentro.
// ============================================================

import { supabase } from '../../../lib/supabase';

const URL_BASE = import.meta.env.VITE_SUPABASE_URL;
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Estados que ocupan de verdad un apartamento (los mismos que mira la base). */
const ESTADOS_QUE_OCUPAN = ['hold', 'pending', 'confirmed'];

const aNumero = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const sumaDias = (iso, dias) => {
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    const f = new Date(a, m - 1, d + dias);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

export const nochesEntre = (entrada, salida) => {
    if (!entrada || !salida) return 0;
    const a = new Date(`${entrada}T00:00:00`);
    const b = new Date(`${salida}T00:00:00`);
    const n = Math.round((b - a) / 86400000);
    // Una fecha imposible (un año de cinco cifras tecleado a mano) daba NaN
    // y la pantalla enseñaba «NaN noches».
    return Number.isFinite(n) ? n : 0;
};

export const masUnDia = (iso) => (iso ? sumaDias(iso, 1) : '');

// ------------------------------------------------------------
// 1. Qué hay libre para esas fechas
// ------------------------------------------------------------
/**
 * Devuelve los cuatro apartamentos clasificados:
 *   libres     → caben y están vacíos, con su precio ya calculado
 *   noCaben    → están vacíos pero son pequeños para tanta gente
 *   ocupados   → hay alguien o están cerrados, y decimos por qué
 *
 * Lo de "está libre" se calcula aquí con las MISMAS reglas que usa la base
 * al guardar (reservas vivas + días cerrados), para que no pueda pasar que
 * la pantalla enseñe uno libre y al guardar salte "ocupado".
 *
 * El precio sale de `check_availability`, que es el que cobra la web. Si esa
 * función se salta un apartamento por una regla de mínimo de noches (ella
 * cierra por teléfono estancias de una noche que la web no vende), lo
 * recuperamos aquí con `tjm_quote_price` y lo enseñamos igual.
 */
export async function buscarApartamentos({ entrada, salida, personas }) {
    const noches = nochesEntre(entrada, salida);
    if (!entrada || !salida || noches < 1) {
        return { libres: [], noCaben: [], ocupados: [], noches: 0 };
    }

    const finBloqueo = sumaDias(salida, -1); // blocked_dates.end_date es inclusiva

    const [aptRes, resRes, cerradosRes, dispRes] = await Promise.all([
        supabase.from('apartments')
            .select('id, name, capacity_people, is_active')
            .eq('is_active', true)
            .order('id'),
        supabase.from('guest_bookings')
            .select('apartment_id, guest_name, check_in, check_out, status')
            .in('status', ESTADOS_QUE_OCUPAN)
            .lt('check_in', salida)
            .gt('check_out', entrada),
        supabase.from('blocked_dates')
            .select('apartment_id, start_date, end_date, reason')
            .lte('start_date', finBloqueo)
            .gte('end_date', entrada),
        supabase.rpc('check_availability', {
            p_check_in: entrada, p_check_out: salida, p_pax: 1,
        }),
    ]);

    if (aptRes.error) throw aptRes.error;

    const apartamentos = aptRes.data || [];
    const ocupadaPor = {};
    (resRes.data || []).forEach((r) => {
        if (!ocupadaPor[r.apartment_id]) {
            ocupadaPor[r.apartment_id] = `está ${r.guest_name || 'alguien'} esos días`;
        }
    });
    (cerradosRes.data || []).forEach((b) => {
        if (!ocupadaPor[b.apartment_id]) {
            ocupadaPor[b.apartment_id] = b.reason
                ? `está cerrado esos días (${b.reason})`
                : 'está cerrado esos días';
        }
    });

    const precios = {};
    (dispRes.data || []).forEach((a) => {
        precios[a.apartment_id] = {
            total: aNumero(a.total_price),
            porNoche: aNumero(a.nightly_avg),
        };
    });

    // Los libres a los que check_availability no puso precio (regla de mínimo
    // de noches): se lo pedimos uno a uno. Como mucho son cuatro.
    const sinPrecio = apartamentos.filter((a) => !ocupadaPor[a.id] && !precios[a.id]);
    if (sinPrecio.length > 0) {
        const cotizados = await Promise.all(sinPrecio.map((a) =>
            supabase.rpc('tjm_quote_price', {
                p_apartment_id: a.id, p_check_in: entrada, p_check_out: salida,
            })
        ));
        sinPrecio.forEach((a, i) => {
            const total = aNumero(cotizados[i]?.data);
            precios[a.id] = { total, porNoche: noches > 0 ? total / noches : 0, fueraDeLaWeb: true };
        });
    }

    const libres = [];
    const noCaben = [];
    const ocupados = [];

    apartamentos.forEach((a) => {
        const ficha = {
            id: a.id,
            nombre: a.name,
            plazas: a.capacity_people,
            total: precios[a.id]?.total ?? 0,
            porNoche: precios[a.id]?.porNoche ?? 0,
            fueraDeLaWeb: Boolean(precios[a.id]?.fueraDeLaWeb),
            motivo: ocupadaPor[a.id] || '',
        };
        if (ficha.motivo) ocupados.push(ficha);
        else if (a.capacity_people < personas) noCaben.push(ficha);
        else libres.push(ficha);
    });

    libres.sort((a, b) => a.total - b.total);
    return { libres, noCaben, ocupados, noches };
}

// ------------------------------------------------------------
// 2. ¿Esta persona ya ha estado aquí?
// ------------------------------------------------------------
const soloDigitos = (t) => String(t || '').replace(/\D/g, '');

/**
 * Busca por teléfono o por correo. Devuelve null si no la conocemos.
 * { nombre, telefono, email, veces, futuras }
 *   veces   → veces que ya ha venido (estancias terminadas)
 *   futuras → reservas que todavía no han pasado
 */
export async function buscarPersona({ telefono, email }) {
    const correo = String(email || '').trim().toLowerCase();
    const digitos = soloDigitos(telefono);
    const cola = digitos.length >= 9 ? digitos.slice(-9) : '';
    if (!correo && !cola) return null;

    const filtros = [];
    if (correo) filtros.push(`guest_email.ilike.${correo}`);
    if (cola) filtros.push(`guest_phone.ilike.%${cola}%`);

    const { data, error } = await supabase
        .from('guest_bookings')
        .select('guest_name, guest_email, guest_phone, check_out, status')
        .or(filtros.join(','))
        .neq('status', 'cancelled')
        .order('check_out', { ascending: false })
        .limit(50);

    if (error || !data || data.length === 0) return null;

    const hoy = new Date().toISOString().slice(0, 10);
    const veces = data.filter((r) => r.check_out < hoy).length;
    const futuras = data.length - veces;
    const ultima = data[0];

    // El nombre bueno es el de la ficha de cliente si la hay; si no, el de
    // la última reserva.
    let nombre = ultima.guest_name || '';
    let tel = ultima.guest_phone || '';
    const correoUltimo = (ultima.guest_email || '').includes('@tiojosemaria.local')
        ? '' : (ultima.guest_email || '');

    if (correoUltimo) {
        const { data: ficha } = await supabase
            .from('customers')
            .select('canonical_name, phone')
            .eq('email', correoUltimo.toLowerCase())
            .maybeSingle();
        if (ficha?.canonical_name) nombre = ficha.canonical_name;
        if (ficha?.phone) tel = ficha.phone;
    }

    return { nombre, telefono: tel, email: correoUltimo, veces, futuras };
}

// ------------------------------------------------------------
// 3. Guardar la reserva
// ------------------------------------------------------------
/** Devuelve { ok, booking_id, booking_code, ... } o { ok:false, error }. */
export async function crearReserva({
    apartamentoId, entrada, salida, personas,
    nombre, email, telefono, canal, precio,
    localizador, comision, notas,
}) {
    const { data, error } = await supabase.rpc('create_manual_booking', {
        p_apartment_id: apartamentoId,
        p_check_in: entrada,
        p_check_out: salida,
        p_pax: personas,
        p_guest_name: nombre || null,
        p_guest_email: email || null,
        p_guest_phone: telefono || null,
        p_channel: canal,
        p_total_price: precio,
        p_external_locator: localizador || null,
        p_commission_amount: comision || 0,
        p_notes: notas || null,
    });
    if (error) return { ok: false, error: error.message || 'fallo' };
    return data || { ok: false, error: 'fallo' };
}

/** Apunta un cobro sobre una reserva ya guardada. */
export async function apuntarCobro({ reservaId, importe, forma, fecha, nota }) {
    const { data, error } = await supabase.rpc('register_payment', {
        p_booking_id: reservaId,
        p_amount: importe,
        p_method: forma,
        p_paid_on: fecha || null,
        p_note: nota || null,
    });
    if (error) return { ok: false, error: error.message || 'fallo' };
    return data || { ok: false, error: 'fallo' };
}

// ------------------------------------------------------------
// 4. Correo de confirmación y enlace de pago
// ------------------------------------------------------------
const llamarFuncion = async (nombre, cuerpo) => {
    const res = await fetch(`${URL_BASE}/functions/v1/${nombre}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            apikey: CLAVE,
            authorization: `Bearer ${CLAVE}`,
        },
        body: JSON.stringify(cuerpo),
    });
    let datos = {};
    try { datos = await res.json(); } catch { /* respuesta sin cuerpo */ }
    return { ok: res.ok, estado: res.status, datos };
};

/**
 * Manda el correo de confirmación (con el enlace para que el huésped
 * rellene sus datos). Nunca lanza: si falla, la reserva ya está guardada.
 */
export async function mandarConfirmacion(codigoReserva) {
    try {
        const { ok, datos } = await llamarFuncion('send-booking-email', {
            bookingCode: codigoReserva,
            template: 'confirmation',
        });
        return { ok: ok && !datos?.error, saltado: datos?.skipped || null };
    } catch {
        return { ok: false, saltado: null };
    }
}

/**
 * Pide el enlace de pago de Stripe para una reserva YA guardada.
 *
 * Manda el código de reserva (obligatorio: hace de secreto), el id como
 * filtro y el importe a cobrar. Desde el 10-sep-2026 la función admite
 * reservas ya guardadas y cobros parciales.
 */
export async function pedirEnlaceDePago({ codigoReserva, reservaId, importe }) {
    try {
        const { ok, datos } = await llamarFuncion('create-payment-session', {
            bookingCode: codigoReserva,
            bookingId: reservaId,
            amount: importe,
        });
        if (ok && datos?.url) return { ok: true, url: datos.url };
        return { ok: false, motivo: datos?.error || 'sin_respuesta' };
    } catch {
        return { ok: false, motivo: 'sin_conexion' };
    }
}

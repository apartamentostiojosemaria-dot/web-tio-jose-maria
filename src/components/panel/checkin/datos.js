// ============================================================
// checkin/datos.js — lo que la pantalla de check-in necesita de la base
// ============================================================
// Aquí vive TODO lo que toca la base para el check-in, para que la pantalla
// se ocupe sólo de pintar. Reglas de esta capa:
//
//   · Nada de lo que se guarda aquí es una copia de un documento. Lo único
//     que se apunta es «una persona miró el documento y coincidía», que es
//     literalmente lo que el art. 4.3 del RD 933/2021 le pide al alojamiento.
//     Ni foto, ni escaneo, ni número tecleado por quien recibe.
//   · Algunas columnas todavía no existen (las está creando otro agente).
//     Cuando falta una, esta capa lo DICE. Nunca finge que ha guardado algo.
//     Un check-in que dice «hecho» sin estarlo es peor que uno que dice
//     «no he podido».
// ============================================================

import { supabase } from '../../../lib/supabase';

// ---------------------------------------------------------------- errores

/** ¿El fallo es «esa columna todavía no existe»? */
export const faltaColumna = (e) =>
    e?.code === 'PGRST204' || e?.code === '42703'
    || /column .* does not exist/i.test(e?.message || '');

/** ¿El fallo es «esa función todavía no existe»? */
export const faltaFuncion = (e) =>
    e?.code === 'PGRST202' || e?.code === '42883'
    || /could not find the function|function .* does not exist/i.test(e?.message || '');

// ---------------------------------------------------------------- enlaces

const BASE_PUBLICA = 'https://tiojosemaria.com';

/** El enlace que abre el formulario del huésped para esta reserva. */
export function enlacePrecheckin(codigo, { absoluto = false } = {}) {
    const base = absoluto
        ? BASE_PUBLICA
        : (typeof window !== 'undefined' ? window.location.origin : BASE_PUBLICA);
    return `${base}/precheckin?code=${encodeURIComponent(codigo || '')}`;
}

/**
 * El mismo enlace, en corto, para leerlo en voz alta o teclearlo a mano si el
 * código no se deja escanear. Sin `https://`, que sólo estorba.
 */
export function enlaceCorto(codigo) {
    return enlacePrecheckin(codigo, { absoluto: true }).replace(/^https?:\/\//, '');
}

/** Deja el teléfono como lo quiere WhatsApp: sólo dígitos y con prefijo. */
export function telefonoParaWhatsapp(tel) {
    if (!tel) return '';
    let limpio = String(tel).replace(/[^\d+]/g, '');
    if (limpio.startsWith('+')) limpio = limpio.slice(1);
    if (limpio.startsWith('00')) limpio = limpio.slice(2);
    // Un móvil español escrito sin prefijo: 9 dígitos que empiezan por 6, 7 u 8.
    if (/^[6789]\d{8}$/.test(limpio)) limpio = `34${limpio}`;
    return /^\d{8,15}$/.test(limpio) ? limpio : '';
}

const primerNombre = (nombre) => String(nombre || '').trim().split(/\s+/)[0] || '';

/**
 * El recado que se le manda al huésped con el enlace.
 * El enlace NO va al final de la línea: algunas apps se comen el salto y lo
 * dejan pegado a la palabra siguiente, y entonces no abre.
 */
export function textoRecordatorio({ guest_name, booking_code }, { enLaPuerta = false } = {}) {
    const nombre = primerNombre(guest_name);
    const saludo = nombre ? `Hola ${nombre}` : 'Hola';
    const motivo = enLaPuerta
        ? 'Para daros la llave necesitamos los datos de cada persona que se aloja. Nos los pide la ley y se rellena en dos minutos desde el móvil:'
        : 'Antes de que lleguéis necesitamos los datos de cada persona que se aloja (nombre, documento y poco más). Nos los pide la ley y se rellena en un par de minutos desde el móvil:';
    return [
        `${saludo}, somos los Apartamentos Tío José María.`,
        '',
        motivo,
        '',
        enlacePrecheckin(booking_code, { absoluto: true }),
        '',
        enLaPuerta ? '¡Gracias!' : '¡Gracias y hasta pronto!',
    ].join('\n');
}

export function abrirWhatsapp(telefono, texto) {
    const tel = telefonoParaWhatsapp(telefono);
    if (!tel) return false;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    return true;
}

// ---------------------------------------------------------------- edades

export function edadEn(nacimiento, referencia) {
    if (!nacimiento) return null;
    const n = new Date(`${String(nacimiento).slice(0, 10)}T00:00:00`);
    const r = new Date(`${String(referencia || new Date().toISOString().slice(0, 10)).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(n.getTime()) || Number.isNaN(r.getTime())) return null;
    let e = r.getFullYear() - n.getFullYear();
    const m = r.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && r.getDate() < n.getDate())) e -= 1;
    return Math.max(e, 0);
}

/** Firman los mayores de CATORCE (art. 4.2 RD 933/2021). No 16 ni 18. */
export const EDAD_FIRMA = 14;
/** El documento propio sólo se le pide a los mayores de edad. */
export const EDAD_DOCUMENTO = 18;

// ---------------------------------------------------------------- lectura

const CAMPOS_PERSONA =
    'id, is_titular, nombre, apellido_primero, apellido_segundo, tipo_documento, '
    + 'numero_documento, soporte_documento, fecha_nacimiento, nacionalidad, '
    + 'parentesco, firma_base64, submitted_at, created_at';

const NOMBRES_DOCUMENTO = {
    D: 'DNI', N: 'NIE', P: 'Pasaporte',
    E: 'Documento de identidad', C: 'Permiso de conducir', X: 'Documento',
};

export const nombreDocumento = (tipo) => NOMBRES_DOCUMENTO[tipo] || 'Documento';

export const nombreCompleto = (p) =>
    [p?.nombre, p?.apellido_primero, p?.apellido_segundo].filter(Boolean).join(' ').trim();

/**
 * Trae la reserva y las personas que ya han rellenado.
 *
 * La lista de personas se pide primero por la función `tjm_checkin_personas`
 * (la que hay que crear para que la madre, con permiso de `staff`, pueda
 * verla) y, si todavía no existe, se lee la tabla directamente — que hoy
 * funciona para quien entra como administrador.
 *
 * Devuelve `puedeVerPersonas: false` cuando el recuento dice que hay gente
 * rellenada pero la lista vuelve vacía. Eso NO es «no ha rellenado nadie»:
 * es «no tengo permiso para verlo», y la pantalla lo dice tal cual.
 */
export async function cargarCheckin(reservaId) {
    const id = Number(reservaId);
    if (!id) throw new Error('sin_reserva');

    const [reservaRes, estadoRes] = await Promise.all([
        supabase
            .from('guest_bookings')
            .select('*, apartments(name)')
            .eq('id', id)
            .maybeSingle(),
        supabase
            .from('v_parte_estado')
            .select('*')
            .eq('booking_id', id)
            .maybeSingle(),
    ]);

    if (reservaRes.error) throw reservaRes.error;
    if (!reservaRes.data) throw new Error('reserva_no_encontrada');

    const personasRes = await leerPersonas(id);

    const rellenos = Number(estadoRes.data?.viajeros_rellenos ?? personasRes.personas.length) || 0;
    const puedeVerPersonas = personasRes.personas.length > 0 || rellenos === 0;

    return {
        reserva: reservaRes.data,
        estado: estadoRes.data || null,
        personas: personasRes.personas,
        rellenos,
        puedeVerPersonas,
    };
}

async function leerPersonas(id) {
    const porFuncion = await supabase.rpc('tjm_checkin_personas', { p_booking_id: id });
    if (!porFuncion.error) {
        return { personas: ordenar(porFuncion.data || []) };
    }
    if (!faltaFuncion(porFuncion.error)) {
        // Un error de verdad (permiso, red). Se deja pasar como lista vacía y
        // que la pantalla avise; no se inventa nada.
        // eslint-disable-next-line no-console
        console.warn('tjm_checkin_personas falló:', porFuncion.error.message);
    }

    const directo = await supabase
        .from('traveler_records')
        .select(CAMPOS_PERSONA)
        .eq('booking_id', id);

    if (directo.error) return { personas: [] };
    return { personas: ordenar(directo.data || []) };
}

/** Primero quien reserva, después por orden de llegada de los datos. */
const ordenar = (lista) => [...lista].sort((a, b) => {
    if (a.is_titular !== b.is_titular) return a.is_titular ? -1 : 1;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
});

// ------------------------------------------------- «Coincide» (comprobación)

const clave = (reservaId) => `tjm-checkin-comprobado-${reservaId}`;

/** Lo comprobado que hay guardado en ESTE aparato. */
export function leerComprobadoLocal(reservaId) {
    try {
        return JSON.parse(localStorage.getItem(clave(reservaId)) || '{}') || {};
    } catch {
        return {};
    }
}

function escribirComprobadoLocal(reservaId, personaId, cuando) {
    try {
        const mapa = leerComprobadoLocal(reservaId);
        if (cuando) mapa[personaId] = cuando;
        else delete mapa[personaId];
        localStorage.setItem(clave(reservaId), JSON.stringify(mapa));
    } catch { /* modo privado o sin sitio: se sigue igual */ }
}

export function limpiarComprobadoLocal(reservaId) {
    try { localStorage.removeItem(clave(reservaId)); } catch { /* da igual */ }
}

/**
 * Apunta que se ha mirado el documento de esta persona y coincidía.
 *
 * Se guarda en la base si existe sitio donde guardarlo
 * (`tjm_checkin_verificar`) y, mientras no lo haya, en este mismo aparato.
 * Devuelve dónde ha quedado para que la pantalla lo pueda decir en claro.
 */
export async function marcarCoincide(reservaId, personaId, coincide = true) {
    const cuando = coincide ? new Date().toISOString() : null;
    const porFuncion = await supabase.rpc('tjm_checkin_verificar', {
        p_traveler_id: personaId,
        p_coincide: coincide,
    });
    if (!porFuncion.error) {
        escribirComprobadoLocal(reservaId, personaId, cuando);
        return { donde: 'base', cuando };
    }
    if (!faltaFuncion(porFuncion.error)) {
        // eslint-disable-next-line no-console
        console.warn('tjm_checkin_verificar falló:', porFuncion.error.message);
    }
    escribirComprobadoLocal(reservaId, personaId, cuando);
    return { donde: 'aparato', cuando };
}

// ---------------------------------------------------------- entrada y salida

/**
 * Apunta la hora REAL de entrada. Ni las 16:00 ni ninguna hora inventada:
 * la de ahora mismo, que es la que pide el anexo I A.4.b.
 * Si la columna todavía no existe, devuelve `{ ok: false, motivo: 'sin_columna' }`
 * y la pantalla lo dice. No se marca el check-in como hecho a medias.
 */
export async function apuntarEntrada(reservaId, cuando = new Date()) {
    return apuntarHora(reservaId, 'checkin_at', cuando);
}

export async function apuntarSalida(reservaId, cuando = new Date()) {
    return apuntarHora(reservaId, 'checkout_at', cuando);
}

async function apuntarHora(reservaId, columna, cuando) {
    const iso = (cuando instanceof Date ? cuando : new Date(cuando)).toISOString();
    const { error } = await supabase
        .from('guest_bookings')
        .update({ [columna]: iso })
        .eq('id', Number(reservaId));

    if (!error) return { ok: true, cuando: iso };
    if (faltaColumna(error)) return { ok: false, motivo: 'sin_columna', columna };
    return { ok: false, motivo: 'error', mensaje: error.message };
}

// ------------------------------------------------------------- en vivo

/**
 * Mantiene la pantalla al día mientras el huésped rellena en su móvil.
 *
 * Se intenta por las suscripciones en vivo de Supabase y, ADEMÁS, se relee
 * cada pocos segundos. Lo segundo no sobra: hoy `traveler_records` no está
 * en la publicación de tiempo real, así que la suscripción se conecta y no
 * llega nunca nada. Cuando se añada, las dos vías empujan lo mismo y no
 * pasa nada por releer de más: son cuatro filas.
 *
 * Devuelve una función para dejar de escuchar.
 */
export function escucharCheckin(reservaId, alCambiar, { cadaMs = 4000 } = {}) {
    const id = Number(reservaId);
    let vivo = true;

    const canal = supabase
        .channel(`checkin-${id}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'traveler_records', filter: `booking_id=eq.${id}` },
            () => { if (vivo) alCambiar('en-vivo'); },
        )
        .subscribe();

    const reloj = setInterval(() => { if (vivo) alCambiar('relectura'); }, cadaMs);

    return () => {
        vivo = false;
        clearInterval(reloj);
        supabase.removeChannel(canal);
    };
}

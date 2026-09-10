// Cómo se dicen las cosas del dinero en la pantalla de la madre.
//
// Aquí no hay lógica: solo la traducción de lo que guarda la base a las
// palabras que ella usa. Si alguna vez aparece en pantalla "stripe", "vcc"
// o "channel", el fallo está en este fichero.

import { aFecha, hoyISO, aISO } from '../ui';

// ───────────────────────── Fechas ─────────────────────────

/** '8 de septiembre' (sin el día de la semana: para una línea de cobro). */
export const diaYMes = (iso) => {
    const f = aFecha(iso);
    if (!f) return '';
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(f);
};

/** '8 de septiembre de 2026' — solo cuando el año no es el de ahora. */
export const diaMesYAno = (iso) => {
    const f = aFecha(iso);
    if (!f) return '';
    const esteAno = new Date().getFullYear();
    return f.getFullYear() === esteAno
        ? diaYMes(iso)
        : new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(f);
};

/** 'septiembre' · 'septiembre de 2025' si no es este año. Recibe 'AAAA-MM'. */
export const mesEnPalabras = (mes) => {
    const [a, m] = String(mes).split('-').map(Number);
    if (!a || !m) return '';
    const f = new Date(a, m - 1, 1);
    const esteAno = new Date().getFullYear();
    return new Intl.DateTimeFormat('es-ES', {
        month: 'long', ...(a === esteAno ? {} : { year: 'numeric' }),
    }).format(f);
};

/** 'AAAA-MM' del mes de hoy. */
export const mesDeHoy = () => hoyISO().slice(0, 7);

/** Primer y último día de un mes 'AAAA-MM', como 'AAAA-MM-DD'. */
export const limitesDelMes = (mes) => {
    const [a, m] = String(mes).split('-').map(Number);
    return { desde: aISO(new Date(a, m - 1, 1)), hasta: aISO(new Date(a, m, 0)) };
};

/** Lista de meses hacia atrás para el selector, empezando por el de hoy. */
export const mesesHaciaAtras = (cuantos = 12) => {
    const hoy = aFecha(hoyISO());
    const meses = [];
    for (let i = 0; i < cuantos; i += 1) {
        const f = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        meses.push(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`);
    }
    return meses;
};

/** 'jueves 25 de septiembre' — y con el año detrás si no es este. */
const diaLargo = (iso) => {
    const f = aFecha(iso);
    if (!f) return '';
    const esteAno = new Date().getFullYear();
    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long',
        ...(f.getFullYear() === esteAno ? {} : { year: 'numeric' }),
    }).format(f).replace(',', '');
};

/** 'Entra el jueves 25 de septiembre · Sale el sábado 27 de septiembre' */
export const rangoEnPalabras = (entrada, salida) =>
    `Entra el ${diaLargo(entrada)} · Sale el ${diaLargo(salida)}`;

// ───────────────────────── Formas de pago ─────────────────────────

// Las claves son las de booking_payments_method_check (migración 0002).
export const FORMAS_DE_PAGO = [
    { valor: 'transferencia', etiqueta: 'Transferencia' },
    { valor: 'bizum', etiqueta: 'Bizum' },
    { valor: 'efectivo', etiqueta: 'Efectivo' },
    { valor: 'tarjeta', etiqueta: 'Tarjeta' },
    { valor: 'booking', etiqueta: 'Lo paga Booking' },
];

const NOMBRE_FORMA = {
    transferencia: 'transferencia',
    bizum: 'Bizum',
    efectivo: 'efectivo',
    tarjeta: 'tarjeta',
    booking: 'lo paga Booking',
    stripe: 'pago por la web',
};

/** 'transferencia' · 'pago por la web' · 'lo paga Booking' */
export const nombreForma = (metodo) => NOMBRE_FORMA[metodo] || metodo || '';

/** 'Transferencia, 8 de septiembre' — la línea de un cobro apuntado. */
export const cobroEnPalabras = (cobro) => {
    if (!cobro) return '';
    const forma = nombreForma(cobro.method);
    const cuando = diaMesYAno(cobro.paid_on);
    const texto = `${forma}${cuando ? `, ${cuando}` : ''}`;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// ───────────────────────── Teléfono y WhatsApp ─────────────────────────

/** Deja el teléfono como lo quiere wa.me: solo números, con prefijo. */
export const telefonoLimpio = (tel) => {
    if (!tel) return '';
    const soloNumeros = String(tel).replace(/[^\d+]/g, '').replace(/^00/, '+');
    if (soloNumeros.startsWith('+')) return soloNumeros.slice(1);
    // Nueve cifras sin prefijo: es un móvil español.
    return soloNumeros.length === 9 ? `34${soloNumeros}` : soloNumeros;
};

export const enlaceLlamar = (tel) => (tel ? `tel:${String(tel).replace(/\s/g, '')}` : null);

export const enlaceWhatsApp = (tel, texto) => {
    const numero = telefonoLimpio(tel);
    if (!numero) return null;
    return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
};

/** El recordatorio de los datos de la policía, ya escrito. */
export const textoRecordatorioPolicia = (reserva, web = 'https://tiojosemaria.com') => {
    const nombre = (reserva?.guest_name || '').split(' ')[0];
    const enlace = reserva?.booking_code ? `${web}/precheckin?code=${reserva.booking_code}` : `${web}/precheckin`;
    return [
        `Hola${nombre ? ` ${nombre}` : ''}, somos los Apartamentos Tío José María.`,
        '',
        `Para preparar tu llegada del ${diaYMes(reserva?.check_in)} nos faltan los datos del documento de identidad de quienes venís: nos los pide la policía y hay que mandarlos antes de que entréis.`,
        '',
        'Se rellenan aquí en dos minutos:',
        enlace,
        '',
        'Muchas gracias.',
    ].join('\n');
};

/** El aviso de que falta dinero, ya escrito. */
export const textoRecordatorioCobro = (reserva, falta, formatoEuro) => {
    const nombre = (reserva?.guest_name || '').split(' ')[0];
    return [
        `Hola${nombre ? ` ${nombre}` : ''}, somos los Apartamentos Tío José María.`,
        '',
        `De tu reserva del ${diaYMes(reserva?.check_in)} quedan pendientes ${formatoEuro(falta)}.`,
        '',
        '¿Nos dices cómo prefieres pagarlo? Muchas gracias.',
    ].join('\n');
};

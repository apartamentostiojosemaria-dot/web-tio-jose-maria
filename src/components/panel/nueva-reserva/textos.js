// ============================================================
// textos.js — las palabras y las listas de "Apuntar reserva"
// ============================================================
// Todo lo que se lee en pantalla vive aquí, para poder cambiarlo sin
// tocar la lógica. Regla de oro: ni una palabra que ella no diría.
// Prohibido en pantalla: canal, OTA, iCal, hold, RPC, API, check-in.
// ============================================================

import { Phone, MessageCircle, Globe, Home, Building2, Trees, HandCoins } from 'lucide-react';

/**
 * Por dónde le ha llegado la reserva.
 * `valor` es EXACTAMENTE lo que acepta guest_bookings_channel_check
 * (migración 0002): web, booking, airbnb, escapada, casasrurales,
 * telefono, whatsapp, otro.
 *
 * `deFuera` = webs de reservas que se llevan una comisión y dan un número
 * de reserva propio. Solo en esas se preguntan esos dos datos.
 * `comisionSugerida` = tanto por ciento que se lleva esa web, medido en la
 * cuenta de MisterPlan (Booking: 22,95 € sobre 135 € = 17 %). Donde no
 * tenemos un dato medido, no se inventa: el campo sale vacío.
 */
export const CANALES = [
    { valor: 'telefono', etiqueta: 'Por teléfono', icono: Phone, deFuera: false },
    { valor: 'whatsapp', etiqueta: 'Por WhatsApp', icono: MessageCircle, deFuera: false },
    { valor: 'booking', etiqueta: 'Booking', icono: Building2, deFuera: true, comisionSugerida: 17 },
    { valor: 'airbnb', etiqueta: 'Airbnb', icono: Home, deFuera: true },
    { valor: 'escapada', etiqueta: 'Escapada Rural', icono: Trees, deFuera: true },
    { valor: 'casasrurales', etiqueta: 'CasasRurales.net', icono: Globe, deFuera: true },
    { valor: 'otro', etiqueta: 'Vino en persona', icono: HandCoins, deFuera: false },
];

export const buscarCanal = (valor) => CANALES.find((c) => c.valor === valor) || null;

/**
 * Formas de pago. Las claves son las que acepta register_payment:
 * transferencia, bizum, efectivo, tarjeta, stripe, booking.
 * 'stripe' y 'booking' no se ofrecen aquí: el primero lo apunta solo la
 * web cuando el huésped paga, y el segundo se apunta cuando Booking
 * ingresa, que es más tarde.
 */
export const FORMAS_DE_PAGO = [
    { valor: 'transferencia', etiqueta: 'Transferencia' },
    { valor: 'bizum', etiqueta: 'Bizum' },
    { valor: 'efectivo', etiqueta: 'En efectivo' },
    { valor: 'tarjeta', etiqueta: 'Con tarjeta' },
];

/** Mensaje de capacidad con el nombre y las plazas de verdad. */
export const noCabenAqui = (apartamento, plazas, personas) =>
    `En ${apartamento} solo caben ${plazas} ${plazas === 1 ? 'persona' : 'personas'}, y sois ${personas}.`;

/** Lo que devuelve la base traducido a lo que ella entiende. */
export const explicarError = (error, { apartamento, plazas, personas } = {}) => {
    switch (error) {
        case 'ocupado':
            return apartamento
                ? `Esas fechas ya están ocupadas en ${apartamento}.`
                : 'Esas fechas ya están ocupadas en ese apartamento.';
        case 'capacidad':
            if (apartamento && plazas) return noCabenAqui(apartamento, plazas, personas);
            if (apartamento) return `En ${apartamento} no caben tantas personas.`;
            return 'En ese apartamento no caben tantas personas.';
        case 'fechas_invalidas':
            return 'La salida tiene que ser después de la entrada.';
        case 'apartamento_no_encontrado':
            return 'Ese apartamento ya no está disponible. Vuelve atrás y elige otro.';
        case 'no_autorizado':
            return 'Tu cuenta no puede apuntar reservas. Avisa a Jesús.';
        case 'importe_invalido':
            return 'Ese importe no vale. Escribe cuánto ha pagado, en euros.';
        case 'forma_de_pago_invalida':
            return 'Elige cómo ha pagado antes de guardar.';
        case 'reserva_no_encontrada':
            return 'No encuentro esa reserva.';
        default:
            return 'No he podido guardarla. Inténtalo otra vez en un momento.';
    }
};


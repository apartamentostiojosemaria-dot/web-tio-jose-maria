import React from 'react';
import { Loader2, AlertCircle, Info, CheckCircle2, Inbox } from 'lucide-react';

// ============================================================
// ui.jsx — piezas compartidas del panel sencillo (/panel)
// ============================================================
// Reglas de estas piezas (no romperlas al ampliarlas):
//   - Todo lo que se pulsa mide 44 px de alto como minimo.
//   - Texto grande (16 px o mas) y contraste alto: se usa a 60 anos y con sol.
//   - Nada de jerga en pantalla. Palabras buenas: reserva, huesped, entra,
//     sale, cobrado, pendiente, datos de la policia, factura, limpieza.
//   - Todo accesible con teclado: botones reales, foco visible, aria correcto.
// ============================================================

// ---------- Constantes del alojamiento (recibimiento en persona) ----------
export const HORA_ENTRADA = 'de 16:00 a 20:00';
export const HORA_SALIDA = 'antes de las 12:00';
export const ZONA = 'Europe/Madrid';

// ---------- Fechas ----------

/** Fecha de hoy en Espana, como 'AAAA-MM-DD'. Fiable aunque el movil este en otra zona. */
export const hoyISO = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());

/** Convierte 'AAAA-MM-DD' en un Date local sin sustos de zona horaria. */
export const aFecha = (iso) => {
    if (!iso) return null;
    if (iso instanceof Date) return iso;
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!a || !m || !d) return null;
    return new Date(a, m - 1, d);
};

/** Convierte un Date en 'AAAA-MM-DD' (hora local, sin desfases). */
export const aISO = (fecha) => {
    if (!fecha) return '';
    const f = fecha instanceof Date ? fecha : aFecha(fecha);
    if (!f) return '';
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

/** 'Buenos días' / 'Buenas tardes' / 'Buenas noches', segun la hora REAL en Espana. */
export const saludo = () => {
    const hora = Number(
        new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: 'numeric', hour12: false })
            .format(new Date())
    );
    if (hora < 14) return 'Buenos días';
    if (hora < 21) return 'Buenas tardes';
    return 'Buenas noches';
};

/** 'jueves 10 de septiembre' */
export const fechaEnPalabras = (iso) => {
    const f = aFecha(iso);
    if (!f) return '';
    // El ano solo se dice cuando NO es el actual. Si no, una reserva para mayo
    // del ano que viene se lee igual que una de este mayo, y el sitio donde eso
    // se nota es justo antes de guardarla.
    const esOtroAno = f.getFullYear() !== new Date().getFullYear();
    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long',
        ...(esOtroAno ? { year: 'numeric' } : {}),
    }).format(f);
};

/**
 * Suma dias de CALENDARIO a una fecha ISO. No usar milisegundos: el 25 de
 * octubre de 2026 tiene 25 horas (cambio de hora) y sumar 86.400.000 ms
 * devuelve el mismo dia otra vez.
 */
export const sumarDias = (iso, dias) => {
    const f = aFecha(iso);
    return new Date(f.getFullYear(), f.getMonth(), f.getDate() + dias);
};

/** 'Hoy, jueves 10 de septiembre' · 'Manana, viernes 11...' · 'Jueves 10 de septiembre' */
export const fechaEnPalabrasRelativa = (iso) => {
    const texto = fechaEnPalabras(iso);
    if (!texto) return '';
    const hoy = hoyISO();
    if (iso === hoy) return `Hoy, ${texto}`;
    const manana = aISO(sumarDias(hoy, 1));
    if (iso === manana) return `Mañana, ${texto}`;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** '10 sep' */
export const fechaCorta = (iso) => {
    const f = aFecha(iso);
    if (!f) return '';
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short',
        ...(f && f.getFullYear() !== new Date().getFullYear() ? { year: '2-digit' } : {}) }).format(f);
};

// ---------- Dinero ----------

export const formatoEuro = (n) =>
    new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(Number(n) || 0);

/** <Dinero importe={135} /> → 135 € */
export const Dinero = ({ importe, className = '', tono }) => {
    const color =
        tono === 'pendiente' ? 'text-amber-700' :
        tono === 'cobrado' ? 'text-rural-700' :
        tono === 'apagado' ? 'text-gray-500' : '';
    return (
        <span className={`tabular-nums font-semibold ${color} ${className}`}>
            {formatoEuro(importe)}
        </span>
    );
};

// ---------- Botones ----------

const ESTILOS_BOTON = {
    principal: 'bg-rural-600 text-white hover:bg-rural-700 active:bg-rural-800 shadow-sm',
    secundario: 'bg-white text-rural-700 border-2 border-rural-200 hover:border-rural-400 hover:bg-rural-50',
    suave: 'bg-rural-50 text-rural-700 hover:bg-rural-100',
    peligro: 'bg-white text-red-700 border-2 border-red-200 hover:bg-red-50',
};

/**
 * <Boton onClick={...} icono={Phone}>Llamar</Boton>
 * variante: principal | secundario | suave | peligro
 */
export const Boton = ({
    children, onClick, variante = 'principal', icono: Icono,
    type = 'button', disabled = false, cargando = false,
    ancho = false, tamano = 'normal', className = '', ...resto
}) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled || cargando}
        className={[
            'inline-flex items-center justify-center gap-2 rounded-2xl font-bold',
            'transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30',
            'disabled:opacity-45 disabled:cursor-not-allowed',
            tamano === 'grande' ? 'min-h-[60px] px-6 text-lg' : 'min-h-[52px] px-5 text-base',
            ancho ? 'w-full' : '',
            ESTILOS_BOTON[variante] || ESTILOS_BOTON.principal,
            className,
        ].join(' ')}
        {...resto}
    >
        {cargando
            ? <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            : Icono ? <Icono size={20} aria-hidden="true" /> : null}
        <span>{children}</span>
    </button>
);

// ---------- Tarjeta ----------

/**
 * Contenedor blanco. Si le pasas onClick se comporta como boton grande
 * (toda la tarjeta es pulsable, que es lo que se espera en el movil).
 */
export const Tarjeta = ({ children, titulo, onClick, className = '', ...resto }) => {
    const base = `bg-white rounded-3xl border border-gray-200 shadow-sm ${className}`;
    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={`${base} w-full text-left p-5 min-h-[64px] transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30 active:scale-[0.99]`}
                {...resto}
            >
                {titulo && <p className="font-bold text-lg text-text-primary mb-1">{titulo}</p>}
                {children}
            </button>
        );
    }
    return (
        <div className={`${base} p-5`} {...resto}>
            {titulo && <p className="font-bold text-lg text-text-primary mb-3">{titulo}</p>}
            {children}
        </div>
    );
};

// ---------- Campo de formulario ----------

/**
 * <Campo etiqueta="Nombre" ayuda="Como se llama quien viene" htmlFor="nombre">
 *   <input id="nombre" className={claseInput} />
 * </Campo>
 */
export const Campo = ({ etiqueta, ayuda, error, children, htmlFor, obligatorio = false, className = '' }) => {
    const idAyuda = htmlFor ? `${htmlFor}-ayuda` : undefined;
    const idError = htmlFor ? `${htmlFor}-error` : undefined;
    return (
        <div className={`mb-5 ${className}`}>
            <label htmlFor={htmlFor} className="block text-base font-bold text-text-primary mb-1.5">
                {etiqueta}
                {obligatorio && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
            </label>
            {ayuda && <p id={idAyuda} className="text-sm text-gray-600 mb-2">{ayuda}</p>}
            {children}
            {error && (
                <p id={idError} role="alert" className="mt-2 text-sm font-semibold text-red-700 flex items-start gap-1.5">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </p>
            )}
        </div>
    );
};

/** Clases para inputs dentro de <Campo>. Uso: <input className={claseInput} /> */
export const claseInput =
    'w-full min-h-[52px] px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-2xl ' +
    'text-text-primary placeholder:text-gray-400 outline-none ' +
    'focus:border-rural-600 focus-visible:ring-4 focus-visible:ring-rural-600/20 transition-colors';

// ---------- Chip ----------

const TONOS_CHIP = {
    neutro: 'bg-gray-100 text-gray-700 border-gray-200',
    verde: 'bg-rural-50 text-rural-700 border-rural-200',
    ambar: 'bg-amber-50 text-amber-800 border-amber-200',
    rojo: 'bg-red-50 text-red-700 border-red-200',
    azul: 'bg-blue-50 text-blue-800 border-blue-200',
};

export const Chip = ({ children, tono = 'neutro', icono: Icono, onClick, className = '', ...resto }) => {
    const clases = [
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold',
        TONOS_CHIP[tono] || TONOS_CHIP.neutro,
        className,
    ].join(' ');
    if (onClick) {
        return (
            <button type="button" onClick={onClick} {...resto}
                className={`${clases} min-h-[44px] hover:brightness-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30`}>
                {Icono && <Icono size={15} aria-hidden="true" />}
                {children}
            </button>
        );
    }
    return (
        <span className={clases} {...resto}>
            {Icono && <Icono size={15} aria-hidden="true" />}
            {children}
        </span>
    );
};

// ---------- Aviso ----------

const TONOS_AVISO = {
    urgente: { caja: 'bg-red-50 border-red-200', texto: 'text-red-900', icono: AlertCircle },
    atencion: { caja: 'bg-amber-50 border-amber-200', texto: 'text-amber-900', icono: AlertCircle },
    info: { caja: 'bg-blue-50 border-blue-200', texto: 'text-blue-900', icono: Info },
    bien: { caja: 'bg-rural-50 border-rural-200', texto: 'text-rural-800', icono: CheckCircle2 },
};

/**
 * <Aviso tono="atencion" titulo="Faltan los datos de la policía de Carmen"
 *        accion={{ texto: 'Recordárselo', onClick: fn }} />
 */
export const Aviso = ({ tono = 'info', titulo, texto, accion, icono, className = '' }) => {
    const t = TONOS_AVISO[tono] || TONOS_AVISO.info;
    const Icono = icono || t.icono;
    return (
        <div className={`rounded-2xl border p-4 ${t.caja} ${className}`} role={tono === 'urgente' ? 'alert' : undefined}>
            <div className="flex gap-3 items-start">
                <Icono size={20} className={`mt-0.5 shrink-0 ${t.texto}`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                    <p className={`font-bold text-base leading-snug ${t.texto}`}>{titulo}</p>
                    {texto && <p className={`text-sm mt-1 opacity-90 ${t.texto}`}>{texto}</p>}
                </div>
            </div>
            {accion && (
                <div className="mt-3 pl-8">
                    <Boton variante="secundario" onClick={accion.onClick} icono={accion.icono}>
                        {accion.texto}
                    </Boton>
                </div>
            )}
        </div>
    );
};

// ---------- Cargando ----------

export const Cargando = ({ texto = 'Un momento…', className = '' }) => (
    <div className={`flex flex-col items-center justify-center py-16 text-gray-500 ${className}`}
        role="status" aria-live="polite">
        <Loader2 size={28} className="animate-spin mb-3" aria-hidden="true" />
        <p className="text-base">{texto}</p>
    </div>
);

// ---------- Vacio ----------

export const Vacio = ({ mensaje, icono: Icono = Inbox, accion, className = '' }) => (
    <div className={`text-center py-12 px-6 ${className}`}>
        <Icono size={32} className="mx-auto mb-3 text-gray-300" aria-hidden="true" />
        <p className="text-base text-gray-600">{mensaje}</p>
        {accion && (
            <div className="mt-5 flex justify-center">
                <Boton variante="secundario" onClick={accion.onClick} icono={accion.icono}>{accion.texto}</Boton>
            </div>
        )}
    </div>
);

// ---------- Lecturas de una reserva (mismas reglas en todas las pantallas) ----------
// `guest_bookings` va a tener columnas nuevas (channel, paid_amount,
// pending_amount, commission_amount...) que otro agente esta anadiendo. Estas
// funciones usan las nuevas si existen y, si todavia no estan, se apanan con
// las de siempre. Asi ninguna pantalla se rompe a medio camino.

/** Lo que ya se ha cobrado de una reserva. */
export const cobradoDe = (r) => {
    if (!r) return 0;
    if (r.paid_amount != null) return Number(r.paid_amount) || 0;
    if (r.payment_amount_paid != null) return Number(r.payment_amount_paid) || 0;
    return r.payment_status === 'paid' ? Number(r.total_price) || 0 : 0;
};

/** Lo que falta por cobrar de una reserva. Nunca negativo. */
export const pendienteDe = (r) => {
    if (!r) return 0;
    // Una reserva anulada o devuelta no debe pedir dinero. `pending_amount` es
    // una columna calculada (total - cobrado) y no sabe de anulaciones.
    if (r.status === 'cancelled' || r.payment_status === 'refunded') return 0;
    if (r.pending_amount != null) return Math.max(0, Number(r.pending_amount) || 0);
    return Math.max(0, (Number(r.total_price) || 0) - cobradoDe(r));
};

/**
 * Nombre de por donde ha venido la reserva, dicho como lo diria ella.
 * Las claves son EXACTAMENTE las de guest_bookings_channel_check
 * (migracion 0002): web, booking, airbnb, escapada, casasrurales,
 * telefono, whatsapp, otro.
 */
export const NOMBRES_CANAL = {
    booking: 'Booking',
    airbnb: 'Airbnb',
    escapada: 'Escapada Rural',
    casasrurales: 'CasasRurales.net',
    telefono: 'por teléfono',
    whatsapp: 'por WhatsApp',
    web: 'por la web',
    otro: 'otro sitio',
    // `source` antiguo, por si alguna reserva vieja todavia lo trae:
    direct: 'por la web',
    directa: 'por la web',
};

export const nombreCanal = (r) => {
    const clave = (r?.channel || r?.source || '').toLowerCase();
    if (!clave) return '';
    return NOMBRES_CANAL[clave] || clave.charAt(0).toUpperCase() + clave.slice(1);
};

/**
 * Canales de fuera: los unicos que merece la pena nombrar en pantalla.
 * `channel` vale 'web' por defecto en TODAS las reservas, asi que decir
 * "por la web" en cada linea es ruido; en cambio "por Booking" si importa,
 * porque cambia quien cobra y cuando.
 */
export const CANALES_DE_FUERA = ['booking', 'airbnb', 'escapada', 'casasrurales'];

export const vinoDeFuera = (r) => CANALES_DE_FUERA.includes((r?.channel || '').toLowerCase());

/** Nombre del canal solo si vino de fuera; si no, cadena vacia. */
export const canalSiImporta = (r) => (vinoDeFuera(r) ? nombreCanal(r) : '');

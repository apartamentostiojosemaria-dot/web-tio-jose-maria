// Piezas visuales del dinero: la hoja que sube desde abajo, las cifras
// grandes y el semáforo de los datos de la policía.
//
// Lo que ya existe en `../ui.jsx` se USA, no se copia. Aquí solo va lo que
// estas dos pantallas necesitan y no había.
//
// Todo para un móvil de 375 px: nada por debajo de 44 px, texto de 16 px
// para arriba y ninguna acción escondida detrás de un icono.

import React, { useEffect, useRef } from 'react';
import { X, Shield, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Dinero, formatoEuro, Chip } from '../ui';

const cx = (...c) => c.filter(Boolean).join(' ');

// ───────────────────────── Hoja (sube desde abajo) ─────────────────────────

/**
 * Una hoja que sube desde abajo en el móvil y sale centrada en el ordenador.
 * Se cierra con la X, tocando fuera o con la tecla Escape.
 *
 * <Hoja abierta={...} titulo="Apuntar un cobro" onCerrar={...}>…</Hoja>
 */
export function Hoja({ abierta, titulo, explicacion, onCerrar, children }) {
    const caja = useRef(null);
    const tituloId = React.useId();

    useEffect(() => {
        if (!abierta) return undefined;
        const alPulsarTecla = (e) => { if (e.key === 'Escape') onCerrar?.(); };
        document.addEventListener('keydown', alPulsarTecla);
        const antes = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // El foco entra en la hoja para que el teclado y el lector no se
        // queden detrás, en la pantalla que ya no se ve.
        const t = setTimeout(() => caja.current?.focus(), 30);
        return () => {
            document.removeEventListener('keydown', alPulsarTecla);
            document.body.style.overflow = antes;
            clearTimeout(t);
        };
    }, [abierta, onCerrar]);

    if (!abierta) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onCerrar} aria-hidden="true" />
            <div
                ref={caja}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby={tituloId}
                className={cx(
                    'relative w-full sm:max-w-lg bg-white shadow-2xl outline-none',
                    'rounded-t-3xl sm:rounded-3xl',
                    'max-h-[92vh] sm:max-h-[86vh] overflow-y-auto',
                    'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
                )}
            >
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 pt-4 pb-3 flex items-start gap-3 rounded-t-3xl">
                    <div className="flex-1 min-w-0">
                        <h2 id={tituloId} className="font-serif text-2xl font-bold text-text-primary leading-tight">
                            {titulo}
                        </h2>
                        {explicacion && <p className="text-base text-gray-600 mt-1 leading-snug">{explicacion}</p>}
                    </div>
                    <button
                        type="button" onClick={onCerrar} aria-label="Cerrar"
                        className="shrink-0 -mr-1 w-11 h-11 flex items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                    >
                        <X size={24} aria-hidden="true" />
                    </button>
                </div>
                <div className="px-5 pt-5 space-y-5">{children}</div>
            </div>
        </div>
    );
}

// ───────────────────────── Cifras ─────────────────────────

const TONOS_CIFRA = {
    pendiente: 'text-amber-700',
    cobrado: 'text-rural-700',
    neutro: 'text-text-primary',
};

/**
 * La cifra grande de arriba de la pantalla de Dinero.
 * <CifraGrande etiqueta="Pendiente de cobrar" importe={405} tono="pendiente" />
 */
export function CifraGrande({ etiqueta, importe, tono = 'neutro', nota }) {
    return (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5">
            <p className="text-base font-bold text-gray-600 leading-snug">{etiqueta}</p>
            <p className={cx('font-serif font-bold tabular-nums leading-none mt-2 text-4xl sm:text-5xl', TONOS_CIFRA[tono])}>
                {formatoEuro(importe)}
            </p>
            {nota && <p className="text-sm text-gray-600 mt-2 leading-snug">{nota}</p>}
        </div>
    );
}

/**
 * Una de las tres líneas grandes del dinero de una reserva.
 * <LineaDinero etiqueta="Cobrado" importe={135} detalle="Transferencia, 8 de septiembre" tono="cobrado" />
 */
export function LineaDinero({ etiqueta, importe, detalle, tono = 'neutro', destacada = false }) {
    return (
        <div className={cx(
            'flex items-baseline justify-between gap-3 py-3',
            destacada && 'border-t-2 border-gray-100 mt-1 pt-4',
        )}>
            <div className="min-w-0">
                <p className={cx('font-bold leading-tight', destacada ? 'text-xl' : 'text-lg', 'text-text-primary')}>
                    {etiqueta}
                </p>
                {detalle && <p className="text-sm text-gray-600 leading-snug mt-0.5">{detalle}</p>}
            </div>
            <p className={cx(
                'font-serif font-bold tabular-nums shrink-0',
                destacada ? 'text-3xl' : 'text-2xl',
                TONOS_CIFRA[tono],
            )}>
                {formatoEuro(importe)}
            </p>
        </div>
    );
}

/** La línea de "Te pagará Booking", que no es ni total ni cobrado. */
export function LoQuePagaBooking({ neto, comision, desde }) {
    return (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-base font-bold text-blue-900 leading-snug">
                Te pagará Booking: <Dinero importe={neto} className="text-blue-900" />
            </p>
            <p className="text-sm text-blue-900/80 mt-1 leading-snug">
                Ya descontada su comisión{comision > 0 ? ` de ${formatoEuro(comision)}` : ''}.
                {desde ? ` Booking paga a partir del ${desde}.` : ''}
            </p>
        </div>
    );
}

// ───────────────────────── Semáforo de la policía ─────────────────────────

const SEMAFOROS = {
    completo: { tono: 'verde', icono: ShieldCheck, texto: 'Datos rellenos' },
    faltan: { tono: 'ambar', icono: Shield, texto: 'Faltan datos' },
    desconocido: { tono: 'neutro', icono: ShieldQuestion, texto: 'Sin saber' },
};

/** Verde si están todos, ámbar si falta alguno, gris si todavía no se sabe. */
export function SemaforoPolicia({ parte, className }) {
    const clave = parte == null ? 'desconocido' : (parte.faltan ? 'faltan' : 'completo');
    const s = SEMAFOROS[clave];
    const cuantos = parte?.faltan_cuantos;
    return (
        <Chip tono={s.tono} icono={s.icono} className={className}>
            {clave === 'faltan' && cuantos > 0
                ? `Faltan ${cuantos} ${cuantos === 1 ? 'persona' : 'personas'}`
                : s.texto}
        </Chip>
    );
}

// ───────────────────────── Elegir entre pocas cosas ─────────────────────────

/** Chips grandes en vez de un desplegable: se ve todo de un vistazo. */
export function Opciones({ opciones, valor, onChange, etiquetadoPor }) {
    return (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={etiquetadoPor}>
            {opciones.map((o) => {
                const activo = String(valor) === String(o.valor);
                return (
                    <Chip
                        key={String(o.valor)}
                        tono={activo ? 'verde' : 'neutro'}
                        onClick={() => onChange(o.valor)}
                        role="radio"
                        aria-checked={activo}
                        className={activo ? 'ring-2 ring-rural-600' : undefined}
                    >
                        {activo ? '✓ ' : ''}{o.etiqueta}
                    </Chip>
                );
            })}
        </div>
    );
}

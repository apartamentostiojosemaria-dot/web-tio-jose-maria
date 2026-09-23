// Piezas visuales del dinero: las cifras grandes y el semáforo de los
// datos de la policía. (La hoja que sube desde abajo vive en `../ui.jsx`:
// la usa el panel entero, no solo el dinero.)
//
// Lo que ya existe en `../ui.jsx` se USA, no se copia. Aquí solo va lo que
// estas dos pantallas necesitan y no había.
//
// Todo para un móvil de 375 px: nada por debajo de 44 px, texto de 16 px
// para arriba y ninguna acción escondida detrás de un icono.

import React from 'react';
import { Shield, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Dinero, formatoEuro, Chip } from '../ui';

const cx = (...c) => c.filter(Boolean).join(' ');


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

/**
 * Lo que paga el portal (Booking, Airbnb, Holidu), que no es ni total ni
 * cobrado: a la persona no se le pide nada.
 */
export function LoQuePagaElPortal({ portal, neto, comision, desde, conTarjeta }) {
    return (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-base font-bold text-blue-900 leading-snug">
                Te pagará {portal}: <Dinero importe={neto} className="text-blue-900" />
            </p>
            <p className="text-sm text-blue-900/80 mt-1 leading-snug">
                Al huésped no se le cobra nada.
                {comision > 0 ? ` Ya descontada su comisión de ${formatoEuro(comision)}.` : ''}
                {desde
                    ? (conTarjeta
                        ? ` Su tarjeta se puede cobrar a partir del ${desde}.`
                        : ` Te lo ingresa hacia el ${desde}.`)
                    : ''}
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
                ? (cuantos === 1 ? 'Falta 1 persona' : `Faltan ${cuantos} personas`)
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

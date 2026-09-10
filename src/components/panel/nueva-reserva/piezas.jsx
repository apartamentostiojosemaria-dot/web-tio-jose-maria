import React from 'react';
import { ChevronLeft, Check } from 'lucide-react';

// ============================================================
// piezas.jsx — trocitos que solo usa "Apuntar reserva"
// ============================================================
// Lo común (Boton, Tarjeta, Campo, Chip, Aviso…) está en ../ui.jsx y no
// se toca. Aquí solo lo propio de estos tres pasos.
// ============================================================

const NOMBRES_PASO = ['Cuándo y dónde', 'Quién viene', 'El dinero'];

/**
 * La barra de arriba: "Paso 1 de 3 · Cuándo y dónde" y el botón de atrás,
 * que está SIEMPRE. En el paso 1 vuelve a la pantalla anterior del panel.
 */
export const Progreso = ({ paso, onAtras }) => (
    <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
            <button
                type="button"
                onClick={onAtras}
                className="-ml-2 inline-flex items-center gap-1 min-h-[44px] px-2 rounded-xl text-base font-bold text-rural-700 hover:bg-rural-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
            >
                <ChevronLeft size={22} aria-hidden="true" />
                Atrás
            </button>
            <p className="ml-auto text-base font-bold text-gray-600" aria-live="polite">
                Paso {paso} de 3
            </p>
        </div>

        <div className="flex gap-1.5" role="presentation">
            {[1, 2, 3].map((n) => (
                <span
                    key={n}
                    className={`h-2.5 flex-1 rounded-full ${n <= paso ? 'bg-rural-600' : 'bg-rural-100'}`}
                />
            ))}
        </div>

        <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mt-4">
            {NOMBRES_PASO[paso - 1]}
        </h2>
    </div>
);

/**
 * Botón grande de elegir una cosa de una lista (personas, por dónde ha
 * llegado, cómo ha pagado). Se ve a la legua si está elegido.
 */
export const Opcion = ({ elegida, onClick, icono: Icono, children, className = '' }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={elegida}
        className={[
            'inline-flex items-center justify-center gap-2 rounded-2xl border-2 px-4 min-h-[56px] text-base font-bold',
            'transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30',
            elegida
                ? 'bg-rural-600 border-rural-600 text-white'
                : 'bg-white border-gray-200 text-text-primary hover:border-rural-400 hover:bg-rural-50',
            className,
        ].join(' ')}
    >
        {Icono && <Icono size={20} aria-hidden="true" />}
        <span>{children}</span>
        {elegida && <Check size={18} aria-hidden="true" className="shrink-0" />}
    </button>
);

/** Una línea del resumen: etiqueta a la izquierda, dato a la derecha. */
export const Linea = ({ etiqueta, children, fuerte = false }) => (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
        <span className={`text-base ${fuerte ? 'font-bold text-text-primary' : 'text-gray-600'}`}>
            {etiqueta}
        </span>
        <span className={`text-right ${fuerte ? 'text-xl font-bold text-text-primary' : 'text-base font-semibold text-text-primary'}`}>
            {children}
        </span>
    </div>
);

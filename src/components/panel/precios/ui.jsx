// Piezas visuales de la pantalla de Precios.
//
// Lo que ya existe en el panel (`../ui.jsx`) se USA, no se copia: botones,
// tarjetas, campos, avisos y vacíos salen de ahí para que todas las pantallas
// se vean iguales. Aquí solo se añade lo que esa pantalla necesita y no había:
// la cifra grande, las fechas, los chips para elegir y el interruptor.
//
// Todo pensado para un móvil de 375 px: nada por debajo de 44 px de alto,
// texto de 16 px para arriba, ninguna acción escondida detrás de un icono.

import React from 'react';
import {
    Boton as BotonBase,
    Tarjeta as TarjetaBase,
    Campo as CampoBase,
    Aviso as AvisoBase,
    Cargando as CargandoBase,
    Vacio as VacioBase,
    Chip,
    claseInput,
} from '../ui';

const cx = (...c) => c.filter(Boolean).join(' ');

// ───────────────────────── Botones ─────────────────────────

const VARIANTE = { principal: 'principal', suave: 'secundario', peligro: 'peligro' };

export function Boton({ tipo = 'principal', onClick, disabled, children, className, type = 'button' }) {
    return (
        <BotonBase
            variante={VARIANTE[tipo] || 'principal'}
            onClick={onClick} disabled={disabled} type={type} ancho className={className}
        >
            {children}
        </BotonBase>
    );
}

// Botón corto al final de una fila de lista ("Quitar").
export function BotonFila({ onClick, children, tono = 'neutro' }) {
    return (
        <BotonBase variante={tono === 'peligro' ? 'peligro' : 'secundario'} onClick={onClick} className="shrink-0">
            {children}
        </BotonBase>
    );
}

// ───────────────────────── Campos ─────────────────────────

// Envuelve el campo compartido y ata la etiqueta a lo que hay dentro,
// para que al tocar el texto se abra el campo (y los lectores lo canten bien).
export function Campo({ etiqueta, ayuda, children }) {
    const id = React.useId();
    const hijo = React.isValidElement(children)
        ? React.cloneElement(children, { id: children.props.id || id })
        : children;
    return (
        <CampoBase etiqueta={etiqueta} ayuda={ayuda} htmlFor={React.isValidElement(children) ? (children.props.id || id) : undefined} className="mb-0">
            {hijo}
        </CampoBase>
    );
}

export function Texto({ id, value, onChange, placeholder, maxLength }) {
    return (
        <input id={id} type="text" value={value ?? ''} placeholder={placeholder} maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)} className={claseInput} />
    );
}

export function Fecha({ id, value, onChange, min }) {
    return (
        <input id={id} type="date" value={value ?? ''} min={min}
            onChange={(e) => onChange(e.target.value)} className={claseInput} />
    );
}

// Cifra grande con la unidad pegada: para tocar, escribir y ver bien lo que pone.
export function Cifra({ id, value, onChange, sufijo = '€', ancho = 'w-full' }) {
    const largo = String(sufijo).length > 1;
    return (
        <div className={cx('relative', ancho)}>
            <input
                id={id} type="text" inputMode="decimal" value={value ?? ''}
                onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
                className={cx(claseInput, 'min-h-[60px] text-2xl font-bold', largo ? 'pr-24' : 'pr-12')}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400 pointer-events-none">
                {sufijo}
            </span>
        </div>
    );
}

// Elegir uno entre pocos. Chips grandes, sin desplegables.
export function Chips({ opciones, valor, onChange }) {
    return (
        <div className="flex flex-wrap gap-2">
            {opciones.map((o) => {
                const activo = valor === o.valor;
                return (
                    <Chip
                        key={String(o.valor)}
                        tono={activo ? 'verde' : 'neutro'}
                        onClick={() => onChange(o.valor)}
                        aria-pressed={activo}
                        className={activo ? 'ring-2 ring-rural-600' : undefined}
                    >
                        {activo ? '✓ ' : ''}{o.etiqueta}
                    </Chip>
                );
            })}
        </div>
    );
}

// Elegir varios (para "no alquilar estos días").
export function ChipsVarios({ opciones, valores, onChange }) {
    const alterna = (v) => onChange(valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v]);
    return (
        <div className="flex flex-wrap gap-2">
            {opciones.map((o) => {
                const activo = valores.includes(o.valor);
                return (
                    <Chip
                        key={String(o.valor)}
                        tono={activo ? 'verde' : 'neutro'}
                        onClick={() => alterna(o.valor)}
                        aria-pressed={activo}
                        className={activo ? 'ring-2 ring-rural-600' : undefined}
                    >
                        {activo ? '✓ ' : ''}{o.etiqueta}
                    </Chip>
                );
            })}
        </div>
    );
}

export function Interruptor({ activo, onChange, etiquetaSi = 'Se ofrece en la web', etiquetaNo = 'No se ofrece ahora' }) {
    return (
        <button type="button" role="switch" aria-checked={!!activo} onClick={() => onChange(!activo)}
            className={cx(
                'inline-flex items-center gap-3 min-h-[48px] px-4 rounded-2xl border-2 font-bold text-base',
                'focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30',
                activo ? 'bg-rural-50 text-rural-700 border-rural-200' : 'bg-white text-gray-500 border-gray-200',
            )}>
            <span className={cx('w-11 h-6 rounded-full relative transition-colors shrink-0', activo ? 'bg-rural-600' : 'bg-gray-300')}>
                <span className={cx('absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all', activo ? 'left-[22px]' : 'left-0.5')} />
            </span>
            {activo ? etiquetaSi : etiquetaNo}
        </button>
    );
}

// ───────────────────────── Contenedores y avisos ─────────────────────────

export function Bloque({ numero, titulo, explicacion, children }) {
    return (
        <section className="scroll-mt-4">
            <header className="mb-4">
                <h2 className="font-serif text-2xl font-bold text-text-primary flex items-baseline gap-2">
                    {numero && <span className="text-base font-sans font-bold text-rural-600/70">{numero}.</span>}
                    {titulo}
                </h2>
                {explicacion && <p className="text-base text-gray-600 mt-1 leading-relaxed">{explicacion}</p>}
            </header>
            {children}
        </section>
    );
}

export function Tarjeta({ children, className, apagada }) {
    return <TarjetaBase className={cx(apagada && 'opacity-60', className)}>{children}</TarjetaBase>;
}

export function Fila({ children, className }) {
    return (
        <div className={cx('bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3 flex-wrap', className)}>
            {children}
        </div>
    );
}

// bien = salió bien · mal = no se ha guardado · nota = ojo con esto
const TONO_AVISO = { bien: 'bien', mal: 'urgente', nota: 'atencion' };

export function Aviso({ tono = 'bien', children }) {
    if (!children) return null;
    return <AvisoBase tono={TONO_AVISO[tono] || 'info'} titulo={children} />;
}

export function Vacio({ children }) {
    return <VacioBase mensaje={children} />;
}

export function Cargando({ children = 'Un momento…' }) {
    return <CargandoBase texto={children} />;
}

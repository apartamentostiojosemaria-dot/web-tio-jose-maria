import React from 'react';
import { Link2, Save } from 'lucide-react';
import { Boton, Campo, claseInput, Aviso, formatoEuro, fechaEnPalabras, hoyISO } from '../ui';
import { Opcion, Linea } from './piezas';
import { FORMAS_DE_PAGO, buscarCanal } from './textos';
import { nochesEntre } from './datos';

// ============================================================
// Paso 3 — El dinero
// ============================================================
// ¿Ha pagado algo ya? No · Una señal · Todo. Si algo: cómo y cuándo.
// Debajo, el resumen entero de la reserva y el botón de guardar.
// ============================================================

const Paso3Cobro = ({ valores, apartamento, alCambiar, alGuardar, alAtras, guardando, fallo }) => {
    const {
        entrada, salida, personas, precio, nombre, telefono, email, canal,
        localizador, comision, yaPago, senal, forma, fechaCobro, notas,
    } = valores;

    const noches = nochesEntre(entrada, salida);
    const total = Number(precio) || 0;
    const canalElegido = buscarCanal(canal);

    const cobradoAhora =
        yaPago === 'todo' ? total :
        yaPago === 'senal' ? Math.min(Number(senal) || 0, total) : 0;
    const pendiente = Math.max(0, total - cobradoAhora);

    const hayQueDecirComo = yaPago === 'senal' || yaPago === 'todo';
    const senalMal = yaPago === 'senal' && (!(Number(senal) > 0) || Number(senal) > total);
    const puedeGuardar = !guardando && Boolean(yaPago) && !senalMal && (!hayQueDecirComo || Boolean(forma));

    return (
        <div>
            {/* ---------- ¿Ha pagado algo? ---------- */}
            <Campo etiqueta="¿Ha pagado algo ya?" obligatorio>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Opcion elegida={yaPago === 'no'} onClick={() => alCambiar({ yaPago: 'no', senal: '', forma: '' })}>
                        No, todavía no
                    </Opcion>
                    <Opcion elegida={yaPago === 'senal'} onClick={() => alCambiar({ yaPago: 'senal' })}>
                        Una señal
                    </Opcion>
                    <Opcion elegida={yaPago === 'todo'} onClick={() => alCambiar({ yaPago: 'todo', senal: '' })}>
                        Sí, todo
                    </Opcion>
                </div>
            </Campo>

            {yaPago === 'senal' && (
                <Campo etiqueta="¿Cuánto te ha dado?" htmlFor="senal" obligatorio
                    error={senalMal && senal !== '' ? `Tiene que ser más de 0 y como mucho ${formatoEuro(total)}.` : ''}
                    ayuda={`El total son ${formatoEuro(total)}.`}>
                    <input
                        id="senal" type="number" inputMode="decimal" min="0" max={total} step="1"
                        className={claseInput} autoFocus
                        value={senal}
                        onChange={(e) => alCambiar({ senal: e.target.value === '' ? '' : Number(e.target.value) })}
                        placeholder="0"
                    />
                </Campo>
            )}

            {hayQueDecirComo && (
                <>
                    <Campo etiqueta="¿Cómo te lo ha pagado?" obligatorio>
                        <div className="grid grid-cols-2 gap-2">
                            {FORMAS_DE_PAGO.map((f) => (
                                <Opcion key={f.valor} elegida={forma === f.valor}
                                    onClick={() => alCambiar({ forma: f.valor })}>
                                    {f.etiqueta}
                                </Opcion>
                            ))}
                        </div>
                    </Campo>

                    <Campo etiqueta="¿Qué día lo pagó?" htmlFor="fechaCobro"
                        ayuda="Si fue hoy, déjalo como está.">
                        <input
                            id="fechaCobro" type="date" className={claseInput}
                            max={hoyISO()}
                            value={fechaCobro}
                            onChange={(e) => alCambiar({ fechaCobro: e.target.value })}
                        />
                    </Campo>
                </>
            )}

            {/* ---------- Enlace para pagar ---------- */}
            {pendiente > 0 && (
                <div className="rounded-3xl border border-gray-200 bg-white p-5 mb-6">
                    <p className="font-bold text-lg text-text-primary">
                        ¿Prefieres que lo pague con tarjeta?
                    </p>
                    <p className="text-base text-gray-600 mt-1 mb-4">
                        Guardo la reserva y te doy un enlace para mandárselo. Paga los {formatoEuro(pendiente)} que faltan
                        desde su móvil y se apunta solo.
                    </p>
                    <Boton variante="secundario" ancho icono={Link2}
                        disabled={!puedeGuardar} cargando={guardando === 'enlace'}
                        onClick={() => alGuardar({ conEnlace: true })}>
                        Mandarle un enlace para que pague
                    </Boton>
                </div>
            )}

            {/* ---------- Notas ---------- */}
            <Campo etiqueta="¿Algo que quieras apuntar?" htmlFor="notas"
                ayuda="Lo que te haya dicho: que llega tarde, que viene con perro, que quiere cuna…">
                <textarea
                    id="notas" rows={3} maxLength={500}
                    className={`${claseInput} min-h-[96px] resize-y`}
                    value={notas}
                    onChange={(e) => alCambiar({ notas: e.target.value })}
                    placeholder="Llega sobre las 20:00"
                />
            </Campo>

            {/* ---------- Resumen ---------- */}
            <section aria-labelledby="resumen-t" className="rounded-3xl border-2 border-rural-200 bg-rural-50 p-5 mb-6">
                <h3 id="resumen-t" className="font-bold text-lg text-text-primary mb-2">
                    Antes de guardar, mira que está bien
                </h3>

                <Linea etiqueta="Quién">{nombre || 'Sin nombre'}</Linea>
                {telefono && <Linea etiqueta="Teléfono">{telefono}</Linea>}
                <Linea etiqueta="Correo">{email || 'No ha dado'}</Linea>
                <Linea etiqueta="Entra">{fechaEnPalabras(entrada)}</Linea>
                <Linea etiqueta="Sale">{fechaEnPalabras(salida)}</Linea>
                <Linea etiqueta="Dónde">
                    {apartamento?.nombre || 'Apartamento'} · {noches} {noches === 1 ? 'noche' : 'noches'} · {personas} {personas === 1 ? 'persona' : 'personas'}
                </Linea>
                <Linea etiqueta="Te ha llegado">{canalElegido?.etiqueta || '—'}</Linea>
                {localizador && <Linea etiqueta="Su número de reserva">{localizador}</Linea>}

                <div className="mt-3 pt-3 border-t-2 border-rural-200">
                    <Linea etiqueta="Total" fuerte>{formatoEuro(total)}</Linea>
                    <Linea etiqueta="Ya ha pagado">{formatoEuro(cobradoAhora)}</Linea>
                    <Linea etiqueta="Queda por cobrar" fuerte>{formatoEuro(pendiente)}</Linea>
                    {Number(comision) > 0 && (
                        <Linea etiqueta={`Se lleva ${canalElegido?.etiqueta || 'la web'}`}>
                            {formatoEuro(Number(comision))}
                        </Linea>
                    )}
                </div>
            </section>

            {fallo && <Aviso tono="urgente" titulo={fallo} className="mb-5" />}

            {/* ---------- Guardar ---------- */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Boton variante="secundario" onClick={alAtras} disabled={Boolean(guardando)} className="sm:w-auto">
                    Volver al paso anterior
                </Boton>
                <Boton ancho tamano="grande" icono={Save}
                    disabled={!puedeGuardar} cargando={guardando === 'normal'}
                    onClick={() => alGuardar({ conEnlace: false })}
                    className="sm:flex-1">
                    Guardar reserva
                </Boton>
            </div>
            {!yaPago && (
                <p className="mt-2 text-center text-base text-gray-600">
                    Di si ha pagado algo para poder guardar.
                </p>
            )}
        </div>
    );
};

export default Paso3Cobro;

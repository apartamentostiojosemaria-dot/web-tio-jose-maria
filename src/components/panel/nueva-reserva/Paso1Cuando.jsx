import React, { useEffect, useState } from 'react';
import { Pencil, Lock, Users } from 'lucide-react';
import { Boton, Campo, claseInput, Aviso, Cargando, formatoEuro, hoyISO } from '../ui';
import { Opcion } from './piezas';
import { buscarApartamentos, nochesEntre, masUnDia } from './datos';
import { noCabenAqui } from './textos';

// ============================================================
// Paso 1 — Cuándo y dónde
// ============================================================
// Entrada, salida, cuántos son, y los apartamentos que están libres con
// su precio ya hecho. El precio se puede cambiar a mano ahí mismo, porque
// muchas veces cierra un precio por teléfono.
// ============================================================

const PERSONAS = [1, 2, 3, 4];

const Paso1Cuando = ({ valores, alCambiar, alSeguir }) => {
    const { entrada, salida, personas, apartamentoId, precio } = valores;

    const [buscando, setBuscando] = useState(false);
    const [fallo, setFallo] = useState('');
    const [resultado, setResultado] = useState(null);
    const [cambiandoPrecio, setCambiandoPrecio] = useState(false);

    const noches = nochesEntre(entrada, salida);

    // Cada vez que cambian fechas o personas, se vuelve a mirar qué hay libre.
    useEffect(() => {
        if (!entrada || !salida || noches < 1) { setResultado(null); return; }
        let cortado = false;
        setBuscando(true);
        setFallo('');
        (async () => {
            try {
                const r = await buscarApartamentos({ entrada, salida, personas });
                if (cortado) return;
                setResultado(r);
                // Si el elegido ya no está libre, se suelta. Si sigue libre, se
                // refresca (el precio puede haber cambiado con las fechas).
                if (apartamentoId) {
                    const sigue = r.libres.find((a) => a.id === apartamentoId) || null;
                    alCambiar(sigue
                        ? { apartamento: sigue }
                        : { apartamentoId: null, apartamento: null, precio: null });
                }
            } catch {
                if (!cortado) setFallo('No he podido mirar los apartamentos. Comprueba la conexión y vuelve a probar.');
            } finally {
                if (!cortado) setBuscando(false);
            }
        })();
        return () => { cortado = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entrada, salida, personas]);

    const ponerEntrada = (valor) => {
        const cambios = { entrada: valor };
        // La salida siempre después de la entrada: si no cuadra, se pone al día siguiente.
        if (!salida || salida <= valor) cambios.salida = masUnDia(valor);
        alCambiar(cambios);
    };

    const elegir = (apto) => {
        setCambiandoPrecio(false);
        alCambiar({ apartamentoId: apto.id, apartamento: apto, precio: null });
    };

    const elegido = resultado?.libres.find((a) => a.id === apartamentoId) || null;
    const precioFinal = precio != null ? precio : (elegido?.total ?? 0);
    const puedeSeguir = Boolean(elegido) && noches >= 1 && precioFinal >= 0;

    return (
        <div>
            {/* ---------- Fechas ---------- */}
            <div className="grid sm:grid-cols-2 gap-x-4">
                <Campo etiqueta="¿Qué día entra?" htmlFor="entrada" obligatorio>
                    <input
                        id="entrada" type="date" className={claseInput}
                        min={hoyISO()} value={entrada}
                        onChange={(e) => ponerEntrada(e.target.value)}
                    />
                </Campo>
                <Campo etiqueta="¿Qué día se va?" htmlFor="salida" obligatorio
                    error={entrada && salida && salida <= entrada ? 'La salida tiene que ser después de la entrada.' : ''}>
                    <input
                        id="salida" type="date" className={claseInput}
                        min={entrada ? masUnDia(entrada) : hoyISO()} value={salida}
                        onChange={(e) => alCambiar({ salida: e.target.value })}
                    />
                </Campo>
            </div>

            {noches > 0 && (
                <p className="-mt-2 mb-5 text-base text-gray-600">
                    Son <strong className="text-text-primary">{noches} {noches === 1 ? 'noche' : 'noches'}</strong>.
                </p>
            )}

            {/* ---------- Personas ---------- */}
            <Campo etiqueta="¿Cuántas personas son?">
                <div className="flex gap-2">
                    {PERSONAS.map((n) => (
                        <Opcion key={n} elegida={personas === n} onClick={() => alCambiar({ personas: n })}
                            className="flex-1">
                            {n}
                        </Opcion>
                    ))}
                </div>
                <p className="mt-2 text-sm text-gray-600 flex items-center gap-1.5">
                    <Users size={15} aria-hidden="true" />
                    En el más grande caben 4.
                </p>
            </Campo>

            {/* ---------- Apartamentos ---------- */}
            {fallo && <Aviso tono="urgente" titulo={fallo} className="mb-5" />}

            {noches >= 1 && (
                <section aria-labelledby="libres-t" className="mt-2">
                    <h3 id="libres-t" className="text-lg font-bold text-text-primary mb-3">
                        ¿En cuál lo pones?
                    </h3>

                    {buscando && <Cargando texto="Mirando qué está libre…" />}

                    {!buscando && resultado && resultado.libres.length === 0 && (
                        <Aviso
                            tono="atencion"
                            titulo="No queda ningún apartamento libre esos días"
                            texto={
                                resultado.noCaben.length > 0
                                    ? `Libres hay, pero son pequeños para ${personas} personas. Prueba con otras fechas o con menos gente.`
                                    : 'Prueba a cambiar las fechas ahí arriba.'
                            }
                        />
                    )}

                    {!buscando && resultado && resultado.libres.length > 0 && (
                        <ul className="space-y-3">
                            {resultado.libres.map((a) => {
                                const elegidaEsta = a.id === apartamentoId;
                                return (
                                    <li key={a.id}>
                                        <button
                                            type="button"
                                            onClick={() => elegir(a)}
                                            aria-pressed={elegidaEsta}
                                            className={`w-full text-left rounded-3xl border-2 p-5 min-h-[92px] transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30 ${
                                                elegidaEsta
                                                    ? 'border-rural-600 bg-rural-50'
                                                    : 'border-gray-200 bg-white hover:border-rural-400'
                                            }`}
                                        >
                                            <span className="flex items-start justify-between gap-3">
                                                <span className="min-w-0">
                                                    <span className="block font-bold text-xl text-text-primary">{a.nombre}</span>
                                                    <span className="block text-base text-gray-600">
                                                        {a.plazas} {a.plazas === 1 ? 'plaza' : 'plazas'} · {formatoEuro(a.porNoche)} por noche
                                                    </span>
                                                </span>
                                                <span className="text-right shrink-0">
                                                    <span className="block font-serif text-2xl font-bold text-text-primary tabular-nums">
                                                        {formatoEuro(a.total)}
                                                    </span>
                                                    <span className="block text-sm text-gray-600">
                                                        por {noches} {noches === 1 ? 'noche' : 'noches'}
                                                    </span>
                                                </span>
                                            </span>
                                            {a.fueraDeLaWeb && (
                                                <span className="block mt-2 text-sm text-amber-800">
                                                    Está libre, pero por la web no se vende una estancia tan corta. Tú sí puedes apuntarla.
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {/* Los que no valen, dicho por qué. Así no se pregunta "¿y Lavanda?". */}
                    {!buscando && resultado && (resultado.ocupados.length > 0 || resultado.noCaben.length > 0) && (
                        <ul className="mt-4 space-y-2">
                            {resultado.noCaben.map((a) => (
                                <li key={a.id} className="flex items-start gap-2 text-base text-gray-500 px-1">
                                    <Users size={17} className="mt-1 shrink-0" aria-hidden="true" />
                                    <span>{noCabenAqui(a.nombre, a.plazas, personas)}</span>
                                </li>
                            ))}
                            {resultado.ocupados.map((a) => (
                                <li key={a.id} className="flex items-start gap-2 text-base text-gray-500 px-1">
                                    <Lock size={17} className="mt-1 shrink-0" aria-hidden="true" />
                                    <span><strong className="font-semibold">{a.nombre}</strong>: {a.motivo}.</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {/* ---------- Precio ---------- */}
            {elegido && (
                <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
                    <p className="text-base text-gray-600">Se le cobrarán</p>
                    <p className="font-serif text-3xl font-bold text-text-primary tabular-nums">
                        {formatoEuro(precioFinal)}
                    </p>
                    <p className="text-base text-gray-600 mt-0.5">
                        {elegido.nombre} · {noches} {noches === 1 ? 'noche' : 'noches'} · {personas} {personas === 1 ? 'persona' : 'personas'}
                    </p>

                    {!cambiandoPrecio ? (
                        <button
                            type="button"
                            onClick={() => setCambiandoPrecio(true)}
                            className="mt-3 inline-flex items-center gap-1.5 min-h-[44px] text-base font-bold text-rural-700 underline focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30 rounded-xl px-1"
                        >
                            <Pencil size={16} aria-hidden="true" />
                            {precio != null ? 'Cambiar otra vez el precio' : '¿Le has dicho otro precio?'}
                        </button>
                    ) : (
                        <div className="mt-4">
                            <Campo etiqueta="Precio que le has dicho" htmlFor="precio"
                                ayuda="El total de toda la estancia, en euros.">
                                <input
                                    id="precio" type="number" inputMode="decimal" min="0" step="1"
                                    className={claseInput} autoFocus
                                    value={precio != null ? precio : elegido.total}
                                    onChange={(e) => alCambiar({ precio: e.target.value === '' ? 0 : Number(e.target.value) })}
                                />
                            </Campo>
                            <div className="flex gap-2">
                                <Boton variante="secundario" onClick={() => setCambiandoPrecio(false)}>
                                    Dejarlo así
                                </Boton>
                                <Boton variante="suave" onClick={() => { alCambiar({ precio: null }); setCambiandoPrecio(false); }}>
                                    Volver al precio de siempre
                                </Boton>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ---------- Seguir ---------- */}
            <div className="mt-8">
                <Boton ancho tamano="grande" disabled={!puedeSeguir}
                    onClick={() => alSeguir({ precio: precioFinal })}>
                    Seguir
                </Boton>
                {!puedeSeguir && (
                    <p className="mt-2 text-center text-base text-gray-600">
                        Elige las fechas y un apartamento para seguir.
                    </p>
                )}
            </div>
        </div>
    );
};

export default Paso1Cuando;

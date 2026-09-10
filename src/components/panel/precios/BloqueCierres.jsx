// 5. No alquilar estos días.
// Elige fechas, apartamentos y (si quiere) por qué. Esos días desaparecen
// de la web y de las webs de fuera.
//
// Lo que NO sale aquí: los días que se ocupan solos desde otras webs. No son
// suyos, se sincronizan solos y borrarlos sería un lío. Solo se dice cuántos
// hay, para que no parezca que faltan días sin motivo.

import React, { useState } from 'react';
import { Bloque, Tarjeta, Fila, Campo, Fecha, Texto, ChipsVarios, Boton, BotonFila, Aviso, Vacio } from './ui';
import { rango, hoy, listaY } from './formato';
import { cerrarDias, quitarCierre } from './datos';

export default function BloqueCierres({ apartamentos, cierres, ocupadosFuera, onActualizar }) {
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [elegidos, setElegidos] = useState([]);
    const [motivo, setMotivo] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [bien, setBien] = useState('');
    const [mal, setMal] = useState('');

    const hoyStr = hoy();
    const nombreDe = (id) => apartamentos.find((a) => a.id === id)?.name || 'Apartamento';
    const todos = elegidos.length === apartamentos.length && apartamentos.length > 0;

    const opciones = apartamentos.map((a) => ({ valor: a.id, etiqueta: a.name }));

    async function cerrar() {
        setBien(''); setMal('');
        if (!desde || !hasta) { setMal('Faltan las fechas.'); return; }
        if (desde > hasta) { setMal('El primer día no puede ser posterior al último.'); return; }
        if (elegidos.length === 0) { setMal('Elige al menos un apartamento.'); return; }
        setGuardando(true);
        try {
            const nuevos = await cerrarDias({
                apartamentoIds: elegidos, desde, hasta, motivo: motivo.trim(), hoyStr,
            });
            onActualizar(nuevos);
            setBien(todos
                ? `Hecho. ${rango(desde, hasta)} no se alquila nada.`
                : `Hecho. ${listaY(elegidos.map(nombreDe))} ${elegidos.length === 1 ? 'no se alquila' : 'no se alquilan'} ${rango(desde, hasta)}.`);
            setDesde(''); setHasta(''); setElegidos([]); setMotivo('');
        } catch (e) {
            setMal(e.message);
        } finally {
            setGuardando(false);
        }
    }

    async function abrir(c) {
        setBien(''); setMal('');
        const seguro = window.confirm(`¿Volver a poner en alquiler ${nombreDe(c.apartment_id)} ${rango(c.start_date, c.end_date)}?`);
        if (!seguro) return;
        try {
            const nuevos = await quitarCierre(c.id, hoyStr);
            onActualizar(nuevos);
            setBien(`Listo. ${nombreDe(c.apartment_id)} vuelve a estar libre ${rango(c.start_date, c.end_date)}.`);
        } catch (e) {
            setMal(e.message);
        }
    }

    return (
        <Bloque
            numero="5"
            titulo="No alquilar estos días"
            explicacion="Para obras, para la familia o para lo que sea. Esos días dejan de salir en la web."
        >
            <div className="space-y-4">
                <Tarjeta className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Campo etiqueta="Primer día">
                            <Fecha value={desde} onChange={setDesde} min={hoyStr} />
                        </Campo>
                        <Campo etiqueta="Último día">
                            <Fecha value={hasta} onChange={setHasta} min={desde || hoyStr} />
                        </Campo>
                    </div>

                    <Campo etiqueta="¿Qué apartamentos?">
                        <div className="space-y-2">
                            <ChipsVarios opciones={opciones} valores={elegidos} onChange={setElegidos} />
                            <button
                                type="button"
                                onClick={() => setElegidos(todos ? [] : apartamentos.map((a) => a.id))}
                                className="text-base font-bold text-rural-700 underline min-h-[44px] px-1"
                            >
                                {todos ? 'Quitar todos' : 'Los cuatro'}
                            </button>
                        </div>
                    </Campo>

                    <Campo etiqueta="¿Por qué? (si quieres)">
                        <Texto value={motivo} onChange={setMotivo} placeholder="Obras, familia…" maxLength={80} />
                    </Campo>

                    <Boton onClick={cerrar} disabled={guardando}>
                        {guardando ? 'Guardando…' : 'No alquilar estos días'}
                    </Boton>
                </Tarjeta>

                {bien && <Aviso tono="bien">{bien}</Aviso>}
                {mal && <Aviso tono="mal">{mal}</Aviso>}

                <div className="space-y-3">
                    <h3 className="font-bold text-text-primary">Días que has cerrado</h3>
                    {cierres.length === 0 && <Vacio>No hay ningún día cerrado.</Vacio>}
                    {cierres.map((c) => (
                        <Fila key={c.id}>
                            <div className="flex-1 min-w-[180px]">
                                <p className="font-bold text-text-primary">{nombreDe(c.apartment_id)}</p>
                                <p className="text-sm text-gray-600">
                                    {rango(c.start_date, c.end_date)}{c.reason ? ` · ${c.reason}` : ''}
                                </p>
                            </div>
                            <BotonFila onClick={() => abrir(c)}>Volver a alquilar</BotonFila>
                        </Fila>
                    ))}

                    {ocupadosFuera > 0 && (
                        <p className="text-xs text-gray-500 leading-snug pt-1">
                            Aparte de esto hay días ocupados desde otra web. Se ponen y se quitan solos; de eso nos encargamos nosotros.
                        </p>
                    )}
                </div>
            </div>
        </Bloque>
    );
}

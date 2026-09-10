// 3. Precio especial para unas fechas.
// "Del 10 al 13 de octubre, Lavanda a 150 €". Tres cosas y listo.

import React, { useState } from 'react';
import { Bloque, Tarjeta, Fila, Campo, Fecha, Cifra, Chips, Boton, BotonFila, Aviso, Vacio } from './ui';
import { rango, euros, aNumero, hoy } from './formato';
import { ponerPrecioEspecial, quitarPrecioEspecial } from './datos';

const TODOS = 'todos';

export default function BloqueEspeciales({ apartamentos, especiales, onActualizar }) {
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [cual, setCual] = useState(TODOS);
    const [precio, setPrecio] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [bien, setBien] = useState('');
    const [mal, setMal] = useState('');

    const hoyStr = hoy();
    const nombreDe = (id) => apartamentos.find((a) => a.id === id)?.name || 'ese apartamento';
    const opciones = [{ valor: TODOS, etiqueta: 'Todos' }, ...apartamentos.map((a) => ({ valor: a.id, etiqueta: a.name }))];

    // Solo los que aún sirven para algo: los que ya pasaron no se enseñan.
    const vigentes = especiales
        .filter((e) => !e.valid_until || e.valid_until >= hoyStr)
        .sort((a, b) => String(a.valid_from).localeCompare(String(b.valid_from)));

    async function poner() {
        setBien(''); setMal('');
        const n = aNumero(precio);
        if (!desde || !hasta) { setMal('Faltan las fechas.'); return; }
        if (desde > hasta) { setMal('El primer día no puede ser posterior al último.'); return; }
        if (n === null || n <= 0) { setMal('Escribe cuánto quieres cobrar la noche.'); return; }

        const apartamentoId = cual === TODOS ? null : cual;
        const nombre = `${cual === TODOS ? 'Todos' : nombreDe(cual)} ${rango(desde, hasta)}`;
        setGuardando(true);
        try {
            const nuevos = await ponerPrecioEspecial({ apartamentoId, desde, hasta, precio: n, nombre });
            onActualizar(nuevos);
            setBien(`Puesto. ${rango(desde, hasta)}, ${cual === TODOS ? 'todos los apartamentos se cobran' : `${nombreDe(cual)} se cobra`} a ${euros(n)} la noche.`);
            setDesde(''); setHasta(''); setPrecio(''); setCual(TODOS);
        } catch (e) {
            setMal(e.message);
        } finally {
            setGuardando(false);
        }
    }

    async function quitar(e) {
        setBien(''); setMal('');
        const seguro = window.confirm('¿Quitar este precio especial?\n\nEsos días volverán a cobrarse al precio de siempre.');
        if (!seguro) return;
        try {
            const nuevos = await quitarPrecioEspecial(e.id);
            onActualizar(nuevos);
            setBien('Quitado. Esos días vuelven al precio de siempre.');
        } catch (err) {
            setMal(err.message);
        }
    }

    return (
        <Bloque
            numero="3"
            titulo="Precio especial para unas fechas"
            explicacion="Para un puente, una feria o una semana suelta. Manda sobre el precio normal y sobre el de temporada alta."
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
                    <Campo etiqueta="¿Qué apartamento?">
                        <Chips opciones={opciones} valor={cual} onChange={setCual} />
                    </Campo>
                    <Campo etiqueta="Cuánto cuesta la noche esos días">
                        <Cifra value={precio} onChange={setPrecio} />
                    </Campo>
                    <Boton onClick={poner} disabled={guardando}>
                        {guardando ? 'Guardando…' : 'Poner este precio'}
                    </Boton>
                </Tarjeta>

                {bien && <Aviso tono="bien">{bien}</Aviso>}
                {mal && <Aviso tono="mal">{mal}</Aviso>}

                <div className="space-y-3">
                    <h3 className="font-bold text-text-primary">Precios especiales puestos</h3>
                    {vigentes.length === 0 && <Vacio>Ahora mismo no hay ninguno.</Vacio>}
                    {vigentes.map((e) => (
                        <Fila key={e.id}>
                            <div className="flex-1 min-w-[180px]">
                                <p className="font-bold text-text-primary">
                                    {e.apartment_id ? nombreDe(e.apartment_id) : 'Todos los apartamentos'}
                                    {e.night_price != null && ` · ${euros(e.night_price)} la noche`}
                                </p>
                                <p className="text-sm text-gray-600">{rango(e.valid_from, e.valid_until)}</p>
                            </div>
                            <BotonFila tono="peligro" onClick={() => quitar(e)}>Quitar</BotonFila>
                        </Fila>
                    ))}
                </div>
            </div>
        </Bloque>
    );
}

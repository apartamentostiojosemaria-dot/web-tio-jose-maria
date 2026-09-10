// 2. Temporadas altas: los tramos del año en los que se cobra el precio alto.

import React, { useState } from 'react';
import { Bloque, Tarjeta, Fila, Campo, Texto, Fecha, Boton, BotonFila, Aviso, Vacio } from './ui';
import { rango, hoy } from './formato';
import { anadirTemporada, quitarTemporada } from './datos';

export default function BloqueTemporadas({ temporadas, onActualizar }) {
    const [abierto, setAbierto] = useState(false);
    const [nombre, setNombre] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [bien, setBien] = useState('');
    const [mal, setMal] = useState('');

    const hoyStr = hoy();

    // Primero lo que está por venir, que es lo que va a querer tocar.
    // Las que ya pasaron bajan al final, en gris, por si quiere repasarlas.
    const ordenadas = [...temporadas].sort((a, b) => {
        const pasadaA = a.end_date < hoyStr;
        const pasadaB = b.end_date < hoyStr;
        if (pasadaA !== pasadaB) return pasadaA ? 1 : -1;
        return String(a.start_date).localeCompare(String(b.start_date));
    });

    function limpiar() {
        setNombre(''); setDesde(''); setHasta(''); setAbierto(false);
    }

    async function anadir() {
        setBien(''); setMal('');
        if (!nombre.trim()) { setMal('Ponle un nombre, por ejemplo "Semana Santa".'); return; }
        if (!desde || !hasta) { setMal('Faltan las fechas.'); return; }
        if (desde > hasta) { setMal('El primer día no puede ser posterior al último.'); return; }
        setGuardando(true);
        try {
            const nuevas = await anadirTemporada({ nombre: nombre.trim(), desde, hasta });
            onActualizar(nuevas);
            setBien(`Añadida. ${nombre.trim()}: ${rango(desde, hasta)} se cobra al precio de temporada alta.`);
            limpiar();
        } catch (e) {
            setMal(e.message);
        } finally {
            setGuardando(false);
        }
    }

    async function quitar(t) {
        setBien(''); setMal('');
        const seguro = window.confirm(`¿Quitar "${t.name}" (${rango(t.start_date, t.end_date)})?\n\nEsos días pasarán a cobrarse al precio de días normales.`);
        if (!seguro) return;
        try {
            const nuevas = await quitarTemporada(t.id);
            onActualizar(nuevas);
            setBien(`Quitada. ${rango(t.start_date, t.end_date)} vuelve al precio de días normales.`);
        } catch (e) {
            setMal(e.message);
        }
    }

    return (
        <Bloque
            numero="2"
            titulo="Temporadas altas"
            explicacion="Los días que caen dentro de una temporada se cobran al precio alto. El resto del año, al normal."
        >
            <div className="space-y-3">
                {temporadas.length === 0 && <Vacio>Todavía no hay ninguna temporada.</Vacio>}

                {ordenadas.map((t) => {
                    const pasada = t.end_date < hoyStr;
                    return (
                        <Fila key={t.id} className={pasada ? 'opacity-50' : undefined}>
                            <div className="flex-1 min-w-[180px]">
                                <p className="font-bold text-text-primary">{t.name}</p>
                                <p className="text-sm text-gray-600">
                                    {rango(t.start_date, t.end_date)}{pasada ? ' · ya pasó' : ''}
                                </p>
                            </div>
                            <BotonFila tono="peligro" onClick={() => quitar(t)}>Quitar</BotonFila>
                        </Fila>
                    );
                })}

                {bien && <Aviso tono="bien">{bien}</Aviso>}
                {mal && <Aviso tono="mal">{mal}</Aviso>}

                {!abierto && <Boton tipo="suave" onClick={() => { setAbierto(true); setBien(''); setMal(''); }}>Añadir temporada</Boton>}

                {abierto && (
                    <Tarjeta className="space-y-4">
                        <Campo etiqueta="Nombre">
                            <Texto value={nombre} onChange={setNombre} placeholder="Semana Santa" maxLength={60} />
                        </Campo>
                        <div className="grid grid-cols-2 gap-3">
                            <Campo etiqueta="Primer día">
                                <Fecha value={desde} onChange={setDesde} />
                            </Campo>
                            <Campo etiqueta="Último día">
                                <Fecha value={hasta} onChange={setHasta} min={desde || undefined} />
                            </Campo>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Boton onClick={anadir} disabled={guardando}>
                                {guardando ? 'Guardando…' : 'Guardar temporada'}
                            </Boton>
                            <Boton tipo="suave" onClick={limpiar} disabled={guardando}>Dejarlo</Boton>
                        </div>
                    </Tarjeta>
                )}
            </div>
        </Bloque>
    );
}

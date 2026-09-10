// 4. Mínimo de noches.
// Una cifra para todo el año y, si quiere, otra distinta para una temporada.
//
// Ojo con una cosa real del motor de la web: cuando hay dos mínimos que
// pillan las mismas fechas, mandan LOS DOS. Por eso el mínimo de una
// temporada solo sirve para pedir MÁS noches, nunca menos. Se le dice así,
// en su idioma, y se le impide guardar un número que no haría nada.

import React, { useState } from 'react';
import { Bloque, Tarjeta, Fila, Campo, Cifra, Chips, Boton, BotonFila, Aviso, Vacio } from './ui';
import { rango, noches, aNumero, hoy } from './formato';
import { guardarMinimo, quitarMinimo } from './datos';

const POR_DEFECTO = 2;

export default function BloqueMinimo({ minimos, temporadas, onActualizar }) {
    const general = minimos.find((m) => !m.valid_from && !m.valid_until) || null;
    const porTemporada = minimos.filter((m) => m.valid_from || m.valid_until)
        .sort((a, b) => String(a.valid_from).localeCompare(String(b.valid_from)));

    const [cifra, setCifra] = useState(String(general?.threshold_days ?? POR_DEFECTO));
    const [guardando, setGuardando] = useState(false);
    const [bien, setBien] = useState('');
    const [mal, setMal] = useState('');

    const [abierto, setAbierto] = useState(false);
    const [temporadaId, setTemporadaId] = useState(null);
    const [cifraTemporada, setCifraTemporada] = useState('3');

    const hoyStr = hoy();
    const nGeneral = Number(general?.threshold_days ?? POR_DEFECTO);
    const temporadasFuturas = temporadas.filter((t) => t.end_date >= hoyStr);
    const yaTiene = (t) => porTemporada.some((m) => m.valid_from === t.start_date && m.valid_until === t.end_date);
    const disponibles = temporadasFuturas.filter((t) => !yaTiene(t));

    async function guardarGeneral() {
        setBien(''); setMal('');
        const n = aNumero(cifra);
        if (n === null || n < 1 || n > 30 || n % 1 !== 0) { setMal('Escribe un número de noches entre 1 y 30.'); return; }
        setGuardando(true);
        try {
            const nuevos = await guardarMinimo({
                id: general?.id ?? null,
                nochesMinimas: n,
                nombre: 'Mínimo de noches todo el año',
            });
            onActualizar(nuevos);
            setBien(n === 1
                ? 'Guardado. Ya se puede reservar una sola noche.'
                : `Guardado. La web ya no deja reservar menos de ${noches(n)}.`);
        } catch (e) {
            setMal(e.message);
        } finally {
            setGuardando(false);
        }
    }

    async function anadirDeTemporada() {
        setBien(''); setMal('');
        const t = temporadas.find((x) => x.id === temporadaId);
        const n = aNumero(cifraTemporada);
        if (!t) { setMal('Elige la temporada.'); return; }
        if (n === null || n < 1 || n > 30 || n % 1 !== 0) { setMal('Escribe un número de noches entre 1 y 30.'); return; }
        if (n <= nGeneral) {
            setMal(`En una temporada solo puedes pedir MÁS noches que el mínimo de todo el año, que ahora es ${noches(nGeneral)}.`);
            return;
        }
        setGuardando(true);
        try {
            const nuevos = await guardarMinimo({
                id: null,
                nochesMinimas: n,
                nombre: `Mínimo en ${t.name}`,
                desde: t.start_date,
                hasta: t.end_date,
            });
            onActualizar(nuevos);
            setBien(`Guardado. En ${t.name} (${rango(t.start_date, t.end_date)}) hay que reservar ${noches(n)} como poco.`);
            setAbierto(false); setTemporadaId(null); setCifraTemporada('3');
        } catch (e) {
            setMal(e.message);
        } finally {
            setGuardando(false);
        }
    }

    async function quitar(m) {
        setBien(''); setMal('');
        if (!window.confirm('¿Quitar este mínimo?')) return;
        try {
            const nuevos = await quitarMinimo(m.id);
            onActualizar(nuevos);
            setBien(`Quitado. Esas fechas se quedan con el mínimo de todo el año: ${noches(nGeneral)}.`);
        } catch (e) {
            setMal(e.message);
        }
    }

    return (
        <Bloque
            numero="4"
            titulo="Mínimo de noches"
            explicacion="Las estancias más cortas que esto no se pueden reservar por la web."
        >
            <div className="space-y-4">
                <Tarjeta className="space-y-4">
                    <Campo etiqueta="Todo el año, como poco" ayuda={general ? undefined : `Si no tocas nada, se guarda ${noches(POR_DEFECTO)}.`}>
                        <div className="flex items-center gap-3">
                            <Cifra value={cifra} onChange={(v) => { setCifra(v); setBien(''); setMal(''); }} sufijo="noches" ancho="w-full max-w-[220px]" />
                        </div>
                    </Campo>
                    <Boton onClick={guardarGeneral} disabled={guardando || (!!general && Number(aNumero(cifra)) === nGeneral)}>
                        {guardando ? 'Guardando…' : (!!general && Number(aNumero(cifra)) === nGeneral) ? 'Guardado' : 'Guardar'}
                    </Boton>
                </Tarjeta>

                <div className="space-y-3">
                    <h3 className="font-bold text-text-primary">Y en una temporada concreta</h3>
                    {porTemporada.length === 0 && <Vacio>Ninguna temporada pide más noches que el resto del año.</Vacio>}
                    {porTemporada.map((m) => (
                        <Fila key={m.id}>
                            <div className="flex-1 min-w-[180px]">
                                <p className="font-bold text-text-primary">{noches(m.threshold_days)} como poco</p>
                                <p className="text-sm text-gray-600">{rango(m.valid_from, m.valid_until)}</p>
                            </div>
                            <BotonFila tono="peligro" onClick={() => quitar(m)}>Quitar</BotonFila>
                        </Fila>
                    ))}

                    {!abierto && disponibles.length > 0 && (
                        <Boton tipo="suave" onClick={() => { setAbierto(true); setBien(''); setMal(''); }}>
                            Pedir más noches en una temporada
                        </Boton>
                    )}

                    {abierto && (
                        <Tarjeta className="space-y-4">
                            <Campo etiqueta="¿En qué temporada?">
                                <Chips
                                    opciones={disponibles.map((t) => ({ valor: t.id, etiqueta: t.name }))}
                                    valor={temporadaId}
                                    onChange={setTemporadaId}
                                />
                            </Campo>
                            <Campo
                                etiqueta="Esos días, como poco"
                                ayuda={`Tiene que ser más de ${noches(nGeneral)}, que es lo que pides el resto del año.`}
                            >
                                <Cifra value={cifraTemporada} onChange={setCifraTemporada} sufijo="noches" ancho="w-full max-w-[220px]" />
                            </Campo>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <Boton onClick={anadirDeTemporada} disabled={guardando}>
                                    {guardando ? 'Guardando…' : 'Guardar'}
                                </Boton>
                                <Boton tipo="suave" onClick={() => setAbierto(false)} disabled={guardando}>Dejarlo</Boton>
                            </div>
                        </Tarjeta>
                    )}
                </div>

                {bien && <Aviso tono="bien">{bien}</Aviso>}
                {mal && <Aviso tono="mal">{mal}</Aviso>}
            </div>
        </Bloque>
    );
}

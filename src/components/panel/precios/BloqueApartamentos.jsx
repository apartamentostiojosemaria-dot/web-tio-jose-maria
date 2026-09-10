// 1. Lo que cuesta cada apartamento.
// Una tarjeta por apartamento, dos cifras que se tocan y se escriben encima.

import React, { useEffect, useState } from 'react';
import { Bloque, Tarjeta, Campo, Cifra, Boton, Aviso } from './ui';
import { euros, aNumero } from './formato';
import { guardarPrecios } from './datos';

function TarjetaApartamento({ apartamento, onActualizar }) {
    const [normal, setNormal] = useState(String(apartamento.price_low ?? ''));
    const [alta, setAlta] = useState(String(apartamento.price_high ?? ''));
    const [guardando, setGuardando] = useState(false);
    const [bien, setBien] = useState('');
    const [mal, setMal] = useState('');

    // Si el precio cambia por fuera (recarga, otra pestaña), los campos se
    // ponen al día solos: la copia de pantalla nunca manda sobre la base.
    useEffect(() => {
        setNormal(String(apartamento.price_low ?? ''));
        setAlta(String(apartamento.price_high ?? ''));
    }, [apartamento.price_low, apartamento.price_high]);

    const nNormal = aNumero(normal);
    const nAlta = aNumero(alta);
    const cambiado = Number(apartamento.price_low) !== nNormal || Number(apartamento.price_high) !== nAlta;
    const valido = nNormal !== null && nNormal > 0 && nAlta !== null && nAlta > 0;

    async function guardar() {
        setBien(''); setMal('');
        if (!valido) { setMal('Escribe los dos precios con números.'); return; }
        setGuardando(true);
        try {
            const { apartamentos, guardado } = await guardarPrecios(apartamento.id, nNormal, nAlta);
            onActualizar(apartamentos);
            setBien(`Guardado. La web ya cobra ${euros(guardado.price_low)} la noche en ${guardado.name} los días normales y ${euros(guardado.price_high)} los días de temporada alta.`);
        } catch (e) {
            setMal(e.message);
            setNormal(String(apartamento.price_low ?? ''));
            setAlta(String(apartamento.price_high ?? ''));
        } finally {
            setGuardando(false);
        }
    }

    return (
        <Tarjeta className="space-y-4">
            <h3 className="font-serif text-xl font-bold text-text-primary">{apartamento.name}</h3>

            <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Días normales">
                    <Cifra value={normal} onChange={(v) => { setNormal(v); setBien(''); setMal(''); }} />
                </Campo>
                <Campo etiqueta="Días de temporada alta">
                    <Cifra value={alta} onChange={(v) => { setAlta(v); setBien(''); setMal(''); }} />
                </Campo>
            </div>

            <Boton onClick={guardar} disabled={guardando || !cambiado}>
                {guardando ? 'Guardando…' : cambiado ? 'Guardar' : 'Guardado'}
            </Boton>

            {bien && <Aviso tono="bien">{bien}</Aviso>}
            {mal && <Aviso tono="mal">{mal}</Aviso>}
        </Tarjeta>
    );
}

export default function BloqueApartamentos({ apartamentos, onActualizar }) {
    return (
        <Bloque
            numero="1"
            titulo="Lo que cuesta cada apartamento"
            explicacion="Toca el número, escribe el nuevo y dale a Guardar."
        >
            <div className="grid gap-4 lg:grid-cols-2">
                {apartamentos.map((a) => (
                    <TarjetaApartamento key={a.id} apartamento={a} onActualizar={onActualizar} />
                ))}
            </div>
        </Bloque>
    );
}

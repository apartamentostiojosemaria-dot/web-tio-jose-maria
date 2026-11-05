// 1. Lo que cuesta cada apartamento.
// Una tarjeta por apartamento, dos cifras que se tocan y se escriben encima.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bloque, Tarjeta, Campo, Cifra, Boton, Aviso } from './ui';
import { Confirmar } from '../ui';
import { euros, aNumero } from './formato';
import { guardarPrecios } from './datos';

/**
 * Sense check before saving (a slip of the finger: 60 → 600). Returns the
 * lines to show «antes → después», or [] if nothing looks odd.
 */
function cosasRaras({ antesNormal, antesAlta, normal, alta }) {
    const raras = [];
    const salto = (antes, despues) => Number(antes) > 0 && (despues < antes / 2 || despues > antes * 2);
    if (salto(antesNormal, normal)) raras.push(`Días normales: ${euros(antesNormal)} → ${euros(normal)} la noche.`);
    if (salto(antesAlta, alta)) raras.push(`Temporada alta: ${euros(antesAlta)} → ${euros(alta)} la noche.`);
    if (alta < normal) raras.push(`La temporada alta (${euros(alta)}) queda más barata que los días normales (${euros(normal)}).`);
    return raras;
}

function TarjetaApartamento({ apartamento, onActualizar, onCambiado }) {
    const [normal, setNormal] = useState(String(apartamento.price_low ?? ''));
    const [alta, setAlta] = useState(String(apartamento.price_high ?? ''));
    const [guardando, setGuardando] = useState(false);
    const [bien, setBien] = useState('');
    const [mal, setMal] = useState('');
    const [raras, setRaras] = useState([]);   // lines for the «¿seguro?» window

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

    // Tell the block whether this card has something written and not saved.
    useEffect(() => { onCambiado?.(apartamento.id, cambiado); }, [apartamento.id, cambiado, onCambiado]);
    useEffect(() => () => onCambiado?.(apartamento.id, false), [apartamento.id, onCambiado]);

    async function guardarDeVerdad() {
        setRaras([]);
        setGuardando(true);
        try {
            const { apartamentos, guardado } = await guardarPrecios(apartamento.id, nNormal, nAlta);
            onActualizar(apartamentos);
            setBien(`Guardado. La web ya cobra ${euros(guardado.price_low)} la noche en ${guardado.name} los días normales y ${euros(guardado.price_high)} los días de temporada alta.`);
        } catch (e) {
            // What she typed stays in the boxes: going back to the old price
            // would look as if it had been saved.
            const motivo = String(e.message || 'No se ha guardado.').replace(/\.?\s*$/, '.');
            setMal(/Jesús/.test(motivo)
                ? `${motivo} Lo que has escrito sigue ahí; la web sigue cobrando el precio de antes.`
                : `${motivo} Lo que has escrito sigue ahí: prueba a darle a Guardar otra vez. Si sigue igual, avisa a Jesús.`);
        } finally {
            setGuardando(false);
        }
    }

    function guardar() {
        setBien(''); setMal('');
        if (!valido) { setMal('Escribe los dos precios con números.'); return; }
        const lista = cosasRaras({
            antesNormal: Number(apartamento.price_low), antesAlta: Number(apartamento.price_high),
            normal: nNormal, alta: nAlta,
        });
        if (lista.length > 0) { setRaras(lista); return; }
        guardarDeVerdad();
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

            {/* «Guardado» only right after saving: before touching anything it
                said «Guardado» and looked like something had happened. */}
            <Boton onClick={guardar} disabled={guardando || !cambiado}>
                {guardando ? 'Guardando…' : !cambiado && bien ? 'Guardado' : 'Guardar'}
            </Boton>

            {bien && <Aviso tono="bien">{bien}</Aviso>}
            {mal && <Aviso tono="mal">{mal}</Aviso>}

            <Confirmar
                abierta={raras.length > 0}
                titulo={`¿Seguro que es este precio para ${apartamento.name}?`}
                texto={`Mira bien, por si se ha colado un número: ${raras.join(' ')}`}
                textoSi="Sí, guardarlo así"
                textoNo="No, lo corrijo"
                tono="principal"
                onSi={guardarDeVerdad}
                onNo={() => setRaras([])}
            />
        </Tarjeta>
    );
}

export default function BloqueApartamentos({ apartamentos, onActualizar, protegerSalida }) {
    // Prices typed and not saved: leaving asks first (the panel's own window).
    const sinGuardar = useRef(new Set());
    const [hayCambios, setHayCambios] = useState(false);
    const onCambiado = useCallback((id, cambiado) => {
        if (cambiado) sinGuardar.current.add(id); else sinGuardar.current.delete(id);
        setHayCambios(sinGuardar.current.size > 0);
    }, []);
    useEffect(() => {
        protegerSalida?.(hayCambios ? 'Has cambiado un precio y no le has dado a Guardar. Si sales ahora, se queda el precio de antes.' : null);
        if (!hayCambios) return undefined;
        const alCerrar = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', alCerrar);
        return () => window.removeEventListener('beforeunload', alCerrar);
    }, [hayCambios, protegerSalida]);
    useEffect(() => () => protegerSalida?.(null), [protegerSalida]);

    return (
        <Bloque
            numero="1"
            titulo="Lo que cuesta cada apartamento"
            explicacion="Toca el número, escribe el nuevo y dale a Guardar."
        >
            <div className="grid gap-4 lg:grid-cols-2">
                {apartamentos.map((a) => (
                    <TarjetaApartamento key={a.id} apartamento={a} onActualizar={onActualizar} onCambiado={onCambiado} />
                ))}
            </div>
        </Bloque>
    );
}

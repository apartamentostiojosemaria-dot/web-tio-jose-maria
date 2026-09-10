// 6. Extras.
// Lo que el huésped puede añadir a su reserva. Nombre, precio y si se ofrece o no.

import React, { useEffect, useState } from 'react';
import { Bloque, Tarjeta, Campo, Texto, Cifra, Interruptor, Boton, Aviso } from './ui';
import { euros, comoSeCobra, centimosAEuros, eurosACentimos, aNumero } from './formato';
import { guardarExtra } from './datos';

function TarjetaExtra({ extra, onActualizar }) {
    const [nombre, setNombre] = useState(extra.name);
    const [precio, setPrecio] = useState(String(centimosAEuros(extra.price_cents)));
    const [guardando, setGuardando] = useState(false);
    const [bien, setBien] = useState('');
    const [mal, setMal] = useState('');

    // Si el extra cambia por fuera, los campos se ponen al dia solos.
    useEffect(() => {
        setNombre(extra.name);
        setPrecio(String(centimosAEuros(extra.price_cents)));
    }, [extra.name, extra.price_cents]);

    const nPrecio = aNumero(precio);
    const cambiado = nombre.trim() !== extra.name || eurosACentimos(precio) !== Number(extra.price_cents);

    async function guardar() {
        setBien(''); setMal('');
        if (!nombre.trim()) { setMal('El extra tiene que llamarse de alguna manera.'); return; }
        if (nPrecio === null || nPrecio <= 0) { setMal('Escribe cuánto cuesta.'); return; }
        setGuardando(true);
        try {
            const { extras, guardado } = await guardarExtra({
                id: extra.id, nombre: nombre.trim(), precioCentimos: eurosACentimos(precio),
            });
            onActualizar(extras);
            setBien(`Guardado. ${guardado.name}: ${euros(centimosAEuros(guardado.price_cents))} ${comoSeCobra(guardado.per)}.`);
        } catch (e) {
            setMal(e.message);
            setNombre(extra.name);
            setPrecio(String(centimosAEuros(extra.price_cents)));
        } finally {
            setGuardando(false);
        }
    }

    async function cambiarActivo(valor) {
        setBien(''); setMal('');
        try {
            const { extras, guardado } = await guardarExtra({ id: extra.id, activo: valor });
            onActualizar(extras);
            setBien(guardado.active
                ? `${guardado.name} vuelve a ofrecerse en la web.`
                : `${guardado.name} ya no se ofrece en la web.`);
        } catch (e) {
            setMal(e.message);
        }
    }

    return (
        <Tarjeta className="space-y-4" apagada={!extra.active}>
            <h3 className="font-serif text-xl font-bold text-text-primary">{extra.name}</h3>

            <Campo etiqueta="Cómo se llama">
                <Texto value={nombre} onChange={(v) => { setNombre(v); setBien(''); setMal(''); }} maxLength={60} />
            </Campo>

            <Campo etiqueta="Cuánto cuesta" ayuda={`Se cobra ${comoSeCobra(extra.per)}.`}>
                <Cifra value={precio} onChange={(v) => { setPrecio(v); setBien(''); setMal(''); }} ancho="w-full max-w-[220px]" />
            </Campo>

            <Interruptor activo={!!extra.active} onChange={cambiarActivo} />

            <Boton onClick={guardar} disabled={guardando || !cambiado}>
                {guardando ? 'Guardando…' : cambiado ? 'Guardar' : 'Guardado'}
            </Boton>

            {bien && <Aviso tono="bien">{bien}</Aviso>}
            {mal && <Aviso tono="mal">{mal}</Aviso>}
        </Tarjeta>
    );
}

export default function BloqueExtras({ extras, onActualizar }) {
    return (
        <Bloque
            numero="6"
            titulo="Extras"
            explicacion="Lo que el huésped puede añadir cuando reserva. Si algo no lo quieres ofrecer una temporada, apágalo y ya está."
        >
            <div className="grid gap-4 lg:grid-cols-2">
                {extras.map((e) => (
                    <TarjetaExtra key={e.id} extra={e} onActualizar={onActualizar} />
                ))}
            </div>
        </Bloque>
    );
}

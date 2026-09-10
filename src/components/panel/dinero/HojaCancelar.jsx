// Cancelar una reserva.
//
// Antes de cancelar nada se dice qué pasa con el dinero según la política:
// gratis hasta 7 días antes de la llegada, después no se devuelve. Y se
// pregunta. Cancelar no se hace de un toque sin querer.

import React, { useState, useEffect } from 'react';
import { XCircle, AlertCircle } from 'lucide-react';
import { Boton, Campo, claseInput, Aviso, formatoEuro, hoyISO, aFecha, cobradoDe } from '../ui';
import { Hoja } from './ui';
import { cancelarReserva } from './datos';

const diasHasta = (iso) => {
    const f = aFecha(iso); const h = aFecha(hoyISO());
    if (!f || !h) return null;
    return Math.round((f.getTime() - h.getTime()) / 86400000);
};

export default function HojaCancelar({ abierta, reserva, onCerrar, onCancelada }) {
    const [motivo, setMotivo] = useState('');
    const [seguro, setSeguro] = useState(false);
    const [trabajando, setTrabajando] = useState(false);
    const [error, setError] = useState(null);
    const [hecho, setHecho] = useState(null);

    useEffect(() => {
        if (!abierta) return;
        setMotivo(''); setSeguro(false); setError(null); setHecho(null);
    }, [abierta]);

    const dias = diasHasta(reserva?.check_in);
    const cobrado = cobradoDe(reserva);
    const gratis = dias != null && dias >= 7;

    const cancelar = async () => {
        setTrabajando(true); setError(null);
        try {
            const res = await cancelarReserva({ bookingId: reserva.id, motivo });
            setHecho(res);
            await onCancelada?.();
        } catch (e) { setError(e.message); } finally { setTrabajando(false); }
    };

    return (
        <Hoja abierta={abierta} titulo="Cancelar esta reserva" onCerrar={onCerrar}
            explicacion={reserva?.guest_name ? `De ${reserva.guest_name}.` : undefined}>

            {hecho ? (
                <>
                    <Aviso tono="bien" titulo="Reserva cancelada."
                        texto={Number(hecho.a_devolver) > 0
                            ? `Hay que devolverle ${formatoEuro(hecho.a_devolver)}.`
                            : 'No hay que devolverle nada.'} />
                    {Number(hecho.a_devolver) > 0 && (
                        <p className="text-base text-gray-700 leading-relaxed">
                            Si le pagó con tarjeta por la web, la devolución sale sola. Si te lo pagó
                            por transferencia o Bizum, hazle tú la devolución y apúntala aquí como un
                            cobro en negativo.
                        </p>
                    )}
                    <Boton ancho onClick={onCerrar}>Entendido</Boton>
                </>
            ) : (
                <>
                    <Aviso
                        tono={gratis ? 'info' : 'atencion'}
                        // La regla de la base es `check_in - hoy >= 7`. Decir "faltan MAS
                        // de 7 dias" cuando faltan exactamente 7 se contradecia con la
                        // linea de debajo ("Entra dentro de 7 dias") en la misma caja.
                        titulo={gratis
                            ? (cobrado > 0
                                ? `Quedan 7 días o más: hay que devolverle los ${formatoEuro(cobrado)} que pagó.`
                                : 'Quedan 7 días o más: la cancelación es gratuita.')
                            : (cobrado > 0
                                ? `Quedan menos de 7 días: no hay que devolverle nada de los ${formatoEuro(cobrado)} que pagó.`
                                : 'Quedan menos de 7 días: fuera de plazo, no hay devolución.')}
                        texto={dias != null
                            ? `Entra ${dias > 0 ? `dentro de ${dias} ${dias === 1 ? 'día' : 'días'}` : dias === 0 ? 'hoy' : 'ya entró'}.`
                            : undefined}
                    />

                    <Campo etiqueta="¿Por qué la cancela?" ayuda="Opcional. Queda apuntado en la reserva." htmlFor="cancelar-motivo">
                        <input id="cancelar-motivo" type="text" value={motivo} maxLength={200}
                            onChange={(e) => setMotivo(e.target.value)} className={claseInput}
                            placeholder="Le ha surgido un imprevisto" />
                    </Campo>

                    {error && <Aviso tono="urgente" titulo={error} />}

                    <label className="flex items-start gap-3 min-h-[52px] p-3 rounded-2xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={seguro} onChange={(e) => setSeguro(e.target.checked)}
                            className="mt-1 w-6 h-6 accent-red-600 shrink-0" />
                        <span className="text-base font-semibold text-text-primary leading-snug">
                            Sí, quiero cancelar esta reserva. Las fechas quedarán libres.
                        </span>
                    </label>

                    <Boton ancho tamano="grande" variante="peligro" icono={seguro ? XCircle : AlertCircle}
                        onClick={cancelar} cargando={trabajando} disabled={!seguro}>
                        Cancelar la reserva
                    </Boton>
                </>
            )}
        </Hoja>
    );
}

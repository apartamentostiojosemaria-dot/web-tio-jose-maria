// «No se han presentado».
//
// La política (condiciones, punto 8) dice que no presentarse sin avisar es
// perder el importe, pero hasta el 18-sep-2026 el sistema no tenía dónde
// decirlo: la reserva se quedaba como si hubieran venido. Esta hoja se abre
// desde la ficha solo cuando ya es el día de llegada (o después) y nadie ha
// hecho la entrada. No es una cancelación: no se devuelve nada y no se le
// escribe al huésped; si hay que hablar con él, se le llama.

import React, { useState, useEffect } from 'react';
import { UserX, AlertCircle } from 'lucide-react';
import { Hoja, Boton, Campo, claseInput, Aviso, formatoEuro, cobradoDe } from '../ui';
import { marcarNoShow } from './datos';

export default function HojaNoShow({ abierta, reserva, onCerrar, onMarcada }) {
    const [nota, setNota] = useState('');
    const [seguro, setSeguro] = useState(false);
    const [trabajando, setTrabajando] = useState(false);
    const [error, setError] = useState(null);
    const [hecho, setHecho] = useState(false);

    useEffect(() => {
        if (!abierta) return;
        setNota(''); setSeguro(false); setError(null); setHecho(false);
    }, [abierta]);

    const cobrado = cobradoDe(reserva);

    const marcar = async () => {
        setTrabajando(true); setError(null);
        try {
            await marcarNoShow({ bookingId: reserva.id, nota });
            setHecho(true);
            await onMarcada?.();
        } catch (e) { setError(e.message); } finally { setTrabajando(false); }
    };

    return (
        <Hoja abierta={abierta} titulo="No se han presentado" onCerrar={onCerrar}
            explicacion={reserva?.guest_name ? `Reserva de ${reserva.guest_name}.` : undefined}>
            {hecho ? (
                <>
                    <Aviso tono="bien" titulo="Apuntado: no se presentaron."
                        texto={cobrado > 0
                            ? `Los ${formatoEuro(cobrado)} que pagaron se quedan, como dicen las condiciones.`
                            : 'No habían pagado nada.'} />
                    <Boton ancho onClick={onCerrar}>Entendido</Boton>
                </>
            ) : (
                <>
                    <Aviso tono="atencion"
                        titulo={cobrado > 0
                            ? `No se devuelve nada: los ${formatoEuro(cobrado)} que pagaron se quedan.`
                            : 'No habían pagado nada.'}
                        texto="Es lo que dicen las condiciones cuando alguien no viene sin avisar. Si te han llamado para decir que no vienen, eso no es esto: es una cancelación." />

                    <Campo etiqueta="¿Quieres apuntar algo?" ayuda="Opcional. Queda en la reserva." htmlFor="noshow-nota">
                        <input id="noshow-nota" type="text" value={nota} maxLength={200}
                            onChange={(e) => setNota(e.target.value)} className={claseInput}
                            placeholder="Les llamé dos veces y no cogieron" />
                    </Campo>

                    {error && <Aviso tono="urgente" titulo={error} />}

                    <label className="flex items-start gap-3 min-h-[52px] p-3 rounded-2xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={seguro} onChange={(e) => setSeguro(e.target.checked)}
                            className="mt-1 w-6 h-6 accent-red-600 shrink-0" />
                        <span className="text-base font-semibold text-text-primary leading-snug">
                            Sí, no han venido y no han avisado.
                        </span>
                    </label>

                    <Boton ancho tamano="grande" variante="peligro" icono={seguro ? UserX : AlertCircle}
                        onClick={marcar} cargando={trabajando} disabled={!seguro}>
                        Apuntar que no se presentaron
                    </Boton>
                </>
            )}
        </Hoja>
    );
}

// Cambiar las fechas o el apartamento de una reserva.
//
// El sistema comprueba solo que esté libre. Si el precio nuevo no coincide
// con el que había, se dice en cristiano ("Ahora son 60 € más") y se decide
// aquí si se le cobra o se deja como estaba: el precio NO se cambia solo.

import React, { useState, useEffect } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { Boton, Campo, claseInput, Aviso, formatoEuro, hoyISO } from '../ui';
import { Hoja, Opciones } from './ui';
import { moverReserva, ajustarPrecio } from './datos';
import { diaMesYAno } from './formato';

export default function HojaCambiar({ abierta, reserva, apartamentos = [], factura = null, onCerrar, onCambiada }) {
    const [apartamentoId, setApartamentoId] = useState(reserva?.apartment_id);
    const [entrada, setEntrada] = useState(reserva?.check_in || hoyISO());
    const [salida, setSalida] = useState(reserva?.check_out || hoyISO());
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);
    const [resultado, setResultado] = useState(null);
    const [ajustando, setAjustando] = useState(false);

    // Solo se reinicia al ABRIR la hoja (o si se abre otra reserva). Ojo con
    // meter aqui reserva.check_in / check_out: al cambiar la reserva el padre
    // la relee, esas props cambian, este efecto se vuelve a disparar y borra
    // `resultado` antes de que se llegue a leer. Resultado: se cambiaban las
    // fechas de verdad y en pantalla no aparecia NADA — ni el "Cambiado" ni la
    // diferencia de precio ni el boton de poner el precio nuevo.
    useEffect(() => {
        if (!abierta) return;
        setApartamentoId(reserva?.apartment_id);
        setEntrada(reserva?.check_in || hoyISO());
        setSalida(reserva?.check_out || hoyISO());
        setError(null);
        setResultado(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [abierta, reserva?.id]);

    const cambiar = async () => {
        setGuardando(true); setError(null); setResultado(null);
        try {
            const res = await moverReserva({
                bookingId: reserva.id, apartamentoId: Number(apartamentoId), entrada, salida,
            });
            setResultado(res);
            await onCambiada?.();
        } catch (e) { setError(e.message); } finally { setGuardando(false); }
    };

    const dejarElPrecioNuevo = async () => {
        setAjustando(true); setError(null);
        try {
            await ajustarPrecio(reserva.id, resultado.precio_sugerido);
            setResultado({ ...resultado, aplicado: true, diferencia: 0 });
            await onCambiada?.();
        } catch (e) { setError(e.message); } finally { setAjustando(false); }
    };

    const dif = Number(resultado?.diferencia || 0);
    const idAptos = React.useId();

    return (
        <Hoja abierta={abierta} titulo="Cambiar fechas o apartamento" onCerrar={onCerrar}
            explicacion="Compruebo que esté libre antes de cambiar nada.">

            <div className="mb-5">
                <p id={idAptos} className="block text-base font-bold text-text-primary mb-2">¿Qué apartamento?</p>
                <Opciones
                    opciones={apartamentos.map((a) => ({ valor: a.id, etiqueta: a.name }))}
                    valor={apartamentoId} onChange={setApartamentoId} etiquetadoPor={idAptos}
                />
            </div>

            <Campo etiqueta="Entra el" htmlFor="cambiar-entrada">
                <input id="cambiar-entrada" type="date" value={entrada}
                    onChange={(e) => setEntrada(e.target.value)} className={claseInput} />
            </Campo>

            <Campo etiqueta="Se va el" htmlFor="cambiar-salida">
                <input id="cambiar-salida" type="date" value={salida} min={entrada}
                    onChange={(e) => setSalida(e.target.value)} className={claseInput} />
            </Campo>

            {error && <Aviso tono="urgente" titulo={error} />}

            {factura && factura.tipo !== 'rectificativa' && !resultado?.ok && (
                <Aviso tono="atencion" titulo={`Esta reserva ya tiene factura (del ${diaMesYAno(factura.fecha_emision)}).`}
                    texto="Si cambias las fechas o el apartamento, la factura se queda con lo antiguo y habrá que hacer una rectificativa. Díselo a Jesús después de cambiarla." />
            )}

            {resultado?.ok && (
                <Aviso
                    tono={dif === 0 ? 'bien' : 'atencion'}
                    titulo={
                        resultado.aplicado ? 'Cambiado y precio actualizado.'
                            : dif === 0 ? 'Cambiado. El precio se queda igual.'
                                : dif > 0 ? `Cambiado. Con las fechas nuevas son ${formatoEuro(dif)} más.`
                                    : `Cambiado. Con las fechas nuevas le sobran ${formatoEuro(Math.abs(dif))}.`
                    }
                    texto={dif !== 0 && !resultado.aplicado
                        ? `Ahora la reserva pone ${formatoEuro(resultado.total_price)}. Con el precio de estas fechas serían ${formatoEuro(resultado.precio_sugerido)}.`
                        : undefined}
                />
            )}

            {resultado?.ok && dif !== 0 && !resultado.aplicado && (
                <Boton ancho variante="secundario" icono={Check}
                    onClick={dejarElPrecioNuevo} cargando={ajustando}>
                    Poner el precio nuevo ({formatoEuro(resultado.precio_sugerido)})
                </Boton>
            )}

            {!resultado?.ok && (
                <Boton ancho tamano="grande" icono={CalendarDays} onClick={cambiar} cargando={guardando}>
                    Cambiar la reserva
                </Boton>
            )}
        </Hoja>
    );
}

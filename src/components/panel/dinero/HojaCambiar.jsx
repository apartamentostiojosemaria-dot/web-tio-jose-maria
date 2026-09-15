// Cambiar las fechas o el apartamento de una reserva.
//
// El sistema comprueba solo que esté libre. Si el precio nuevo no coincide
// con el que había, se dice en cristiano ("Ahora son 60 € más") y se decide
// aquí si se le cobra o se deja como estaba: el precio NO se cambia solo.
//
// Al huésped se le avisa por correo DESPUÉS, con un toque de ella, y solo si
// reservó directo (a los de Booking o Airbnb les avisa el canal). Va después
// del precio a propósito: el correo lleva el total que tenga la reserva en
// ese momento, y ella decide el precio antes de que él lo lea.

import React, { useState, useEffect } from 'react';
import { CalendarDays, Check, Mail } from 'lucide-react';
import { Hoja, Boton, Campo, claseInput, Aviso, formatoEuro, hoyISO } from '../ui';
import { Opciones } from './ui';
import { moverReserva, ajustarPrecio, avisarPorCorreo, sePuedeAvisarPorCorreo } from './datos';
import { diaMesYAno } from './formato';

export default function HojaCambiar({ abierta, reserva, apartamentos = [], factura = null, onCerrar, onCambiada }) {
    const [apartamentoId, setApartamentoId] = useState(reserva?.apartment_id);
    const [entrada, setEntrada] = useState(reserva?.check_in || hoyISO());
    const [salida, setSalida] = useState(reserva?.check_out || hoyISO());
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);
    const [resultado, setResultado] = useState(null);
    const [ajustando, setAjustando] = useState(false);
    // Cómo estaba ANTES de cambiarla: va en el correo («Antes: Albahaca, del…»).
    const [antes, setAntes] = useState(null);
    const [aviso, setAviso] = useState(null);        // null | 'mandando' | 'enviado' | { fallo }

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
        setAntes(null);
        setAviso(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [abierta, reserva?.id]);

    const cambiar = async () => {
        setGuardando(true); setError(null); setResultado(null);
        // Se guarda antes de mover: al volver, `reserva` ya trae lo nuevo.
        const comoEstaba = {
            check_in: reserva.check_in,
            check_out: reserva.check_out,
            apartment_name: apartamentos.find((a) => a.id === reserva.apartment_id)?.name || '',
        };
        try {
            const res = await moverReserva({
                bookingId: reserva.id, apartamentoId: Number(apartamentoId), entrada, salida,
            });
            setResultado(res);
            setAntes(comoEstaba);
            await onCambiada?.();
        } catch (e) { setError(e.message); } finally { setGuardando(false); }
    };

    const avisar = async () => {
        setAviso('mandando');
        try {
            const r = await avisarPorCorreo(reserva, 'booking_changed', { antes });
            setAviso(r.ok ? 'enviado' : { fallo: 'No se ha mandado: a este huésped le avisa la web por la que reservó.' });
        } catch (e) { setAviso({ fallo: e.message }); }
    };

    const puedeAvisar = sePuedeAvisarPorCorreo(reserva);
    const nombreCorto = (reserva?.guest_name || '').trim().split(/\s+/)[0] || 'al huésped';

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

            {/* ---------- Avisarle del cambio ---------- */}
            {resultado?.ok && puedeAvisar && aviso !== 'enviado' && (
                <>
                    <p className="text-base text-gray-700 leading-relaxed">
                        ¿Le aviso a {nombreCorto} por correo? Le diré cómo queda la reserva
                        (apartamento, fechas y el total que tiene ahora) y cómo estaba antes.
                    </p>
                    {aviso?.fallo && <Aviso tono="urgente" titulo={aviso.fallo} />}
                    <Boton ancho tamano="grande" icono={Mail} onClick={avisar} cargando={aviso === 'mandando'}>
                        Mandarle el correo del cambio
                    </Boton>
                </>
            )}
            {resultado?.ok && aviso === 'enviado' && (
                <Aviso tono="bien" titulo={`Le hemos mandado el correo a ${reserva.guest_email}.`} />
            )}
            {resultado?.ok && !puedeAvisar && (
                <p className="text-sm text-gray-600 leading-relaxed">
                    {reserva?.channel && ['booking', 'airbnb', 'escapada', 'casasrurales', 'holidu'].includes(String(reserva.channel).toLowerCase())
                        ? 'A este huésped le avisa la web por la que reservó: aquí no se le manda correo.'
                        : 'Este huésped no tiene correo apuntado, así que no se le puede avisar desde aquí. Llámale o apúntale el correo en su ficha.'}
                </p>
            )}

            {!resultado?.ok && (
                <Boton ancho tamano="grande" icono={CalendarDays} onClick={cambiar} cargando={guardando}>
                    Cambiar la reserva
                </Boton>
            )}
        </Hoja>
    );
}

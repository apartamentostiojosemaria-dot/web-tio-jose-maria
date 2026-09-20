import React, { useEffect, useState, useCallback } from 'react';
import {
    Phone, MessageCircle, Euro, Shield, FileText, CalendarDays, XCircle,
    Users, Home, Check, NotebookPen, QrCode, UserX, Clock, LogOut } from 'lucide-react';
import {
    Boton, Tarjeta, Aviso, Cargando, Vacio, Chip, claseInput,
    formatoEuro, cobradoDe, pendienteDe, canalSiImporta, nombreCanal,
} from './ui';
import { LineaDinero, LoQuePagaBooking, SemaforoPolicia } from './dinero/ui';
import {
    rangoEnPalabras, cobroEnPalabras, diaMesYAno, nombreForma,
    enlaceLlamar, enlaceWhatsApp,
} from './dinero/formato';
import {
    cargarReserva, cargarCobros, cargarParte, cargarEstadoFactura,
    cargarApartamentos, guardarNotas,
} from './dinero/datos';
import HojaCobro from './dinero/HojaCobro';
import HojaFactura from './dinero/HojaFactura';
import HojaCambiar from './dinero/HojaCambiar';
import HojaCancelar from './dinero/HojaCancelar';
import HojaNoShow from './dinero/HojaNoShow';

// ============================================================
// ReservaFicha — la ficha de una reserva (sección 4.4 del plan)
// ============================================================
// Lo primero que se ve: quién, dónde, cuándo y su teléfono, para poder
// llamarle sin buscar nada.
//
// Después, EL DINERO, que es lo que Jesús pidió que se viera clarísimo:
// tres líneas grandes — total, cobrado y pendiente — y, si la reserva vino
// de Booking, lo que va a pagar Booking ya descontada su comisión.
//
// Luego tres botones grandes: Cobrar · Datos de la policía · Factura.
// Y, sin gritar pero a la vista: cambiar fechas o apartamento, y cancelar.
//
// Nada de canal, comisión en bruto, localizador, series ni estados en
// inglés. Si algo de eso aparece en pantalla, está mal.
// ============================================================

const ReservaFicha = ({ ir, params = {} }) => {
    const reservaId = params.reservaId;

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [reserva, setReserva] = useState(null);
    const [apartamentos, setApartamentos] = useState([]);
    const [cobros, setCobros] = useState([]);
    const [parte, setParte] = useState(null);
    const [factura, setFactura] = useState(null);       // la VIVA
    const [anuladas, setAnuladas] = useState([]);       // anuladas por rectificativa (Jesús)
    const [hoja, setHoja] = useState(null);   // cobro | factura | cambiar | cancelar | noshow

    const refrescar = useCallback(async () => {
        const [r, c, p, f] = await Promise.all([
            cargarReserva(reservaId),
            cargarCobros(reservaId),
            cargarParte(reservaId),
            cargarEstadoFactura(reservaId),
        ]);
        setReserva(r); setCobros(c); setParte(p); setFactura(f.factura); setAnuladas(f.anuladas);
        return r;
    }, [reservaId]);

    useEffect(() => {
        let cortado = false;
        if (!reservaId) { setCargando(false); return undefined; }

        (async () => {
            try {
                const [, apts] = await Promise.all([refrescar(), cargarApartamentos()]);
                if (cortado) return;
                setApartamentos(apts);
                // Si se llega desde un aviso, se abre directamente lo que toca.
                if (['cobro', 'parte', 'factura'].includes(params.abrir)) setHoja(params.abrir);
            } catch (e) {
                if (!cortado) setError(e.message);
            } finally {
                if (!cortado) setCargando(false);
            }
        })();

        return () => { cortado = true; };
        // `params.abrir` solo se mira al entrar: si no, se reabriría sola al refrescar.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reservaId, refrescar]);

    if (!reservaId) return <Vacio mensaje="No sé qué reserva quieres ver. Vuelve atrás y ábrela desde la lista." />;
    if (cargando) return <Cargando texto="Abriendo la reserva…" />;
    if (error) return <Aviso tono="urgente" titulo={error} />;
    if (!reserva) return <Vacio mensaje="Esa reserva ya no está." />;

    const apartamento = apartamentos.find((a) => a.id === reserva.apartment_id)?.name || 'Apartamento';
    const personas = reserva.pax_count || 1;
    const total = Number(reserva.total_price) || 0;
    const cobrado = cobradoDe(reserva);
    const pendiente = pendienteDe(reserva);
    const cancelada = reserva.status === 'cancelled';
    const noSePresento = reserva.status === 'no_show';
    // «No se han presentado» solo tiene sentido desde el día de llegada y si
    // nadie ha hecho la entrada; el resto del tiempo el botón no está.
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    const puedeSerNoShow = reserva.status === 'confirmed' && String(reserva.check_in) <= hoy && !reserva.checkin_at;
    // El check-in y los datos de la policía son la MISMA cosa (Jesús, 18-sep):
    // un solo botón que cambia con el momento. Antes del día: «Datos de la
    // policía» (QR, recordárselo, quién ha rellenado). El día de llegada:
    // «Hacer el check-in». Dentro: «Entraron a las X» y el botón para apuntar
    // que se van. Después: solo la hora a la que se fueron.
    const entraron = !!reserva.checkin_at;
    const seFueron = !!reserva.checkout_at;
    const esElDia = String(reserva.check_in) <= hoy;
    const horaDe = (t) => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(t));

    // Falta hacerla si no hay una válida, no se ha dicho «no hace falta» y la
    // reserva sigue viva. Con una anulada y sin sustituta, también falta.
    const faltaFactura = !factura && !reserva.invoice_not_needed && !cancelada && !noSePresento;

    const deBooking = (reserva.channel || '').toLowerCase() === 'booking';
    const comision = Number(reserva.commission_amount) || 0;
    const netoBooking = Math.max(0, total - comision);

    // Debajo de "Cobrado" se dice CÓMO y CUÁNDO. Con un solo cobro es la
    // frase del plan ("transferencia, 8 de septiembre"); con varios hay que
    // decir que son varios, o el detalle del último parecería el total.
    const ultimoCobro = cobros.find((c) => Number(c.amount) > 0);
    const cuantosCobros = cobros.filter((c) => Number(c.amount) > 0).length;
    const detalleCobrado = cobrado <= 0
        ? 'Todavía no ha pagado nada'
        : cuantosCobros > 1
            ? `En ${cuantosCobros} veces · la última, ${nombreForma(ultimoCobro.method)} el ${diaMesYAno(ultimoCobro.paid_on)}`
            : cobroEnPalabras(ultimoCobro);
    const tel = reserva.guest_phone;
    const wa = enlaceWhatsApp(tel);
    const llamar = enlaceLlamar(tel);

    return (
        <div className="space-y-6">
            {/* ---------- Quién, dónde y cuándo ---------- */}
            <section>
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-primary leading-tight break-words">
                    {reserva.guest_name || 'Sin nombre'}
                </h2>

                <div className="flex flex-wrap gap-2 mt-3">
                    <Chip icono={Home}>{apartamento}</Chip>
                    <Chip icono={Users}>{personas} {personas === 1 ? 'persona' : 'personas'}</Chip>
                    {canalSiImporta(reserva) && <Chip tono="azul">Vino por {nombreCanal(reserva)}</Chip>}
                    {cancelada && <Chip tono="rojo" icono={XCircle}>Cancelada</Chip>}
                    {noSePresento && <Chip tono="rojo" icono={UserX}>No se presentaron</Chip>}
                    {reserva.hora_llegada_prevista && !reserva.checkin_at && (
                        <Chip tono="verde" icono={Clock}>Llegan sobre las {String(reserva.hora_llegada_prevista).slice(0, 5)}</Chip>
                    )}
                </div>

                <p className="text-lg text-text-primary mt-3 leading-relaxed">
                    {rangoEnPalabras(reserva.check_in, reserva.check_out)}
                </p>
                <p className="text-base text-gray-600">
                    {reserva.nights || ''} {reserva.nights === 1 ? 'noche' : 'noches'}
                </p>

                {tel && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        <Boton variante="secundario" icono={Phone} onClick={() => window.location.assign(llamar)}>
                            Llamar
                        </Boton>
                        {wa && (
                            <Boton variante="secundario" icono={MessageCircle}
                                onClick={() => window.open(wa, '_blank', 'noopener')}>
                                WhatsApp
                            </Boton>
                        )}
                        <span className="w-full text-base text-gray-600 mt-1">{tel}</span>
                    </div>
                )}
            </section>

            {cancelada && (
                <Aviso tono="info" titulo="Esta reserva está cancelada."
                    texto="Las fechas están libres y no se le pide dinero." />
            )}
            {cancelada && factura && (
                <Aviso tono="atencion" titulo={`Tiene una factura hecha el ${diaMesYAno(factura.fecha_emision)} y la reserva se ha cancelado.`}
                    texto="Una factura hecha no se borra: hay que hacer una factura rectificativa. Eso lo hace Jesús desde la vista completa; díselo." />
            )}

            {/* ---------- EL DINERO ---------- */}
            <Tarjeta>
                <LineaDinero etiqueta="Total" importe={total} />
                <LineaDinero
                    etiqueta="Cobrado" importe={cobrado} tono="cobrado"
                    detalle={detalleCobrado}
                />
                <LineaDinero
                    etiqueta="Pendiente" importe={pendiente} destacada
                    tono={pendiente > 0 ? 'pendiente' : 'cobrado'}
                    detalle={pendiente > 0 ? null : 'No falta nada por cobrar'}
                />

                {deBooking && (
                    <div className="mt-4">
                        <LoQuePagaBooking
                            neto={netoBooking}
                            comision={comision}
                            desde={reserva.vcc_chargeable_from ? diaMesYAno(reserva.vcc_chargeable_from) : null}
                        />
                    </div>
                )}
            </Tarjeta>

            {/* ---------- Cobros apuntados y factura ---------- */}
            <Tarjeta titulo="Cobros apuntados">
                {cobros.length === 0 ? (
                    <p className="text-base text-gray-600">Todavía no hay ningún cobro apuntado.</p>
                ) : (
                    <ul className="divide-y divide-gray-100 -mx-5">
                        {cobros.map((c) => (
                            <li key={c.id} className="px-5 py-3 flex items-baseline justify-between gap-3">
                                <span className="text-base text-text-primary min-w-0">
                                    <span className="block font-semibold">{cobroEnPalabras(c)}</span>
                                    {c.note && <span className="block text-sm text-gray-600">{c.note}</span>}
                                </span>
                                <span className={`font-serif font-bold tabular-nums text-xl shrink-0 ${Number(c.amount) < 0 ? 'text-red-700' : 'text-rural-700'}`}>
                                    {formatoEuro(c.amount)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {pendiente <= 0 && !cancelada && !noSePresento && (
                    <div className="mt-3">
                        <Chip tono="neutro" icono={Euro} onClick={() => setHoja('cobro')}>Apuntar otro cobro</Chip>
                    </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-text-primary">Factura:</span>
                    {/* Lo resuelto se enseña como dato y se pulsa para verlo; el
                        botón grande de abajo solo sale cuando falta hacerla. */}
                    {factura ? (
                        <Chip tono="verde" icono={Check} onClick={() => setHoja('factura')} aria-label="Ver la factura">
                            Hecha el {diaMesYAno(factura.fecha_emision)} · ver
                        </Chip>
                    ) : anuladas.length > 0 ? (
                        <Chip tono="rojo" icono={XCircle} onClick={() => setHoja('factura')}>Anulada{cancelada || reserva.invoice_not_needed ? '' : ' · falta hacer otra'}</Chip>
                    ) : reserva.invoice_not_needed ? (
                        <Chip tono="neutro" onClick={() => setHoja('factura')}>No hace falta · cambiar</Chip>
                    ) : (
                        <Chip tono="ambar">Sin hacer</Chip>
                    )}
                    {factura && factura.abonado > 0 && (
                        <Chip tono="ambar">Con un abono de {formatoEuro(factura.abonado)}</Chip>
                    )}
                </div>
            </Tarjeta>

            {/* ---------- Los botones grandes ---------- */}
            <section className="space-y-3">
                <div>
                    {seFueron ? (
                        <div className="flex flex-wrap justify-center gap-2">
                            <Chip tono="verde" icono={Check}>Entraron a las {horaDe(reserva.checkin_at)}</Chip>
                            <Chip tono="neutro" icono={LogOut}>Se fueron a las {horaDe(reserva.checkout_at)}</Chip>
                        </div>
                    ) : entraron ? (
                        <>
                            <div className="flex justify-center mb-2">
                                <Chip tono="verde" icono={Check}>Entraron a las {horaDe(reserva.checkin_at)}</Chip>
                            </div>
                            <Boton ancho tamano="grande" variante="secundario" icono={LogOut} onClick={() => ir('checkin', { reservaId: reserva.id })}>
                                Se han ido
                            </Boton>
                        </>
                    ) : esElDia ? (
                        <Boton ancho tamano="grande" icono={parte?.completo ? Check : QrCode} onClick={() => ir('checkin', { reservaId: reserva.id })} disabled={cancelada || noSePresento}>
                            {parte?.completo ? 'Terminar el check-in' : 'Hacer el check-in'}
                        </Boton>
                    ) : (
                        <Boton ancho tamano="grande" variante="secundario" icono={Shield} onClick={() => ir('checkin', { reservaId: reserva.id })} disabled={cancelada}>
                            Datos de la policía
                        </Boton>
                    )}
                    {!cancelada && !noSePresento && (
                        <div className="mt-2 flex justify-center">
                            <SemaforoPolicia parte={parte} />
                        </div>
                    )}
                </div>

                {/* Regla (Jesús, 20-sep): un botón grande solo cuando hay algo
                    que hacer. Cobrado del todo → no hay «Cobrar»; factura hecha
                    → no hay «Factura» (se ve arriba, en su chip). Cancelada o
                    no presentada → ninguno de los dos. */}
                {pendiente > 0 && !cancelada && !noSePresento && (
                    <Boton ancho tamano="grande" icono={Euro} onClick={() => setHoja('cobro')}>
                        Cobrar {formatoEuro(pendiente)}
                    </Boton>
                )}

                {reserva.factura_pedida_at && !factura && (
                    <Aviso tono="atencion" titulo={`Ha pedido factura a nombre de ${reserva.factura_datos?.nombre || 'el huésped'}.`}
                        texto={`NIF ${reserva.factura_datos?.nif || '—'} · ${reserva.factura_datos?.direccion || ''}. Al hacerla salen ya estos datos.`} />
                )}
                {faltaFactura && (
                    <Boton ancho tamano="grande" variante={pendiente > 0 ? 'secundario' : 'principal'} icono={FileText} onClick={() => setHoja('factura')}>
                        Hacer la factura
                    </Boton>
                )}
            </section>

            {/* ---------- Apuntes suyos ---------- */}
            <NotasInternas reserva={reserva} onGuardado={(txt) => setReserva({ ...reserva, internal_notes: txt })} />

            {/* ---------- A la vista, pero sin gritar ---------- */}
            {/* Cambiar o cancelar solo mientras la estancia no ha terminado:
                una reserva que ya se fue no se cambia ni se cancela. */}
            {!cancelada && !noSePresento && !seFueron && String(reserva.check_out) >= hoy && (
                <section className="pt-2 space-y-2">
                    <Boton ancho variante="suave" icono={CalendarDays} onClick={() => setHoja('cambiar')}>
                        Cambiar fechas o apartamento
                    </Boton>
                    <Boton ancho variante="peligro" icono={XCircle} onClick={() => setHoja('cancelar')}>
                        Cancelar reserva
                    </Boton>
                    {puedeSerNoShow && (
                        <Boton ancho variante="suave" icono={UserX} onClick={() => setHoja('noshow')}>
                            No se han presentado
                        </Boton>
                    )}
                </section>
            )}

            {/* ---------- Hojas ---------- */}
            <HojaCobro
                abierta={hoja === 'cobro'} reserva={reserva} pendiente={pendiente}
                onCerrar={() => setHoja(null)}
                onCobrado={() => refrescar()}
            />
            <HojaFactura
                abierta={hoja === 'factura'} reserva={reserva} factura={factura} anuladas={anuladas}
                onCerrar={() => setHoja(null)}
                onCambio={refrescar}
            />
            <HojaCambiar
                abierta={hoja === 'cambiar'} reserva={reserva} apartamentos={apartamentos} factura={factura}
                onCerrar={() => setHoja(null)}
                onCambiada={refrescar}
            />
            <HojaCancelar
                abierta={hoja === 'cancelar'} reserva={reserva}
                onCerrar={() => setHoja(null)}
                onCancelada={refrescar}
            />
            <HojaNoShow
                abierta={hoja === 'noshow'} reserva={reserva}
                onCerrar={() => setHoja(null)}
                onMarcada={refrescar}
            />
        </div>
    );
};

// ============================================================
// Apuntes suyos sobre esta reserva. No los ve el huésped.
// ============================================================

const NotasInternas = ({ reserva, onGuardado }) => {
    const [texto, setTexto] = useState(reserva.internal_notes || '');
    const [guardando, setGuardando] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => { setTexto(reserva.internal_notes || ''); }, [reserva.internal_notes]);

    const cambiado = (texto || '') !== (reserva.internal_notes || '');

    const guardar = async () => {
        setGuardando(true); setError(null); setGuardado(false);
        try {
            const nuevo = await guardarNotas(reserva.id, texto);
            onGuardado?.(nuevo || '');
            setGuardado(true);
            setTimeout(() => setGuardado(false), 2500);
        } catch (e) { setError(e.message); } finally { setGuardando(false); }
    };

    return (
        <Tarjeta>
            <label htmlFor="notas-reserva" className="block font-bold text-lg text-text-primary mb-1">
                Apuntes tuyos sobre esta reserva
            </label>
            <p className="text-sm text-gray-600 mb-3">Solo los ves tú. El huésped no los ve.</p>
            <textarea
                id="notas-reserva" rows={4} value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Viene con perro. Llega tarde, sobre las 22h."
                className={`${claseInput} min-h-[120px] resize-y`}
            />
            {error && <div className="mt-3"><Aviso tono="urgente" titulo={error} /></div>}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
                <Boton variante="secundario" icono={guardado ? Check : NotebookPen}
                    onClick={guardar} cargando={guardando} disabled={!cambiado && !guardado}>
                    {guardado ? 'Guardado' : 'Guardar los apuntes'}
                </Boton>
            </div>
        </Tarjeta>
    );
};

export default ReservaFicha;

import React, { useEffect, useState, useCallback } from 'react';
import { Euro, ChevronRight, FileText } from 'lucide-react';
import {
    Boton, Tarjeta, Aviso, Cargando, Chip,
    formatoEuro, pendienteDe, canalSiImporta, nombreCanal, fechaCorta,
} from './ui';
import { CifraGrande } from './dinero/ui';
import {
    mesDeHoy, mesEnPalabras, mesesHaciaAtras, limitesDelMes,
    diaMesYAno, nombreForma,
} from './dinero/formato';
import { cargarPendientes, cargarCobrosDelMes, cargarSinFactura } from './dinero/datos';
import HojaCobro from './dinero/HojaCobro';

// ============================================================
// DineroPanel — Dinero (sección 4.5 del plan)
// ============================================================
// Lo que Jesús pidió: que su madre vea claro qué se ha cobrado y qué falta.
//
// Arriba, las dos cifras grandes. Debajo, dos listas:
//   · Pendiente de cobrar — lo que llega antes, primero, con su botón de cobrar.
//   · Cobrado — los apuntes del mes que se esté mirando.
// Y al final, pequeño, "Sin factura": reservas ya cobradas a las que no se
// les ha hecho factura ni se ha marcado que no hace falta, para que la
// lista no engañe.
//
// Las canceladas NUNCA aparecen pidiendo dinero.
// ============================================================

const suma = (lista, de) => Math.round(lista.reduce((t, x) => t + (Number(de(x)) || 0), 0) * 100) / 100;

const DineroPanel = ({ ir }) => {
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [mes, setMes] = useState(mesDeHoy);
    const [pendientes, setPendientes] = useState([]);
    const [cobrosDelMes, setCobrosDelMes] = useState([]);
    const [sinFactura, setSinFactura] = useState([]);
    const [cobrando, setCobrando] = useState(null);   // la reserva de la hoja de cobro

    const cargar = useCallback(async (elMes) => {
        const [p, c, s] = await Promise.all([
            cargarPendientes(),
            cargarCobrosDelMes(limitesDelMes(elMes)),
            cargarSinFactura(),
        ]);
        setPendientes(p); setCobrosDelMes(c); setSinFactura(s);
    }, []);

    useEffect(() => {
        let cortado = false;
        setCargando(true);
        (async () => {
            try { await cargar(mes); }
            catch (e) { if (!cortado) setError(e.message); }
            finally { if (!cortado) setCargando(false); }
        })();
        return () => { cortado = true; };
    }, [mes, cargar]);

    if (cargando) return <Cargando texto="Echando cuentas…" />;
    if (error) return <Aviso tono="urgente" titulo={error} />;

    const totalPendiente = suma(pendientes, pendienteDe);
    const totalCobrado = suma(cobrosDelMes, (c) => c.amount);
    const esteMes = mes === mesDeHoy();

    return (
        <div className="space-y-6">
            {/* ---------- Las dos cifras ---------- */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CifraGrande
                    etiqueta="Pendiente de cobrar" importe={totalPendiente} tono="pendiente"
                    nota={pendientes.length === 0
                        ? 'No falta cobrar nada.'
                        : `De ${pendientes.length} ${pendientes.length === 1 ? 'reserva' : 'reservas'}.`}
                />
                <CifraGrande
                    etiqueta={esteMes ? 'Cobrado este mes' : `Cobrado en ${mesEnPalabras(mes)}`}
                    importe={totalCobrado} tono="cobrado"
                    nota={cobrosDelMes.length === 0
                        ? 'Todavía no hay ningún cobro apuntado.'
                        : `${cobrosDelMes.length} ${cobrosDelMes.length === 1 ? 'cobro' : 'cobros'}.`}
                />
            </section>

            {/* ---------- Pendiente de cobrar ---------- */}
            <section aria-labelledby="pend-t">
                <h2 id="pend-t" className="font-serif text-2xl font-bold text-text-primary mb-1">
                    Pendiente de cobrar
                </h2>
                <p className="text-base text-gray-600 mb-3">Lo que llega antes, primero.</p>

                {pendientes.length === 0 ? (
                    <Tarjeta><p className="text-lg text-text-primary">No falta cobrar nada. Todo al día.</p></Tarjeta>
                ) : (
                    <ul className="space-y-3">
                        {pendientes.map((r) => (
                            <FilaPendiente key={r.id} reserva={r} ir={ir} onCobrar={() => setCobrando(r)} />
                        ))}
                    </ul>
                )}
            </section>

            {/* ---------- Cobrado ---------- */}
            <section aria-labelledby="cob-t">
                <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
                    <div>
                        <h2 id="cob-t" className="font-serif text-2xl font-bold text-text-primary">
                            {esteMes ? 'Cobrado este mes' : `Cobrado en ${mesEnPalabras(mes)}`}
                        </h2>
                        <p className="text-base text-gray-600">Cada vez que te han pagado algo.</p>
                    </div>
                    <label className="shrink-0">
                        <span className="sr-only">Mirar otro mes</span>
                        <select
                            value={mes} onChange={(e) => setMes(e.target.value)}
                            className="min-h-[52px] px-4 text-base font-semibold bg-white border-2 border-gray-200 rounded-2xl text-text-primary focus:border-rural-600 focus-visible:ring-4 focus-visible:ring-rural-600/20 outline-none"
                        >
                            {mesesHaciaAtras(15).map((m) => (
                                <option key={m} value={m}>
                                    {m === mesDeHoy() ? 'Este mes' : mesEnPalabras(m)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {cobrosDelMes.length === 0 ? (
                    <Tarjeta>
                        <p className="text-lg text-text-primary">
                            {esteMes ? 'Este mes todavía no te ha pagado nadie.' : 'Ese mes no hubo cobros.'}
                        </p>
                    </Tarjeta>
                ) : (
                    <Tarjeta className="p-0 overflow-hidden">
                        <ul className="divide-y divide-gray-100">
                            {cobrosDelMes.map((c) => (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => ir('reserva', { reservaId: c.booking_id })}
                                        className="w-full text-left px-5 py-4 min-h-[72px] flex items-center gap-3 hover:bg-rural-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                                    >
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-bold text-lg text-text-primary truncate">
                                                {c.guest_bookings?.guest_name || 'Sin nombre'}
                                            </span>
                                            <span className="block text-base text-gray-600">
                                                {diaMesYAno(c.paid_on)} · {nombreForma(c.method)}
                                            </span>
                                        </span>
                                        <span className={`font-serif font-bold tabular-nums text-2xl shrink-0 ${Number(c.amount) < 0 ? 'text-red-700' : 'text-rural-700'}`}>
                                            {formatoEuro(c.amount)}
                                        </span>
                                        <ChevronRight size={20} className="text-gray-400 shrink-0" aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Tarjeta>
                )}
            </section>

            {/* ---------- Sin factura ---------- */}
            {sinFactura.length > 0 && (
                <section aria-labelledby="sinf-t" className="pt-2">
                    <h2 id="sinf-t" className="text-lg font-bold text-text-primary flex items-center gap-2">
                        <FileText size={20} className="text-gray-500" aria-hidden="true" />
                        Sin factura
                    </h2>
                    <p className="text-sm text-gray-600 mb-3">
                        Ya te han pagado y todavía no les has hecho la factura. Si alguna no la necesita, márcalo en su ficha.
                    </p>
                    <Tarjeta className="p-0 overflow-hidden">
                        <ul className="divide-y divide-gray-100">
                            {sinFactura.map((r) => (
                                <li key={r.id}>
                                    <button
                                        type="button"
                                        onClick={() => ir('reserva', { reservaId: r.id, abrir: 'factura' })}
                                        className="w-full text-left px-5 py-3 min-h-[60px] flex items-center gap-3 hover:bg-rural-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                                    >
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-semibold text-base text-text-primary truncate">
                                                {r.guest_name || 'Sin nombre'}
                                            </span>
                                            <span className="block text-sm text-gray-600">
                                                {fechaCorta(r.check_in)} · {formatoEuro(r.paid_amount)} cobrados
                                            </span>
                                        </span>
                                        <ChevronRight size={20} className="text-gray-400 shrink-0" aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Tarjeta>
                </section>
            )}

            {/* ---------- Hoja de cobro, la misma que en la ficha ---------- */}
            <HojaCobro
                abierta={!!cobrando}
                reserva={cobrando}
                pendiente={cobrando ? pendienteDe(cobrando) : 0}
                onCerrar={() => setCobrando(null)}
                onCobrado={async () => { await cargar(mes); }}
            />
        </div>
    );
};

// ============================================================

const FilaPendiente = ({ reserva, ir, onCobrar }) => {
    const falta = pendienteDe(reserva);
    const deBooking = (reserva.channel || '').toLowerCase() === 'booking';
    const comision = Number(reserva.commission_amount) || 0;
    const neto = Math.max(0, (Number(reserva.total_price) || 0) - comision);

    return (
        <li>
            <Tarjeta>
                <button
                    type="button"
                    onClick={() => ir('reserva', { reservaId: reserva.id })}
                    className="w-full text-left -m-1 p-1 rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                >
                    <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                            <span className="block font-bold text-xl text-text-primary truncate">
                                {reserva.guest_name || 'Sin nombre'}
                            </span>
                            <span className="block text-base text-gray-600 mt-0.5">
                                {reserva.apartamento} · llega el {diaMesYAno(reserva.check_in)}
                            </span>
                        </span>
                        <span className="text-right shrink-0">
                            <span className="block font-serif font-bold tabular-nums text-2xl text-amber-700">
                                {formatoEuro(falta)}
                            </span>
                            <span className="block text-sm text-gray-600">falta</span>
                        </span>
                    </span>
                </button>

                {canalSiImporta(reserva) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Chip tono="azul">Vino por {nombreCanal(reserva)}</Chip>
                        {deBooking && <Chip tono="neutro">Booking te paga {formatoEuro(neto)}</Chip>}
                    </div>
                )}

                {deBooking && reserva.vcc_chargeable_from && (
                    <p className="text-sm text-gray-600 mt-2">
                        Booking paga a partir del {diaMesYAno(reserva.vcc_chargeable_from)}.
                    </p>
                )}

                <div className="mt-4">
                    <Boton ancho icono={Euro} onClick={onCobrar}>Cobrar</Boton>
                </div>
            </Tarjeta>
        </li>
    );
};

export default DineroPanel;

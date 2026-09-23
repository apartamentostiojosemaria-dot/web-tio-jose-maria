import React, { useEffect, useState, useCallback } from 'react';
import { Euro, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import {
    Boton, Tarjeta, Aviso, Cargando, Chip,
    formatoEuro, pendienteDe, canalSiImporta, nombreCanal, fechaCorta, hoyISO,
    loPagaElPortal, netoDelPortal, cuandoPagaElPortal, seCobraConTarjetaDelPortal,
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
// Arriba, tres cifras (auditoría 23-sep: una sola «Pendiente de cobrar»
// mezclaba lo que debe una persona con lo que pagan Booking y Airbnb; de
// 2.688,50 € solo 655 € eran de alguien):
//   · Te tienen que pagar los huéspedes — con su botón de cobrar.
//   · Te pagarán los portales — lo ingresan ellos; plegado, con su fecha.
//   · Cobrado — solo lo que YA ha llegado. Lo apuntado con fecha futura va
//     aparte, «Por llegar».
// Y al final, plegado, "Sin factura": reservas ya cobradas a las que no se
// les ha hecho factura ni se ha marcado que no hace falta.
//
// Las canceladas NUNCA aparecen pidiendo dinero.
// ============================================================

const suma = (lista, de) => Math.round(lista.reduce((t, x) => t + (Number(de(x)) || 0), 0) * 100) / 100;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

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

    const hoy = hoyISO();
    const deHuespedes = pendientes.filter((r) => !loPagaElPortal(r));
    const dePortales = pendientes.filter((r) => loPagaElPortal(r));
    const totalHuespedes = suma(deHuespedes, pendienteDe);
    const totalPortales = suma(dePortales, netoDelPortal);
    const llegados = cobrosDelMes.filter((c) => String(c.paid_on) <= hoy);
    const porLlegar = cobrosDelMes.filter((c) => String(c.paid_on) > hoy);
    const totalCobrado = suma(llegados, (c) => c.amount);
    const esteMes = mes === mesDeHoy();

    return (
        <div className="space-y-6">
            {/* ---------- Las tres cifras ---------- */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CifraGrande
                    etiqueta="Te tienen que pagar los huéspedes" importe={totalHuespedes} tono="pendiente"
                    nota={deHuespedes.length === 0 ? 'Nadie te debe nada.' : `De ${plural(deHuespedes.length, 'reserva', 'reservas')}.`}
                />
                <CifraGrande
                    etiqueta="Te pagarán los portales" importe={totalPortales} tono="neutro"
                    nota={dePortales.length === 0
                        ? 'Ninguno te debe nada.'
                        : `Booking, Airbnb… · ${plural(dePortales.length, 'reserva', 'reservas')}. Al huésped no se le cobra.`}
                />
                <CifraGrande
                    etiqueta={esteMes ? 'Cobrado este mes' : `Cobrado en ${mesEnPalabras(mes)}`}
                    importe={totalCobrado} tono="cobrado"
                    nota={llegados.length === 0
                        ? 'Todavía no ha llegado ningún pago.'
                        : `${plural(llegados.length, 'pago', 'pagos')} que ya han llegado.`}
                />
            </section>

            {/* ---------- Lo que deben los huéspedes ---------- */}
            <section aria-labelledby="pend-t">
                <h2 id="pend-t" className="font-serif text-2xl font-bold text-text-primary mb-1">
                    Te tienen que pagar los huéspedes
                </h2>
                <p className="text-base text-gray-600 mb-3">Lo que llega antes, primero.</p>

                {deHuespedes.length === 0 ? (
                    <Tarjeta><p className="text-lg text-text-primary">Ningún huésped te debe nada. Todo al día.</p></Tarjeta>
                ) : (
                    <ul className="space-y-3">
                        {deHuespedes.map((r) => (
                            <FilaPendiente key={r.id} reserva={r} ir={ir} onCobrar={() => setCobrando(r)} />
                        ))}
                    </ul>
                )}
            </section>

            {/* ---------- Lo que pagan los portales (plegado) ---------- */}
            {dePortales.length > 0 && (
                <Plegable
                    titulo="Te pagarán los portales"
                    resumen={`${plural(dePortales.length, 'reserva', 'reservas')} · ${formatoEuro(totalPortales)}`}
                    explicacion="Lo cobran ellos al huésped y te lo pagan. Solo la tarjeta de Booking la cobras tú, desde su fecha."
                >
                    <ul className="divide-y divide-gray-100">
                        {dePortales.map((r) => (
                            <FilaPortal key={r.id} reserva={r} hoy={hoy} ir={ir} onCobrar={() => setCobrando(r)} />
                        ))}
                    </ul>
                </Plegable>
            )}

            {/* ---------- Cobrado ---------- */}
            <section aria-labelledby="cob-t">
                <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
                    <div>
                        <h2 id="cob-t" className="font-serif text-2xl font-bold text-text-primary">
                            {esteMes ? 'Cobrado este mes' : `Cobrado en ${mesEnPalabras(mes)}`}
                        </h2>
                        <p className="text-base text-gray-600">Cada pago que ya te ha llegado.</p>
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

                {llegados.length === 0 ? (
                    <Tarjeta>
                        <p className="text-lg text-text-primary">
                            {esteMes ? 'Este mes todavía no te ha llegado ningún pago.' : 'Ese mes no hubo cobros.'}
                        </p>
                    </Tarjeta>
                ) : (
                    <ListaCobros cobros={llegados} ir={ir} />
                )}

                {porLlegar.length > 0 && (
                    <div className="mt-4">
                        <p className="text-base font-bold text-text-primary">Por llegar</p>
                        <p className="text-sm text-gray-600 mb-2">
                            Apuntados para un día que todavía no ha llegado. No se cuentan como cobrados.
                        </p>
                        <ListaCobros cobros={porLlegar} ir={ir} porLlegar />
                    </div>
                )}
            </section>

            {/* ---------- Sin factura (plegado) ---------- */}
            {sinFactura.length > 0 && (
                <Plegable
                    icono={FileText}
                    titulo="Sin factura"
                    resumen={`Faltan ${plural(sinFactura.length, 'factura', 'facturas')}`}
                    explicacion="Ya te han pagado y todavía no les has hecho la factura. Si alguna no la necesita, márcalo en su ficha."
                >
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
                </Plegable>
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

/** Una lista que se ve cerrada, con su resumen, y se abre al tocarla. */
const Plegable = ({ titulo, resumen, explicacion, icono: Icono, children }) => (
    <details className="group bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <summary className="list-none cursor-pointer px-5 py-4 min-h-[64px] flex items-center gap-3 hover:bg-rural-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30">
            {Icono && <Icono size={20} className="text-gray-500 shrink-0" aria-hidden="true" />}
            <span className="flex-1 min-w-0">
                <span className="block font-bold text-lg text-text-primary">{titulo}</span>
                <span className="block text-base text-gray-600">{resumen}</span>
            </span>
            <span className="text-sm font-semibold text-rural-700 shrink-0 group-open:hidden">Ver</span>
            <ChevronDown size={22} className="text-gray-400 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        {explicacion && <p className="px-5 pb-3 text-sm text-gray-600">{explicacion}</p>}
        <div className="border-t border-gray-100">{children}</div>
    </details>
);

const ListaCobros = ({ cobros, ir, porLlegar = false }) => (
    <Tarjeta className="p-0 overflow-hidden">
        <ul className="divide-y divide-gray-100">
            {cobros.map((c) => (
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
                        <span className={`font-serif font-bold tabular-nums text-2xl shrink-0 ${
                            porLlegar ? 'text-gray-500' : Number(c.amount) < 0 ? 'text-red-700' : 'text-rural-700'}`}>
                            {formatoEuro(c.amount)}
                        </span>
                        <ChevronRight size={20} className="text-gray-400 shrink-0" aria-hidden="true" />
                    </button>
                </li>
            ))}
        </ul>
    </Tarjeta>
);

/** Una reserva que paga el portal: cuánto, desde cuándo y, si ya toca, el botón. */
const FilaPortal = ({ reserva, hoy, ir, onCobrar }) => {
    const desde = cuandoPagaElPortal(reserva);
    const yaToca = !!desde && desde <= hoy;
    const conTarjeta = seCobraConTarjetaDelPortal(reserva);
    const portal = nombreCanal(reserva) || 'El portal';
    const neto = netoDelPortal(reserva);
    let cuando = '';
    if (desde && conTarjeta) cuando = yaToca ? ' · ya puedes cobrar su tarjeta' : ` · su tarjeta, desde el ${diaMesYAno(desde)}`;
    else if (desde) cuando = ` · te lo ingresa hacia el ${diaMesYAno(desde)}`;

    return (
        <li className="px-5 py-4">
            <button type="button" onClick={() => ir('reserva', { reservaId: reserva.id })}
                className="w-full text-left rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30">
                <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                        <span className="block font-bold text-lg text-text-primary truncate">{reserva.guest_name || 'Sin nombre'}</span>
                        <span className="block text-base text-gray-600">{reserva.apartamento} · llega el {diaMesYAno(reserva.check_in)}</span>
                        <span className="block text-sm text-gray-600 mt-0.5">{portal} te paga {formatoEuro(neto)}{cuando}</span>
                    </span>
                    <span className="font-serif font-bold tabular-nums text-xl text-blue-900 shrink-0">{formatoEuro(neto)}</span>
                </span>
            </button>
            {yaToca && (
                <div className="mt-3">
                    <Boton ancho variante="secundario" icono={Euro} onClick={onCobrar}>
                        {conTarjeta ? `Cobrar la tarjeta de ${portal}` : `Ya te ha pagado ${portal}: apuntarlo`}
                    </Boton>
                </div>
            )}
        </li>
    );
};

/** Lo que debe un huésped, con su botón de cobrar. */
const FilaPendiente = ({ reserva, ir, onCobrar }) => {
    const falta = pendienteDe(reserva);

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
                                {reserva.apartamento} · {reserva.check_out < hoyISO() ? 'estuvo' : 'llega'} el {diaMesYAno(reserva.check_in)}
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
                    </div>
                )}

                <div className="mt-4">
                    <Boton ancho icono={Euro} onClick={onCobrar}>Cobrar</Boton>
                </div>
            </Tarjeta>
        </li>
    );
};

export default DineroPanel;

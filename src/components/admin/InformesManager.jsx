import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { logError } from '../../utils/logger';
import {
    BarChart3, ChevronLeft, ChevronRight, Download, RefreshCw, Info, AlertTriangle,
} from 'lucide-react';

// Informes del mes — pantalla de Jesús (panel completo), no de la madre.
// Sustituye a la antigua «Estadísticas» (reservas totales con canceladas y
// pruebas dentro, sin canal ni comisión). Lee v_informe_mes / v_informe_serie
// (migración 0025): ocupación, entradas, cancelaciones, viajeros,
// pernoctaciones e ingresos brutos / comisión / netos, por apartamento y por
// canal, prorrateados por noche. Comparativa con el mes anterior y con el
// mismo mes del año pasado cuando hay datos; cuando no los hay, lo dice.

const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const eur = (v) => (v === null || v === undefined ? '—'
    : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v)));
const eur2 = (v) => (v === null || v === undefined ? '—'
    : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(v)));
const pct = (v) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`);
const num = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-ES'));

const mesActual = () => {
    const hoy = new Date();
    return { year: hoy.getFullYear(), month: hoy.getMonth() + 1 };
};
const ymd = (y, m, d = 1) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const etiquetaMes = (isoMes) => {
    const [y, m] = String(isoMes).slice(0, 7).split('-');
    return `${MESES[Number(m) - 1].slice(0, 3)} ${y.slice(2)}`;
};

/* Diferencia contra otro periodo. Sin datos en el otro periodo → «sin datos», no 0. */
const Delta = ({ actual, previo, formato = num, label }) => {
    if (previo === null || previo === undefined || actual === null || actual === undefined) {
        return <span className="text-[11px] text-gray-400">{label}: sin datos</span>;
    }
    const diff = Number(actual) - Number(previo);
    const color = diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-700' : 'text-gray-500';
    const signo = diff > 0 ? '+' : '';
    return (
        <span className={`text-[11px] font-semibold ${color}`} title={`${label}: ${formato(previo)}`}>
            {label}: {signo}{formato(diff)}
        </span>
    );
};

const Tarjeta = ({ titulo, valor, sub, deltas }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{titulo}</p>
        <p className="text-2xl font-bold tabular-nums text-text-primary mt-1">{valor}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        {deltas && <div className="flex flex-col gap-0.5 mt-2">{deltas}</div>}
    </div>
);

const Th = ({ children, right = true, title }) => (
    <th title={title} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
        {children}
    </th>
);
const Td = ({ children, right = true, strong = false, muted = false }) => (
    <td className={`px-3 py-2 tabular-nums whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${strong ? 'font-bold' : ''} ${muted ? 'text-gray-400' : ''}`}>
        {children}
    </td>
);

const InformesManager = () => {
    const [{ year, month }, setPeriodo] = useState(mesActual());
    const [filas, setFilas] = useState([]);       // v_informe_mes del mes elegido
    const [serie, setSerie] = useState([]);       // 13 meses hasta el elegido
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const desde = ymd(year - 1, month);
            const hasta = ymd(year, month);
            const [mesRes, serieRes] = await Promise.all([
                supabase.rpc('v_informe_mes', { p_year: year, p_month: month }),
                supabase.rpc('v_informe_serie', { p_desde: desde, p_hasta: hasta }),
            ]);
            if (mesRes.error) throw mesRes.error;
            if (serieRes.error) throw serieRes.error;
            setFilas(mesRes.data || []);
            setSerie(serieRes.data || []);
        } catch (e) {
            logError('InformesManager', e);
            setError(e.message || 'No se pudo cargar el informe.');
        } finally {
            setLoading(false);
        }
    }, [year, month]);

    useEffect(() => { cargar(); }, [cargar]);

    const irA = (delta) => {
        const d = new Date(year, month - 1 + delta, 1);
        setPeriodo({ year: d.getFullYear(), month: d.getMonth() + 1 });
    };

    const total = useMemo(() => filas.find((f) => f.nivel === 'total') || null, [filas]);
    const porApto = useMemo(() => filas.filter((f) => f.nivel === 'apartamento'), [filas]);
    const porCanal = useMemo(() => filas.filter((f) => f.nivel === 'canal'), [filas]);

    // Mes anterior y mismo mes del año pasado, sacados de la serie (13 meses).
    const { mesAnterior, anioAnterior } = useMemo(() => {
        const clave = (y, m) => ymd(y, m);
        const dPrev = new Date(year, month - 2, 1);
        const buscar = (k) => serie.find((s) => String(s.mes).slice(0, 10) === k) || null;
        const conDatos = (s) => (s && (s.noches_ocupadas > 0 || s.entradas > 0 || s.cancelaciones > 0) ? s : null);
        return {
            mesAnterior: conDatos(buscar(clave(dPrev.getFullYear(), dPrev.getMonth() + 1))),
            anioAnterior: conDatos(buscar(clave(year - 1, month))),
        };
    }, [serie, year, month]);

    const tasaCancel = (f) => {
        if (!f) return null;
        const base = Number(f.entradas) + Number(f.cancelaciones);
        return base > 0 ? (100 * Number(f.cancelaciones)) / base : null;
    };

    const exportarCSV = () => {
        const n = (v) => (v === null || v === undefined ? '' : String(Number(v).toFixed(2)).replace('.', ','));
        const t = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
        const cab = ['Nivel', 'Nombre', 'Noches disponibles', 'Noches ocupadas', 'Noches canal sin datos', 'Ocupación %',
            'Entradas', 'Cancelaciones', 'Viajeros', 'Pernoctaciones', 'Ingresos brutos', 'Comisión', 'Ingresos netos',
            'Precio medio noche', 'Estancia media'];
        const lineas = [
            [t(`Informe ${MESES[month - 1]} ${year}`)].join(';'),
            cab.join(';'),
            ...filas.map((f) => [
                t(f.nivel), t(f.nombre), f.noches_disponibles ?? '', f.noches_ocupadas, f.noches_canal, n(f.ocupacion_pct),
                f.entradas, f.cancelaciones, f.viajeros, f.pernoctaciones, n(f.ingresos_brutos), n(f.comision), n(f.ingresos_netos),
                n(f.precio_medio_noche), n(f.estancia_media),
            ].join(';')),
            '',
            [t('Serie mensual'), 'Noches disponibles', 'Noches ocupadas', 'Noches canal', 'Ocupación %', 'Entradas', 'Cancelaciones',
                'Viajeros', 'Pernoctaciones', 'Ingresos brutos', 'Comisión', 'Ingresos netos', 'Precio medio noche'].join(';'),
            ...serie.map((s) => [
                t(String(s.mes).slice(0, 7)), s.noches_disponibles, s.noches_ocupadas, s.noches_canal, n(s.ocupacion_pct), s.entradas,
                s.cancelaciones, s.viajeros, s.pernoctaciones, n(s.ingresos_brutos), n(s.comision), n(s.ingresos_netos), n(s.precio_medio_noche),
            ].join(';')),
        ];
        // BOM + ; para que Excel en español lo abra sin retoques.
        const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `informe-tio-jose-maria-${year}-${String(month).padStart(2, '0')}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const Selector = (
        <div className="flex items-center gap-2">
            <button onClick={() => irA(-1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50" aria-label="Mes anterior">
                <ChevronLeft size={16} />
            </button>
            <select value={month} onChange={(e) => setPeriodo({ year, month: Number(e.target.value) })}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white capitalize" aria-label="Mes">
                {MESES.map((m, i) => <option key={m} value={i + 1} className="capitalize">{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setPeriodo({ year: Number(e.target.value), month })}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white" aria-label="Año">
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => irA(1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50" aria-label="Mes siguiente">
                <ChevronRight size={16} />
            </button>
            <button onClick={cargar} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50" aria-label="Recalcular" title="Recalcular">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
        </div>
    );

    const sinDatos = !loading && total && total.noches_ocupadas === 0 && total.noches_canal === 0 && total.entradas === 0 && total.cancelaciones === 0;

    return (
        <div>
            <header className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <BarChart3 size={28} className="text-primary" />
                    <h1 className="text-3xl font-serif font-bold text-text-primary">Informes del mes</h1>
                </div>
                <p className="text-gray-500">
                    Ocupación, entradas, cancelaciones e ingresos por apartamento y por canal. Ingresos y comisión repartidos
                    por noche: una estancia a caballo entre dos meses cuenta en los dos. Sin reservas de prueba ni cierres.
                </p>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                {Selector}
                <button onClick={exportarCSV} disabled={!filas.length}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                    <Download size={15} /> Exportar CSV
                </button>
            </div>

            {error && (
                <div className="mb-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
                </div>
            )}

            {loading && !total ? (
                <div className="animate-pulse space-y-3">
                    <div className="h-24 bg-gray-100 rounded-2xl" /><div className="h-64 bg-gray-100 rounded-2xl" />
                </div>
            ) : total && (
                <>
                    {/* ---- Los números del mes ---- */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                        <Tarjeta titulo="Ocupación" valor={pct(total.ocupacion_pct)}
                            sub={`${num(total.noches_ocupadas + total.noches_canal)} de ${num(total.noches_disponibles)} noches`}
                            deltas={<>
                                <Delta actual={total.ocupacion_pct} previo={mesAnterior?.ocupacion_pct} formato={pct} label="mes ant." />
                                <Delta actual={total.ocupacion_pct} previo={anioAnterior?.ocupacion_pct} formato={pct} label="año ant." />
                            </>} />
                        <Tarjeta titulo="Ingresos netos" valor={eur(total.ingresos_netos)}
                            sub={`${eur(total.ingresos_brutos)} brutos · ${eur(total.comision)} comisión`}
                            deltas={<>
                                <Delta actual={total.ingresos_netos} previo={mesAnterior?.ingresos_netos} formato={eur} label="mes ant." />
                                <Delta actual={total.ingresos_netos} previo={anioAnterior?.ingresos_netos} formato={eur} label="año ant." />
                            </>} />
                        <Tarjeta titulo="Entradas · cancelaciones" valor={`${num(total.entradas)} · ${num(total.cancelaciones)}`}
                            sub={tasaCancel(total) === null ? 'sin reservas con entrada este mes' : `${pct(tasaCancel(total))} de las que entraban se cancelaron`}
                            deltas={<>
                                <Delta actual={total.entradas} previo={mesAnterior?.entradas} label="entradas, mes ant." />
                                <Delta actual={total.entradas} previo={anioAnterior?.entradas} label="entradas, año ant." />
                            </>} />
                        <Tarjeta titulo="Precio medio por noche" valor={eur2(total.precio_medio_noche)}
                            sub={total.estancia_media ? `estancia media ${num(total.estancia_media)} noches` : 'sin entradas este mes'}
                            deltas={<>
                                <Delta actual={total.precio_medio_noche} previo={mesAnterior?.precio_medio_noche} formato={eur2} label="mes ant." />
                                <Delta actual={total.precio_medio_noche} previo={anioAnterior?.precio_medio_noche} formato={eur2} label="año ant." />
                            </>} />
                        <Tarjeta titulo="Viajeros · pernoctaciones" valor={`${num(total.viajeros)} · ${num(total.pernoctaciones)}`}
                            sub={total.noches_canal > 0 ? `+ ${num(total.noches_canal)} noches de canal sin datos de personas` : 'personas que entran · personas × noches'}
                            deltas={<>
                                <Delta actual={total.pernoctaciones} previo={mesAnterior?.pernoctaciones} label="pernoct., mes ant." />
                                <Delta actual={total.pernoctaciones} previo={anioAnterior?.pernoctaciones} label="pernoct., año ant." />
                            </>} />
                    </div>

                    {sinDatos && (
                        <div className="mb-6 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <Info size={16} className="mt-0.5 shrink-0" />
                            Este mes no tiene ni una noche ocupada ni una reserva con entrada. Si es un mes pasado, lo más probable es que
                            las estancias vivieran solo en MisterPlan o en Airbnb y no se hayan traído al sistema.
                        </div>
                    )}

                    {/* ---- Por apartamento ---- */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-x-auto">
                        <div className="px-4 pt-4 pb-2">
                            <h2 className="font-serif font-bold text-lg text-text-primary">Por apartamento</h2>
                        </div>
                        <table className="min-w-full text-sm">
                            <thead className="border-b border-gray-100">
                                <tr>
                                    <Th right={false}>Apartamento</Th>
                                    <Th title="Noches del mes menos las cerradas">Disponibles</Th>
                                    <Th title="Con reserva propia (+ noches de canal sin reserva detrás)">Ocupadas</Th>
                                    <Th>Ocupación</Th>
                                    <Th>Entradas</Th>
                                    <Th>Cancel.</Th>
                                    <Th>Viajeros</Th>
                                    <Th>Pernoct.</Th>
                                    <Th>Brutos</Th>
                                    <Th>Comisión</Th>
                                    <Th>Netos</Th>
                                    <Th>€/noche</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {porApto.map((f) => (
                                    <tr key={f.clave} className="border-b border-gray-50 hover:bg-gray-50/60">
                                        <Td right={false} strong>{f.nombre}</Td>
                                        <Td>{num(f.noches_disponibles)}</Td>
                                        <Td>{num(f.noches_ocupadas)}{f.noches_canal > 0 && <span className="text-gray-400"> +{num(f.noches_canal)}</span>}</Td>
                                        <Td strong>{pct(f.ocupacion_pct)}</Td>
                                        <Td>{num(f.entradas)}</Td>
                                        <Td muted={!f.cancelaciones}>{num(f.cancelaciones)}</Td>
                                        <Td>{num(f.viajeros)}</Td>
                                        <Td>{num(f.pernoctaciones)}</Td>
                                        <Td>{eur2(f.ingresos_brutos)}</Td>
                                        <Td muted={!Number(f.comision)}>{eur2(f.comision)}</Td>
                                        <Td strong>{eur2(f.ingresos_netos)}</Td>
                                        <Td>{eur2(f.precio_medio_noche)}</Td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-50 font-bold">
                                    <Td right={false} strong>Total</Td>
                                    <Td>{num(total.noches_disponibles)}</Td>
                                    <Td>{num(total.noches_ocupadas)}{total.noches_canal > 0 && <span className="text-gray-400"> +{num(total.noches_canal)}</span>}</Td>
                                    <Td strong>{pct(total.ocupacion_pct)}</Td>
                                    <Td>{num(total.entradas)}</Td>
                                    <Td>{num(total.cancelaciones)}</Td>
                                    <Td>{num(total.viajeros)}</Td>
                                    <Td>{num(total.pernoctaciones)}</Td>
                                    <Td>{eur2(total.ingresos_brutos)}</Td>
                                    <Td>{eur2(total.comision)}</Td>
                                    <Td strong>{eur2(total.ingresos_netos)}</Td>
                                    <Td>{eur2(total.precio_medio_noche)}</Td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ---- Por canal ---- */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-x-auto">
                        <div className="px-4 pt-4 pb-2 flex items-baseline justify-between gap-3 flex-wrap">
                            <h2 className="font-serif font-bold text-lg text-text-primary">Por canal</h2>
                            <p className="text-xs text-gray-500">Comisión: la apuntada en cada reserva (Booking). Airbnb por iCal llega sin importe: noches sí, dinero no.</p>
                        </div>
                        {porCanal.length === 0 ? (
                            <p className="px-4 pb-4 text-sm text-gray-500">Sin reservas este mes.</p>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead className="border-b border-gray-100">
                                    <tr>
                                        <Th right={false}>Canal</Th>
                                        <Th>Noches</Th>
                                        <Th>Entradas</Th>
                                        <Th>Cancel.</Th>
                                        <Th title="Cancelaciones sobre entradas + cancelaciones">Tasa cancel.</Th>
                                        <Th>Viajeros</Th>
                                        <Th>Pernoct.</Th>
                                        <Th>Brutos</Th>
                                        <Th>Comisión</Th>
                                        <Th>Netos</Th>
                                        <Th>€/noche</Th>
                                        <Th>Estancia media</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {porCanal.map((f) => (
                                        <tr key={f.clave} className="border-b border-gray-50 hover:bg-gray-50/60">
                                            <Td right={false} strong>{f.nombre}</Td>
                                            <Td>{num(f.noches_ocupadas)}{f.noches_canal > 0 && <span className="text-gray-400"> +{num(f.noches_canal)}</span>}</Td>
                                            <Td>{num(f.entradas)}</Td>
                                            <Td muted={!f.cancelaciones}>{num(f.cancelaciones)}</Td>
                                            <Td muted={tasaCancel(f) === null}>{pct(tasaCancel(f))}</Td>
                                            <Td>{num(f.viajeros)}</Td>
                                            <Td>{num(f.pernoctaciones)}</Td>
                                            <Td>{eur2(f.ingresos_brutos)}</Td>
                                            <Td muted={!Number(f.comision)}>{eur2(f.comision)}</Td>
                                            <Td strong>{eur2(f.ingresos_netos)}</Td>
                                            <Td>{eur2(f.precio_medio_noche)}</Td>
                                            <Td>{num(f.estancia_media)}</Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* ---- Serie 13 meses ---- */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-x-auto">
                        <div className="px-4 pt-4 pb-2">
                            <h2 className="font-serif font-bold text-lg text-text-primary">Mes a mes (últimos 13)</h2>
                        </div>
                        <table className="min-w-full text-sm">
                            <thead className="border-b border-gray-100">
                                <tr>
                                    <Th right={false}>Mes</Th>
                                    <Th>Ocupación</Th>
                                    <Th>Noches</Th>
                                    <Th>Entradas</Th>
                                    <Th>Cancel.</Th>
                                    <Th>Pernoct.</Th>
                                    <Th>Brutos</Th>
                                    <Th>Comisión</Th>
                                    <Th>Netos</Th>
                                    <Th>€/noche</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {serie.map((s) => {
                                    const esElMes = String(s.mes).slice(0, 7) === ymd(year, month).slice(0, 7);
                                    const vacio = !s.noches_ocupadas && !s.noches_canal && !s.entradas && !s.cancelaciones;
                                    return (
                                        <tr key={String(s.mes)} className={`border-b border-gray-50 ${esElMes ? 'bg-primary/5 font-semibold' : ''} ${vacio ? 'text-gray-400' : ''}`}>
                                            <Td right={false} strong={esElMes}>{etiquetaMes(s.mes)}</Td>
                                            {vacio ? (
                                                // Un mes sin nada no es un mes a cero: casi seguro no está traído al sistema.
                                                <td colSpan={9} className="px-3 py-2 text-left text-gray-400">sin datos</td>
                                            ) : (<>
                                                <Td>{pct(s.ocupacion_pct)}</Td>
                                                <Td>{num(s.noches_ocupadas)}{s.noches_canal > 0 && <span className="text-gray-400"> +{num(s.noches_canal)}</span>}</Td>
                                                <Td>{num(s.entradas)}</Td>
                                                <Td>{num(s.cancelaciones)}</Td>
                                                <Td>{num(s.pernoctaciones)}</Td>
                                                <Td>{eur(s.ingresos_brutos)}</Td>
                                                <Td>{eur(s.comision)}</Td>
                                                <Td strong>{eur(s.ingresos_netos)}</Td>
                                                <Td>{eur2(s.precio_medio_noche)}</Td>
                                            </>)}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <p className="px-4 py-3 text-xs text-gray-500">
                            Lo anterior a septiembre de 2026 viene de los avisos de MisterPlan (solo Booking); las estancias de Airbnb
                            de esos meses no están. «Sin datos» es un mes que no está traído al sistema, no un mes a cero.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};

export default InformesManager;

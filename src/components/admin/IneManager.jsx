import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { logError } from '../../utils/logger';
import {
    ClipboardList, ChevronLeft, ChevronRight, Copy, Check, Download,
    AlertTriangle, ExternalLink, Info, RefreshCw, Table2,
} from 'lucide-react';

// Panel del INE — Encuesta de Ocupación en Alojamientos de Turismo Rural (EOTR).
// Es una pantalla NUESTRA (rol admin), no de la madre: aquí sí cabe la jerga.
// Cuestionario de referencia: Mod. EOTR-21 (ine.es/daco/daco42/ocuptr/eotr_21.pdf).
// Depende de supabase/migrations/_pendiente_ine.sql. Si no está aplicado,
// la pantalla lo dice en lugar de fallar en silencio.

const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const IRIA_URL = 'https://iria.ine.es';
const CUESTIONARIO_URL = 'https://www.ine.es/daco/daco42/ocuptr/eotr_21.pdf';
const METODOLOGIA_URL = 'https://www.ine.es/daco/daco42/ocuptr/meto_eotr.pdf';

// Mes de referencia por defecto: el que acaba de terminar (es el que toca enviar).
const mesAnterior = () => {
    const hoy = new Date();
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

// Fecha límite: 5 días naturales siguientes al mes de referencia.
const fechaLimite = (year, month) => new Date(year, month, 5);

const nf = (v) => (v === null || v === undefined ? '—' : String(v));
const nf2 = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-ES'));

/* ------------------------------------------------------------------ */
/* Valor con botón de copiar                                           */
/* ------------------------------------------------------------------ */

const CopyValue = ({ value, suffix = '', size = 'md' }) => {
    const [copied, setCopied] = useState(false);
    const texto = value === null || value === undefined ? '' : String(value);

    const copiar = async () => {
        if (!texto) return;
        try {
            await navigator.clipboard.writeText(texto);
        } catch {
            // Navegadores sin permiso de portapapeles: selección manual.
            const ta = document.createElement('textarea');
            ta.value = texto;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch { /* nada que hacer */ }
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
    };

    return (
        <button
            type="button"
            onClick={copiar}
            disabled={!texto}
            title={texto ? `Copiar ${texto}` : 'Sin valor'}
            className={`group inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 -mx-2
                        hover:bg-primary/10 disabled:hover:bg-transparent disabled:cursor-default
                        transition-colors ${size === 'lg' ? 'text-2xl font-bold' : 'text-sm font-semibold'}`}
        >
            <span className="tabular-nums text-text-primary">{nf2(value)}{suffix}</span>
            {copied
                ? <Check size={size === 'lg' ? 16 : 13} className="text-green-600" />
                : <Copy size={size === 'lg' ? 16 : 13} className="text-gray-300 group-hover:text-primary" />}
        </button>
    );
};

/* ------------------------------------------------------------------ */
/* Ficha de una casilla del cuestionario                               */
/* ------------------------------------------------------------------ */

const Casilla = ({ apartado, label, value, suffix = '', nota, manual }) => (
    <div className={`bg-white p-5 rounded-2xl border ${manual ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100'} shadow-sm`}>
        <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[10px] font-bold tracking-widest uppercase text-primary">{apartado}</span>
            {manual && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    a mano
                </span>
            )}
        </div>
        <p className="text-sm text-gray-600 mb-2 leading-snug">{label}</p>
        {manual
            ? <p className="text-lg font-bold text-amber-700">No sale del sistema</p>
            : <CopyValue value={value} suffix={suffix} size="lg" />}
        {nota && <p className="text-xs text-gray-400 mt-2 leading-snug">{nota}</p>}
    </div>
);

/* ------------------------------------------------------------------ */
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

const IneManager = () => {
    const inicial = mesAnterior();
    const [year, setYear] = useState(inicial.year);
    const [month, setMonth] = useState(inicial.month);

    const [loading, setLoading] = useState(true);
    const [faltaVista, setFaltaVista] = useState(false);
    const [error, setError] = useState(null);

    const [resumen, setResumen] = useState(null);
    const [residencia, setResidencia] = useState([]);
    const [detalle, setDetalle] = useState([]);
    const [verDetalle, setVerDetalle] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        setFaltaVista(false);
        try {
            const args = { p_year: year, p_month: month };
            const [r1, r2, r3] = await Promise.all([
                supabase.rpc('v_ine_mes', args),
                supabase.rpc('v_ine_mes_residencia', args),
                supabase.rpc('v_ine_mes_detalle', args),
            ]);

            // La vista todavía no está aplicada en la base: decirlo, no fingir ceros.
            const noExiste = [r1, r2, r3].some(
                (r) => r.error && /does not exist|could not find|schema cache/i.test(r.error.message || '')
            );
            if (noExiste) { setFaltaVista(true); return; }

            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;
            if (r3.error) throw r3.error;

            setResumen(Array.isArray(r1.data) ? r1.data[0] : r1.data);
            setResidencia(r2.data || []);
            setDetalle(r3.data || []);
        } catch (e) {
            logError('IneManager', e);
            setError(e.message || 'No se han podido calcular los datos del INE.');
        } finally {
            setLoading(false);
        }
    }, [year, month]);

    useEffect(() => { cargar(); }, [cargar]);

    const irA = (delta) => {
        const d = new Date(year, month - 1 + delta, 1);
        setYear(d.getFullYear());
        setMonth(d.getMonth() + 1);
    };

    const etiquetaMes = `${MESES[month - 1]} de ${year}`;

    const limite = fechaLimite(year, month);
    const vencido = new Date() > limite;

    // Suma de control: el apartado 6 tiene que cuadrar con el total.
    const sumaResidencia = useMemo(() => residencia.reduce(
        (acc, r) => ({
            viajeros: acc.viajeros + (r.viajeros || 0),
            pernoctaciones: acc.pernoctaciones + (r.pernoctaciones || 0),
        }), { viajeros: 0, pernoctaciones: 0 }
    ), [residencia]);

    const sinDeterminar = residencia.find((r) => r.orden === 999);

    const cuadra = resumen
        && sumaResidencia.viajeros === resumen.viajeros_entrados
        && sumaResidencia.pernoctaciones === resumen.pernoctaciones;

    /* ---------------- Export CSV ---------------- */

    const exportarCSV = () => {
        if (!resumen) return;
        const esc = (v) => {
            const s = v === null || v === undefined ? '' : String(v);
            return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const fila = (...c) => c.map(esc).join(';');

        const lineas = [
            fila(`INE - Encuesta de ocupacion en alojamientos de turismo rural (Mod. EOTR-21)`),
            fila(`Establecimiento`, 'Apartamentos Rurales Tio Jose Maria - Hinojares (Jaen) - VTAR/JA/00044'),
            fila(`Mes de referencia`, etiquetaMes),
            fila(`Generado`, new Date().toLocaleString('es-ES')),
            '',
            fila('Apartado', 'Casilla', 'Concepto', 'Valor'),
            fila('2', '', 'Dias que ha estado abierto el establecimiento', resumen.dias_abiertos),
            fila('3', '', 'N. de alojamientos independientes', resumen.num_alojamientos),
            fila('3', '', 'Modalidad de alquiler', '3.2 Uso completo (vivienda completa)'),
            fila('4.2', '', 'Total mensual de alojamientos independientes ocupados', resumen.alojamientos_ocupados_total),
            fila('4.2', 'desglose', '  de los cuales, por reservas propias', resumen.alojamientos_ocupados_reservas),
            fila('4.2', 'desglose', '  de los cuales, por bloqueos de canal (sin datos de huesped)', resumen.alojamientos_ocupados_canal),
            fila('4.3', '', 'Plazas supletorias utilizadas', 'A MANO - el sistema no las registra'),
            fila('5', '', 'Personal ocupado (no remunerado / fijo / eventual)', 'A MANO - el sistema no lo registra'),
            fila('6', 'Total', 'Entrada de viajeros', resumen.viajeros_entrados),
            fila('6', 'Total', 'Pernoctaciones', resumen.pernoctaciones),
            fila('6.1', '', 'Pernoctaciones en fin de semana (viernes y sabado)', resumen.pernoctaciones_fin_semana),
            fila('7.2', '', 'Precio medio/dia tarifa normal (domingo a jueves), sin IVA', resumen.precio_medio_normal),
            fila('7.2', '', 'Precio medio/dia tarifa fin de semana, sin IVA', resumen.precio_medio_fin_semana),
            fila('7.2', '', '% alojamientos ocupados tarifa normal', resumen.pct_ocupados_normal),
            fila('7.2', '', '% alojamientos ocupados tarifa fin de semana', resumen.pct_ocupados_fin_semana),
            '',
            fila('Apartado 6 - Entrada de viajeros y pernoctaciones por lugar de residencia'),
            fila('Casilla', 'Ambito', 'Lugar de residencia', 'Entrada de viajeros', 'Pernoctaciones'),
            ...residencia.map((r) => fila(r.casilla, r.ambito, r.grupo, r.viajeros, r.pernoctaciones)),
            '',
            fila('Control (no son casillas del cuestionario)'),
            fila('', '', 'Plazas del establecimiento', resumen.plazas),
            fila('', '', 'Dias del mes', resumen.dias_del_mes),
            fila('', '', 'Grado de ocupacion por plazas (%)', resumen.grado_ocupacion_plazas),
            fila('', '', 'Grado de ocupacion por alojamientos (%)', resumen.grado_ocupacion_alojamientos),
            fila('', '', 'Estancia media (noches)', resumen.estancia_media),
            fila('', '', 'Noches de canal sin datos de huesped', resumen.noches_canal_sin_viajeros),
            fila('', '', 'Viajeros sin parte de viajeros relleno', resumen.viajeros_sin_residencia),
            '',
            fila('Detalle del mes'),
            fila('Origen', 'Referencia', 'Apartamento', 'Huesped', 'Entrada', 'Salida',
                'Personas', 'Noches en el mes', 'Entra en el mes', 'Pernoctaciones', 'Partes', 'Residencia'),
            ...detalle.map((d) => fila(
                d.origen, d.referencia, d.apartamento, d.huesped, d.entrada, d.salida,
                d.personas, d.noches_en_el_mes, d.entra_en_el_mes ? 'Si' : 'No',
                d.pernoctaciones, d.partes_rellenos, d.residencia
            )),
        ];

        // BOM para que Excel en español abra los acentos y el ; sin retoques.
        const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ine-eotr-${year}-${String(month).padStart(2, '0')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /* ---------------- Render ---------------- */

    const Selector = (
        <div className="flex items-center gap-2">
            <button onClick={() => irA(-1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50" aria-label="Mes anterior">
                <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white capitalize"
                    aria-label="Mes">
                    {MESES.map((m, i) => <option key={m} value={i + 1} className="capitalize">{m}</option>)}
                </select>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white"
                    aria-label="Año">
                    {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 5 + i)
                        .map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <button onClick={() => irA(1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50" aria-label="Mes siguiente">
                <ChevronRight size={16} />
            </button>
            <button onClick={cargar} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50" aria-label="Recalcular" title="Recalcular">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
        </div>
    );

    return (
        <div>
            <header className="mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <ClipboardList size={28} className="text-primary" />
                    <h1 className="text-3xl font-serif font-bold text-text-primary">INE — Encuesta mensual</h1>
                </div>
                <p className="text-gray-500">
                    Encuesta de Ocupación en Alojamientos de Turismo Rural (Mod. EOTR-21). Se rellena en IRIA
                    casilla por casilla con los números de abajo.
                </p>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                {Selector}
                <div className="flex items-center gap-2">
                    <button onClick={exportarCSV} disabled={!resumen}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold
                                   hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Download size={15} /> Exportar CSV
                    </button>
                    <a href={IRIA_URL} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50">
                        Abrir IRIA <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            {/* Plazo */}
            <div className={`mb-6 rounded-2xl px-5 py-3 text-sm border ${vencido
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                Mes de referencia: <strong className="capitalize">{etiquetaMes}</strong>. Plazo de envío:{' '}
                <strong>5 días naturales</strong> desde que acaba el mes, es decir hasta el{' '}
                <strong>{limite.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                {vencido && ' Ese plazo ya ha pasado.'}
            </div>

            {faltaVista && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-900">
                            <p className="font-bold mb-1">El cálculo todavía no está en la base de datos.</p>
                            <p>
                                Falta aplicar <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">
                                supabase/migrations/_pendiente_ine.sql</code>. Hasta entonces esta pantalla no puede
                                dar ningún número — y no se va a inventar ninguno.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {error && !faltaVista && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 text-sm text-red-800">
                    <strong>No se ha podido calcular:</strong> {error}
                </div>
            )}

            {loading && !faltaVista && (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary" />
                </div>
            )}

            {!loading && !faltaVista && resumen && (
                <>
                    {/* ---- Avisos de lo que NO sale del sistema ---- */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-900 space-y-2">
                                <p className="font-bold">Antes de enviar, mira esto. No todo sale del sistema.</p>
                                <ul className="list-disc pl-5 space-y-1.5">
                                    <li>
                                        <strong>Apartado 5, personal ocupado</strong>: el sistema no lleva nóminas ni
                                        horas. Se pone a mano (personal no remunerado / remunerado fijo / eventual).
                                    </li>
                                    <li>
                                        <strong>Apartado 4.3, plazas supletorias</strong>: no se registran las camas
                                        supletorias ni las cunas. Si se han usado, se suman a mano.
                                    </li>
                                    {resumen.noches_canal_sin_viajeros > 0 && (
                                        <li className="text-red-800">
                                            <strong>{nf2(resumen.noches_canal_sin_viajeros)} noches de apartamento vienen de
                                            un canal (Airbnb) como bloqueo mudo</strong>: ocupan el alojamiento pero llegan
                                            sin nombre ni nº de personas. Están contadas en el apartado 4.2 y{' '}
                                            <strong>no</strong> en viajeros ni en pernoctaciones. Si se envía tal cual,
                                            el INE verá apartamentos ocupados con cero personas durmiendo. Hay que sacar
                                            de Airbnb cuántas personas y de dónde eran, y sumarlas al apartado 6.
                                        </li>
                                    )}
                                    {resumen.viajeros_sin_residencia > 0 && (
                                        <li>
                                            <strong>{nf2(resumen.viajeros_sin_residencia)} viajeros sin parte de viajeros
                                            relleno</strong>: caen en la fila «Sin determinar», que{' '}
                                            <strong>no existe en el cuestionario</strong>. Hay que repartirlos entre las
                                            casillas reales antes de enviar.
                                        </li>
                                    )}
                                    <li>
                                        Los <strong>precios del apartado 7.2</strong> salen del precio realmente aplicado
                                        en las reservas del mes, sin IVA prorrateado. Si el mes no tuvo reservas propias,
                                        vienen vacíos y hay que poner la tarifa de catálogo.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* ---- Casillas de establecimiento ---- */}
                    <h2 className="font-serif font-bold text-lg text-text-primary mb-3">Casillas del cuestionario</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        <Casilla apartado="Apdo 2" label="Días que ha estado abierto el establecimiento en el mes"
                            value={resumen.dias_abiertos}
                            nota={`El mes tiene ${resumen.dias_del_mes} días. Solo se descuenta un día si están cerrados los ${resumen.num_alojamientos} apartamentos a la vez.`} />
                        <Casilla apartado="Apdo 3" label="Nº de alojamientos independientes"
                            value={resumen.num_alojamientos}
                            nota="Tipo: «dividido en unidades de alojamiento». Modalidad: 3.2 uso completo." />
                        <Casilla apartado="Apdo 4.2" label="Total mensual de alojamientos independientes ocupados"
                            value={resumen.alojamientos_ocupados_total}
                            nota={`Suma día a día. ${nf2(resumen.alojamientos_ocupados_reservas)} de reservas propias + ${nf2(resumen.alojamientos_ocupados_canal)} de bloqueos de canal.`} />
                        <Casilla apartado="Apdo 4.3" label="Plazas supletorias utilizadas en el mes" manual
                            nota="El sistema no registra camas supletorias ni cunas." />
                        <Casilla apartado="Apdo 5" label="Personal ocupado (no remunerado / fijo / eventual)" manual
                            nota="No hay datos de personal en el sistema." />
                        <Casilla apartado="Apdo 6 · Total" label="Entrada de viajeros en el mes"
                            value={resumen.viajeros_entrados}
                            nota="Cada persona se cuenta una vez, en el mes en que entra." />
                        <Casilla apartado="Apdo 6 · Total" label="Pernoctaciones (plazas ocupadas)"
                            value={resumen.pernoctaciones}
                            nota="Personas × noches dormidas dentro del mes." />
                        <Casilla apartado="Apdo 6.1" label="Pernoctaciones en fin de semana (viernes y sábado)"
                            value={resumen.pernoctaciones_fin_semana} />
                        <Casilla apartado="Apdo 7.2" label="Precio medio por día, tarifa normal (domingo a jueves)"
                            value={resumen.precio_medio_normal} suffix=" €"
                            nota={`Sin IVA. Es el % ${nf(resumen.pct_ocupados_normal)} de los alojamientos ocupados.`} />
                        <Casilla apartado="Apdo 7.2" label="Precio medio por día, tarifa de fin de semana"
                            value={resumen.precio_medio_fin_semana} suffix=" €"
                            nota={`Sin IVA. Es el % ${nf(resumen.pct_ocupados_fin_semana)} de los alojamientos ocupados.`} />
                    </div>

                    {/* ---- Apartado 6: residencia ---- */}
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-serif font-bold text-lg text-text-primary">
                            Apartado 6 — Viajeros y pernoctaciones por lugar de residencia
                        </h2>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cuadra
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {cuadra ? 'Cuadra con el total' : 'No cuadra con el total'}
                        </span>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 overflow-x-auto">
                        <table className="w-full text-sm min-w-[560px]">
                            <thead>
                                <tr className="border-b border-gray-100 text-left">
                                    <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-bold">Casilla</th>
                                    <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-bold">Lugar de residencia</th>
                                    <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-bold text-right">Entrada de viajeros</th>
                                    <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-bold text-right">Pernoctaciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {residencia.map((r) => {
                                    const vacia = !r.viajeros && !r.pernoctaciones;
                                    const pendiente = r.orden === 999;
                                    return (
                                        <tr key={r.orden}
                                            className={`border-b border-gray-50 last:border-0 ${pendiente
                                                ? 'bg-red-50/60'
                                                : vacia ? 'text-gray-300' : ''}`}>
                                            <td className="px-4 py-2 font-mono text-xs">{r.casilla}</td>
                                            <td className="px-4 py-2">
                                                {r.grupo}
                                                {r.ambito === 'España' && r.orden === 101 && (
                                                    <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">España</span>
                                                )}
                                                {pendiente && (
                                                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-red-700">
                                                        no es una casilla · repartir
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {vacia ? <span className="tabular-nums">0</span> : <CopyValue value={r.viajeros} />}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {vacia ? <span className="tabular-nums">0</span> : <CopyValue value={r.pernoctaciones} />}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-gray-50 font-bold">
                                    <td className="px-4 py-3" />
                                    <td className="px-4 py-3">Total mensual</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{nf2(sumaResidencia.viajeros)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{nf2(sumaResidencia.pernoctaciones)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {sinDeterminar && (sinDeterminar.viajeros > 0 || sinDeterminar.pernoctaciones > 0) && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-8 text-sm text-red-900">
                            <strong>La fila «Sin determinar» no se puede enviar.</strong> El cuestionario solo tiene
                            32 casillas y ninguna es esa. Esos {nf2(sinDeterminar.viajeros)} viajeros y{' '}
                            {nf2(sinDeterminar.pernoctaciones)} pernoctaciones vienen de reservas sin parte de viajeros
                            relleno (o sin domicilio). Mira el detalle de abajo, averigua de dónde eran y súmalos a su
                            comunidad o su país antes de enviar.
                        </div>
                    )}

                    {/* ---- Control ---- */}
                    <h2 className="font-serif font-bold text-lg text-text-primary mb-3">Control (no son casillas)</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                        {[
                            ['Plazas', resumen.plazas, ''],
                            ['Ocupación por plazas', resumen.grado_ocupacion_plazas, ' %'],
                            ['Ocupación por alojamientos', resumen.grado_ocupacion_alojamientos, ' %'],
                            ['Estancia media', resumen.estancia_media, ' noches'],
                            ['Días del mes', resumen.dias_del_mes, ''],
                        ].map(([label, value, suffix]) => (
                            <div key={label} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-xs text-gray-500 mb-1">{label}</p>
                                <p className="text-xl font-bold text-text-primary tabular-nums">
                                    {value === null || value === undefined ? '—' : `${nf2(value)}${suffix}`}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* ---- Detalle ---- */}
                    <button onClick={() => setVerDetalle((v) => !v)}
                        className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline mb-3">
                        <Table2 size={15} />
                        {verDetalle ? 'Ocultar' : 'Ver'} el detalle del mes ({detalle.length} líneas)
                    </button>

                    {verDetalle && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 overflow-x-auto">
                            <table className="w-full text-sm min-w-[900px]">
                                <thead>
                                    <tr className="border-b border-gray-100 text-left">
                                        {['Origen', 'Ref.', 'Apartamento', 'Huésped', 'Entra', 'Sale',
                                            'Pers.', 'Noches en el mes', '¿Entra en el mes?', 'Pernoct.', 'Partes', 'Residencia']
                                            .map((h) => (
                                                <th key={h} className="px-3 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-bold whitespace-nowrap">{h}</th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {detalle.length === 0 && (
                                        <tr><td colSpan={12} className="px-3 py-6 text-center text-gray-400">
                                            Ninguna estancia toca este mes.
                                        </td></tr>
                                    )}
                                    {detalle.map((d, i) => (
                                        <tr key={`${d.origen}-${d.referencia}-${i}`}
                                            className={`border-b border-gray-50 last:border-0 ${d.origen !== 'Reserva' ? 'bg-amber-50/50' : ''}`}>
                                            <td className="px-3 py-2 whitespace-nowrap">{d.origen}</td>
                                            <td className="px-3 py-2 font-mono text-xs">{nf(d.referencia)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{nf(d.apartamento)}</td>
                                            <td className="px-3 py-2">{d.huesped || <span className="text-gray-300">sin nombre</span>}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{nf(d.entrada)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{nf(d.salida)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{nf(d.personas)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{nf(d.noches_en_el_mes)}</td>
                                            <td className="px-3 py-2">{d.entra_en_el_mes ? 'Sí' : 'No'}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-semibold">{nf(d.pernoctaciones)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{nf(d.partes_rellenos)}</td>
                                            <td className="px-3 py-2">{d.residencia || <span className="text-gray-300">—</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ---- Guía IRIA ---- */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Info size={18} className="text-primary" />
                            <h2 className="font-serif font-bold text-lg text-text-primary">Cómo se envía por IRIA</h2>
                        </div>
                        <ol className="text-sm text-gray-700 space-y-2 list-decimal pl-5">
                            <li>
                                Entrar en <a href={IRIA_URL} target="_blank" rel="noopener noreferrer"
                                    className="text-primary font-semibold hover:underline">iria.ine.es</a> con el usuario
                                y la contraseña que el INE manda en la carta del cuestionario (van asociados al
                                establecimiento, no a una persona).
                            </li>
                            <li>Elegir la encuesta <strong>«Ocupación en alojamientos de turismo rural»</strong> y el mes de referencia.</li>
                            <li>
                                <strong>Apartado 1</strong>: solo se toca si ha cambiado algo de la identificación
                                (nombre, dirección, plazas, temporadas de apertura). Normalmente se deja como está.
                            </li>
                            <li><strong>Apartado 2</strong>: días abiertos.</li>
                            <li>
                                <strong>Apartado 3</strong>: «dividido en unidades de alojamiento» con{' '}
                                {nf2(resumen.num_alojamientos)} alojamientos independientes, y modalidad{' '}
                                <strong>3.2 uso completo</strong>.
                            </li>
                            <li><strong>Apartado 4.2</strong>: el total mensual de alojamientos ocupados. El 4.1 se deja vacío (no se alquila por habitaciones).</li>
                            <li><strong>Apartado 5</strong>: personal ocupado, <em>a mano</em>.</li>
                            <li><strong>Apartado 6</strong>: casilla por casilla, viajeros y pernoctaciones. El total tiene que cuadrar con la suma.</li>
                            <li><strong>Apartado 6.1</strong>: pernoctaciones de viernes y sábado.</li>
                            <li><strong>Apartado 7.2</strong>: precios sin IVA. Si el INE pide los de un solo alojamiento, se dan los de uno y se dice cuál en «Observaciones».</li>
                            <li>Grabar y enviar. Guardar el justificante que devuelve IRIA.</li>
                        </ol>
                        <p className="text-xs text-gray-400 mt-4">
                            Cuestionario oficial:{' '}
                            <a href={CUESTIONARIO_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">Mod. EOTR-21 (PDF)</a>
                            {' · '}
                            <a href={METODOLOGIA_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">Metodología (PDF)</a>
                            {' · '}La encuesta es de cumplimentación obligatoria y solo la contesta el establecimiento si el INE lo ha incluido en la muestra.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};

export default IneManager;

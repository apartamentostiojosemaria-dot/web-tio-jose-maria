// Panel de canales — pantalla de JESÚS, no de su madre.
// =====================================================
// Aquí sí cabe el vocabulario técnico (iCal, canal, sincronizar): esta
// pantalla no aparece en el modo sencillo. Lo que tiene que resolver:
//
//   1. Las CUATRO URL por apartamento (Airbnb, Booking, Escapada, CasasRurales).
//   2. El enlace de TJM que hay que pegar en cada canal — uno POR CANAL, para
//      no devolverle a un canal sus propias reservas (ver ical-export).
//   3. Cuándo se miró cada canal por última vez, en rojo si hace más de 2 h.
//   4. Los solapes detectados, que son overbookings a punto de pasar.
//
// Un panel que solo PINTA el retraso no sirve: la falta de sincronización
// dispara además un aviso desde `sync-ical-imports`. Esto es la foto.

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    RefreshCw, Link2, Calendar, Send, Copy, AlertTriangle,
    CheckCircle2, Clock, XCircle, Check,
} from 'lucide-react';

// El orden manda: es el que ve Jesús y el que usa la guía docs/CANALES.md.
const CANALES = [
    { key: 'airbnb', columna: 'airbnb_ical_url', label: 'Airbnb', refresco: 'cada 3 h' },
    { key: 'booking', columna: 'booking_ical_url', label: 'Booking', refresco: 'cada 2 h' },
    { key: 'escapada', columna: 'escapada_ical_url', label: 'Escapada Rural', refresco: 'cada 3 h' },
    { key: 'casasrurales', columna: 'casasrurales_ical_url', label: 'CasasRurales.net', refresco: 'sin declarar' },
];

const BASE_ICAL = 'https://tiojosemaria.com/ical';

/** "hace 12 minutos" en lenguaje llano. */
const haceCuanto = (iso) => {
    if (!iso) return 'nunca';
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'ahora mismo';
    if (min < 60) return `hace ${min} minuto${min !== 1 ? 's' : ''}`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} hora${h !== 1 ? 's' : ''}`;
    const d = Math.round(h / 24);
    return `hace ${d} día${d !== 1 ? 's' : ''}`;
};

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-ES') : '—');

const ChannelSyncManager = () => {
    const [apartamentos, setApartamentos] = useState([]);
    const [estado, setEstado] = useState([]);        // v_channel_sync_status
    const [conflictos, setConflictos] = useState([]);
    const [registro, setRegistro] = useState([]);    // channel_sync_log
    const [bloqueos, setBloqueos] = useState({});
    const [faltaSql, setFaltaSql] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [sincronizando, setSincronizando] = useState(false);
    const [resultado, setResultado] = useState(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const cargar = useCallback(async () => {
        setCargando(true);
        const pendientes = [];

        // Las cuatro columnas pueden no existir todavía (SQL pendiente). Si el
        // select falla, se cae al de siempre y se avisa arriba, en vez de
        // dejar la pantalla en blanco sin explicar por qué.
        const columnasCompletas = `id, slug, name, is_active, ${CANALES.map(c => c.columna).join(', ')}`;
        let apts = null;
        const conTodas = await supabase.from('apartments')
            .select(columnasCompletas).eq('is_active', true).order('name');
        if (conTodas.error) {
            pendientes.push('Faltan las columnas de Escapada Rural y CasasRurales.net en `apartments`. Aplicar supabase/migrations/_pendiente_canales.sql.');
            const basico = await supabase.from('apartments')
                .select('id, slug, name, is_active, airbnb_ical_url, booking_ical_url')
                .eq('is_active', true).order('name');
            apts = basico.data || [];
        } else {
            apts = conTodas.data || [];
        }
        setApartamentos(apts);

        const est = await supabase.from('v_channel_sync_status').select('*');
        if (est.error) {
            pendientes.push('Falta la tabla `channel_sync_log` y la vista `v_channel_sync_status`: sin ellas no se puede saber cuándo se miró cada canal.');
            setEstado([]);
        } else {
            setEstado(est.data || []);
        }

        const conf = await supabase.from('channel_sync_conflicts')
            .select('*').is('resolved_at', null).order('detected_at', { ascending: false });
        if (conf.error) {
            pendientes.push('Falta la tabla `channel_sync_conflicts`: los solapes se detectan pero no se pueden guardar.');
            setConflictos([]);
        } else {
            setConflictos(conf.data || []);
        }

        const reg = await supabase.from('channel_sync_log')
            .select('*').order('ran_at', { ascending: false }).limit(40);
        setRegistro(reg.error ? [] : (reg.data || []));

        const blo = await supabase.from('blocked_dates')
            .select('apartment_id, source').gte('end_date', new Date().toISOString().slice(0, 10));
        const agrupados = {};
        for (const fila of (blo.data || [])) {
            const k = `${fila.apartment_id}-${fila.source || 'manual'}`;
            agrupados[k] = (agrupados[k] || 0) + 1;
        }
        setBloqueos(agrupados);

        setFaltaSql(pendientes.length ? pendientes : null);
        setCargando(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const sincronizarAhora = async () => {
        setSincronizando(true);
        setResultado(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${supabaseUrl}/functions/v1/sync-ical-imports`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({}),
            });
            setResultado(res.ok ? await res.json() : { error: await res.text() });
            await cargar();
        } catch (e) {
            setResultado({ error: e.message });
        } finally { setSincronizando(false); }
    };

    const guardarUrl = async (id, columna, valor) => {
        const { error } = await supabase.from('apartments')
            .update({ [columna]: valor || null }).eq('id', id);
        if (error) alert(`No se pudo guardar: ${error.message}`);
        await cargar();
    };

    const marcarResuelto = async (id) => {
        if (!confirm('¿Dar por resuelto este solape? Solo hazlo cuando ya hayas decidido qué reserva se queda.')) return;
        const { error } = await supabase.from('channel_sync_conflicts')
            .update({ resolved_at: new Date().toISOString(), resolution: 'revisado a mano desde el panel' })
            .eq('id', id);
        if (error) alert(`No se pudo marcar: ${error.message}`);
        await cargar();
    };

    const estadoDe = (aptId, canal) =>
        estado.find(e => e.apartment_id === aptId && e.channel === canal) || null;

    const enRojo = estado.filter(e => e.is_stale).length;

    return (
        <div className="max-w-6xl">
            <header className="mb-6 flex justify-between items-end flex-wrap gap-3">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Canales</h1>
                    <p className="text-sm text-gray-600 max-w-2xl mt-1">
                        Airbnb, Booking, Escapada Rural y CasasRurales.net. Lo que se reserva allí bloquea
                        las fechas aquí, y lo que se reserva aquí las bloquea allí. Se sincroniza solo cada
                        15 minutos.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={sincronizarAhora} disabled={sincronizando}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow hover:shadow-md disabled:opacity-50">
                        <Send size={14} /> {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
                    </button>
                    <button onClick={cargar}
                        className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                        <RefreshCw size={14} /> Actualizar
                    </button>
                </div>
            </header>

            {faltaSql && (
                <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                    <p className="font-bold flex items-center gap-2">
                        <AlertTriangle size={15} /> Falta aplicar cambios en la base
                    </p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                        {faltaSql.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                    <p className="mt-2 text-xs">
                        Mientras tanto la sincronización sigue funcionando y creando bloqueos: no se pierde nada.
                    </p>
                </div>
            )}

            <PanelConflictos conflictos={conflictos} apartamentos={apartamentos} onResolver={marcarResuelto} />

            <PanelVigilancia estado={estado} enRojo={enRojo} />

            {resultado && <ResultadoSync resultado={resultado} />}

            {cargando ? <p className="text-gray-500 font-serif italic">Cargando…</p> : (
                <ul className="space-y-4">
                    {apartamentos.map(a => (
                        <li key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-serif text-lg font-bold text-text-primary">{a.name}</h3>
                                <span className="text-xs text-gray-500 font-mono">/{a.slug}</span>
                            </div>

                            <div className="space-y-4">
                                {CANALES.map(c => (
                                    <FilaCanal
                                        key={c.key}
                                        canal={c}
                                        apartamento={a}
                                        disponible={Object.prototype.hasOwnProperty.call(a, c.columna)}
                                        valor={a[c.columna] || ''}
                                        onGuardar={(v) => guardarUrl(a.id, c.columna, v)}
                                        estado={estadoDe(a.id, c.key)}
                                        bloqueos={bloqueos[`${a.id}-${c.key}`] || 0}
                                    />
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <RegistroSync registro={registro} apartamentos={apartamentos} />

            <p className="mt-8 text-xs text-gray-500">
                Los pasos exactos de cada portal (dónde se copia su enlace y dónde se pega el nuestro)
                están en <code className="font-mono">docs/CANALES.md</code>.
            </p>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Una fila = un canal de un apartamento: su URL, su estado y el enlace de TJM
// que hay que pegar EN ESE canal.
// ---------------------------------------------------------------------------
const FilaCanal = ({ canal, apartamento, disponible, valor, onGuardar, estado, bloqueos }) => {
    const [local, setLocal] = useState(valor);
    const [copiado, setCopiado] = useState(false);
    useEffect(() => { setLocal(valor); }, [valor]);

    // Un enlace POR CANAL: al feed de Airbnb se le quitan las reservas que
    // vinieron de Airbnb, para no devolvérselas y liar su calendario.
    const nuestroEnlace = `${BASE_ICAL}/${apartamento.slug}-${canal.key}.ics`;

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(nuestroEnlace);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
        } catch {
            window.prompt('Copia este enlace:', nuestroEnlace);
        }
    };

    if (!disponible) {
        return (
            <div className="rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-500">
                <span className="font-bold">{canal.label}</span> — falta la columna{' '}
                <code className="font-mono">{canal.columna}</code> en la base. Aplicar el SQL pendiente.
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-100 p-3">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-600 flex items-center gap-1.5">
                    <Calendar size={12} aria-hidden="true" /> {canal.label}
                    <span className="font-normal normal-case tracking-normal text-gray-400">
                        (ellos refrescan {canal.refresco})
                    </span>
                </span>
                <Semaforo estado={estado} configurado={!!valor} bloqueos={bloqueos} />
            </div>

            {/* 1) lo que ELLOS nos dan */}
            <label className="block text-[11px] text-gray-500 mb-1">
                Enlace del calendario de {canal.label} (lo copias en su panel y lo pegas aquí)
            </label>
            <div className="flex gap-2">
                <input type="url" value={local} onChange={(e) => setLocal(e.target.value)}
                    placeholder={`https://…/${canal.key}…ics`}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono outline-none focus:border-primary" />
                {local !== valor && (
                    <button type="button" onClick={() => onGuardar(local)}
                        className="text-xs font-bold text-white bg-primary px-3 py-2 rounded-lg shrink-0">Guardar</button>
                )}
            </div>

            {/* 2) lo que NOSOTROS le damos */}
            <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-[11px] text-gray-500 flex items-center gap-1 min-w-0">
                    <Link2 size={11} className="shrink-0" />
                    <span className="shrink-0">Para pegar en {canal.label}:</span>
                    <code className="font-mono text-[10px] text-gray-600 truncate">{nuestroEnlace}</code>
                </div>
                <button onClick={copiar}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-rural-700 hover:text-primary px-2.5 py-1 rounded-lg hover:bg-rural-50 shrink-0">
                    {copiado ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                </button>
            </div>
            {estado?.error_message && (
                <p className="mt-2 text-[11px] text-red-700 bg-red-50 rounded px-2 py-1">{estado.error_message}</p>
            )}
        </div>
    );
};

// Verde / ámbar / rojo. Rojo también cuando NUNCA se ha sincronizado: un canal
// configurado que nunca corrió es lo más peligroso que hay, y desaparecer de
// la lista sería la peor forma de contarlo.
const Semaforo = ({ estado, configurado, bloqueos }) => {
    if (!configurado) {
        return <span className="text-[11px] text-gray-400 inline-flex items-center gap-1">
            <XCircle size={12} /> sin conectar
        </span>;
    }
    if (!estado) {
        return <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
            <Clock size={12} /> sin registro todavía
        </span>;
    }
    const rojo = estado.is_stale;
    return (
        <span className={`text-[11px] inline-flex items-center gap-1 font-bold ${rojo ? 'text-red-700' : 'text-rural-700'}`}>
            {rojo ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
            {rojo
                ? (estado.last_ok_at ? `sin sincronizar bien desde ${haceCuanto(estado.last_ok_at)}` : 'nunca ha sincronizado')
                : `visto ${haceCuanto(estado.last_ok_at)}`}
            {bloqueos > 0 && (
                <span className="font-normal text-gray-500">· {bloqueos} bloqueo{bloqueos !== 1 ? 's' : ''}</span>
            )}
        </span>
    );
};

// ---------------------------------------------------------------------------
const PanelConflictos = ({ conflictos, apartamentos, onResolver }) => {
    if (!conflictos.length) return null;
    const nombre = (id) => apartamentos.find(a => a.id === id)?.name || `#${id}`;
    return (
        <div className="mb-6 rounded-2xl bg-red-50 border-2 border-red-300 p-5">
            <p className="font-bold text-red-900 flex items-center gap-2 mb-1">
                <AlertTriangle size={17} />
                {conflictos.length} posible{conflictos.length !== 1 ? 's' : ''} doble reserva
            </p>
            <p className="text-xs text-red-800 mb-3">
                Un canal ha ocupado unas fechas que ya tenían reserva propia. Las fechas SÍ se han
                bloqueado (bloquear es lo seguro); lo que hay que decidir es qué reserva se queda.
            </p>
            <ul className="space-y-2">
                {conflictos.map(c => (
                    <li key={c.id} className="bg-white rounded-xl p-3 text-sm flex justify-between items-start gap-3 flex-wrap">
                        <div>
                            <p className="font-medium text-text-primary">{nombre(c.apartment_id)} · {c.summary}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                Detectado {haceCuanto(c.detected_at)}
                                {c.notified_at ? ' · aviso enviado' : ' · sin avisar'}
                            </p>
                        </div>
                        <button onClick={() => onResolver(c.id)}
                            className="text-xs font-bold text-white bg-red-700 px-3 py-1.5 rounded-lg shrink-0">
                            Ya está resuelto
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// ---------------------------------------------------------------------------
const PanelVigilancia = ({ estado, enRojo }) => {
    if (!estado.length) return null;
    return (
        <div className={`mb-6 rounded-2xl p-4 border ${enRojo ? 'bg-red-50 border-red-200' : 'bg-rural-50 border-rural-100'}`}>
            <p className="font-bold text-text-primary text-sm mb-2">
                {enRojo
                    ? `${enRojo} canal${enRojo !== 1 ? 'es' : ''} sin sincronizar desde hace más de 2 horas`
                    : 'Todos los canales conectados se han mirado en las últimas 2 horas'}
            </p>
            <div className="flex flex-wrap gap-2">
                {estado.map(e => (
                    <span key={`${e.apartment_id}-${e.channel}`}
                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                            e.is_stale ? 'bg-red-100 text-red-800' : 'bg-white text-rural-700 border border-rural-100'}`}>
                        {e.apartment_name} · {e.channel} · {haceCuanto(e.last_ok_at)}
                    </span>
                ))}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
const ResultadoSync = ({ resultado }) => {
    if (resultado.error) {
        return (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
                <p className="font-bold">Error durante la sincronización</p>
                <p className="font-mono text-xs mt-1 break-all">{resultado.error}</p>
            </div>
        );
    }
    const filas = resultado.results || [];
    const suma = (campo) => filas.reduce((acc, f) =>
        acc + CANALES.reduce((s, c) => s + (f[c.key]?.[campo] || 0), 0), 0);

    return (
        <div className="mb-6 rounded-2xl bg-rural-50 border border-rural-100 p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <p className="font-bold text-text-primary">
                    Sincronización completada
                    <span className="ml-2 text-xs text-gray-500 font-normal">{fecha(resultado.syncedAt)}</span>
                </p>
                <p className="text-sm text-gray-700">
                    <span className="font-bold text-rural-700">+{suma('blocks_inserted')}</span> bloqueos ·{' '}
                    <span className="font-bold text-gray-500">−{suma('blocks_removed')}</span> retirados ·{' '}
                    <span className="font-bold text-rural-700">{suma('bookings_created')}</span> reservas nuevas
                    {suma('conflicts') > 0 && (
                        <> · <span className="font-bold text-red-700">{suma('conflicts')} solapes</span></>
                    )}
                </p>
            </div>

            {resultado.pendiente_sql && (
                <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mb-3">{resultado.pendiente_sql}</p>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                    <thead className="text-xs uppercase tracking-widest font-bold text-gray-500">
                        <tr>
                            <th className="text-left py-2">Apartamento</th>
                            {CANALES.map(c => <th key={c.key} className="text-center py-2">{c.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map(f => (
                            <tr key={f.apartment} className="border-t border-rural-100">
                                <td className="py-2 font-medium text-text-primary capitalize">{f.apartment}</td>
                                {CANALES.map(c => (
                                    <td key={c.key} className="py-2 text-center"><Insignia dato={f[c.key]} /></td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const Insignia = ({ dato }) => {
    if (!dato) return <span className="text-xs text-gray-300">—</span>;
    if (!dato.fetched) return <span className="text-xs text-red-700 font-bold">no se pudo leer</span>;
    return (
        <span className="text-xs text-gray-700">
            <span className="font-bold text-rural-700">+{dato.blocks_inserted ?? 0}</span>
            {' / '}
            <span className="font-bold text-gray-500">−{dato.blocks_removed ?? 0}</span>
            <span className="block text-[10px] text-gray-400">{dato.events_parsed ?? 0} en el calendario</span>
            {dato.conflicts > 0 && (
                <span className="block text-[10px] text-red-700 font-bold">{dato.conflicts} solape(s)</span>
            )}
        </span>
    );
};

// ---------------------------------------------------------------------------
// El registro. No es adorno: es la prueba de que el cron ESCRIBE, no solo de
// que corre. Un proceso en verde que no deja fila aquí no está sincronizando.
// ---------------------------------------------------------------------------
const RegistroSync = ({ registro, apartamentos }) => {
    const [abierto, setAbierto] = useState(false);
    if (!registro.length) return null;
    const nombre = (id) => apartamentos.find(a => a.id === id)?.name || `#${id}`;

    return (
        <section className="mt-8">
            <button onClick={() => setAbierto(!abierto)}
                className="text-sm font-bold text-rural-700 hover:text-primary">
                {abierto ? '▾' : '▸'} Últimas {registro.length} sincronizaciones
            </button>
            {abierto && (
                <div className="mt-3 overflow-x-auto bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <table className="w-full text-xs min-w-[680px]">
                        <thead className="text-[10px] uppercase tracking-widest font-bold text-gray-500 bg-gray-50">
                            <tr>
                                <th className="text-left py-2 px-3">Cuándo</th>
                                <th className="text-left py-2 px-3">Apartamento</th>
                                <th className="text-left py-2 px-3">Canal</th>
                                <th className="text-center py-2 px-3">Eventos</th>
                                <th className="text-center py-2 px-3">+/−</th>
                                <th className="text-center py-2 px-3">Reservas</th>
                                <th className="text-left py-2 px-3">Resultado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registro.map(r => (
                                <tr key={r.id} className="border-t border-gray-50">
                                    <td className="py-1.5 px-3 whitespace-nowrap text-gray-500">{haceCuanto(r.ran_at)}</td>
                                    <td className="py-1.5 px-3">{nombre(r.apartment_id)}</td>
                                    <td className="py-1.5 px-3">{r.channel}</td>
                                    <td className="py-1.5 px-3 text-center">{r.events_parsed}</td>
                                    <td className="py-1.5 px-3 text-center">+{r.blocks_inserted} / −{r.blocks_removed}</td>
                                    <td className="py-1.5 px-3 text-center">
                                        {r.bookings_created > 0 ? `+${r.bookings_created}` : '—'}
                                        {r.bookings_cancelled > 0 && ` / canc. ${r.bookings_cancelled}`}
                                    </td>
                                    <td className="py-1.5 px-3">
                                        {r.error_message
                                            ? <span className="text-red-700">{r.error_message}</span>
                                            : r.ok ? <span className="text-rural-700">bien</span>
                                                   : <span className="text-red-700">falló</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default ChannelSyncManager;

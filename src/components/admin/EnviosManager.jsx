import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    RefreshCw, MailCheck, MailWarning, BellRing, Activity, ShieldCheck, ShieldAlert,
    CheckCircle2, AlertTriangle, Clock, Send,
} from 'lucide-react';

// ============================================================
// EnviosManager — «Correos y avisos» (panel de Jesús)
// ============================================================
// Lo que sale del sistema y si llegó de verdad. Tres bloques:
//   1. Salud: dominio en Resend + DKIM en DNS + fallos de 24 h + crones
//      (tabla salud_correo y tjm_salud(), migración 0043).
//   2. Lo abierto: tareas que ha abierto el sistema (correo caído, correos
//      que no llegan).
//   3. Envíos: cada correo (con su estado real, por webhook de Resend) y
//      cada aviso push.
// Botones: «Comprobar ahora» (vigilar) y «Probar avisos» (manda un push y
// un correo de prueba al buzón del negocio).
// ============================================================

const FN = (nombre) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${nombre}`;

const ESTADOS = {
    enviado:   { texto: 'Enviado · sin confirmar', clase: 'bg-blue-50 text-blue-800 border-blue-200', icono: Clock },
    entregado: { texto: 'Entregado', clase: 'bg-green-50 text-green-800 border-green-200', icono: CheckCircle2 },
    retrasado: { texto: 'Retrasado', clase: 'bg-amber-50 text-amber-800 border-amber-200', icono: Clock },
    rebotado:  { texto: 'Rebotado', clase: 'bg-red-50 text-red-800 border-red-200', icono: MailWarning },
    queja:     { texto: 'Marcado como spam', clase: 'bg-red-50 text-red-800 border-red-200', icono: AlertTriangle },
    fallido:   { texto: 'Fallido', clase: 'bg-red-50 text-red-800 border-red-200', icono: MailWarning },
    error_api: { texto: 'Resend lo rechazó', clase: 'bg-red-50 text-red-800 border-red-200', icono: AlertTriangle },
};
const pinta = (e) => ESTADOS[e] || ESTADOS.enviado;
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const MALOS = ['rebotado', 'queja', 'fallido', 'error_api'];

const EnviosManager = () => {
    const [salud, setSalud] = useState(null);
    const [envios, setEnvios] = useState([]);
    const [soloFallidos, setSoloFallidos] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [ocupado, setOcupado] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [abierto, setAbierto] = useState(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        const [s, e] = await Promise.all([
            supabase.rpc('tjm_salud'),
            supabase.rpc('tjm_envios', { p_solo_fallidos: soloFallidos, p_limite: 200 }),
        ]);
        setSalud(s.data || null);
        setEnvios(e.data || []);
        if (s.error || e.error) setAviso({ tono: 'mal', texto: (s.error || e.error).message });
        setCargando(false);
    }, [soloFallidos]);

    useEffect(() => { cargar(); }, [cargar]);

    const llamar = async (nombre, cuerpo, query = '') => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(FN(nombre) + query, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                authorization: `Bearer ${session?.access_token || ''}`,
            },
            body: JSON.stringify(cuerpo || {}),
        });
        const txt = await res.text();
        let r = {};
        try { r = JSON.parse(txt); } catch { r = { mensaje: txt.slice(0, 300) }; }
        if (!res.ok) throw new Error(r.mensaje || r.error || `HTTP ${res.status}`);
        return r;
    };

    const conBloqueo = async (clave, fn) => {
        setOcupado(clave); setAviso(null);
        try { await fn(); } catch (e) { setAviso({ tono: 'mal', texto: e.message }); } finally { setOcupado(null); }
    };

    const comprobar = () => conBloqueo('vigilar', async () => {
        const r = await llamar('resend-webhook', {}, '?accion=vigilar');
        setAviso({
            tono: r.ok ? 'bien' : 'mal',
            texto: r.ok
                ? `Todo bien: dominio ${r.dominio || '—'}, DKIM en DNS, ${r.fallidos_24h} fallidos en 24 h.`
                : `Problema: dominio ${r.dominio || 'sin respuesta'} · DKIM ${r.dkim ? 'ok' : 'FALTA en DNS'} · ${r.fallidos_24h} fallidos en 24 h.`,
        });
        await cargar();
    });

    const probar = () => conBloqueo('probar', async () => {
        const r = await llamar('submit-ses-hospedajes', { accion: 'prueba-aviso' });
        setAviso({
            tono: r.ok ? 'bien' : 'mal',
            texto: `Push: ${r.push} · Correo: ${r.correo}. ${r.ok ? 'Mira el móvil y el buzón del negocio; el estado real del correo aparece abajo en un minuto.' : ''}`,
        });
        setTimeout(cargar, 4000);
    });

    const c = salud?.correo;
    const correoOk = !c || c.ok !== false;
    const fallidos24 = Number(salud?.envios?.fallidos_24h) || 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="font-serif text-2xl font-bold text-text-primary">Correos y avisos</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Lo que sale del sistema y si llegó de verdad. El estado lo confirma Resend; el dominio se comprueba cada mañana.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Boton onClick={comprobar} icono={Activity} cargando={ocupado === 'vigilar'}>Comprobar ahora</Boton>
                    <Boton onClick={probar} icono={Send} cargando={ocupado === 'probar'}>Probar avisos</Boton>
                    <Boton onClick={cargar} icono={RefreshCw} cargando={cargando}>Recargar</Boton>
                </div>
            </div>

            {aviso && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${aviso.tono === 'bien' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
                    {aviso.texto}
                </div>
            )}

            {/* ---------- Salud ---------- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Tarjeta
                    bien={correoOk}
                    icono={correoOk ? ShieldCheck : ShieldAlert}
                    titulo="Dominio del correo"
                    valor={c ? (c.dominio_estado || '—') : 'sin comprobar'}
                    pie={c ? `DKIM en DNS: ${c.dkim_ok ? 'sí' : 'NO'} · ${fecha(c.comprobado_at)}` : 'Pulsa «Comprobar ahora».'}
                />
                <Tarjeta
                    bien={fallidos24 === 0}
                    icono={fallidos24 === 0 ? MailCheck : MailWarning}
                    titulo="Correos en 24 h"
                    valor={`${Number(salud?.envios?.total_24h) || 0} enviados · ${fallidos24} fallidos`}
                    pie={`${Number(salud?.envios?.fallidos_7d) || 0} fallidos en 7 días`}
                />
                <Tarjeta
                    bien={(Number(salud?.partes?.rechazados) || 0) + (Number(salud?.partes?.faltan_datos) || 0) === 0}
                    icono={BellRing}
                    titulo="Parte de viajeros"
                    valor={`${salud?.partes?.rechazados ?? 0} rechazados · ${salud?.partes?.faltan_datos ?? 0} con datos que faltan`}
                    pie={`${salud?.partes?.esperando ?? 0} esperando validación del Ministerio`}
                />
            </div>

            {/* ---------- Tareas abiertas por el sistema ---------- */}
            {Array.isArray(salud?.tareas) && salud.tareas.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-widest font-bold text-red-800 mb-2">Abierto por el sistema</p>
                    <ul className="space-y-2">
                        {salud.tareas.map((t) => (
                            <li key={t.id} className="text-sm text-red-900">
                                <span className="font-bold">{t.titulo}</span> <span className="text-red-700">· desde {fecha(t.desde)}</span>
                                {t.descripcion && <pre className="mt-1 text-xs whitespace-pre-wrap font-sans text-red-900/80">{t.descripcion}</pre>}
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-red-800/80 mt-2">Se cierran solas cuando la comprobación vuelve a salir bien, o a mano en «Calendario de mantenimiento».</p>
                </div>
            )}

            {/* ---------- Crones ---------- */}
            {Array.isArray(salud?.crons) && salud.crons.length > 0 && (
                <details className="bg-white border border-gray-200 rounded-2xl p-4">
                    <summary className="cursor-pointer text-sm font-bold text-text-primary">Tareas programadas ({salud.crons.length})</summary>
                    <table className="w-full text-xs mt-3">
                        <tbody>
                            {salud.crons.map((j) => (
                                <tr key={j.nombre} className="border-t border-gray-100">
                                    <td className="py-1.5 pr-3 font-mono">{j.nombre}</td>
                                    <td className="py-1.5 pr-3 font-mono text-gray-500">{j.horario}</td>
                                    <td className="py-1.5 pr-3 tabular-nums text-gray-600">{fecha(j.ultimo)}</td>
                                    <td className={`py-1.5 pr-3 font-semibold ${j.estado === 'succeeded' ? 'text-green-700' : j.estado ? 'text-red-700' : 'text-gray-400'}`}>{j.estado || 'nunca'}</td>
                                    <td className="py-1.5 text-gray-500 truncate max-w-[280px]">{j.mensaje || ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </details>
            )}

            {/* ---------- Envíos ---------- */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-bold text-text-primary">Envíos ({envios.length})</p>
                    <label className="text-xs text-gray-700 flex items-center gap-2">
                        <input type="checkbox" checked={soloFallidos} onChange={(e) => setSoloFallidos(e.target.checked)} />
                        Solo los que no llegaron
                    </label>
                </div>
                {cargando ? (
                    <p className="p-6 text-sm text-gray-500">Cargando…</p>
                ) : envios.length === 0 ? (
                    <p className="p-6 text-sm text-gray-500">
                        {soloFallidos ? 'Ningún envío fallido.' : 'Todavía no hay envíos registrados: se apuntan a partir de ahora (webhook de Resend + avisos push).'}
                    </p>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {envios.map((e) => {
                            const p = pinta(e.estado);
                            const I = p.icono;
                            const desplegado = abierto === e.id;
                            return (
                                <li key={e.id}>
                                    <button type="button" onClick={() => setAbierto(desplegado ? null : e.id)}
                                        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50">
                                        <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md border ${p.clase}`}>
                                            <I size={12} /> {p.texto}
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm font-semibold text-text-primary truncate">
                                                {e.canal === 'push' ? '📱 ' : ''}{e.asunto || '(sin asunto)'}
                                            </span>
                                            <span className="block text-xs text-gray-500 truncate">
                                                {e.destinatario || '—'}{e.guest_name ? ` · ${e.guest_name}` : ''}{e.booking_code ? ` · ${e.booking_code}` : ''}
                                                {e.tipo ? ` · ${e.tipo}` : ''}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs text-gray-500 tabular-nums">{fecha(e.created_at)}</span>
                                    </button>
                                    {desplegado && (
                                        <div className="px-4 pb-3 text-xs text-gray-700 space-y-1">
                                            {e.detalle && <p><span className="font-bold">Detalle:</span> {e.detalle}</p>}
                                            {Array.isArray(e.eventos) && e.eventos.length > 0 && (
                                                <ul className="list-disc pl-5">
                                                    {e.eventos.map((ev, i) => (
                                                        <li key={i}><span className="tabular-nums text-gray-500">{fecha(ev.cuando)}</span> · {ev.tipo}{ev.detalle ? ` — ${ev.detalle}` : ''}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};

const Tarjeta = ({ bien, icono: Icono, titulo, valor, pie }) => (
    <div className={`rounded-2xl border p-4 ${bien ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-2 mb-1">
            <Icono size={18} className={bien ? 'text-green-700' : 'text-red-700'} />
            <p className="text-xs uppercase tracking-widest font-bold text-gray-500">{titulo}</p>
        </div>
        <p className={`text-base font-bold ${bien ? 'text-text-primary' : 'text-red-900'}`}>{valor}</p>
        <p className="text-xs text-gray-500 mt-1">{pie}</p>
    </div>
);

const Boton = ({ children, onClick, icono: Icono, cargando }) => (
    <button type="button" onClick={onClick} disabled={cargando}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-rural-700 bg-rural-50 hover:bg-rural-100 px-3 py-2 rounded-lg disabled:opacity-50">
        {Icono && <Icono size={13} className={cargando ? 'animate-spin' : ''} />} {children}
    </button>
);

export default EnviosManager;

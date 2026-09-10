import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Search, RefreshCw, Download, Send, ShieldCheck, ShieldAlert, Clock,
    CircleHelp, FileText, History, KeyRound,
} from 'lucide-react';

// ============================================================
// TravelersManager — parte de viajeros, vista técnica (panel de Jesús)
// ============================================================
// Aquí SÍ se habla claro: estados reales del Ministerio, número de lote,
// acuse guardado, reintentos, XML e histórico. La pantalla sin jerga es
// `panel/ParteViajerosPanel.jsx`, y es otra cosa.
//
// Todo lo que toca datos personales pasa por la edge function
// `submit-ses-hospedajes`, que es quien tiene permiso de servicio. Este
// componente sólo lee `traveler_records` (política de admin) y llama a la
// función para actuar.
// ============================================================

const FUNCION = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-ses-hospedajes`;

/** Cómo se pinta cada `mir_response_status`. */
const ESTADOS = {
    aceptado: { texto: 'Aceptado por el MIR', clase: 'bg-green-50 text-green-800 border-green-200', icono: ShieldCheck },
    enviado_pendiente_acuse: { texto: 'Enviado · esperando validación', clase: 'bg-blue-50 text-blue-800 border-blue-200', icono: Clock },
    enviado_a_mano: { texto: 'Enviado a mano', clase: 'bg-teal-50 text-teal-800 border-teal-200', icono: ShieldCheck },
    pendiente_de_alta: { texto: 'Preparado · sin credenciales', clase: 'bg-amber-50 text-amber-800 border-amber-200', icono: KeyRound },
    faltan_datos: { texto: 'Faltan datos del huésped', clase: 'bg-amber-50 text-amber-800 border-amber-200', icono: CircleHelp },
    retry: { texto: 'Sin respuesta · reintentar', clase: 'bg-orange-50 text-orange-800 border-orange-200', icono: RefreshCw },
    error: { texto: 'Rechazado / error', clase: 'bg-red-50 text-red-800 border-red-200', icono: ShieldAlert },
    // Estados del stub anterior, por si queda alguna fila vieja.
    stub_no_credentials: { texto: 'Preparado (versión antigua)', clase: 'bg-gray-100 text-gray-700 border-gray-200', icono: KeyRound },
    ok: { texto: 'Enviado (versión antigua)', clase: 'bg-gray-100 text-gray-700 border-gray-200', icono: ShieldCheck },
};

const SIN_ESTADO = { texto: 'Sin comunicar', clase: 'bg-gray-100 text-gray-600 border-gray-200', icono: CircleHelp };

const pinta = (estado) => ESTADOS[estado] || SIN_ESTADO;

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—');

const descargar = (nombre, contenido, tipo) => {
    const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
};

const deBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const TravelersManager = () => {
    const [filas, setFilas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [ocupado, setOcupado] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [abierta, setAbierta] = useState(null);   // booking_id desplegado
    const [credenciales, setCredenciales] = useState(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        const { data, error } = await supabase
            .from('traveler_records')
            .select(`id, booking_id, nombre, apellido_primero, tipo_documento, numero_documento,
                     nacionalidad, is_titular, fecha_nacimiento, firma_base64,
                     submitted_at, mir_reference, mir_response_status, mir_response_payload, created_at,
                     guest_bookings(booking_code, check_in, check_out, status, pax_count, channel, apartments(name))`)
            .order('created_at', { ascending: false })
            .limit(500);
        if (error) setAviso({ tono: 'mal', texto: `No se ha podido leer: ${error.message}` });
        setFilas(data || []);
        setCargando(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    /** Agrupa por reserva: el parte se manda por reserva, no por persona. */
    const reservas = useMemo(() => {
        const mapa = new Map();
        filas.forEach((f) => {
            const clave = f.booking_id;
            if (!mapa.has(clave)) {
                mapa.set(clave, {
                    booking_id: clave,
                    reserva: f.guest_bookings,
                    viajeros: [],
                    estado: f.mir_response_status,
                    submitted_at: f.submitted_at,
                    lote: f.mir_reference,
                    payload: f.mir_response_payload,
                });
            }
            mapa.get(clave).viajeros.push(f);
        });
        const lista = [...mapa.values()];
        const q = busqueda.trim().toLowerCase();
        if (!q) return lista;
        return lista.filter((r) =>
            (r.reserva?.booking_code || '').toLowerCase().includes(q)
            || (r.reserva?.apartments?.name || '').toLowerCase().includes(q)
            || (r.lote || '').toLowerCase().includes(q)
            || r.viajeros.some((v) =>
                `${v.nombre} ${v.apellido_primero}`.toLowerCase().includes(q)
                || (v.numero_documento || '').toLowerCase().includes(q)));
    }, [filas, busqueda]);

    // ---------------------------------------------------------- llamadas

    const llamar = async (cuerpo) => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(FUNCION, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                authorization: `Bearer ${session?.access_token || ''}`,
            },
            body: JSON.stringify(cuerpo),
        });
        const txt = await res.text();
        let r = {};
        try { r = JSON.parse(txt); } catch { r = { mensaje: txt.slice(0, 300) }; }
        if (!res.ok) throw new Error(r.mensaje || `HTTP ${res.status}`);
        return r;
    };

    const conBloqueo = async (clave, fn) => {
        setOcupado(clave);
        setAviso(null);
        try {
            await fn();
        } catch (e) {
            setAviso({ tono: 'mal', texto: e.message });
        } finally {
            setOcupado(null);
        }
    };

    const tandaCompleta = () => conBloqueo('tanda', async () => {
        const r = await llamar({});
        setCredenciales({ hay: r.credenciales, faltan: r.faltan_secretos || [] });
        setAviso({
            tono: r.fallos ? 'mal' : 'bien',
            texto: `${r.reservas} reserva(s) · enviados ${r.mandados} · preparados ${r.preparados} · fallos ${r.fallos}`
                + (r.credenciales ? '' : ` · faltan secretos: ${(r.faltan_secretos || []).join(', ')}`),
        });
        await cargar();
    });

    const mandar = (r) => conBloqueo(`m${r.booking_id}`, async () => {
        const res = await llamar({ accion: 'mandar', booking_id: r.booking_id });
        if (res.documento) {
            descargar(res.documento.nombre, new Blob([deBase64(res.documento.base64)], { type: res.documento.tipo }));
        }
        setAviso({ tono: res.estado === 'error' ? 'mal' : 'bien', texto: `${r.reserva?.booking_code}: ${res.mensaje}` });
        await cargar();
    });

    const comprobar = (r) => conBloqueo(`c${r.booking_id}`, async () => {
        const res = await llamar({ accion: 'comprobar', booking_id: r.booking_id });
        setAviso({ tono: res.estado === 'error' ? 'mal' : 'bien', texto: `${r.reserva?.booking_code}: ${res.mensaje}` });
        await cargar();
    });

    const hoja = (r) => conBloqueo(`h${r.booking_id}`, async () => {
        const res = await llamar({ accion: 'documento', booking_id: r.booking_id });
        if (!res.documento) throw new Error(res.mensaje || 'Sin documento');
        descargar(res.documento.nombre, new Blob([deBase64(res.documento.base64)], { type: res.documento.tipo }));
    });

    const xml = (r) => {
        const contenido = r.payload?.xml;
        if (!contenido) {
            setAviso({ tono: 'mal', texto: 'Todavía no hay XML guardado para esta reserva. Se genera al mandar o al preparar el parte.' });
            return;
        }
        descargar(`parte-${r.reserva?.booking_code || r.booking_id}.xml`, contenido, 'application/xml');
    };

    // ------------------------------------------------------------ pintado

    return (
        <div className="max-w-7xl">
            <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Parte de viajeros</h1>
                    <p className="text-sm text-gray-600 max-w-3xl mt-1">
                        Registro documental del RD 933/2021 y su comunicación al servicio web de Hospedajes
                        (Ministerio del Interior). Una comunicación por reserva. {reservas.length} reserva(s) con datos.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={tandaCompleta} disabled={ocupado === 'tanda'}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2.5 rounded-xl shadow hover:shadow-md disabled:opacity-50">
                        <Send size={15} /> {ocupado === 'tanda' ? 'Procesando…' : 'Procesar pendientes'}
                    </button>
                    <button onClick={cargar}
                        className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary px-3 py-2.5">
                        <RefreshCw size={15} /> Actualizar
                    </button>
                </div>
            </header>

            {credenciales && !credenciales.hay && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <strong>Sin credenciales del servicio web.</strong> Faltan estos secretos:{' '}
                    <code className="font-mono">{credenciales.faltan.join(', ')}</code>. Mientras tanto la función
                    trabaja en modo preparado: genera el XML y la hoja de registro, y no envía nada.
                    Pasos del alta en <code className="font-mono">docs/PARTE-VIAJEROS.md</code>.
                </div>
            )}

            {aviso && (
                <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                    aviso.tono === 'mal'
                        ? 'border-red-200 bg-red-50 text-red-900'
                        : 'border-green-200 bg-green-50 text-green-900'
                }`}>
                    {aviso.texto}
                </div>
            )}

            <div className="relative mb-5 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Reserva, huésped, documento o lote…"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </div>

            {cargando ? (
                <p className="text-gray-500 font-serif italic">Cargando…</p>
            ) : reservas.length === 0 ? (
                <p className="text-gray-500 font-serif italic">
                    Ninguna reserva tiene datos de viajeros todavía. Se rellenan en /precheckin desde 7 días antes de la entrada.
                </p>
            ) : (
                <div className="space-y-3">
                    {reservas.map((r) => {
                        const e = pinta(r.estado);
                        const Icono = e.icono;
                        const desplegada = abierta === r.booking_id;
                        const pax = r.reserva?.pax_count || r.viajeros.length;
                        return (
                            <div key={r.booking_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="p-4 flex flex-wrap items-start gap-4">
                                    <div className="min-w-[180px]">
                                        <p className="font-mono text-sm font-bold text-primary">{r.reserva?.booking_code}</p>
                                        <p className="text-sm text-gray-700">{r.reserva?.apartments?.name}</p>
                                        <p className="text-xs text-gray-500 tabular-nums">
                                            {r.reserva?.check_in} → {r.reserva?.check_out}
                                            {r.reserva?.channel && r.reserva.channel !== 'web' ? ` · ${r.reserva.channel}` : ''}
                                        </p>
                                    </div>

                                    <div className="flex-1 min-w-[200px]">
                                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-bold ${e.clase}`}>
                                            <Icono size={13} /> {e.texto}
                                        </span>
                                        <p className="text-xs text-gray-500 mt-1.5">
                                            {r.viajeros.length} de {pax} viajero(s) · {r.viajeros.filter((v) => v.firma_base64).length} firma(s)
                                            {r.submitted_at ? ` · comunicado ${fecha(r.submitted_at)}` : ''}
                                        </p>
                                        {r.lote && (
                                            <p className="font-mono text-[11px] text-gray-500 mt-0.5 break-all">Lote {r.lote}</p>
                                        )}
                                        {r.payload?.mensaje && (
                                            <p className="text-xs text-gray-600 mt-0.5">{String(r.payload.mensaje).slice(0, 180)}</p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 justify-end">
                                        <Boton onClick={() => mandar(r)} cargando={ocupado === `m${r.booking_id}`} icono={Send}>
                                            Mandar
                                        </Boton>
                                        {r.lote && (
                                            <Boton onClick={() => comprobar(r)} cargando={ocupado === `c${r.booking_id}`} icono={ShieldCheck}>
                                                Comprobar lote
                                            </Boton>
                                        )}
                                        <Boton onClick={() => hoja(r)} cargando={ocupado === `h${r.booking_id}`} icono={FileText}>
                                            Hoja PDF
                                        </Boton>
                                        <Boton onClick={() => xml(r)} icono={Download}>XML</Boton>
                                        <Boton onClick={() => setAbierta(desplegada ? null : r.booking_id)} icono={History}>
                                            {desplegada ? 'Cerrar' : 'Detalle'}
                                        </Boton>
                                    </div>
                                </div>

                                {desplegada && (
                                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                                        <div>
                                            <p className="text-xs uppercase tracking-widest font-bold text-gray-500 mb-2">Viajeros</p>
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    {r.viajeros.map((v) => (
                                                        <tr key={v.id} className="border-b border-gray-100 last:border-0">
                                                            <td className="py-1.5 pr-3">
                                                                {v.nombre} {v.apellido_primero}
                                                                {v.is_titular && <span className="ml-2 text-[10px] uppercase font-bold text-primary">Titular</span>}
                                                            </td>
                                                            <td className="py-1.5 pr-3 font-mono text-xs">{v.numero_documento || '—'}</td>
                                                            <td className="py-1.5 pr-3 text-xs text-gray-500">{v.tipo_documento} · {v.nacionalidad}</td>
                                                            <td className="py-1.5 pr-3 text-xs text-gray-500 tabular-nums">{v.fecha_nacimiento}</td>
                                                            <td className="py-1.5 text-xs">
                                                                {v.firma_base64
                                                                    ? <span className="text-green-700 font-semibold">firmado</span>
                                                                    : <span className="text-amber-700 font-semibold">sin firma</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {Array.isArray(r.payload?.historial) && r.payload.historial.length > 0 && (
                                            <div>
                                                <p className="text-xs uppercase tracking-widest font-bold text-gray-500 mb-2">Histórico</p>
                                                <ul className="space-y-1 text-xs text-gray-700">
                                                    {[...r.payload.historial].reverse().map((h, i) => (
                                                        <li key={i} className="flex gap-2">
                                                            <span className="tabular-nums text-gray-500 shrink-0">{fecha(h.cuando)}</span>
                                                            <span className="font-semibold">{h.estado}</span>
                                                            {h.nota && <span className="text-gray-600">— {String(h.nota).slice(0, 160)}</span>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {r.payload?.acuse && (
                                            <div>
                                                <p className="text-xs uppercase tracking-widest font-bold text-gray-500 mb-2">Acuse del Ministerio</p>
                                                <pre className="text-[11px] bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto max-h-52">
                                                    {String(r.payload.acuse)}
                                                </pre>
                                            </div>
                                        )}

                                        {Array.isArray(r.payload?.pegas) && r.payload.pegas.length > 0 && (
                                            <div>
                                                <p className="text-xs uppercase tracking-widest font-bold text-gray-500 mb-2">Lo que falta</p>
                                                <ul className="text-xs text-amber-900 list-disc pl-5">
                                                    {r.payload.pegas.map((p, i) => <li key={i}>{p.viajero}: falta {p.falta}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const Boton = ({ children, onClick, icono: Icono, cargando }) => (
    <button type="button" onClick={onClick} disabled={cargando}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-rural-700 bg-rural-50 hover:bg-rural-100 px-3 py-2 rounded-lg disabled:opacity-50">
        {Icono && <Icono size={13} className={cargando ? 'animate-spin' : ''} />} {children}
    </button>
);

export default TravelersManager;

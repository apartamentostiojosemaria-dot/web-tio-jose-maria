import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Inbox, Search, RefreshCw, AlertTriangle, MessageCircle, Mail, Wrench, ShieldQuestion, HelpCircle,
    Sparkles, Send, Archive, Check, X, Loader2, Globe,
} from 'lucide-react';
import { logError, userErrorMessage } from '../../utils/logger';

// Bandeja de mensajes entrantes con triage IA.
// Las fuentes posibles: web_form (formulario contacto público), bot (bot RAG cuando deriva),
// email (importado vía Resend inbound o webhook futuro), manual (operador apunta llamada).

const CLASSIFICATIONS = [
    { value: 'consulta',        label: 'Consulta',         icon: HelpCircle,     cls: 'bg-blue-100 text-blue-800' },
    { value: 'queja',           label: 'Queja',            icon: AlertTriangle,  cls: 'bg-red-100 text-red-800' },
    { value: 'averia',          label: 'Avería',           icon: Wrench,         cls: 'bg-orange-100 text-orange-800' },
    { value: 'modificacion',    label: 'Modificar reserva', icon: MessageCircle, cls: 'bg-amber-100 text-amber-800' },
    { value: 'reserva_nueva',   label: 'Reserva nueva',    icon: Mail,           cls: 'bg-green-100 text-green-800' },
    { value: 'otro',            label: 'Otro',             icon: ShieldQuestion, cls: 'bg-gray-100 text-gray-700' },
];
const URGENCY_CLS = { alta: 'bg-red-50 text-red-700 border-red-200', normal: 'bg-amber-50 text-amber-700 border-amber-200', baja: 'bg-gray-50 text-gray-600 border-gray-200' };
const SENTIMENT_EMOJI = { positivo: '😊', neutro: '😐', negativo: '😟' };

const InboxManager = () => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('new');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('inbox_messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(300);
        setMessages(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => messages.filter(m => {
        if (filter === 'new' && m.status !== 'new') return false;
        if (filter === 'urgent' && m.urgency !== 'alta') return false;
        if (filter === 'in_progress' && m.status !== 'in_progress') return false;
        if (filter === 'archived' && m.status !== 'archived') return false;
        if (filter === 'all') {}
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (m.from_name || '').toLowerCase().includes(q)
            || (m.from_email || '').toLowerCase().includes(q)
            || (m.subject || '').toLowerCase().includes(q)
            || (m.body || '').toLowerCase().includes(q);
    }), [messages, filter, query]);

    const kpis = useMemo(() => ({
        new: messages.filter(m => m.status === 'new').length,
        urgent: messages.filter(m => m.urgency === 'alta' && m.status !== 'archived' && m.status !== 'resolved').length,
        in_progress: messages.filter(m => m.status === 'in_progress').length,
    }), [messages]);

    const updateStatus = async (id, status) => {
        const patch = { status };
        if (status === 'resolved') patch.resolved_at = new Date().toISOString();
        await supabase.from('inbox_messages').update(patch).eq('id', id);
        load();
        if (selected?.id === id) setSelected({ ...selected, ...patch });
    };

    const updateMessage = async (id, patch) => {
        await supabase.from('inbox_messages').update(patch).eq('id', id);
        load();
        if (selected?.id === id) setSelected({ ...selected, ...patch });
    };

    const runTriage = async (id) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/triage-message`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ messageId: id }),
            });
            if (!res.ok) { alert('Error en triage: ' + await res.text()); return; }
            await load();
            if (selected?.id === id) {
                const { data } = await supabase.from('inbox_messages').select('*').eq('id', id).maybeSingle();
                setSelected(data);
            }
        } catch (e) { alert('Error: ' + e.message); }
    };

    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Bandeja de mensajes</h1>
                    <p className="text-sm text-gray-600 mt-1">Consultas, quejas, averías y peticiones de los huéspedes en un solo sitio. La IA los clasifica por urgencia y propone respuesta.</p>
                </div>
                <button onClick={load} className="p-2 text-rural-700"><RefreshCw size={14} /></button>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                <Kpi label="Sin leer" value={kpis.new} highlight={kpis.new > 0} />
                <Kpi label="Urgentes" value={kpis.urgent} highlight={kpis.urgent > 0} color="red" />
                <Kpi label="En curso" value={kpis.in_progress} />
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                <Chip active={filter === 'new'} onClick={() => setFilter('new')}>Sin leer</Chip>
                <Chip active={filter === 'urgent'} onClick={() => setFilter('urgent')} color="red">Urgentes</Chip>
                <Chip active={filter === 'in_progress'} onClick={() => setFilter('in_progress')}>En curso</Chip>
                <Chip active={filter === 'archived'} onClick={() => setFilter('archived')}>Archivados</Chip>
                <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Todos</Chip>
                <div className="flex-1 min-w-[200px] relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:border-primary" />
                </div>
            </div>

            {loading ? <p className="text-gray-500 italic">Cargando…</p> :
             filtered.length === 0 ? (
                <div className="text-center py-12 bg-white border-2 border-dashed border-gray-200 rounded-3xl">
                    <Inbox size={32} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 italic">No hay mensajes con esos filtros.</p>
                </div>
             ) : (
                <ul className="space-y-2">
                    {filtered.map(m => {
                        const c = CLASSIFICATIONS.find(x => x.value === m.classification) || CLASSIFICATIONS[5];
                        return (
                            <li key={m.id} onClick={() => setSelected(m)}
                                className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${m.urgency === 'alta' && m.status !== 'archived' ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'} ${m.status === 'new' ? 'font-medium' : ''}`}>
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            {m.classification && <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${c.cls}`}><c.icon size={10} />{c.label}</span>}
                                            {m.urgency && <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${URGENCY_CLS[m.urgency]}`}>{m.urgency}</span>}
                                            {m.sentiment && <span title={m.sentiment}>{SENTIMENT_EMOJI[m.sentiment]}</span>}
                                            {m.language && m.language !== 'es' && <span className="text-[10px] uppercase text-gray-500 inline-flex items-center gap-1"><Globe size={9} />{m.language}</span>}
                                            {m.status === 'new' && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                                        </div>
                                        <p className="text-sm text-text-primary">{m.from_name || m.from_email || 'Anónimo'}<span className="text-gray-400 text-xs"> · {m.source}</span></p>
                                        {m.subject && <p className="text-sm font-bold text-text-primary">{m.subject}</p>}
                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{m.body}</p>
                                    </div>
                                    <p className="text-[10px] text-gray-400 tabular-nums">{new Date(m.created_at).toLocaleString('es-ES')}</p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
             )}

            {selected && <MessageDetail message={selected} onClose={() => setSelected(null)}
                onUpdateStatus={updateStatus} onUpdate={updateMessage} onTriage={runTriage} />}
        </div>
    );
};

const MessageDetail = ({ message, onClose, onUpdateStatus, onUpdate, onTriage }) => {
    const [notes, setNotes] = useState(message.internal_notes || '');
    const [response, setResponse] = useState(message.suggested_response || '');
    const [running, setRunning] = useState(false);

    const triage = async () => { setRunning(true); await onTriage(message.id); setRunning(false); };

    const phoneClean = (message.from_phone || '').replace(/[^\d+]/g, '');
    const whatsAppNum = phoneClean.startsWith('+') ? phoneClean.slice(1) : phoneClean;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch justify-end" onClick={onClose}>
            <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <header className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-start justify-between z-10">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400">{message.source}</p>
                        <p className="font-bold text-text-primary">{message.from_name || 'Anónimo'}</p>
                        <p className="text-xs text-gray-500">
                            {message.from_email && <a href={`mailto:${message.from_email}`} className="hover:underline">{message.from_email}</a>}
                            {message.from_email && message.from_phone && ' · '}
                            {message.from_phone && <a href={`tel:${message.from_phone}`} className="hover:underline">{message.from_phone}</a>}
                            {whatsAppNum && <a href={`https://wa.me/${whatsAppNum}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-rural-700 font-bold">WhatsApp</a>}
                        </p>
                        {message.booking_code && <p className="text-xs text-rural-700 font-mono font-bold mt-1">Reserva: {message.booking_code}</p>}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                </header>

                <div className="p-5 space-y-4">
                    {message.subject && <p className="text-lg font-serif font-bold">{message.subject}</p>}
                    <div className="bg-gray-50 rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed">{message.body}</div>

                    {/* Botón triage IA */}
                    {!message.classification && (
                        <button onClick={triage} disabled={running}
                            className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                            {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            Clasificar con IA
                        </button>
                    )}

                    {/* Clasificación */}
                    {message.classification && (
                        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-purple-700 mb-2 flex items-center gap-1"><Sparkles size={11} /> Análisis IA</p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><span className="text-gray-500">Tipo:</span> <strong>{message.classification}</strong></div>
                                <div><span className="text-gray-500">Urgencia:</span> <strong>{message.urgency || '—'}</strong></div>
                                <div><span className="text-gray-500">Tono:</span> <strong>{message.sentiment || '—'} {SENTIMENT_EMOJI[message.sentiment]}</strong></div>
                                <div><span className="text-gray-500">Idioma:</span> <strong>{message.language || '—'}</strong></div>
                            </div>
                            <button onClick={triage} disabled={running} className="text-xs text-purple-700 font-bold mt-2 hover:underline disabled:opacity-50">
                                Re-clasificar
                            </button>
                        </div>
                    )}

                    {/* Respuesta sugerida */}
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Borrador de respuesta</p>
                        <textarea value={response} onChange={e => setResponse(e.target.value)} rows={6}
                            placeholder={message.suggested_response ? '' : 'Escribe la respuesta o usa "Clasificar con IA" para que te sugiera una.'}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary text-sm" />
                        <div className="flex gap-2 mt-2">
                            {message.from_email && (
                                <a href={`mailto:${message.from_email}?subject=${encodeURIComponent('Re: ' + (message.subject || ''))}&body=${encodeURIComponent(response)}`}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-rural-700 text-white text-sm font-bold rounded-xl hover:bg-rural-800">
                                    <Send size={12} /> Abrir email
                                </a>
                            )}
                            {whatsAppNum && response && (
                                <a href={`https://wa.me/${whatsAppNum}?text=${encodeURIComponent(response)}`} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700">
                                    <MessageCircle size={12} /> WhatsApp
                                </a>
                            )}
                            <button onClick={() => onUpdate(message.id, { suggested_response: response })}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50">
                                <Check size={12} /> Guardar borrador
                            </button>
                        </div>
                    </div>

                    {/* Notas internas */}
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Notas internas</p>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                            placeholder="Qué se ha hecho, a quién se le ha pasado, qué falta..."
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-primary text-sm"
                            onBlur={() => onUpdate(message.id, { internal_notes: notes })} />
                    </div>

                    {/* Cambio de estado */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                        <button onClick={() => onUpdateStatus(message.id, 'in_progress')}
                            className="px-3 py-2 bg-amber-100 text-amber-800 text-xs font-bold rounded-xl hover:bg-amber-200">Marcar en curso</button>
                        <button onClick={() => onUpdateStatus(message.id, 'resolved')}
                            className="px-3 py-2 bg-green-100 text-green-800 text-xs font-bold rounded-xl hover:bg-green-200">
                            <Check size={11} className="inline mr-1" /> Resuelto
                        </button>
                        <button onClick={() => onUpdateStatus(message.id, 'archived')}
                            className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-200">
                            <Archive size={11} className="inline mr-1" /> Archivar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Kpi = ({ label, value, highlight, color = 'rural' }) => (
    <div className={`rounded-2xl border p-4 shadow-sm ${highlight ? (color === 'red' ? 'bg-red-50 border-red-100' : 'bg-rural-50 border-rural-200') : 'bg-white border-gray-100'}`}>
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</p>
        <p className={`font-serif font-bold text-2xl mt-1 ${highlight ? (color === 'red' ? 'text-red-700' : 'text-rural-900') : 'text-text-primary'}`}>{value}</p>
    </div>
);

const Chip = ({ active, onClick, children, color = 'rural' }) => {
    const palettes = {
        rural: active ? 'bg-rural-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
        red:   active ? 'bg-red-600 text-white'   : 'bg-white text-gray-600 hover:bg-red-50',
    };
    return <button onClick={onClick} className={`px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-100 ${palettes[color]}`}>{children}</button>;
};

export default InboxManager;

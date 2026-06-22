import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Bot, MessageSquare, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const BotLogsManager = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);
    const [turns, setTurns] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        // Cargar sesiones (agrupadas por session_id, último turno como representativo)
        const { data } = await supabase
            .from('ai_interaction_logs')
            .select('session_id, language, request_ip_country, created_at, error')
            .order('created_at', { ascending: false })
            .limit(500);

        // Agrupar por session_id, contar turnos, marcar errores
        const groups = new Map();
        for (const row of (data || [])) {
            const sid = row.session_id;
            const g = groups.get(sid) || { session_id: sid, turns: 0, last: row.created_at, first: row.created_at, lang: row.language, country: row.request_ip_country, errors: 0 };
            g.turns += 1;
            if (row.created_at < g.first) g.first = row.created_at;
            if (row.created_at > g.last) g.last = row.created_at;
            if (row.error) g.errors += 1;
            groups.set(sid, g);
        }
        const arr = Array.from(groups.values()).sort((a, b) => b.last.localeCompare(a.last));
        setSessions(arr.slice(0, 100));
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const loadTurns = async (sid) => {
        if (turns[sid]) { setExpanded(expanded === sid ? null : sid); return; }
        const { data } = await supabase
            .from('ai_interaction_logs')
            .select('turn_index, user_message, ai_response, latency_ms, tokens_input, tokens_output, sources_used, error, created_at')
            .eq('session_id', sid)
            .order('turn_index', { ascending: true });
        setTurns({ ...turns, [sid]: data || [] });
        setExpanded(sid);
    };

    return (
        <div className="max-w-6xl">
            <header className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Conversaciones del asistente virtual</h1>
                    <p className="text-sm text-gray-600">Lo que los visitantes le preguntan al chat de la web · {sessions.length} {sessions.length === 1 ? 'conversación' : 'conversaciones'} · se borran a los 12 meses</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                    <RefreshCw size={14} /> Actualizar
                </button>
            </header>

            {loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> :
             sessions.length === 0 ? <p className="text-gray-500 font-serif italic">Aún no hay conversaciones registradas.</p> :
            <ul className="space-y-2">
                {sessions.map(s => (
                    <li key={s.session_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <button onClick={() => loadTurns(s.session_id)}
                            className="w-full grid grid-cols-12 gap-3 items-center text-left p-4 hover:bg-gray-50">
                            <span className="col-span-12 sm:col-span-4 font-mono text-xs text-gray-700 truncate">{s.session_id.slice(0, 20)}…</span>
                            <span className="col-span-4 sm:col-span-2 text-xs text-gray-600 tabular-nums">
                                <MessageSquare size={12} className="inline mr-1" />{s.turns} turno{s.turns !== 1 ? 's' : ''}
                            </span>
                            <span className="col-span-4 sm:col-span-2 text-xs text-gray-600">{s.lang} · {s.country || '—'}</span>
                            <span className="col-span-4 sm:col-span-3 text-xs text-gray-500 tabular-nums">{new Date(s.last).toLocaleString('es-ES')}</span>
                            <span className="col-span-12 sm:col-span-1 text-right">
                                {s.errors > 0 && <AlertTriangle size={14} className="inline text-red-500 mr-2" />}
                                {expanded === s.session_id ? <ChevronUp size={16} className="inline text-gray-400" /> : <ChevronDown size={16} className="inline text-gray-400" />}
                            </span>
                        </button>
                        {expanded === s.session_id && turns[s.session_id] && (
                            <div className="px-4 pb-4 pt-2 border-t border-gray-50 space-y-3">
                                {turns[s.session_id].map(t => (
                                    <div key={t.turn_index} className="text-sm">
                                        <div className="bg-gray-50 rounded-xl p-3 mb-1">
                                            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Huésped</p>
                                            <p className="text-text-primary whitespace-pre-wrap">{t.user_message}</p>
                                        </div>
                                        <div className="bg-rural-50 rounded-xl p-3">
                                            <p className="text-[10px] uppercase tracking-widest font-bold text-rural-700 mb-1 flex items-center gap-1">
                                                <Bot size={10} /> Bot
                                                {t.latency_ms && <span className="ml-2 text-gray-500 normal-case font-normal">· {t.latency_ms}ms</span>}
                                                {t.tokens_input && <span className="ml-1 text-gray-500 normal-case font-normal">· {t.tokens_input}→{t.tokens_output} tokens</span>}
                                            </p>
                                            <p className="text-text-primary whitespace-pre-wrap">{t.ai_response || <em className="text-red-500">{t.error}</em>}</p>
                                            {Array.isArray(t.sources_used) && t.sources_used.length > 0 && (
                                                <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-rural-100">
                                                    Fuentes: {t.sources_used.slice(0, 3).map(s => s.title).join(' · ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </li>
                ))}
            </ul>}
        </div>
    );
};

export default BotLogsManager;

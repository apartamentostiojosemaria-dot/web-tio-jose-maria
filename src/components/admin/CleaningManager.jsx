import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Brush, Check, AlertTriangle, User } from 'lucide-react';

const STATUS_CLS = {
    pending:     'bg-amber-50 text-amber-700 border-amber-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    done:        'bg-green-50 text-green-700 border-green-200',
    skipped:     'bg-gray-100 text-gray-500 border-gray-200',
    issue:       'bg-red-50 text-red-700 border-red-200',
};

const STATUSES = [
    { value: 'pending',     label: 'Pendiente' },
    { value: 'in_progress', label: 'En curso' },
    { value: 'done',        label: 'Hecha' },
    { value: 'skipped',     label: 'Sin hacer' },
    { value: 'issue',       label: 'Hay un problema' },
];

const CleaningManager = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('upcoming'); // upcoming | today | week | all

    const load = useCallback(async () => {
        setLoading(true);
        let q = supabase
            .from('cleaning_tasks')
            .select(`id, scheduled_date, status, assigned_to, notes, apartment_id,
                     booking_out_id, booking_in_id, started_at, completed_at,
                     apartments(name, slug),
                     out_booking:guest_bookings!cleaning_tasks_booking_out_id_fkey(booking_code, guest_name),
                     in_booking:guest_bookings!cleaning_tasks_booking_in_id_fkey(booking_code, guest_name)`)
            .order('scheduled_date', { ascending: true });
        const today = new Date().toISOString().slice(0, 10);
        const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        if (filter === 'today') q = q.eq('scheduled_date', today);
        else if (filter === 'week') q = q.gte('scheduled_date', today).lte('scheduled_date', in7);
        else if (filter === 'upcoming') q = q.gte('scheduled_date', today).neq('status', 'done');
        const { data } = await q.limit(100);
        setTasks(data || []);
        setLoading(false);
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    const updateField = async (id, patch) => {
        await supabase.from('cleaning_tasks').update(patch).eq('id', id);
        await load();
    };

    return (
        <div className="max-w-6xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Limpiezas</h1>
                    <p className="text-sm text-gray-600">Cada vez que sale un huésped se crea una tarea de limpieza · {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}</p>
                </div>
                <div className="flex gap-2">
                    <FilterPill active={filter === 'today'} onClick={() => setFilter('today')}>Hoy</FilterPill>
                    <FilterPill active={filter === 'week'} onClick={() => setFilter('week')}>Esta semana</FilterPill>
                    <FilterPill active={filter === 'upcoming'} onClick={() => setFilter('upcoming')}>Pendientes</FilterPill>
                    <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>Todas</FilterPill>
                    <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary px-2">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </header>

            {loading ? (
                <p className="text-gray-500 font-serif italic">Cargando…</p>
            ) : tasks.length === 0 ? (
                <p className="text-gray-500 font-serif italic">Sin tareas de limpieza en este filtro.</p>
            ) : (
                <ul className="space-y-3">
                    {tasks.map(t => (
                        <li key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="grid sm:grid-cols-12 gap-3 items-center">
                                <div className="sm:col-span-2 flex items-center gap-2">
                                    <Brush size={16} className="text-rural-700" aria-hidden="true" />
                                    <span className="font-bold tabular-nums text-text-primary">{t.scheduled_date}</span>
                                </div>
                                <div className="sm:col-span-2 text-sm text-text-primary font-medium">{t.apartments?.name}</div>
                                <div className="sm:col-span-3 text-xs text-gray-600">
                                    {t.out_booking?.booking_code && (
                                        <p>Sale: <span className="font-mono">{t.out_booking.booking_code}</span> · {t.out_booking.guest_name}</p>
                                    )}
                                    {t.in_booking?.booking_code && (
                                        <p>Entra: <span className="font-mono">{t.in_booking.booking_code}</span> · {t.in_booking.guest_name}</p>
                                    )}
                                </div>
                                <div className="sm:col-span-2">
                                    <input type="text" placeholder="Asignar a…" value={t.assigned_to || ''}
                                        onChange={(e) => updateField(t.id, { assigned_to: e.target.value })}
                                        className="w-full text-xs px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-primary" />
                                </div>
                                <div className="sm:col-span-2">
                                    <select value={t.status} onChange={(e) => updateField(t.id, {
                                        status: e.target.value,
                                        started_at: e.target.value === 'in_progress' && !t.started_at ? new Date().toISOString() : t.started_at,
                                        completed_at: e.target.value === 'done' ? new Date().toISOString() : null,
                                    })} className={`w-full text-xs font-bold px-2 py-1.5 rounded-lg border cursor-pointer ${STATUS_CLS[t.status] || STATUS_CLS.pending}`}>
                                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div className="sm:col-span-1 text-right">
                                    {t.status === 'pending' && (
                                        <button onClick={() => updateField(t.id, { status: 'done', completed_at: new Date().toISOString() })}
                                            className="text-green-700 hover:bg-green-50 p-1.5 rounded-full" title="Marcar como hecha">
                                            <Check size={16} />
                                        </button>
                                    )}
                                    {t.status === 'issue' && <AlertTriangle size={16} className="text-red-500 inline" />}
                                </div>
                            </div>
                            <textarea placeholder="Notas (incidencias, suministros, etc.)"
                                value={t.notes || ''}
                                onChange={(e) => updateField(t.id, { notes: e.target.value })}
                                className="w-full mt-3 text-xs px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-primary resize-none"
                                rows={2} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const FilterPill = ({ active, onClick, children }) => (
    <button onClick={onClick}
        className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
            active ? 'bg-primary text-white border-primary' : 'bg-white text-rural-700 border-gray-200 hover:border-rural-300'
        }`}>{children}</button>
);

export default CleaningManager;

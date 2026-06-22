import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    RefreshCw, Brush, Check, AlertTriangle, ChevronLeft, ChevronRight,
    LayoutGrid, List as ListIcon, X, Loader2, Save, Clock, User,
} from 'lucide-react';

// ─────── utilidades de fecha ───────
const ymd = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};
const startOfWeek = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const day = x.getDay();
    const offset = (day + 6) % 7; // lunes=0
    x.setDate(x.getDate() - offset);
    return x;
};
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const WEEKDAYS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const STATUS_CLS = {
    pending:     'bg-amber-50 text-amber-800 border-amber-200',
    in_progress: 'bg-blue-50 text-blue-800 border-blue-200',
    done:        'bg-green-50 text-green-800 border-green-200',
    skipped:     'bg-gray-100 text-gray-600 border-gray-200',
    issue:       'bg-red-50 text-red-800 border-red-200',
};
const STATUS_DOT = {
    pending: 'bg-amber-500', in_progress: 'bg-blue-500',
    done: 'bg-green-500', skipped: 'bg-gray-400', issue: 'bg-red-500',
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
    const [view, setView] = useState('week');  // 'week' | 'list'
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [listFilter, setListFilter] = useState('upcoming');
    const [detailTask, setDetailTask] = useState(null);

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

        if (view === 'week') {
            const from = ymd(weekStart);
            const to = ymd(addDays(weekStart, 6));
            q = q.gte('scheduled_date', from).lte('scheduled_date', to);
        } else {
            const today = ymd(new Date());
            const in7 = ymd(addDays(new Date(), 7));
            if (listFilter === 'today') q = q.eq('scheduled_date', today);
            else if (listFilter === 'week') q = q.gte('scheduled_date', today).lte('scheduled_date', in7);
            else if (listFilter === 'upcoming') q = q.gte('scheduled_date', today).neq('status', 'done');
        }
        const { data } = await q.limit(500);
        setTasks(data || []);
        setLoading(false);
    }, [view, weekStart, listFilter]);

    useEffect(() => { load(); }, [load]);

    const updateField = async (id, patch) => {
        await supabase.from('cleaning_tasks').update(patch).eq('id', id);
        await load();
        if (detailTask?.id === id) setDetailTask({ ...detailTask, ...patch });
    };

    // KPIs
    const todayKey = ymd(new Date());
    const kpis = useMemo(() => {
        const today = tasks.filter(t => t.scheduled_date === todayKey && t.status !== 'done').length;
        const overdue = tasks.filter(t => t.scheduled_date < todayKey && t.status !== 'done').length;
        const week = tasks.filter(t => t.status !== 'done').length;
        const issues = tasks.filter(t => t.status === 'issue').length;
        return { today, overdue, week, issues };
    }, [tasks, todayKey]);

    // Agrupar tareas por día (para vista semana)
    const tasksByDay = useMemo(() => {
        const map = {};
        for (let i = 0; i < 7; i++) map[ymd(addDays(weekStart, i))] = [];
        for (const t of tasks) {
            if (map[t.scheduled_date]) map[t.scheduled_date].push(t);
        }
        return map;
    }, [tasks, weekStart]);

    const weekLabel = `${weekStart.getDate()} ${MONTHS_ES[weekStart.getMonth()]} – ${addDays(weekStart, 6).getDate()} ${MONTHS_ES[addDays(weekStart, 6).getMonth()]} ${weekStart.getFullYear()}`;

    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Limpiezas</h1>
                    <p className="text-sm text-gray-600 mt-1">Cuando sale un huésped se crea una tarea aquí. Asígnala a la limpiadora, márcala como hecha y apunta incidencias.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                        <button onClick={() => setView('week')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${view === 'week' ? 'bg-white shadow text-rural-800' : 'text-gray-500 hover:text-gray-700'}`}>
                            <LayoutGrid size={12} /> Semana
                        </button>
                        <button onClick={() => setView('list')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${view === 'list' ? 'bg-white shadow text-rural-800' : 'text-gray-500 hover:text-gray-700'}`}>
                            <ListIcon size={12} /> Lista
                        </button>
                    </div>
                    <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary p-2">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <Kpi label="Pendientes hoy" value={kpis.today} color="amber" />
                <Kpi label="Atrasadas" value={kpis.overdue} color={kpis.overdue > 0 ? 'red' : 'gray'} />
                <Kpi label="Pendientes total" value={kpis.week} />
                <Kpi label="Con problemas" value={kpis.issues} color={kpis.issues > 0 ? 'red' : 'gray'} />
            </div>

            {/* VISTA SEMANA */}
            {view === 'week' && (
                <>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setWeekStart(addDays(weekStart, -7))}
                                className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Semana anterior">
                                <ChevronLeft size={16} />
                            </button>
                            <h3 className="font-serif font-bold text-lg text-rural-900 px-2">{weekLabel}</h3>
                            <button onClick={() => setWeekStart(addDays(weekStart, 7))}
                                className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Semana siguiente">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <button onClick={() => setWeekStart(startOfWeek(new Date()))}
                            className="text-xs font-bold text-rural-700 hover:underline">
                            Volver a esta semana
                        </button>
                    </div>

                    {loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> : (
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                            {Array.from({ length: 7 }, (_, i) => {
                                const day = addDays(weekStart, i);
                                const key = ymd(day);
                                const dayTasks = tasksByDay[key] || [];
                                const isToday = key === todayKey;
                                const isPast = key < todayKey;
                                return (
                                    <div key={key} className={`rounded-2xl border ${isToday ? 'border-rural-400 ring-2 ring-rural-100 bg-rural-50/30' : isPast ? 'border-gray-100 bg-gray-50/50' : 'border-gray-100 bg-white'} p-3 min-h-[200px]`}>
                                        <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-gray-100">
                                            <div>
                                                <p className={`text-[10px] uppercase tracking-widest font-bold ${isToday ? 'text-rural-700' : 'text-gray-400'}`}>
                                                    {WEEKDAYS_ES[i].slice(0, 3)}
                                                </p>
                                                <p className={`text-xl font-serif font-bold tabular-nums ${isToday ? 'text-rural-900' : 'text-gray-700'}`}>{day.getDate()}</p>
                                            </div>
                                            {dayTasks.length > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                    {dayTasks.length}
                                                </span>
                                            )}
                                        </div>

                                        {dayTasks.length === 0 ? (
                                            <p className="text-[11px] text-gray-300 italic text-center pt-4">—</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {dayTasks.map(t => (
                                                    <button key={t.id} onClick={() => setDetailTask(t)}
                                                        className={`w-full text-left p-2 rounded-lg border text-xs hover:shadow-sm transition-shadow ${STATUS_CLS[t.status] || STATUS_CLS.pending}`}>
                                                        <div className="flex items-start gap-2">
                                                            <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${STATUS_DOT[t.status]}`} />
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-bold truncate">{t.apartments?.name || '—'}</p>
                                                                {t.assigned_to && <p className="text-[10px] opacity-75 truncate flex items-center gap-1"><User size={9} />{t.assigned_to}</p>}
                                                                {t.status === 'issue' && <p className="text-[10px] flex items-center gap-1 mt-0.5"><AlertTriangle size={9} /> Problema</p>}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* VISTA LISTA */}
            {view === 'list' && (
                <>
                    <div className="flex gap-2 mb-4">
                        <FilterPill active={listFilter === 'today'} onClick={() => setListFilter('today')}>Hoy</FilterPill>
                        <FilterPill active={listFilter === 'week'} onClick={() => setListFilter('week')}>Próximos 7 días</FilterPill>
                        <FilterPill active={listFilter === 'upcoming'} onClick={() => setListFilter('upcoming')}>Pendientes</FilterPill>
                        <FilterPill active={listFilter === 'all'} onClick={() => setListFilter('all')}>Todas</FilterPill>
                    </div>

                    {loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> :
                     tasks.length === 0 ? <p className="text-gray-500 font-serif italic">Sin tareas en este filtro.</p> :
                    (
                        <ul className="space-y-2">
                            {tasks.map(t => (
                                <li key={t.id} onClick={() => setDetailTask(t)}
                                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3 hover:shadow-md cursor-pointer transition-shadow">
                                    <div className="flex items-center gap-2 min-w-[140px]">
                                        <Brush size={14} className="text-rural-700" />
                                        <span className="font-bold tabular-nums text-text-primary text-sm">{t.scheduled_date}</span>
                                    </div>
                                    <div className="text-sm text-text-primary font-medium min-w-[120px]">{t.apartments?.name}</div>
                                    <div className="text-xs text-gray-600 flex-1 min-w-[200px]">
                                        {t.out_booking?.booking_code && <span>Sale <span className="font-mono">{t.out_booking.booking_code}</span></span>}
                                        {t.in_booking?.booking_code && <span className="ml-3">Entra <span className="font-mono">{t.in_booking.booking_code}</span></span>}
                                    </div>
                                    {t.assigned_to && <span className="text-xs text-gray-500 flex items-center gap-1"><User size={11} />{t.assigned_to}</span>}
                                    <span className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${STATUS_CLS[t.status] || STATUS_CLS.pending}`}>
                                        {STATUSES.find(s => s.value === t.status)?.label || t.status}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {detailTask && <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} onUpdate={updateField} />}
        </div>
    );
};

// ───────── Modal detalle de tarea ─────────

const TaskDetailModal = ({ task, onClose, onUpdate }) => {
    const [notes, setNotes] = useState(task.notes || '');
    const [assignedTo, setAssignedTo] = useState(task.assigned_to || '');
    const [isSaving, setIsSaving] = useState(false);

    const save = async () => {
        setIsSaving(true);
        await onUpdate(task.id, { notes: notes.trim() || null, assigned_to: assignedTo.trim() || null });
        setIsSaving(false);
    };

    const changeStatus = (newStatus) => {
        const patch = { status: newStatus };
        if (newStatus === 'in_progress' && !task.started_at) patch.started_at = new Date().toISOString();
        if (newStatus === 'done') patch.completed_at = new Date().toISOString();
        if (newStatus !== 'done') patch.completed_at = null;
        onUpdate(task.id, patch);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <header className="p-5 border-b border-gray-100 sticky top-0 bg-white z-10 flex items-start justify-between">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-rural-700 flex items-center gap-1">
                            <Brush size={11} /> Tarea de limpieza
                        </p>
                        <h3 className="font-serif text-xl font-bold mt-1">{task.apartments?.name}</h3>
                        <p className="text-sm text-gray-500">{task.scheduled_date}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                </header>

                <div className="p-5 space-y-5">
                    {/* Reservas relacionadas */}
                    <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                        {task.out_booking?.booking_code && (
                            <p><strong className="text-gray-700">Sale:</strong> <span className="font-mono text-primary">{task.out_booking.booking_code}</span> · {task.out_booking.guest_name}</p>
                        )}
                        {task.in_booking?.booking_code && (
                            <p><strong className="text-gray-700">Entra ese día:</strong> <span className="font-mono text-primary">{task.in_booking.booking_code}</span> · {task.in_booking.guest_name}</p>
                        )}
                        {!task.out_booking?.booking_code && !task.in_booking?.booking_code && (
                            <p className="text-gray-400 italic">Sin reservas relacionadas (limpieza programada manualmente)</p>
                        )}
                    </div>

                    {/* Estado */}
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Estado</p>
                        <div className="grid grid-cols-2 gap-2">
                            {STATUSES.map(s => (
                                <button key={s.value} onClick={() => changeStatus(s.value)}
                                    className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${task.status === s.value ? STATUS_CLS[s.value] + ' ring-2 ring-current' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Asignado a */}
                    <Field label="Asignado a">
                        <input type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                            placeholder="Nombre de la limpiadora"
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400" />
                    </Field>

                    {/* Notas */}
                    <Field label="Notas" hint="Incidencias, suministros faltantes, observaciones...">
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 text-sm" />
                    </Field>

                    {/* Timeline */}
                    {(task.started_at || task.completed_at) && (
                        <div className="text-xs text-gray-500 space-y-1 pt-3 border-t border-gray-100">
                            {task.started_at && <p className="flex items-center gap-2"><Clock size={11} /> Empezada {new Date(task.started_at).toLocaleString('es-ES')}</p>}
                            {task.completed_at && <p className="flex items-center gap-2"><Check size={11} className="text-green-600" /> Terminada {new Date(task.completed_at).toLocaleString('es-ES')}</p>}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
                    <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl">Cerrar</button>
                    <button onClick={save} disabled={isSaving}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-rural-700 text-white font-bold rounded-xl hover:bg-rural-800 disabled:opacity-50">
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

const Kpi = ({ label, value, color = 'rural' }) => {
    const palettes = {
        rural: 'bg-white border-gray-100 text-text-primary',
        amber: 'bg-amber-50 border-amber-100 text-amber-900',
        red:   'bg-red-50 border-red-100 text-red-700',
        gray:  'bg-white border-gray-100 text-gray-500',
    };
    return (
        <div className={`rounded-2xl border p-4 shadow-sm ${palettes[color]}`}>
            <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">{label}</p>
            <p className="font-serif font-bold text-2xl mt-1">{value}</p>
        </div>
    );
};

const FilterPill = ({ active, onClick, children }) => (
    <button onClick={onClick}
        className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
            active ? 'bg-primary text-white border-primary' : 'bg-white text-rural-700 border-gray-200 hover:border-rural-300'
        }`}>{children}</button>
);

const Field = ({ label, hint, children }) => (
    <label className="block">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">{label}</span>
        {children}
        {hint && <span className="block text-[11px] text-gray-400 mt-1 italic">{hint}</span>}
    </label>
);

export default CleaningManager;

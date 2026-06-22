import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    ClipboardList, Plus, Check, X, Edit3, Trash2, Loader2, Save, AlertTriangle,
    Calendar as CalendarIcon, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (s) => s ? fromYmd(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const CATEGORIES = [
    { value: 'legal',         label: 'Legal',          cls: 'bg-red-100 text-red-800 border-red-200' },
    { value: 'mantenimiento', label: 'Mantenimiento',  cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    { value: 'fiscal',        label: 'Fiscal',         cls: 'bg-purple-100 text-purple-800 border-purple-200' },
    { value: 'tecnico',       label: 'Técnico',        cls: 'bg-blue-100 text-blue-800 border-blue-200' },
    { value: 'comercial',     label: 'Comercial',      cls: 'bg-green-100 text-green-800 border-green-200' },
    { value: 'general',       label: 'General',        cls: 'bg-gray-100 text-gray-700 border-gray-200' },
];
const RECURRENCES = [
    { value: 'none',     label: 'Una sola vez' },
    { value: 'monthly',  label: 'Cada mes' },
    { value: 'quarterly', label: 'Cada 3 meses' },
    { value: 'biannual', label: 'Cada 6 meses' },
    { value: 'annual',   label: 'Cada año' },
];
const PRIORITIES = [
    { value: 'low',    label: 'Baja',   cls: 'bg-gray-100 text-gray-600' },
    { value: 'normal', label: 'Normal', cls: 'bg-blue-50 text-blue-700' },
    { value: 'high',   label: 'Alta',   cls: 'bg-red-50 text-red-700' },
];
const STATUSES = [
    { value: 'pending',     label: 'Pendiente',   cls: 'bg-amber-50 text-amber-700' },
    { value: 'in_progress', label: 'En curso',    cls: 'bg-blue-50 text-blue-700' },
    { value: 'done',        label: 'Hecha',       cls: 'bg-green-50 text-green-700' },
    { value: 'skipped',     label: 'No hacer',    cls: 'bg-gray-100 text-gray-500' },
];

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS_ES = ['L','M','X','J','V','S','D'];
const firstWeekdayMon0 = (y, m) => ((new Date(y, m, 1).getDay()) + 6) % 7;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

// Cuando se marca como hecha, calcula la siguiente fecha según recurrencia
const computeNextDate = (currentDateStr, recurrence) => {
    if (recurrence === 'none') return null;
    const d = fromYmd(currentDateStr);
    if (recurrence === 'monthly')   d.setMonth(d.getMonth() + 1);
    if (recurrence === 'quarterly') d.setMonth(d.getMonth() + 3);
    if (recurrence === 'biannual')  d.setMonth(d.getMonth() + 6);
    if (recurrence === 'annual')    d.setFullYear(d.getFullYear() + 1);
    return ymd(d);
};

const emptyTask = () => ({
    title: '', description: '', category: 'general',
    scheduled_date: ymd(new Date()), recurrence: 'none', priority: 'normal',
    assigned_to: '', auto_reschedule: true,
});

const InternalTasksManager = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [view, setView] = useState('list');  // 'list' | 'month'
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('internal_tasks')
            .select('*')
            .order('scheduled_date', { ascending: true })
            .limit(500);
        setTasks(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        return tasks.filter(t => {
            if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
            if (statusFilter === 'pending' && (t.status === 'done' || t.status === 'skipped')) return false;
            if (statusFilter === 'done' && t.status !== 'done') return false;
            if (statusFilter === 'all') return true;
            return true;
        });
    }, [tasks, categoryFilter, statusFilter]);

    const kpis = useMemo(() => {
        const today = ymd(new Date());
        const in30 = ymd(new Date(Date.now() + 30 * 86400000));
        const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
        return {
            total: pending.length,
            overdue: pending.filter(t => t.scheduled_date < today).length,
            soon: pending.filter(t => t.scheduled_date >= today && t.scheduled_date <= in30).length,
            high: pending.filter(t => t.priority === 'high').length,
        };
    }, [tasks]);

    const tasksByDay = useMemo(() => {
        const map = {};
        for (const t of tasks) {
            if (t.status === 'done' || t.status === 'skipped') continue;
            if (!map[t.scheduled_date]) map[t.scheduled_date] = [];
            map[t.scheduled_date].push(t);
        }
        return map;
    }, [tasks]);

    const save = async (form) => {
        const payload = { ...form };
        if (payload.id) {
            await supabase.from('internal_tasks').update(payload).eq('id', payload.id);
        } else {
            delete payload.id;
            await supabase.from('internal_tasks').insert(payload);
        }
        setEditing(null);
        load();
    };

    const remove = async (id) => {
        if (!confirm('¿Borrar esta tarea? Si tiene recurrencia, no se generarán más.')) return;
        await supabase.from('internal_tasks').delete().eq('id', id);
        load();
    };

    // Marcar como hecha + regenerar siguiente si tiene recurrencia
    const markDone = async (t) => {
        await supabase.from('internal_tasks').update({
            status: 'done',
            last_completed_at: new Date().toISOString(),
        }).eq('id', t.id);

        if (t.recurrence !== 'none' && t.auto_reschedule) {
            const nextDate = computeNextDate(t.scheduled_date, t.recurrence);
            if (nextDate) {
                await supabase.from('internal_tasks').insert({
                    title: t.title,
                    description: t.description,
                    category: t.category,
                    scheduled_date: nextDate,
                    recurrence: t.recurrence,
                    priority: t.priority,
                    assigned_to: t.assigned_to,
                    auto_reschedule: true,
                });
            }
        }
        load();
    };

    const todayStr = ymd(new Date());

    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Calendario de mantenimiento</h1>
                    <p className="text-sm text-gray-600 mt-1">Todo lo que toca hacer cada cierto tiempo: caldera, certificado digital, declaraciones, revisiones... Marca como hecha y la próxima se programa sola.</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                        <button onClick={() => setView('list')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${view === 'list' ? 'bg-white shadow text-rural-800' : 'text-gray-500'}`}>
                            Lista
                        </button>
                        <button onClick={() => setView('month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${view === 'month' ? 'bg-white shadow text-rural-800' : 'text-gray-500'}`}>
                            Calendario
                        </button>
                    </div>
                    <button onClick={() => setEditing(emptyTask())}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow hover:shadow-md">
                        <Plus size={14} /> Nueva tarea
                    </button>
                    <button onClick={load} className="p-2 text-sm font-bold text-rural-700 hover:text-primary">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <Kpi label="Pendientes total" value={kpis.total} />
                <Kpi label="Atrasadas" value={kpis.overdue} highlight={kpis.overdue > 0} />
                <Kpi label="Próximos 30 días" value={kpis.soon} />
                <Kpi label="De prioridad alta" value={kpis.high} highlight={kpis.high > 0} />
            </div>

            {editing && <TaskForm task={editing} onSave={save} onCancel={() => setEditing(null)} />}

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 mb-5">
                <SelectPill label="Categoría" value={categoryFilter} onChange={setCategoryFilter}
                    options={[{ value: 'all', label: 'Todas las categorías' }, ...CATEGORIES.map(c => ({ value: c.value, label: c.label }))]} />
                <SelectPill label="Estado" value={statusFilter} onChange={setStatusFilter}
                    options={[
                        { value: 'pending', label: 'Pendientes (por hacer)' },
                        { value: 'done', label: 'Hechas' },
                        { value: 'all', label: 'Todas' },
                    ]} />
            </div>

            {/* ─── Vista calendario mensual ─── */}
            {view === 'month' && (
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                            className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
                        <h3 className="font-serif font-bold text-xl text-rural-900">{MONTHS_ES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                            className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-2 text-center mb-2">
                        {WEEKDAYS_ES.map((w, i) => <span key={i} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{w}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: firstWeekdayMon0(currentMonth.getFullYear(), currentMonth.getMonth()) }, (_, i) => <div key={`e-${i}`} />)}
                        {Array.from({ length: daysInMonth(currentMonth.getFullYear(), currentMonth.getMonth()) }, (_, i) => {
                            const d = i + 1;
                            const key = ymd(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
                            const dayTasks = tasksByDay[key] || [];
                            const isToday = key === todayStr;
                            const isPast = key < todayStr;
                            return (
                                <div key={d} className={`min-h-[90px] rounded-xl border p-2 ${isToday ? 'border-rural-400 ring-2 ring-rural-100 bg-rural-50/30' : isPast && dayTasks.length > 0 ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50/40'}`}>
                                    <p className={`text-xs font-bold mb-1 ${isToday ? 'text-rural-900' : 'text-gray-600'}`}>{d}</p>
                                    {dayTasks.slice(0, 3).map(t => {
                                        const cat = CATEGORIES.find(c => c.value === t.category) || CATEGORIES[5];
                                        return (
                                            <button key={t.id} onClick={() => setEditing(t)}
                                                className={`block w-full text-left text-[10px] px-1.5 py-0.5 rounded mb-1 truncate hover:opacity-80 ${cat.cls}`}
                                                title={t.title}>
                                                {t.priority === 'high' && '⚠ '}{t.title}
                                            </button>
                                        );
                                    })}
                                    {dayTasks.length > 3 && <span className="text-[10px] text-gray-500">+{dayTasks.length - 3} más</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── Vista lista ─── */}
            {view === 'list' && (
                loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> :
                filtered.length === 0 ? <p className="text-gray-500 font-serif italic">No hay tareas con esos filtros.</p> :
                <ul className="space-y-3">
                    {filtered.map(t => {
                        const cat = CATEGORIES.find(c => c.value === t.category) || CATEGORIES[5];
                        const pri = PRIORITIES.find(p => p.value === t.priority) || PRIORITIES[1];
                        const sta = STATUSES.find(s => s.value === t.status) || STATUSES[0];
                        const isOverdue = t.scheduled_date < todayStr && t.status !== 'done' && t.status !== 'skipped';
                        return (
                            <li key={t.id}
                                className={`bg-white rounded-2xl border shadow-sm p-4 ${isOverdue ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'}`}>
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex-1 min-w-[280px]">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${cat.cls}`}>{cat.label}</span>
                                            {t.priority === 'high' && <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${pri.cls}`}>{pri.label}</span>}
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${sta.cls}`}>{sta.label}</span>
                                            {isOverdue && <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><AlertTriangle size={9} /> Atrasada</span>}
                                            {t.recurrence !== 'none' && <span className="text-[10px] text-gray-500">↻ {RECURRENCES.find(r => r.value === t.recurrence)?.label}</span>}
                                        </div>
                                        <p className="font-bold text-text-primary">{t.title}</p>
                                        {t.description && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{t.description}</p>}
                                        <p className="text-xs text-gray-500 mt-2 flex flex-wrap gap-x-3 gap-y-1 items-center">
                                            <CalendarIcon size={11} className="inline" /> <span className={isOverdue ? 'font-bold text-red-700' : ''}>{fmtDate(t.scheduled_date)}</span>
                                            {t.assigned_to && <span>· {t.assigned_to}</span>}
                                            {t.last_completed_at && <span>· última vez {new Date(t.last_completed_at).toLocaleDateString('es-ES')}</span>}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        {t.status !== 'done' && (
                                            <button onClick={() => markDone(t)} className="p-2 rounded-lg text-green-700 hover:bg-green-50" title="Marcar como hecha">
                                                <Check size={14} />
                                            </button>
                                        )}
                                        <button onClick={() => setEditing(t)} className="p-2 rounded-lg text-rural-700 hover:bg-rural-50" title="Editar">
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={() => remove(t.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Borrar">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

const TaskForm = ({ task, onSave, onCancel }) => {
    const [form, setForm] = useState(task);
    const set = (k, v) => setForm({ ...form, [k]: v });
    const [isSaving, setIsSaving] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.scheduled_date) {
            alert('Faltan título y fecha.');
            return;
        }
        setIsSaving(true);
        await onSave(form);
        setIsSaving(false);
    };

    return (
        <form onSubmit={submit} className="bg-rural-50 border border-rural-200 rounded-2xl p-5 mb-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-lg font-bold">{form.id ? 'Editar tarea' : 'Nueva tarea'}</h3>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="space-y-3">
                <Field label="Título" required>
                    <input type="text" value={form.title} onChange={e => set('title', e.target.value)} required
                        placeholder="Ej: Revisión anual de la caldera"
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary" />
                </Field>
                <Field label="Descripción" hint="Detalles, qué empresa lo hace, dónde está el contrato...">
                    <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary text-sm" />
                </Field>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Field label="Categoría">
                        <select value={form.category} onChange={e => set('category', e.target.value)}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary cursor-pointer">
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Fecha">
                        <input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} required
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary" />
                    </Field>
                    <Field label="Repetir">
                        <select value={form.recurrence} onChange={e => set('recurrence', e.target.value)}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary cursor-pointer">
                            {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Prioridad">
                        <select value={form.priority} onChange={e => set('priority', e.target.value)}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary cursor-pointer">
                            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Estado">
                        <select value={form.status || 'pending'} onChange={e => set('status', e.target.value)}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary cursor-pointer">
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Responsable">
                        <input type="text" value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)}
                            placeholder="Jesús, Mari Carmen…"
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary" />
                    </Field>
                </div>
                {form.recurrence !== 'none' && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={!!form.auto_reschedule} onChange={e => set('auto_reschedule', e.target.checked)}
                            className="w-4 h-4 accent-rural-700" />
                        <span>Cuando la marque como hecha, crear automáticamente la siguiente</span>
                    </label>
                )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-rural-700 font-bold rounded-xl hover:bg-rural-100">Cancelar</button>
                <button type="submit" disabled={isSaving}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white font-bold rounded-xl shadow hover:shadow-md disabled:opacity-50">
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
                </button>
            </div>
        </form>
    );
};

const Kpi = ({ label, value, highlight }) => (
    <div className={`rounded-2xl border p-4 shadow-sm ${highlight ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</p>
        <p className={`font-serif font-bold text-2xl mt-1 ${highlight ? 'text-red-700' : 'text-text-primary'}`}>{value}</p>
    </div>
);

const SelectPill = ({ label, value, onChange, options }) => (
    <label className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm">
        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}:</span>
        <select value={value} onChange={e => onChange(e.target.value)} className="bg-transparent outline-none text-sm font-medium cursor-pointer">
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    </label>
);

const Field = ({ label, hint, required, children }) => (
    <label className="block">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</span>
        {children}
        {hint && <span className="block text-[11px] text-gray-400 mt-1 italic">{hint}</span>}
    </label>
);

export default InternalTasksManager;

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    RefreshCw, Plus, Trash2, Edit3, X, Power, ChevronLeft, ChevronRight,
    TrendingUp, TrendingDown, Calendar as CalendarIcon, Info,
} from 'lucide-react';

// ─────── tipos de regla con metadata ───────
const RULE_TYPES = [
    { value: 'weekend_premium',  label: 'Cobrar más fines de semana', icon: TrendingUp,   tone: 'amber', help: 'Sube el precio los días seleccionados en "días semana" (ej FRI,SAT).' },
    { value: 'last_minute',      label: 'Descuento última hora',      icon: TrendingDown, tone: 'green', help: 'Baja el precio si reservan a menos de N días vista.' },
    { value: 'early_bird',       label: 'Descuento con antelación',   icon: TrendingDown, tone: 'green', help: 'Baja el precio si reservan con más de N días vista.' },
    { value: 'min_nights',       label: 'Mínimo de noches',           icon: Info,         tone: 'blue',  help: 'Obliga a reservar mínimo N noches en ciertas fechas.' },
    { value: 'occupancy_boost',  label: 'Subir por alta ocupación',   icon: TrendingUp,   tone: 'amber', help: 'Sube el precio cuando la ocupación del fin de semana o periodo supera un umbral.' },
];

const TONE_CLS = {
    amber: 'bg-amber-100 text-amber-900 border-amber-200',
    green: 'bg-green-100 text-green-900 border-green-200',
    blue:  'bg-blue-100 text-blue-900 border-blue-200',
};

const emptyRule = () => ({
    apartment_id: null, name: '', rule_type: 'weekend_premium',
    multiplier: 1.20, flat_extra: null,
    threshold_days: null, weekday_mask: 'FRI,SAT', occupancy_threshold: null,
    valid_from: null, valid_until: null,
    active: true, priority: 0,
});

// ─────── utilidades fecha ───────
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS_ES = ['L','M','X','J','V','S','D'];
const WEEKDAY_CODES = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const firstWeekdayMon0 = (y, m) => ((new Date(y, m, 1).getDay()) + 6) % 7;

// Devuelve las reglas que aplican un día concreto.
// Solo se evalúan las reglas con base temporal predecible: weekend_premium y reglas con valid_from/until.
// last_minute / early_bird / occupancy dependen del momento de la reserva, no se pintan.
function rulesActiveOn(rules, dateStr) {
    const d = new Date(dateStr);
    const wd = WEEKDAY_CODES[((d.getDay()) + 6) % 7];  // lunes=MON
    return rules.filter(r => {
        if (!r.active) return false;
        if (r.valid_from && dateStr < r.valid_from) return false;
        if (r.valid_until && dateStr > r.valid_until) return false;
        if (r.rule_type === 'weekend_premium') {
            const days = (r.weekday_mask || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            return days.includes(wd);
        }
        // min_nights con valid_from/until aplica al rango (no pinta, es restricción)
        // last_minute / early_bird / occupancy: no se pintan
        return false;
    });
}

const PricingRulesManager = () => {
    const [rules, setRules] = useState([]);
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

    const load = useCallback(async () => {
        setLoading(true);
        const [r, a] = await Promise.all([
            supabase.from('pricing_rules').select('*').order('priority', { ascending: false }),
            supabase.from('apartments').select('id, name, slug').order('name'),
        ]);
        setRules(r.data || []);
        setApartments(a.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async (rule) => {
        const payload = { ...rule };
        if (payload.id) {
            await supabase.from('pricing_rules').update(payload).eq('id', payload.id);
        } else {
            delete payload.id;
            await supabase.from('pricing_rules').insert(payload);
        }
        setEditing(null);
        await load();
    };

    const remove = async (id) => {
        if (!confirm('¿Eliminar esta regla?')) return;
        await supabase.from('pricing_rules').delete().eq('id', id);
        await load();
    };

    const toggle = async (r) => {
        await supabase.from('pricing_rules').update({ active: !r.active }).eq('id', r.id);
        await load();
    };

    const todayKey = ymd(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    return (
        <div className="max-w-7xl space-y-8">
            <header className="flex justify-between items-end flex-wrap gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Recargos y descuentos</h1>
                    <p className="text-sm text-gray-600 mt-1">Reglas que suben o bajan el precio base según día, antelación u ocupación. {rules.length} regla{rules.length !== 1 ? 's' : ''} en total.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setEditing(emptyRule())}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow hover:shadow-md">
                        <Plus size={14} /> Nueva regla
                    </button>
                    <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </header>

            {editing && <RuleForm rule={editing} apartments={apartments} onSave={save} onCancel={() => setEditing(null)} />}

            {/* ─────── CALENDARIO VISUAL ─────── */}
            <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <CalendarIcon size={18} className="text-rural-700" />
                        <h3 className="font-serif font-bold text-lg text-text-primary">Cuándo se aplican</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setCalendarYear(y => y - 1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500" aria-label="Año anterior">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xl font-serif font-bold text-rural-900 tabular-nums px-2">{calendarYear}</span>
                        <button onClick={() => setCalendarYear(y => y + 1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500" aria-label="Año siguiente">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <p className="text-xs text-gray-500 mb-4">
                    Los días en color tienen alguna regla activa. <strong>Pasa el ratón por encima</strong> para ver qué regla aplica. Las reglas de antelación (última hora / pronto reservar / ocupación) no se pintan porque dependen de cuándo se hace la reserva.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 12 }, (_, m) => (
                        <MonthGrid key={m} year={calendarYear} month={m} rules={rules} todayKey={todayKey} />
                    ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-4 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber-200 border border-amber-300" /><span className="text-gray-600">Sobrecargo (fin de semana, etc.)</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-blue-100 border border-blue-200" /><span className="text-gray-600">Mínimo noches</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-50 border border-gray-200 ring-2 ring-rural-700" /><span className="text-gray-600">Hoy</span></span>
                </div>
            </section>

            {/* ─────── LISTA DE REGLAS ─────── */}
            <section>
                <h3 className="font-serif font-bold text-lg text-text-primary mb-3">Reglas definidas</h3>
                {loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> :
                 rules.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
                        <p className="text-gray-400 font-serif italic mb-2">Aún no has creado ninguna regla.</p>
                        <p className="text-xs text-gray-500">Crea una para ajustar precio según día, antelación u ocupación.</p>
                    </div>
                 ) :
                <ul className="space-y-3">
                    {rules.map(r => {
                        const meta = RULE_TYPES.find(t => t.value === r.rule_type) || RULE_TYPES[0];
                        const Icon = meta.icon;
                        return (
                            <li key={r.id} className={`bg-white rounded-2xl border shadow-sm p-4 transition-opacity ${r.active ? 'border-gray-100' : 'border-gray-200 opacity-50'}`}>
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border ${TONE_CLS[meta.tone]}`}>
                                                <Icon size={11} /> {meta.label}
                                            </span>
                                            {!r.active && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Desactivada</span>}
                                        </div>
                                        <p className="font-bold text-text-primary">{r.name || <span className="italic text-gray-400">Sin nombre</span>}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {r.apartment_id ? apartments.find(a => a.id === r.apartment_id)?.name || `Apt ${r.apartment_id}` : 'Todos los apartamentos'}
                                        </p>
                                        <p className="text-xs text-gray-700 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                            {r.multiplier && <span>× <strong>{r.multiplier}</strong> {r.multiplier > 1 ? `(+${Math.round((r.multiplier - 1) * 100)}%)` : `(−${Math.round((1 - r.multiplier) * 100)}%)`}</span>}
                                            {r.flat_extra && <span>+<strong>{r.flat_extra}€</strong>/noche</span>}
                                            {r.threshold_days != null && <span>umbral <strong>{r.threshold_days}</strong> días</span>}
                                            {r.weekday_mask && <span>días <strong>{r.weekday_mask}</strong></span>}
                                            {r.occupancy_threshold != null && <span>ocupación &gt;<strong>{Math.round(r.occupancy_threshold * 100)}%</strong></span>}
                                            {r.valid_from && <span>desde <strong>{r.valid_from}</strong></span>}
                                            {r.valid_until && <span>hasta <strong>{r.valid_until}</strong></span>}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => toggle(r)} title={r.active ? 'Desactivar' : 'Activar'}
                                            className={`p-2 rounded-lg ${r.active ? 'text-green-700 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}>
                                            <Power size={14} />
                                        </button>
                                        <button onClick={() => setEditing(r)} className="p-2 rounded-lg text-rural-700 hover:bg-rural-50">
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={() => remove(r.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>}
            </section>
        </div>
    );
};

const MonthGrid = ({ year, month, rules, todayKey }) => {
    const total = daysInMonth(year, month);
    const offset = firstWeekdayMon0(year, month);
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);

    return (
        <div className="bg-gray-50/60 rounded-2xl p-3 border border-gray-100">
            <p className="font-serif font-bold text-sm text-rural-900 mb-2 text-center">{MONTHS_ES[month]}</p>
            <div className="grid grid-cols-7 gap-px mb-1">
                {WEEKDAYS_ES.map((w, i) => <div key={i} className="text-[9px] font-bold text-gray-400 text-center">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                    if (d === null) return <div key={i} />;
                    const key = ymd(year, month, d);
                    const active = rulesActiveOn(rules, key);
                    const isToday = key === todayKey;
                    const hasPremium = active.some(r => r.rule_type === 'weekend_premium' || r.rule_type === 'occupancy_boost');
                    const hasMinNights = active.some(r => r.rule_type === 'min_nights');
                    let cls = 'bg-gray-50 text-gray-500';
                    if (hasPremium) cls = 'bg-amber-200 text-amber-900';
                    else if (hasMinNights) cls = 'bg-blue-100 text-blue-900';

                    const tooltip = active.length > 0
                        ? `${d} ${MONTHS_ES[month].toLowerCase()}: ${active.map(r => r.name || RULE_TYPES.find(t => t.value === r.rule_type)?.label).join(' · ')}`
                        : `${d} ${MONTHS_ES[month].toLowerCase()} — sin reglas`;

                    return (
                        <div key={i} title={tooltip}
                            className={`text-[11px] text-center py-1 rounded-md font-medium ${cls} ${isToday ? 'ring-2 ring-rural-700 font-bold' : ''}`}>
                            {d}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const RuleForm = ({ rule, apartments, onSave, onCancel }) => {
    const [form, setForm] = useState(rule);
    const set = (k, v) => setForm({ ...form, [k]: v });
    const meta = RULE_TYPES.find(t => t.value === form.rule_type);

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}
            className="bg-rural-50 border border-rural-200 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
                <h2 className="font-serif text-lg font-bold text-text-primary">{form.id ? 'Editar regla' : 'Nueva regla'}</h2>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            {meta?.help && (
                <div className="bg-white border border-rural-100 rounded-xl p-3 mb-4 text-sm text-rural-800 flex gap-2">
                    <Info size={14} className="shrink-0 mt-0.5" />
                    <span>{meta.help}</span>
                </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <FormField label="Nombre" value={form.name} onChange={(v) => set('name', v)} required />
                <FormField label="Tipo de regla" type="select" value={form.rule_type} onChange={(v) => set('rule_type', v)}
                    options={RULE_TYPES.map(t => ({ value: t.value, label: t.label }))} />
                <FormField label="Apartamento" type="select" value={form.apartment_id || ''}
                    onChange={(v) => set('apartment_id', v ? Number(v) : null)}
                    options={[{ value: '', label: 'Todos los apartamentos' }, ...apartments.map(a => ({ value: a.id, label: a.name }))]} />
                <FormField label="Prioridad" type="number" value={form.priority || 0} onChange={(v) => set('priority', Number(v))}
                    hint="Si dos reglas chocan, gana la de prioridad mayor" />
                <FormField label="Multiplicador" type="number" step="0.01" value={form.multiplier ?? ''} onChange={(v) => set('multiplier', v ? Number(v) : null)}
                    hint="1.20 = +20% · 0.85 = −15%" />
                <FormField label="Extra fijo €/noche" type="number" step="0.01" value={form.flat_extra ?? ''} onChange={(v) => set('flat_extra', v ? Number(v) : null)} />
                {(form.rule_type === 'last_minute' || form.rule_type === 'early_bird' || form.rule_type === 'min_nights') && (
                    <FormField label="Umbral en días" type="number" value={form.threshold_days ?? ''} onChange={(v) => set('threshold_days', v ? Number(v) : null)} />
                )}
                {form.rule_type === 'weekend_premium' && (
                    <FormField label="Días de la semana" value={form.weekday_mask || ''} onChange={(v) => set('weekday_mask', v.toUpperCase())}
                        hint="Ej: FRI,SAT (lun=MON, mar=TUE, mié=WED, jue=THU, vie=FRI, sáb=SAT, dom=SUN)" />
                )}
                {form.rule_type === 'occupancy_boost' && (
                    <FormField label="Ocupación umbral (0-1)" type="number" step="0.01" value={form.occupancy_threshold ?? ''} onChange={(v) => set('occupancy_threshold', v ? Number(v) : null)}
                        hint="0.80 = aplicar cuando 80% ocupado" />
                )}
                <FormField label="Activa" type="checkbox" value={form.active} onChange={(v) => set('active', v)} />
                <FormField label="Aplicar desde" type="date" value={form.valid_from || ''} onChange={(v) => set('valid_from', v || null)}
                    hint="Vacío = sin fecha de inicio" />
                <FormField label="Aplicar hasta" type="date" value={form.valid_until || ''} onChange={(v) => set('valid_until', v || null)}
                    hint="Vacío = sin fecha de fin" />
            </div>
            <div className="flex gap-2 mt-4">
                <button type="submit" className="text-sm font-bold text-white bg-primary px-5 py-2 rounded-xl shadow hover:shadow-md">Guardar regla</button>
                <button type="button" onClick={onCancel} className="text-sm font-bold text-rural-700 px-4 py-2">Cancelar</button>
            </div>
        </form>
    );
};

const FormField = ({ label, type = 'text', value, onChange, options, required, step, hint }) => (
    <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">{label}</span>
        {type === 'select' ? (
            <select value={value} onChange={(e) => onChange(e.target.value)} required={required}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-primary text-sm cursor-pointer">
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        ) : type === 'checkbox' ? (
            <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-rural-700" />
        ) : (
            <input type={type} step={step} value={value} onChange={(e) => onChange(e.target.value)} required={required}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-primary text-sm" />
        )}
        {hint && <span className="block text-[10px] text-gray-400 mt-1 italic">{hint}</span>}
    </label>
);

export default PricingRulesManager;

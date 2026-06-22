import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Plus, Trash2, Edit3, X, Power } from 'lucide-react';

const RULE_TYPES = [
    { value: 'weekend_premium',  label: 'Recargo fin de semana' },
    { value: 'last_minute',      label: 'Descuento última hora' },
    { value: 'early_bird',       label: 'Descuento reserva anticipada' },
    { value: 'min_nights',       label: 'Estancia mínima' },
    { value: 'occupancy_boost',  label: 'Subida por ocupación' },
];

const emptyRule = () => ({
    apartment_id: null, name: '', rule_type: 'weekend_premium',
    multiplier: 1.20, flat_extra: null,
    threshold_days: null, weekday_mask: 'FRI,SAT', occupancy_threshold: null,
    valid_from: null, valid_until: null,
    active: true, priority: 0,
});

const PricingRulesManager = () => {
    const [rules, setRules] = useState([]);
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);

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

    return (
        <div className="max-w-6xl">
            <header className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Reglas de pricing</h1>
                    <p className="text-sm text-gray-500">Recargos y descuentos dinámicos · {rules.length} regla{rules.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setEditing(emptyRule())}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow hover:shadow-md">
                        <Plus size={14} /> Nueva regla
                    </button>
                    <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                        <RefreshCw size={14} /> Recargar
                    </button>
                </div>
            </header>

            {editing && <RuleForm rule={editing} apartments={apartments} onSave={save} onCancel={() => setEditing(null)} />}

            {loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> :
             rules.length === 0 ? <p className="text-gray-500 font-serif italic mt-6">Aún no has creado ninguna regla. Crea una para empezar a aplicar pricing dinámico.</p> :
            <ul className="space-y-3">
                {rules.map(r => (
                    <li key={r.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${r.active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                                <p className="font-bold text-text-primary">{r.name}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {RULE_TYPES.find(t => t.value === r.rule_type)?.label}
                                    {r.apartment_id ? ` · ${apartments.find(a => a.id === r.apartment_id)?.name}` : ' · todos los apartamentos'}
                                </p>
                                <p className="text-xs text-gray-600 mt-2">
                                    {r.multiplier && <span>×{r.multiplier} </span>}
                                    {r.flat_extra && <span>+{r.flat_extra}€ </span>}
                                    {r.threshold_days && <span>· umbral {r.threshold_days}d </span>}
                                    {r.weekday_mask && <span>· días {r.weekday_mask} </span>}
                                    {r.valid_from && <span>· desde {r.valid_from} </span>}
                                    {r.valid_until && <span>· hasta {r.valid_until} </span>}
                                </p>
                            </div>
                            <div className="flex gap-1">
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
                ))}
            </ul>}
        </div>
    );
};

const RuleForm = ({ rule, apartments, onSave, onCancel }) => {
    const [form, setForm] = useState(rule);
    const set = (k, v) => setForm({ ...form, [k]: v });

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}
            className="bg-rural-50 border border-rural-200 rounded-2xl p-5 mb-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="font-serif text-lg font-bold text-text-primary">{form.id ? 'Editar regla' : 'Nueva regla'}</h2>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <FormField label="Nombre" value={form.name} onChange={(v) => set('name', v)} required />
                <FormField label="Tipo" type="select" value={form.rule_type} onChange={(v) => set('rule_type', v)}
                    options={RULE_TYPES.map(t => ({ value: t.value, label: t.label }))} />
                <FormField label="Apartamento (vacío = todos)" type="select" value={form.apartment_id || ''}
                    onChange={(v) => set('apartment_id', v ? Number(v) : null)}
                    options={[{ value: '', label: 'Todos' }, ...apartments.map(a => ({ value: a.id, label: a.name }))]} />
                <FormField label="Prioridad" type="number" value={form.priority || 0} onChange={(v) => set('priority', Number(v))} />
                <FormField label="Multiplicador (ej 1.20 = +20%)" type="number" step="0.001" value={form.multiplier || ''} onChange={(v) => set('multiplier', v ? Number(v) : null)} />
                <FormField label="Extra fijo €/noche" type="number" step="0.01" value={form.flat_extra || ''} onChange={(v) => set('flat_extra', v ? Number(v) : null)} />
                <FormField label="Umbral días (last_min/early_bird/min_nights)" type="number" value={form.threshold_days || ''} onChange={(v) => set('threshold_days', v ? Number(v) : null)} />
                <FormField label="Días semana (ej FRI,SAT)" value={form.weekday_mask || ''} onChange={(v) => set('weekday_mask', v)} />
                <FormField label="Ocupación umbral 0-1" type="number" step="0.01" value={form.occupancy_threshold || ''} onChange={(v) => set('occupancy_threshold', v ? Number(v) : null)} />
                <FormField label="Activa" type="checkbox" value={form.active} onChange={(v) => set('active', v)} />
                <FormField label="Desde" type="date" value={form.valid_from || ''} onChange={(v) => set('valid_from', v || null)} />
                <FormField label="Hasta" type="date" value={form.valid_until || ''} onChange={(v) => set('valid_until', v || null)} />
            </div>
            <div className="flex gap-2 mt-4">
                <button type="submit" className="text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow hover:shadow-md">Guardar</button>
                <button type="button" onClick={onCancel} className="text-sm font-bold text-rural-700 px-4 py-2">Cancelar</button>
            </div>
        </form>
    );
};

const FormField = ({ label, type = 'text', value, onChange, options, required, step }) => (
    <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">{label}</span>
        {type === 'select' ? (
            <select value={value} onChange={(e) => onChange(e.target.value)} required={required}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-primary text-sm">
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        ) : type === 'checkbox' ? (
            <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-rural-700" />
        ) : (
            <input type={type} step={step} value={value} onChange={(e) => onChange(e.target.value)} required={required}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-primary text-sm" />
        )}
    </label>
);

export default PricingRulesManager;

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit3, Trash2, X, Save, Loader2, Power, ShoppingBag, RefreshCw } from 'lucide-react';
import { logError, userErrorMessage } from '../../utils/logger';

const PER_OPTIONS = [
    { value: 'stay',         label: 'Por estancia' },
    { value: 'night',        label: 'Por noche' },
    { value: 'person_night', label: 'Por persona y noche' },
];
const ICON_OPTIONS = ['Gift','Coffee','Clock','Baby','TreePine','Sandwich','Wine','Sparkles','Bath','Key'];

const fmtEur = (cents) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);

const emptyAddon = () => ({ name: '', description: '', price_cents: 1000, apartment_id: null, icon: 'Gift', per: 'stay', max_quantity: 10, active: true, sort_order: 0 });

const AddonsManager = () => {
    const [addons, setAddons] = useState([]);
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const [a, apt] = await Promise.all([
            supabase.from('addons').select('*').order('sort_order'),
            supabase.from('apartments').select('id, name').order('name'),
        ]);
        setAddons(a.data || []);
        setApartments(apt.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async (form) => {
        const payload = { ...form };
        if (payload.id) await supabase.from('addons').update(payload).eq('id', payload.id);
        else { delete payload.id; await supabase.from('addons').insert(payload); }
        setEditing(null);
        load();
    };

    const remove = async (id) => {
        if (!confirm('¿Borrar este extra? Las reservas que ya lo tienen comprado mantendrán el registro.')) return;
        await supabase.from('addons').delete().eq('id', id);
        load();
    };

    const toggle = async (a) => {
        await supabase.from('addons').update({ active: !a.active }).eq('id', a.id);
        load();
    };

    return (
        <div className="max-w-5xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Extras y servicios opcionales</h1>
                    <p className="text-sm text-gray-600 mt-1">Cosas que el huésped puede añadir al hacer el precheckin: cesta de bienvenida, late check-out, desayuno, cuna, leña...</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setEditing(emptyAddon())}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow"><Plus size={14} /> Nuevo extra</button>
                    <button onClick={load} className="p-2 text-rural-700"><RefreshCw size={14} /></button>
                </div>
            </header>

            {editing && <AddonForm addon={editing} apartments={apartments} onSave={save} onCancel={() => setEditing(null)} />}

            {loading ? <p className="text-gray-500 italic">Cargando…</p> :
             addons.length === 0 ? <p className="text-gray-500 italic">No hay extras configurados.</p> :
            <ul className="space-y-3 mt-5">
                {addons.map(a => (
                    <li key={a.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${a.active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex-1 min-w-[260px]">
                                <p className="font-bold text-text-primary flex items-center gap-2"><ShoppingBag size={14} className="text-rural-700" /> {a.name}</p>
                                {a.description && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{a.description}</p>}
                                <p className="text-xs text-gray-500 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                    <span className="font-bold text-rural-700">{fmtEur(a.price_cents)}</span>
                                    <span>· {PER_OPTIONS.find(p => p.value === a.per)?.label}</span>
                                    {a.apartment_id && <span>· solo {apartments.find(x => x.id === a.apartment_id)?.name}</span>}
                                    {!a.apartment_id && <span>· todos los apartamentos</span>}
                                    {!a.active && <span className="text-gray-500">· desactivado</span>}
                                </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button onClick={() => toggle(a)} className={`p-2 rounded-lg ${a.active ? 'text-green-700 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}><Power size={14} /></button>
                                <button onClick={() => setEditing(a)} className="p-2 rounded-lg text-rural-700 hover:bg-rural-50"><Edit3 size={14} /></button>
                                <button onClick={() => remove(a.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>}
        </div>
    );
};

const AddonForm = ({ addon, apartments, onSave, onCancel }) => {
    const [form, setForm] = useState(addon);
    const [isSaving, setIsSaving] = useState(false);
    const set = (k, v) => setForm({ ...form, [k]: v });

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.price_cents) { alert('Faltan nombre y precio.'); return; }
        setIsSaving(true);
        await onSave(form);
        setIsSaving(false);
    };

    return (
        <form onSubmit={submit} className="bg-rural-50 border border-rural-200 rounded-2xl p-5 mb-5">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-lg font-bold">{form.id ? 'Editar extra' : 'Nuevo extra'}</h3>
                <button type="button" onClick={onCancel}><X size={18} /></button>
            </div>
            <div className="space-y-3">
                <Field label="Nombre" required>
                    <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
                        placeholder="Ej: Cesta de bienvenida"
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary" />
                </Field>
                <Field label="Descripción">
                    <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3}
                        placeholder="Qué incluye, qué hace especial este extra..."
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary text-sm" />
                </Field>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Precio (€)" required>
                        <input type="number" min="0" step="0.5" value={(form.price_cents || 0) / 100}
                            onChange={e => set('price_cents', Math.round(parseFloat(e.target.value || 0) * 100))} required
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary" />
                    </Field>
                    <Field label="Cobrar">
                        <select value={form.per} onChange={e => set('per', e.target.value)}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary cursor-pointer">
                            {PER_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Apartamento">
                        <select value={form.apartment_id || ''} onChange={e => set('apartment_id', e.target.value ? Number(e.target.value) : null)}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary cursor-pointer">
                            <option value="">Todos</option>
                            {apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Icono">
                        <select value={form.icon || 'Gift'} onChange={e => set('icon', e.target.value)}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary cursor-pointer">
                            {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                    </Field>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!form.active} onChange={e => set('active', e.target.checked)} className="w-4 h-4 accent-rural-700" />
                    <span>Activo (visible para huéspedes en precheckin)</span>
                </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-rural-700 font-bold">Cancelar</button>
                <button type="submit" disabled={isSaving}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white font-bold rounded-xl shadow disabled:opacity-50">
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
                </button>
            </div>
        </form>
    );
};

const Field = ({ label, required, children }) => (
    <label className="block">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</span>
        {children}
    </label>
);

export default AddonsManager;

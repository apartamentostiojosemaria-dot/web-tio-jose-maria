import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logError, userErrorMessage } from '../../utils/logger';
import { useApartments } from '../../hooks/useDatabase';
import {
    Plus, Save, X, Trash2, Pencil, Loader2, BookOpen,
    MapPin, Key, Clock, Wifi, Flame, UtensilsCrossed,
    ThermometerSun, Shirt, DoorOpen, Info, GripVertical,
    Eye, EyeOff
} from 'lucide-react';

const CATEGORY_OPTIONS = [
    { value: 'llegada', label: 'Llegada', icon: MapPin },
    { value: 'apartamento', label: 'Apartamento', icon: Key },
    { value: 'wifi', label: 'WiFi', icon: Wifi },
    { value: 'chimenea', label: 'Chimenea', icon: Flame },
    { value: 'cocina', label: 'Cocina', icon: UtensilsCrossed },
    { value: 'calefaccion', label: 'Calefaccion', icon: ThermometerSun },
    { value: 'limpieza', label: 'Limpieza', icon: Shirt },
    { value: 'salida', label: 'Salida', icon: DoorOpen },
    { value: 'otro', label: 'Otro', icon: Info },
];

const ICON_OPTIONS = [
    { value: 'map-pin', label: 'Ubicacion', Icon: MapPin },
    { value: 'key', label: 'Llave', Icon: Key },
    { value: 'clock', label: 'Reloj', Icon: Clock },
    { value: 'wifi', label: 'WiFi', Icon: Wifi },
    { value: 'flame', label: 'Fuego', Icon: Flame },
    { value: 'utensils-crossed', label: 'Cocina', Icon: UtensilsCrossed },
    { value: 'thermometer', label: 'Temperatura', Icon: ThermometerSun },
    { value: 'shirt', label: 'Ropa', Icon: Shirt },
    { value: 'door-open', label: 'Puerta', Icon: DoorOpen },
    { value: 'info', label: 'Info', Icon: Info },
];

const EMPTY_INSTRUCTION = {
    apartment_id: null,
    category: 'apartamento',
    title: '',
    content: '',
    icon: 'info',
    sort_order: 0,
};

const InstructionsManager = () => {
    const [instructions, setInstructions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const { apartments } = useApartments();

    useEffect(() => { fetchInstructions(); }, []);

    async function fetchInstructions() {
        setLoading(true);
        const { data, error } = await supabase.from('apartment_instructions').select('*, apartments(name)').order('sort_order').order('category');
        if (error) logError('InstructionsManager.fetch', error);
        if (data) setInstructions(data);
        setLoading(false);
    }

    const resetForm = () => setEditingItem(null);

    const handleSave = async () => {
        if (!editingItem.title || !editingItem.content) return alert('Titulo y contenido son obligatorios.');
        setSaving(true);
        const { id, created_at, apartments: _, ...payload } = editingItem;
        if (payload.apartment_id === 'null' || payload.apartment_id === '') payload.apartment_id = null;

        let error;
        if (id) {
            ({ error } = await supabase.from('apartment_instructions').update(payload).eq('id', id));
        } else {
            ({ error } = await supabase.from('apartment_instructions').insert([payload]));
        }
        if (error) {
            logError('InstructionsManager.save', error);
            alert(userErrorMessage('Error al guardar.'));
        } else { resetForm(); fetchInstructions(); }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Eliminar esta instruccion?')) return;
        await supabase.from('apartment_instructions').delete().eq('id', id);
        if (editingItem?.id === id) resetForm();
        fetchInstructions();
    };

    const grouped = instructions.reduce((acc, inst) => {
        const key = inst.apartment_id ? `apt-${inst.apartment_id}` : 'general';
        if (!acc[key]) acc[key] = { label: inst.apartment_id ? inst.apartments?.name || 'Apartamento' : 'Todos los apartamentos', items: [] };
        acc[key].items.push(inst);
        return acc;
    }, {});

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando instrucciones...</div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-text-primary">Guia del Apartamento</h1>
                    <p className="text-sm text-gray-400 mt-1">{instructions.length} instrucciones — esto es lo que ve el cliente en su portal</p>
                </div>
                <button onClick={() => setEditingItem({ ...EMPTY_INSTRUCTION })} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all">
                    <Plus size={16} /> Nueva Instruccion
                </button>
            </div>

            {Object.entries(grouped).map(([key, group]) => (
                <div key={key} className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3 px-1">
                        {key === 'general' ? 'Aplica a todos los apartamentos' : group.label}
                    </h3>
                    <div className="space-y-2">
                        {group.items.map(inst => {
                            const catConfig = CATEGORY_OPTIONS.find(c => c.value === inst.category);
                            const CatIcon = catConfig?.icon || Info;
                            return (
                                <div key={inst.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4 hover:shadow-md transition-shadow group">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <CatIcon size={18} className="text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-sm text-text-primary">{inst.title}</h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">{catConfig?.label || inst.category}</span>
                                            <span className="text-[10px] text-gray-300">#{inst.sort_order}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 line-clamp-2">{inst.content}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingItem({ ...inst })} className="p-2 rounded-lg hover:bg-gray-50"><Pencil size={14} className="text-gray-400" /></button>
                                        <button onClick={() => handleDelete(inst.id)} className="p-2 rounded-lg hover:bg-red-50"><Trash2 size={14} className="text-red-400" /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {instructions.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="font-serif italic">No hay instrucciones. Crea la primera.</p>
                </div>
            )}

            {/* Edit modal */}
            {editingItem && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-start justify-center overflow-y-auto p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                            <h2 className="font-serif font-bold text-lg text-text-primary">
                                {editingItem.id ? 'Editar Instruccion' : 'Nueva Instruccion'}
                            </h2>
                            <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Titulo *</label>
                                <input type="text" value={editingItem.title} onChange={e => setEditingItem(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200"
                                    placeholder="Ej: Conexion WiFi" />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Contenido *</label>
                                <textarea value={editingItem.content} onChange={e => setEditingItem(prev => ({ ...prev, content: e.target.value }))}
                                    rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 resize-y"
                                    placeholder="Instrucciones detalladas para el huesped..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Categoria</label>
                                    <select value={editingItem.category} onChange={e => setEditingItem(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 bg-white">
                                        {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Apartamento</label>
                                    <select value={editingItem.apartment_id || 'null'} onChange={e => setEditingItem(prev => ({ ...prev, apartment_id: e.target.value === 'null' ? null : parseInt(e.target.value) }))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 bg-white">
                                        <option value="null">Todos los apartamentos</option>
                                        {apartments.map(apt => <option key={apt.id} value={apt.id}>{apt.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Icono</label>
                                    <div className="flex flex-wrap gap-2">
                                        {ICON_OPTIONS.map(({ value, Icon }) => (
                                            <button key={value} onClick={() => setEditingItem(prev => ({ ...prev, icon: value }))}
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${editingItem.icon === value ? 'bg-primary text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                                                <Icon size={18} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Orden</label>
                                    <input type="number" value={editingItem.sort_order} onChange={e => setEditingItem(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200"
                                        min="0" max="99" />
                                    <p className="text-[10px] text-gray-400 mt-1">Menor numero = aparece primero</p>
                                </div>
                            </div>
                        </div>

                        <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-gray-100 px-6 py-4 flex items-center justify-between">
                            <button onClick={resetForm} className="px-5 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600">Cancelar</button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstructionsManager;

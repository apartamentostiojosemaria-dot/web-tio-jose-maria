import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

import { logError, userErrorMessage } from '../../utils/logger';
import {
    Plus, Save, X, Trash2, Pencil, Loader2, MapPin,
    Phone, Globe, Utensils, Mountain, ShieldAlert, Pill,
    Fuel, Landmark, Store, Building, TreePine
} from 'lucide-react';

const TYPE_OPTIONS = [
    { value: 'restaurante', label: 'Restaurante', icon: Utensils },
    { value: 'turismo_activo', label: 'Turismo Activo', icon: Mountain },
    { value: 'patrimonio', label: 'Patrimonio', icon: Landmark },
    { value: 'naturaleza', label: 'Naturaleza', icon: TreePine },
    { value: 'emergencia', label: 'Emergencia', icon: ShieldAlert },
    { value: 'farmacia', label: 'Farmacia', icon: Pill },
    { value: 'supermercado', label: 'Supermercado', icon: Store },
    { value: 'gasolinera', label: 'Gasolinera', icon: Fuel },
    { value: 'banco', label: 'Banco', icon: Building },
    { value: 'servicio', label: 'Servicio', icon: Store },
    { value: 'otro', label: 'Otro', icon: MapPin },
];

const EMPTY_PLACE = {
    name: '', description: '', type: 'restaurante',
    address: '', phone: '', web_url: '', location_url: '', image_url: '',
};

const PlacesManager = () => {
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingPlace, setEditingPlace] = useState(null);
    const [filterType, setFilterType] = useState('all');

    useEffect(() => { fetchPlaces(); }, []);

    async function fetchPlaces() {
        setLoading(true);
        const { data, error } = await supabase.from('local_places').select('*').order('type').order('name');
        if (error) logError('PlacesManager.fetch', error);
        if (data) setPlaces(data);
        setLoading(false);
    }

    const resetForm = () => setEditingPlace(null);

    const handleSave = async () => {
        if (!editingPlace.name) return alert('El nombre es obligatorio.');
        setSaving(true);
        const { id, updated_at, ...payload } = editingPlace;

        let error;
        if (id) {
            ({ error } = await supabase.from('local_places').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id));
        } else {
            ({ error } = await supabase.from('local_places').insert([payload]));
        }
        if (error) {
            logError('PlacesManager.save', error);
            alert(userErrorMessage('Error al guardar.'));
        } else { resetForm(); fetchPlaces(); }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este sitio?')) return;
        await supabase.from('local_places').delete().eq('id', id);
        if (editingPlace?.id === id) resetForm();
        fetchPlaces();
    };

    const filtered = filterType === 'all' ? places : places.filter(p => p.type === filterType);
    const typeCounts = {};
    places.forEach(p => { typeCounts[p.type] = (typeCounts[p.type] || 0) + 1; });

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando directorio...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-bold text-text-primary">Directorio Local</h3>
                    <p className="text-sm text-gray-500">{places.length} sitios en el directorio</p>
                </div>
                <button onClick={() => setEditingPlace({ ...EMPTY_PLACE })} className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-md bg-primary">
                    <Plus size={18} /> Nuevo Sitio
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                <button onClick={() => setFilterType('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'text-white bg-primary' : 'bg-white border border-gray-100 text-gray-500'}`}>
                    Todos ({places.length})
                </button>
                {TYPE_OPTIONS.filter(t => typeCounts[t.value]).map(t => (
                    <button key={t.value} onClick={() => setFilterType(t.value)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === t.value ? 'text-white bg-primary' : 'bg-white border border-gray-100 text-gray-500'}`}>
                        {t.label} ({typeCounts[t.value]})
                    </button>
                ))}
            </div>

            {editingPlace && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] max-w-2xl w-full shadow-2xl my-8">
                        <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 border-b border-gray-100 flex justify-between items-center rounded-t-[2rem] z-10">
                            <h4 className="text-xl font-serif font-bold">{editingPlace.id ? 'Editar Sitio' : 'Nuevo Sitio'}</h4>
                            <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
                        </div>
                        <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nombre *</label>
                                    <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editingPlace.name} onChange={e => setEditingPlace({ ...editingPlace, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Tipo</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editingPlace.type || 'otro'} onChange={e => setEditingPlace({ ...editingPlace, type: e.target.value })}>
                                        {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Descripción</label>
                                <textarea className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none resize-none" rows={2} value={editingPlace.description || ''} onChange={e => setEditingPlace({ ...editingPlace, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dirección</label>
                                    <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editingPlace.address || ''} onChange={e => setEditingPlace({ ...editingPlace, address: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Teléfono</label>
                                    <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editingPlace.phone || ''} onChange={e => setEditingPlace({ ...editingPlace, phone: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Web</label>
                                    <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" value={editingPlace.web_url || ''} onChange={e => setEditingPlace({ ...editingPlace, web_url: e.target.value })} placeholder="https://..." />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Google Maps</label>
                                    <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" value={editingPlace.location_url || ''} onChange={e => setEditingPlace({ ...editingPlace, location_url: e.target.value })} placeholder="https://maps.google.com/..." />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL Imagen</label>
                                <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" value={editingPlace.image_url || ''} onChange={e => setEditingPlace({ ...editingPlace, image_url: e.target.value })} placeholder="https://..." />
                            </div>
                            {editingPlace.image_url && <img src={editingPlace.image_url} alt="Preview" className="w-full h-32 object-cover rounded-xl" />}
                        </div>
                        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end bg-gray-50/50 rounded-b-[2rem]">
                            <button onClick={resetForm} className="px-6 py-3 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl">Cancelar</button>
                            <button onClick={handleSave} disabled={saving} className="px-8 py-3 text-white font-bold rounded-2xl shadow-lg flex items-center gap-2 bg-primary">
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                {editingPlace.id ? 'Actualizar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-3">
                {filtered.map(place => {
                    const typeInfo = TYPE_OPTIONS.find(t => t.value === place.type) || TYPE_OPTIONS[TYPE_OPTIONS.length - 1];
                    const Icon = typeInfo.icon;
                    return (
                        <div key={place.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-rural-50 flex items-center justify-center flex-shrink-0">
                                <Icon size={18} className="text-primary" />
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h5 className="font-bold text-gray-800 truncate text-sm">{place.name}</h5>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">{typeInfo.label}</span>
                                </div>
                                <p className="text-xs text-gray-400 truncate">
                                    {[place.address, place.phone].filter(Boolean).join(' · ') || place.description || '—'}
                                </p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => setEditingPlace(place)} className="p-2 text-gray-300 hover:text-rural-500 transition-colors"><Pencil size={16} /></button>
                                <button onClick={() => handleDelete(place.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="p-16 text-center bg-white border-2 border-dashed rounded-3xl opacity-30 italic font-serif">No hay sitios en esta categoría.</div>
                )}
            </div>
        </div>
    );
};

export default PlacesManager;

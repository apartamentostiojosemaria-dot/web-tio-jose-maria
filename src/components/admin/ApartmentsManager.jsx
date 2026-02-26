import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { Plus, Edit2, Trash2, Camera, Check, X, Save } from 'lucide-react';

const ApartmentsManager = () => {
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    useEffect(() => {
        fetchApartments();
    }, []);

    async function fetchApartments() {
        setLoading(true);
        const { data, error } = await supabase.from('apartments').select('*').order('id');
        if (data) setApartments(data);
        setLoading(false);
    }

    const startEdit = (apt) => {
        setEditingId(apt.id);
        setEditForm(apt);
    };

    const handleSave = async () => {
        const { error } = await supabase
            .from('apartments')
            .update(editForm)
            .eq('id', editingId);

        if (!error) {
            setEditingId(null);
            fetchApartments();
        }
    };

    if (loading) return <div className="p-10 text-center animate-pulse">Cargando apartamentos...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Gestión de Apartamentos</h3>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold transition-all hover:scale-105" style={{ backgroundColor: COLORS.primary }}>
                    <Plus size={18} /> Nuevo Apartamento
                </button>
            </div>

            <div className="grid gap-6">
                {apartments.map(apt => (
                    <div key={apt.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-48 h-32 bg-gray-100 rounded-xl overflow-hidden relative group">
                            <img src={apt.images?.[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80'} alt={apt.name} className="w-full h-full object-cover" />
                            <button className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-xs font-bold uppercase">
                                <Camera size={14} /> Cambiar Fotos
                            </button>
                        </div>

                        <div className="flex-grow space-y-2">
                            {editingId === apt.id ? (
                                <div className="space-y-4">
                                    <input
                                        className="text-xl font-bold w-full border-b focus:outline-none"
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    />
                                    <textarea
                                        className="w-full text-sm text-gray-500 border rounded-lg p-2 focus:outline-none"
                                        rows="3"
                                        value={editForm.description}
                                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-bold"><Check size={14} /> Guardar</button>
                                        <button onClick={() => setEditingId(null)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm font-bold"><X size={14} /> Cancelar</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between">
                                        <h4 className="text-xl font-bold" style={{ color: COLORS.text }}>{apt.name}</h4>
                                        <div className="flex gap-2">
                                            <button onClick={() => startEdit(apt)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors"><Edit2 size={18} /></button>
                                            <button className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 line-clamp-2">{apt.description}</p>
                                    <div className="flex gap-4 text-xs font-bold uppercase tracking-widest opacity-60">
                                        <span>Max {apt.capacity_people} pers.</span>
                                        <span>{apt.is_active ? '✅ Activo' : '❌ Inactivo'}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ApartmentsManager;

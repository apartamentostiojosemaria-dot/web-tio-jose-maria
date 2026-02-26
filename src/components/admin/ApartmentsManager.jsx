import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { Plus, Edit2, Trash2, Camera, Check, X, Save, Home, Users } from 'lucide-react';

const ApartmentsManager = () => {
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [showNewModal, setShowNewModal] = useState(false);
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

    const handleCreate = async (e) => {
        e.preventDefault();
        const { error } = await supabase.from('apartments').insert([editForm]);
        if (!error) {
            setShowNewModal(false);
            setEditForm({});
            fetchApartments();
        }
    };

    const handleUpdate = async () => {
        const { error } = await supabase
            .from('apartments')
            .update(editForm)
            .eq('id', editingId);

        if (!error) {
            setEditingId(null);
            fetchApartments();
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este apartamento?')) {
            const { error } = await supabase.from('apartments').delete().eq('id', id);
            if (!error) fetchApartments();
        }
    };

    const startEdit = (apt) => {
        setEditingId(apt.id);
        setEditForm(apt);
    };

    if (loading) return <div className="p-10 text-center animate-pulse font-serif italic text-gray-500">Cargando apartamentos...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Gestión de Apartamentos</h3>
                <button
                    onClick={() => { setShowNewModal(true); setEditForm({ is_active: true, capacity_people: 2 }); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-lg"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    <Plus size={18} /> Nuevo Apartamento
                </button>
            </div>

            {/* Modal de Creación */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h4 className="text-2xl font-serif font-bold">Añadir Apartamento</h4>
                            <button onClick={() => setShowNewModal(false)}><X /></button>
                        </div>
                        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold uppercase mb-1">Nombre</label>
                                <input required className="w-full p-3 bg-gray-50 rounded-xl" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase mb-1">Capacidad</label>
                                <input type="number" className="w-full p-3 bg-gray-50 rounded-xl" value={editForm.capacity_people || ''} onChange={e => setEditForm({ ...editForm, capacity_people: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase mb-1">Slug (URL)</label>
                                <input placeholder="ej: albahaca" className="w-full p-3 bg-gray-50 rounded-xl" value={editForm.slug || ''} onChange={e => setEditForm({ ...editForm, slug: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold uppercase mb-1">Descripción</label>
                                <textarea className="w-full p-3 bg-gray-50 rounded-xl" rows="3" value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                            </div>
                            <button type="submit" className="col-span-2 py-4 bg-green-600 text-white rounded-xl font-bold">Crear Apartamento</button>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid gap-6">
                {apartments.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        <Home className="mx-auto mb-4 opacity-20" size={48} />
                        <p className="text-gray-400 font-serif italic text-lg">No hay apartamentos todavía. ¡Crea el primero!</p>
                    </div>
                ) : (
                    apartments.map(apt => (
                        <div key={apt.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">
                            <div className="w-full md:w-56 h-36 bg-gray-100 rounded-xl overflow-hidden relative group">
                                <img src={apt.images?.[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80'} alt={apt.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-widest">{apt.images?.length || 0} Fotos configuradas</p>
                                </div>
                            </div>

                            <div className="flex-grow space-y-3">
                                {editingId === apt.id ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <input className="text-xl font-bold w-full border-b p-1" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                            <input className="text-sm border-b p-1" placeholder="Slug" value={editForm.slug} onChange={e => setEditForm({ ...editForm, slug: e.target.value })} />
                                        </div>
                                        <textarea className="w-full text-sm text-gray-500 border rounded-xl p-3" rows="3" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                                        <div className="flex gap-2">
                                            <button onClick={handleUpdate} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-green-700 transition-colors"><Check size={14} /> Guardar</button>
                                            <button onClick={() => setEditingId(null)} className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"><X size={14} /> Cancelar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>{apt.name}</h4>
                                                <p className="text-xs font-mono text-gray-400">/{apt.slug}</p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => startEdit(apt)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors bg-gray-50 rounded-lg"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(apt.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-gray-50 rounded-lg"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{apt.description || 'Sin descripción.'}</p>
                                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-rural-50 text-rural-700 rounded-md">
                                                <Users size={12} /> Max {apt.capacity_people || 2} pers.
                                            </div>
                                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${apt.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                {apt.is_active ? '✅ Visible' : '❌ Oculto'}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ApartmentsManager;

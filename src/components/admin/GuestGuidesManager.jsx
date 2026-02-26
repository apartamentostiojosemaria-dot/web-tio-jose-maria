import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { useGuestGuides } from '../../hooks/useDatabase';
import { Plus, Trash2, Save, X, Mountain, ChefHat, Tent, ChevronRight } from 'lucide-react';

const CATEGORIES = [
    { id: 'rutas', label: 'Rutas y Paisajes', icon: Mountain },
    { id: 'gastronomia', label: 'Sabores Locales', icon: ChefHat },
    { id: 'actividades', label: 'Aventura y Ocio', icon: Tent }
];

const GuestGuidesManager = () => {
    const { guides, loading } = useGuestGuides();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        category: 'rutas',
        title: '',
        description: '',
        order_index: 0
    });

    const resetForm = () => {
        setFormData({ category: 'rutas', title: '', description: '', order_index: 0 });
        setIsAdding(false);
        setEditingId(null);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.description) return alert('Por favor, rellena todos los campos');

        if (editingId) {
            await supabase.from('guest_guides').update(formData).eq('id', editingId);
        } else {
            await supabase.from('guest_guides').insert([formData]);
        }
        resetForm();
    };

    const handleDelete = async (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar esta recomendación?')) {
            await supabase.from('guest_guides').delete().eq('id', id);
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-rural-400 font-serif italic">Cargando guías...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Guía del Huésped</h2>
                    <p className="text-gray-500 text-sm">Gestiona lo que tus clientes verán en su área privada.</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold transition-transform hover:scale-105 shadow-lg"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        <Plus size={20} /> Añadir Recomendación
                    </button>
                )}
            </header>

            {isAdding && (
                <div className="bg-white p-8 rounded-3xl border border-rural-100 shadow-xl space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Categoría</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all font-bold"
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Título</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all"
                                placeholder="Ej: Cerrada del Río Castril"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Descripción</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all h-32 resize-none"
                            placeholder="Describe esta ruta, plato o actividad..."
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button onClick={resetForm} className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-colors">Cancelar</button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-8 py-3 rounded-xl text-white font-bold transition-all hover:shadow-lg"
                            style={{ backgroundColor: COLORS.primary }}
                        >
                            <Save size={18} /> Guardar
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-10">
                {CATEGORIES.map(category => (
                    <div key={category.id} className="space-y-4">
                        <h3 className="flex items-center gap-3 text-lg font-serif font-bold border-b border-gray-100 pb-2" style={{ color: COLORS.text }}>
                            <category.icon size={20} style={{ color: COLORS.primary }} />
                            {category.label}
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            {guides.filter(g => g.category === category.id).map(guide => (
                                <div key={guide.id} className="bg-white p-6 rounded-2xl border border-gray-50 shadow-sm relative group hover:border-rural-200 transition-all">
                                    <div className="pr-10">
                                        <h4 className="font-bold text-rural-900 mb-1 flex items-center gap-2">
                                            <ChevronRight size={14} style={{ color: COLORS.accent }} />
                                            {guide.title}
                                        </h4>
                                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 italic">{guide.description}</p>
                                    </div>
                                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setFormData(guide); setEditingId(guide.id); setIsAdding(true); }}
                                            className="p-2 text-gray-400 hover:text-rural-600 hover:bg-rural-50 rounded-lg transition-all"
                                        >
                                            <Plus size={16} className="rotate-45" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(guide.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GuestGuidesManager;

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
    const [activeTab, setActiveTab] = useState('rutas');
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        category: 'rutas',
        title: '',
        description: '',
        order_index: 0
    });

    // Update form category when tab changes if we are adding fresh
    useEffect(() => {
        if (!editingId) {
            setFormData(prev => ({ ...prev, category: activeTab }));
        }
    }, [activeTab, editingId]);

    const resetForm = () => {
        setFormData({ category: activeTab, title: '', description: '', order_index: 0 });
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

    const currentGuides = guides.filter(g => g.category === activeTab);
    const activeCategory = CATEGORIES.find(c => c.id === activeTab);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header>
                <h2 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Mi Guía Exclusiva</h2>
                <p className="text-gray-500 text-sm">Gestiona visualmente lo que ven tus clientes.</p>
            </header>

            {/* Categorías (mismo estilo que Área de Clientes) */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = activeTab === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => { setActiveTab(cat.id); setIsAdding(false); setEditingId(null); }}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${isActive
                                ? 'text-white shadow-lg'
                                : 'bg-white text-gray-500 border border-gray-100 hover:border-rural-200 shadow-sm'
                                }`}
                            style={isActive ? { backgroundColor: COLORS.primary } : {}}
                        >
                            <Icon size={18} />
                            {cat.label}
                        </button>
                    );
                })}
            </div>

            {/* Botón de añadir específico para la categoría activa */}
            <div className="flex justify-start">
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border-2 border-dashed hover:border-solid bg-transparent"
                        style={{ color: COLORS.primary, borderColor: COLORS.primary + '40' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.primary; e.currentTarget.style.backgroundColor = COLORS.bgWarm }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.primary + '40'; e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                        <Plus size={18} /> Añadir a {activeCategory?.label}
                    </button>
                )}
            </div>

            {/* Formulario Inline */}
            {isAdding && (
                <div className="bg-white p-6 rounded-3xl border border-rural-100 shadow-xl space-y-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-rural-50 rounded-full" style={{ color: COLORS.primary, backgroundColor: COLORS.bgWarm }}>
                            Nuevo Item: {activeCategory?.label}
                        </span>
                        <button onClick={resetForm} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                    </div>
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all font-bold"
                            placeholder="Título sugerente (ej: Cueva del Agua)"
                        />
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all h-24 resize-none text-sm"
                            placeholder="Describe brevemente el sitio, sabor o actividad..."
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-8 py-3 rounded-xl text-white font-bold transition-all hover:scale-105"
                                style={{ backgroundColor: COLORS.primary }}
                            >
                                <Save size={18} /> {editingId ? 'Actualizar' : 'Publicar en Guía'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cards (Estilo Cliente con Admin Controls) */}
            <div className="grid md:grid-cols-2 gap-4">
                {currentGuides.map((guide) => (
                    <div key={guide.id} className="bg-white p-6 rounded-2xl border border-gray-50 shadow-sm relative group hover:border-rural-200 transition-all">
                        <div className="pr-12">
                            <h4 className="font-bold text-rural-900 mb-2 flex items-center gap-2">
                                <ChevronRight size={14} style={{ color: COLORS.accent }} />
                                {guide.title}
                            </h4>
                            <p className="text-sm text-gray-500 leading-relaxed">{guide.description}</p>
                        </div>
                        <div className="absolute top-4 right-4 flex flex-col gap-2">
                            <button
                                onClick={() => { setFormData(guide); setEditingId(guide.id); setIsAdding(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                className="p-2 text-gray-400 hover:text-rural-600 hover:bg-rural-50 rounded-lg transition-all"
                                title="Editar"
                            >
                                <Plus size={16} className="rotate-45" />
                            </button>
                            <button
                                onClick={() => handleDelete(guide.id)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Eliminar"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
                {currentGuides.length === 0 && !isAdding && (
                    <div className="col-span-full text-center p-12 bg-white rounded-3xl border-2 border-dashed border-gray-100 text-gray-400 italic">
                        No hay nada en {activeCategory?.label} todavía.
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuestGuidesManager;

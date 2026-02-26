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
        image_url: '',
        video_url: '',
        location_url: '',
        difficulty: '',
        duration: '',
        order_index: 0
    });

    // Update form category when tab changes if we are adding fresh
    useEffect(() => {
        if (!editingId) {
            setFormData(prev => ({ ...prev, category: activeTab }));
        }
    }, [activeTab, editingId]);

    const resetForm = () => {
        setFormData({
            category: activeTab,
            title: '',
            description: '',
            image_url: '',
            video_url: '',
            location_url: '',
            difficulty: '',
            duration: '',
            order_index: 0
        });
        setIsAdding(false);
        setEditingId(null);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.description) return alert('Por favor, rellena al menos Título y Descripción');

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
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <header>
                <h2 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Mi Guía Exclusiva</h2>
                <p className="text-gray-500 text-sm">Gestiona visualmente lo que ven tus clientes (imágenes, vídeos, mapas...).</p>
            </header>

            {/* Categorías */}
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

            {/* Añadir */}
            {!isAdding && (
                <div className="flex justify-start">
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border-2 border-dashed hover:border-solid bg-transparent"
                        style={{ color: COLORS.primary, borderColor: COLORS.primary + '40' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.primary; e.currentTarget.style.backgroundColor = COLORS.bgWarm }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.primary + '40'; e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                        <Plus size={18} /> Añadir a {activeCategory?.label}
                    </button>
                </div>
            )}

            {/* Formulario Expandido */}
            {isAdding && (
                <div className="bg-white p-6 rounded-3xl border border-rural-100 shadow-2xl space-y-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-rural-50 rounded-full" style={{ color: COLORS.primary, backgroundColor: COLORS.bgWarm }}>
                            {editingId ? 'Editando Item' : 'Nuevo Item'}: {activeCategory?.label}
                        </span>
                        <button onClick={resetForm} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"><X size={20} /></button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Título</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all font-bold"
                                    placeholder="Nombre de la ruta, plato o sitio"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Descripción</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all h-32 resize-none text-sm leading-relaxed"
                                    placeholder="Describe los detalles..."
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL Imagen</label>
                                    <input
                                        type="url"
                                        value={formData.image_url}
                                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all text-xs"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL Vídeo</label>
                                    <input
                                        type="url"
                                        value={formData.video_url}
                                        onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all text-xs"
                                        placeholder="YouTube/Vimeo link"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL Google Maps (Cómo llegar)</label>
                                <input
                                    type="url"
                                    value={formData.location_url}
                                    onChange={(e) => setFormData({ ...formData, location_url: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all text-xs"
                                    placeholder="Pega el enlace de Google Maps"
                                />
                            </div>
                            {activeTab === 'rutas' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dificultad</label>
                                        <select
                                            value={formData.difficulty}
                                            onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all text-sm font-bold"
                                        >
                                            <option value="">No aplica</option>
                                            <option value="Baja">Baja</option>
                                            <option value="Media">Media</option>
                                            <option value="Alta">Alta</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Duración</label>
                                        <input
                                            type="text"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all text-sm"
                                            placeholder="Ej: 2h 30m"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end border-t border-gray-50 pt-4">
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-10 py-4 rounded-2xl text-white font-bold transition-all hover:scale-105 shadow-lg shadow-rural-200"
                            style={{ backgroundColor: COLORS.primary }}
                        >
                            <Save size={20} /> {editingId ? 'Guardar Cambios' : 'Publicar en Guía'}
                        </button>
                    </div>
                </div>
            )}

            {/* Cards Grid */}
            <div className="grid md:grid-cols-2 gap-6">
                {currentGuides.map((guide) => (
                    <div key={guide.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:border-rural-200 transition-all flex flex-col">
                        {guide.image_url && (
                            <div className="h-40 overflow-hidden relative">
                                <img src={guide.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={guide.title} />
                                <div className="absolute top-3 left-3 flex gap-2">
                                    {guide.video_url && <span className="p-1.5 bg-black/50 text-white rounded-lg backdrop-blur-sm"><Plus size={14} /></span>}
                                    {guide.location_url && <span className="p-1.5 bg-black/50 text-white rounded-lg backdrop-blur-sm"><MapPin size={14} /></span>}
                                </div>
                            </div>
                        )}
                        <div className="p-6 flex-grow relative">
                            <h4 className="font-bold text-rural-900 mb-2 pr-16 flex items-center gap-2">
                                <ChevronRight size={14} style={{ color: COLORS.accent }} />
                                {guide.title}
                            </h4>
                            <p className="text-sm text-gray-500 leading-relaxed mb-4 line-clamp-3">{guide.description}</p>

                            <div className="flex flex-wrap gap-2 mt-auto">
                                {guide.difficulty && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-gray-50 rounded text-gray-400">Dif: {guide.difficulty}</span>}
                                {guide.duration && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-gray-50 rounded text-gray-400">{guide.duration}</span>}
                            </div>

                            <div className="absolute top-6 right-6 flex flex-col gap-2">
                                <button
                                    onClick={() => { setFormData(guide); setEditingId(guide.id); setIsAdding(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                    className="p-2 bg-gray-50 text-gray-400 hover:text-rural-700 hover:bg-rural-100 rounded-xl transition-all shadow-sm"
                                    title="Editar"
                                >
                                    <Save size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(guide.id)}
                                    className="p-2 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm"
                                    title="Eliminar"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {currentGuides.length === 0 && !isAdding && (
                    <div className="col-span-full text-center p-16 bg-white rounded-[40px] border-2 border-dashed border-gray-100 text-gray-400 italic font-serif">
                        Tu guía de {activeCategory?.label} está esperando contenido.
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuestGuidesManager;

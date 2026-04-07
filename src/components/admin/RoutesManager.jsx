import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { logError, userErrorMessage } from '../../utils/logger';
import { validateImageFile } from '../../utils/fileValidation';
import {
    Plus, Save, X, Trash2, Pencil, Loader2, Map, Mountain,
    Clock, Ruler, TrendingUp, Image, Link as LinkIcon, Tag, Layers, Upload, Camera
} from 'lucide-react';

const DIFFICULTY_OPTIONS = [
    { value: 'facil', label: 'Fácil', emoji: '🟢' },
    { value: 'media', label: 'Media', emoji: '🟡' },
    { value: 'media-alta', label: 'Media-Alta', emoji: '🟠' },
    { value: 'alta', label: 'Alta', emoji: '🔴' },
];

const CATEGORY_OPTIONS = [
    { value: 'senderismo', label: 'Senderismo' },
    { value: 'ciclismo', label: 'Ciclismo' },
    { value: 'kayak', label: 'Kayak' },
    { value: 'caballo', label: 'A caballo' },
    { value: 'coche', label: 'En coche' },
    { value: 'otro', label: 'Otro' },
];

const GROUP_OPTIONS = [
    { value: 'walk', label: 'Andando desde casa' },
    { value: 'near', label: 'Muy cerca (15-20 min)' },
    { value: 'medium', label: 'Media hora en coche' },
    { value: 'day', label: 'Excursión de día' },
];

const EMPTY_ROUTE = {
    title: '',
    description: '',
    difficulty: 'facil',
    duration: '',
    distance_km: '',
    elevation_gain: '',
    map_url: '',
    image_url: '',
    images: [],
    gpx_url: '',
    category: 'senderismo',
    route_group: 'walk',
    highlights: [],
    start_lat: '',
    start_lon: '',
};

const RoutesManager = () => {
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingRoute, setEditingRoute] = useState(null);
    const [highlightInput, setHighlightInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchRoutes();
    }, []);

    async function fetchRoutes() {
        setLoading(true);
        const { data, error } = await supabase.from('routes').select('*').order('route_group').order('id');
        if (error) logError('RoutesManager.fetch', error);
        if (data) setRoutes(data);
        setLoading(false);
    }

    const startNew = () => {
        setEditingRoute({ ...EMPTY_ROUTE });
        setHighlightInput('');
    };

    const startEdit = (route) => {
        setEditingRoute({ ...route });
        setHighlightInput('');
    };

    const resetForm = () => {
        setEditingRoute(null);
        setHighlightInput('');
    };

    const handleSave = async () => {
        if (!editingRoute.title) {
            alert('El título es obligatorio.');
            return;
        }
        setSaving(true);

        const payload = {
            title: editingRoute.title,
            description: editingRoute.description || null,
            difficulty: editingRoute.difficulty || null,
            duration: editingRoute.duration || null,
            distance_km: editingRoute.distance_km ? parseFloat(editingRoute.distance_km) : null,
            elevation_gain: editingRoute.elevation_gain ? parseInt(editingRoute.elevation_gain) : null,
            map_url: editingRoute.map_url || null,
            image_url: editingRoute.images?.[0] || editingRoute.image_url || null,
            images: editingRoute.images?.length > 0 ? editingRoute.images : null,
            gpx_url: editingRoute.gpx_url || null,
            category: editingRoute.category || 'senderismo',
            route_group: editingRoute.route_group || 'walk',
            highlights: editingRoute.highlights?.length > 0 ? editingRoute.highlights : null,
            start_lat: editingRoute.start_lat ? parseFloat(editingRoute.start_lat) : null,
            start_lon: editingRoute.start_lon ? parseFloat(editingRoute.start_lon) : null,
            updated_at: new Date().toISOString(),
        };

        let error;
        if (editingRoute.id) {
            ({ error } = await supabase.from('routes').update(payload).eq('id', editingRoute.id));
        } else {
            ({ error } = await supabase.from('routes').insert([payload]));
        }

        if (error) {
            logError('RoutesManager.save', error);
            alert(userErrorMessage('Error al guardar la ruta.'));
        } else {
            resetForm();
            fetchRoutes();
        }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta ruta?')) return;
        const { error } = await supabase.from('routes').delete().eq('id', id);
        if (error) {
            logError('RoutesManager.delete', error);
            alert(userErrorMessage('Error al eliminar.'));
        } else {
            if (editingRoute?.id === id) resetForm();
            fetchRoutes();
        }
    };

    const addHighlight = () => {
        const val = highlightInput.trim();
        if (!val) return;
        setEditingRoute({
            ...editingRoute,
            highlights: [...(editingRoute.highlights || []), val],
        });
        setHighlightInput('');
    };

    const removeHighlight = (idx) => {
        const h = [...(editingRoute.highlights || [])];
        h.splice(idx, 1);
        setEditingRoute({ ...editingRoute, highlights: h });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const validation = validateImageFile(file);
        if (!validation.valid) {
            alert(validation.message);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `routes/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('apartments').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('apartments').getPublicUrl(fileName);
            setEditingRoute({
                ...editingRoute,
                images: [...(editingRoute.images || []), publicUrl],
                image_url: editingRoute.image_url || publicUrl,
            });
        } catch (error) {
            logError('RoutesManager.upload', error);
            alert(userErrorMessage('Error al subir la imagen.'));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (idx) => {
        const imgs = [...(editingRoute.images || [])];
        imgs.splice(idx, 1);
        setEditingRoute({
            ...editingRoute,
            images: imgs,
            image_url: imgs[0] || '',
        });
    };

    const groupLabel = (group) => GROUP_OPTIONS.find(g => g.value === group)?.label || group;

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando rutas...</div>;

    // Group routes
    const grouped = {};
    routes.forEach(r => {
        const g = r.route_group || 'walk';
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push(r);
    });

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Rutas y Senderismo</h3>
                    <p className="text-sm text-gray-500">{routes.length} rutas publicadas</p>
                </div>
                <button
                    onClick={startNew}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-md"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    <Plus size={18} /> Nueva Ruta
                </button>
            </div>

            {/* Edit modal */}
            {editingRoute && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] max-w-4xl w-full shadow-2xl my-8">
                        <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 border-b border-gray-100 flex justify-between items-center rounded-t-[2rem] z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-rural-50 text-rural-700"><Map size={24} /></div>
                                <h4 className="text-2xl font-serif font-bold">{editingRoute.id ? 'Editar Ruta' : 'Nueva Ruta'}</h4>
                            </div>
                            <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
                        </div>

                        <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                            {/* Title & description */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Título *</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                                        value={editingRoute.title}
                                        onChange={e => setEditingRoute({ ...editingRoute, title: e.target.value })}
                                        placeholder="Ej: Cerrada de Utrero"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Categoría</label>
                                        <select
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                                            value={editingRoute.category}
                                            onChange={e => setEditingRoute({ ...editingRoute, category: e.target.value })}
                                        >
                                            {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Grupo</label>
                                        <select
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                                            value={editingRoute.route_group}
                                            onChange={e => setEditingRoute({ ...editingRoute, route_group: e.target.value })}
                                        >
                                            {GROUP_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Descripción</label>
                                <textarea
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none resize-none"
                                    rows={3}
                                    value={editingRoute.description || ''}
                                    onChange={e => setEditingRoute({ ...editingRoute, description: e.target.value })}
                                    placeholder="Describe la ruta..."
                                />
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dificultad</label>
                                    <select
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                                        value={editingRoute.difficulty || 'facil'}
                                        onChange={e => setEditingRoute({ ...editingRoute, difficulty: e.target.value })}
                                    >
                                        {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.emoji} {d.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Duración</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                                        value={editingRoute.duration || ''}
                                        onChange={e => setEditingRoute({ ...editingRoute, duration: e.target.value })}
                                        placeholder="Ej: 2h 30min"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Distancia (km)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                                        value={editingRoute.distance_km || ''}
                                        onChange={e => setEditingRoute({ ...editingRoute, distance_km: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Desnivel (m)</label>
                                    <input
                                        type="number"
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                                        value={editingRoute.elevation_gain || ''}
                                        onChange={e => setEditingRoute({ ...editingRoute, elevation_gain: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* URLs */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL imagen</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-xs"
                                        value={editingRoute.image_url || ''}
                                        onChange={e => setEditingRoute({ ...editingRoute, image_url: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL mapa / cómo llegar</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-xs"
                                        value={editingRoute.map_url || ''}
                                        onChange={e => setEditingRoute({ ...editingRoute, map_url: e.target.value })}
                                        placeholder="https://maps.google.com/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL archivo GPX</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-xs"
                                        value={editingRoute.gpx_url || ''}
                                        onChange={e => setEditingRoute({ ...editingRoute, gpx_url: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Latitud inicio</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                                            value={editingRoute.start_lat || ''}
                                            onChange={e => setEditingRoute({ ...editingRoute, start_lat: e.target.value })}
                                            placeholder="37.78"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Longitud inicio</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                                            value={editingRoute.start_lon || ''}
                                            onChange={e => setEditingRoute({ ...editingRoute, start_lon: e.target.value })}
                                            placeholder="-3.03"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Highlights */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Puntos destacados</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        className="flex-grow p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-sm"
                                        value={highlightInput}
                                        onChange={e => setHighlightInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addHighlight())}
                                        placeholder="Ej: Cascada, Mirador, Cueva..."
                                    />
                                    <button
                                        onClick={addHighlight}
                                        className="px-4 py-2 bg-rural-100 text-rural-700 rounded-xl font-bold text-sm hover:bg-rural-200 transition-all"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(editingRoute.highlights || []).map((h, i) => (
                                        <span key={i} className="flex items-center gap-1 px-3 py-1.5 bg-rural-50 text-rural-700 rounded-full text-xs font-bold border border-rural-200">
                                            {h}
                                            <button onClick={() => removeHighlight(i)} className="text-rural-400 hover:text-red-500 ml-1"><X size={12} /></button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Galería de fotos */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                                    <Camera size={12} className="inline mr-1" /> Galería de fotos ({(editingRoute.images || []).length})
                                </label>
                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                                    <button
                                        onClick={() => fileInputRef.current.click()}
                                        disabled={isUploading}
                                        className="w-full py-3 border-2 border-dashed border-rural-200 rounded-xl flex items-center justify-center gap-2 text-rural-600 font-bold text-sm hover:bg-rural-100 transition-all"
                                    >
                                        {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                                        {isUploading ? 'Subiendo...' : 'Subir foto'}
                                    </button>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(editingRoute.images || []).map((img, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                                                <img src={img} className="w-full h-full object-cover" />
                                                {idx === 0 && (
                                                    <span className="absolute top-1 left-1 bg-rural-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">Principal</span>
                                                )}
                                                <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-gray-100 flex gap-3 justify-end bg-gray-50/50 rounded-b-[2rem]">
                            <button onClick={resetForm} className="px-8 py-3 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-100">Cancelar</button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-10 py-3 text-white font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg flex items-center gap-2"
                                style={{ backgroundColor: COLORS.primary }}
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                {saving ? 'Guardando...' : editingRoute.id ? 'Actualizar Ruta' : 'Crear Ruta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Route list grouped */}
            {Object.keys(grouped).length === 0 && (
                <div className="p-20 text-center bg-white border-2 border-dashed rounded-3xl opacity-30 italic font-serif">
                    No hay rutas. Crea la primera.
                </div>
            )}

            {GROUP_OPTIONS.map(group => {
                const groupRoutes = grouped[group.value];
                if (!groupRoutes || groupRoutes.length === 0) return null;
                return (
                    <div key={group.value} className="space-y-3">
                        <h4 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: COLORS.primary }}>
                            <Layers size={14} /> {group.label} ({groupRoutes.length})
                        </h4>
                        <div className="grid gap-3">
                            {groupRoutes.map(route => {
                                const diff = DIFFICULTY_OPTIONS.find(d => d.value === route.difficulty);
                                return (
                                    <div key={route.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
                                        {route.image_url ? (
                                            <img src={route.image_url} alt={route.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-rural-50 flex items-center justify-center flex-shrink-0">
                                                <Mountain size={24} style={{ color: COLORS.primary }} />
                                            </div>
                                        )}
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-bold text-gray-800 truncate">{route.title}</h5>
                                                {diff && <span className="text-xs">{diff.emoji}</span>}
                                            </div>
                                            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                                                {route.duration && <span className="flex items-center gap-1"><Clock size={12} /> {route.duration}</span>}
                                                {route.distance_km && <span className="flex items-center gap-1"><Ruler size={12} /> {route.distance_km} km</span>}
                                                {route.elevation_gain && <span className="flex items-center gap-1"><TrendingUp size={12} /> {route.elevation_gain}m</span>}
                                                <span className="flex items-center gap-1"><Tag size={12} /> {route.category}</span>
                                            </div>
                                            {route.highlights?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {route.highlights.map((h, i) => (
                                                        <span key={i} className="text-[10px] px-2 py-0.5 bg-rural-50 text-rural-600 rounded-full">{h}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0">
                                            <button onClick={() => startEdit(route)} className="p-2 text-gray-300 hover:text-rural-500 transition-colors" title="Editar">
                                                <Pencil size={18} />
                                            </button>
                                            <button onClick={() => handleDelete(route.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Eliminar">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default RoutesManager;

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { MapPin, Utensils, Mountain, Plus, Trash2, ExternalLink, X, Loader2, Save } from 'lucide-react';

const LocalPlacesManager = () => {
    const [places, setPlaces] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPlaceForm, setShowPlaceForm] = useState(false);
    const [showRouteForm, setShowRouteForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newPlace, setNewPlace] = useState({ name: '', type: 'restaurante', description: '', location_url: '', web_url: '', image_url: '' });
    const [newRoute, setNewRoute] = useState({ title: '', description: '', difficulty: 'Fácil', duration: '', map_url: '', image_url: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: p } = await supabase.from('local_places').select('*').order('type');
        const { data: r } = await supabase.from('routes').select('*').order('id');
        if (p) setPlaces(p);
        if (r) setRoutes(r);
        setLoading(false);
    };

    const handleAddPlace = async () => {
        if (!newPlace.name.trim()) { alert('El nombre es obligatorio.'); return; }
        setSaving(true);
        const { error } = await supabase.from('local_places').insert([newPlace]);
        if (error) { alert('Error: ' + error.message); }
        else {
            setNewPlace({ name: '', type: 'restaurante', description: '', location_url: '', web_url: '', image_url: '' });
            setShowPlaceForm(false);
            fetchData();
        }
        setSaving(false);
    };

    const handleDeletePlace = async (id) => {
        if (!window.confirm('¿Eliminar este sitio?')) return;
        await supabase.from('local_places').delete().eq('id', id);
        fetchData();
    };

    const handleAddRoute = async () => {
        if (!newRoute.title.trim()) { alert('El título es obligatorio.'); return; }
        setSaving(true);
        const { error } = await supabase.from('routes').insert([newRoute]);
        if (error) { alert('Error: ' + error.message); }
        else {
            setNewRoute({ title: '', description: '', difficulty: 'Fácil', duration: '', map_url: '', image_url: '' });
            setShowRouteForm(false);
            fetchData();
        }
        setSaving(false);
    };

    const handleDeleteRoute = async (id) => {
        if (!window.confirm('¿Eliminar esta ruta?')) return;
        await supabase.from('routes').delete().eq('id', id);
        fetchData();
    };

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando entorno...</div>;

    return (
        <div className="space-y-12">
            {/* Sitios Locales */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Sitios Locales</h3>
                    <button
                        onClick={() => setShowPlaceForm(!showPlaceForm)}
                        className="px-4 py-2 rounded-xl text-white font-bold text-sm flex items-center gap-2 hover:scale-105 transition-all"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        {showPlaceForm ? <X size={16} /> : <Plus size={16} />}
                        {showPlaceForm ? 'Cancelar' : 'Añadir Sitio'}
                    </button>
                </div>

                {showPlaceForm && (
                    <div className="bg-white p-6 rounded-3xl border-2 border-dashed border-rural-200 space-y-4 mb-6">
                        <h4 className="font-bold text-lg">Nuevo Sitio Local</h4>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nombre *</label>
                                <input type="text" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" placeholder="Ej: Restaurante El Olivo"
                                    value={newPlace.name} onChange={e => setNewPlace({ ...newPlace, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Tipo</label>
                                <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                                    value={newPlace.type} onChange={e => setNewPlace({ ...newPlace, type: e.target.value })}>
                                    <option value="restaurante">Restaurante</option>
                                    <option value="turismo_activo">Turismo Activo</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Descripción</label>
                            <textarea className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" rows="2" placeholder="Breve descripción..."
                                value={newPlace.description} onChange={e => setNewPlace({ ...newPlace, description: e.target.value })} />
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL Google Maps</label>
                                <input type="url" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" placeholder="https://maps.google.com/..."
                                    value={newPlace.location_url} onChange={e => setNewPlace({ ...newPlace, location_url: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Web</label>
                                <input type="url" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" placeholder="https://..."
                                    value={newPlace.web_url} onChange={e => setNewPlace({ ...newPlace, web_url: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL Imagen</label>
                                <input type="url" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" placeholder="https://..."
                                    value={newPlace.image_url} onChange={e => setNewPlace({ ...newPlace, image_url: e.target.value })} />
                            </div>
                        </div>
                        <button onClick={handleAddPlace} disabled={saving}
                            className="w-full py-3 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                            style={{ backgroundColor: COLORS.primary }}>
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {saving ? 'Guardando...' : 'Guardar Sitio'}
                        </button>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                    {places.map(place => (
                        <PlaceCard key={place.id} place={place} onDelete={() => handleDeletePlace(place.id)} />
                    ))}
                    {places.length === 0 && <div className="col-span-2 p-10 bg-white border-2 border-dashed rounded-2xl text-center opacity-40 italic">No hay sitios registrados</div>}
                </div>
            </div>

            {/* Rutas de Senderismo */}
            <div className="pb-10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Rutas de Senderismo</h3>
                    <button
                        onClick={() => setShowRouteForm(!showRouteForm)}
                        className="px-4 py-2 rounded-xl text-white font-bold text-sm flex items-center gap-2 hover:scale-105 transition-all"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        {showRouteForm ? <X size={16} /> : <Plus size={16} />}
                        {showRouteForm ? 'Cancelar' : 'Añadir Ruta'}
                    </button>
                </div>

                {showRouteForm && (
                    <div className="bg-white p-6 rounded-3xl border-2 border-dashed border-rural-200 space-y-4 mb-6">
                        <h4 className="font-bold text-lg">Nueva Ruta</h4>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Título *</label>
                                <input type="text" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" placeholder="Ej: Ruta de los Cahorros"
                                    value={newRoute.title} onChange={e => setNewRoute({ ...newRoute, title: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dificultad</label>
                                <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                                    value={newRoute.difficulty} onChange={e => setNewRoute({ ...newRoute, difficulty: e.target.value })}>
                                    <option value="Fácil">Fácil</option>
                                    <option value="Moderada">Moderada</option>
                                    <option value="Alta">Alta</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Descripción</label>
                            <textarea className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" rows="2" placeholder="Descripción de la ruta..."
                                value={newRoute.description} onChange={e => setNewRoute({ ...newRoute, description: e.target.value })} />
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Duración</label>
                                <input type="text" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" placeholder="Ej: 2h 30min"
                                    value={newRoute.duration} onChange={e => setNewRoute({ ...newRoute, duration: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL Mapa</label>
                                <input type="url" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" placeholder="https://maps.google.com/..."
                                    value={newRoute.map_url} onChange={e => setNewRoute({ ...newRoute, map_url: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL Imagen</label>
                                <input type="url" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" placeholder="https://..."
                                    value={newRoute.image_url} onChange={e => setNewRoute({ ...newRoute, image_url: e.target.value })} />
                            </div>
                        </div>
                        <button onClick={handleAddRoute} disabled={saving}
                            className="w-full py-3 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                            style={{ backgroundColor: COLORS.primary }}>
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {saving ? 'Guardando...' : 'Guardar Ruta'}
                        </button>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                    {routes.map(route => (
                        <RouteCard key={route.id} route={route} onDelete={() => handleDeleteRoute(route.id)} />
                    ))}
                    {routes.length === 0 && <div className="col-span-2 p-10 bg-white border-2 border-dashed rounded-2xl text-center opacity-40 italic">No hay rutas registradas</div>}
                </div>
            </div>
        </div>
    );
};

const PlaceCard = ({ place, onDelete }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
        <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden">
            <img src={place.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7ed9d42339?auto=format&fit=crop&w=200&q=80'} className="w-full h-full object-cover" alt={place.name} />
        </div>
        <div className="flex-grow">
            <div className="flex justify-between">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-500 mb-1 flex items-center gap-1">
                    {place.type === 'restaurante' ? <Utensils size={10} /> : <Mountain size={10} />}
                    {place.type}
                </span>
                <div className="flex gap-2">
                    {place.location_url && <a href={place.location_url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-500"><ExternalLink size={14} /></a>}
                    <button onClick={onDelete} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
            </div>
            <h4 className="font-bold text-gray-800">{place.name}</h4>
            <p className="text-xs text-gray-500 line-clamp-1">{place.description}</p>
        </div>
    </div>
);

const RouteCard = ({ route, onDelete }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
        <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden">
            <img src={route.image_url || 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=200&q=80'} className="w-full h-full object-cover" alt={route.title} />
        </div>
        <div className="flex-grow">
            <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ color: COLORS.primary, backgroundColor: COLORS.bgWarm }}>{route.difficulty}</span>
                <div className="flex gap-2">
                    {route.map_url && <a href={route.map_url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-500"><ExternalLink size={14} /></a>}
                    <button onClick={onDelete} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
            </div>
            <h4 className="font-bold text-gray-800 mt-1">{route.title}</h4>
            <p className="text-[10px] text-gray-500 mb-1">{route.duration}</p>
        </div>
    </div>
);

export default LocalPlacesManager;

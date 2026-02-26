import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { MapPin, Utensils, Mountain, Plus, Trash2, ExternalLink, Camera } from 'lucide-react';

const LocalPlacesManager = () => {
    const [places, setPlaces] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);

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

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando entorno...</div>;

    return (
        <div className="space-y-12">
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Sitios Locales</h3>
                    <button className="px-4 py-2 rounded-xl text-white font-bold text-sm bg-rural-700 flex items-center gap-2 hover:scale-105 transition-all" style={{ backgroundColor: COLORS.primary }}>
                        <Plus size={16} /> Añadir Sitio
                    </button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    {places.map(place => (
                        <PlaceCard key={place.id} place={place} />
                    ))}
                    {places.length === 0 && <div className="col-span-2 p-10 bg-white border-2 border-dashed rounded-2xl text-center opacity-40 italic">No hay sitios registrados</div>}
                </div>
            </div>

            <div className="pb-10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Rutas de Senderismo</h3>
                    <button className="px-4 py-2 rounded-xl text-white font-bold text-sm bg-rural-700 flex items-center gap-2 hover:scale-105 transition-all" style={{ backgroundColor: COLORS.primary }}>
                        <Plus size={16} /> Añadir Ruta
                    </button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    {routes.map(route => (
                        <RouteCard key={route.id} route={route} />
                    ))}
                    {routes.length === 0 && <div className="col-span-2 p-10 bg-white border-2 border-dashed rounded-2xl text-center opacity-40 italic">No hay rutas registradas</div>}
                </div>
            </div>
        </div>
    );
};

const PlaceCard = ({ place }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
        <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0 relative group">
            <img src={place.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7ed9d42339?auto=format&fit=crop&w=200&q=80'} className="w-full h-full object-cover rounded-xl" />
        </div>
        <div className="flex-grow">
            <div className="flex justify-between">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-500 mb-1 flex items-center gap-1">
                    {place.type === 'restaurante' ? <Utensils size={10} /> : <Mountain size={10} />}
                    {place.type}
                </span>
                <div className="flex gap-2">
                    <button className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
            </div>
            <h4 className="font-bold text-gray-800">{place.name}</h4>
            <p className="text-xs text-gray-500 line-clamp-1">{place.description}</p>
        </div>
    </div>
);

const RouteCard = ({ route }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
        <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0">
            <img src={route.image_url || 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=200&q=80'} className="w-full h-full object-cover rounded-xl" />
        </div>
        <div className="flex-grow">
            <span className="text-[9px] font-bold uppercase tracking-widest text-rural-700 bg-rural-100 px-2 py-0.5 rounded" style={{ color: COLORS.primary, backgroundColor: COLORS.bgWarm }}>{route.difficulty}</span>
            <h4 className="font-bold text-gray-800 mt-1">{route.title}</h4>
            <p className="text-[10px] text-gray-500 mb-1">{route.duration}</p>
        </div>
    </div>
);

export default LocalPlacesManager;

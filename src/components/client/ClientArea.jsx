import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { useGuestGuides } from '../../hooks/useDatabase';
import WeatherWidget from '../WeatherWidget';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Download, LogOut, User, MapPin,
    Calendar, ExternalLink, Map, Utensils,
    Tent, Mountain, ChefHat, Info, ChevronRight
} from 'lucide-react';

const ClientArea = () => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    const [profile, setProfile] = useState(null);

    useEffect(() => {
        const getData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (user) {
                const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (profileData) setProfile(profileData);
            }

            const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
            if (data) setDocs(data);
            setLoading(false);
        };
        getData();
    }, []);

    const handleLogout = () => supabase.auth.signOut();

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-rural-50 font-serif italic text-gray-400">Cargando tu área personal...</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 py-6 px-6 sticky top-0 z-40">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: COLORS.primary }}>
                            <User size={20} />
                        </div>
                        <div>
                            <h2 className="font-serif text-lg font-bold" style={{ color: COLORS.text }}>Mi Área Personal</h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{user?.email}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-10">
                <ClientAreaContent docs={docs} userEmail={user?.email} />
            </main>
        </div>
    );
};

export const ClientAreaContent = ({ docs = [], userEmail = 'invitado@ejemplo.com' }) => {
    return (
        <div className="space-y-10">
            {/* Intro Card */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 opacity-5 translate-x-10 -translate-y-10">
                    <MapPin size={120} />
                </div>
                <h3 className="text-2xl font-serif font-bold mb-4" style={{ color: COLORS.text }}>¡Hola de nuevo!</h3>
                <p className="text-gray-500 max-w-xl leading-relaxed">
                    Aquí tienes acceso a toda la documentación de tu estancia en <strong style={{ color: COLORS.primary }}>Tío José María</strong>. Descarga tus facturas, contratos o consulta nuestra guía exclusiva del huésped.
                </p>
            </div>

            {/* Guest Guide Section */}
            <div>
                <h3 className="text-2xl font-serif font-bold mb-8 flex items-center gap-3" style={{ color: COLORS.text }}>
                    <Map size={24} style={{ color: COLORS.primary }} /> Guía Exclusiva del Huésped
                </h3>

                <GuestGuide />
            </div>

            {/* Documents Grid */}
            <div className="grid md:grid-cols-2 gap-10">
                <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 px-2">
                        <FileText size={16} /> Documentación de Interés
                    </h4>
                    <div className="space-y-4">
                        {docs.map(doc => (
                            <div key={doc.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-rural-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-rural-50 flex items-center justify-center text-rural-600" style={{ color: COLORS.primary, backgroundColor: COLORS.bgWarm }}>
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{doc.title}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{doc.category || 'General'}</p>
                                    </div>
                                </div>
                                <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 text-gray-400 group-hover:bg-rural-600 group-hover:text-white transition-all shadow-sm"
                                    style={{ backgroundColor: 'transparent', border: '1px solid #f3f4f6' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.primary; e.currentTarget.style.color = 'white'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                                >
                                    <Download size={18} />
                                </a>
                            </div>
                        ))}
                        {docs.length === 0 && (
                            <div className="text-center p-10 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 italic font-serif text-sm">
                                No hay documentos disponibles para descargar aún.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 px-2">
                        Información de Reserva
                    </h4>
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-start gap-4">
                            <MapPin className="text-rural-400 mt-1" size={20} style={{ color: COLORS.accent }} />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Ubicación</p>
                                <p className="font-bold text-gray-700">Calle Baja 1, Hinojares, Jaén</p>
                                <a href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8" target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 mt-1 font-bold hover:underline" style={{ color: COLORS.primary }}>
                                    Abrir en Maps <ExternalLink size={10} />
                                </a>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <Calendar className="text-rural-400 mt-1" size={20} style={{ color: COLORS.accent }} />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Check-in / Check-out</p>
                                <p className="font-bold text-gray-700">Entrada: 16:00 / Salida: 12:00</p>
                            </div>
                        </div>
                    </div>

                    {/* Help link */}
                    <div className="bg-rural-900 rounded-3xl p-8 text-white relative overflow-hidden" style={{ backgroundColor: COLORS.primaryDark }}>
                        <div className="relative z-10">
                            <h5 className="font-bold mb-2">¿Necesitas ayuda?</h5>
                            <p className="text-xs opacity-70 mb-4">Estamos a tu disposición para cualquier duda durante tu estancia.</p>
                            <a href="https://wa.me/34676344675" target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-2 bg-white text-rural-900 rounded-full text-xs font-bold transition-transform hover:scale-105" style={{ color: COLORS.primaryDark }}>
                                Contactar por WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const GuestGuide = () => {
    const { guides, loading } = useGuestGuides();
    const [activeTab, setActiveTab] = useState('rutas');

    const sections = {
        rutas: { icon: Mountain, title: 'Rutas y Paisajes' },
        gastronomia: { icon: ChefHat, title: 'Sabores Locales' },
        actividades: { icon: Tent, title: 'Aventura y Ocio' }
    };

    if (loading) return <div className="p-8 text-center text-gray-400 font-serif italic">Cargando guía...</div>;

    const filteredGuides = guides.filter(g => g.category === activeTab);

    return (
        <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {Object.entries(sections).map(([key, section]) => {
                    const Icon = section.icon;
                    const isActive = activeTab === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${isActive
                                ? 'text-white shadow-lg'
                                : 'bg-white text-gray-500 border border-gray-100 hover:border-rural-200 shadow-sm'
                                }`}
                            style={isActive ? { backgroundColor: COLORS.primary } : {}}
                        >
                            <Icon size={18} />
                            {section.title}
                        </button>
                    );
                })}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="grid gap-6 md:grid-cols-2"
                >
                    {filteredGuides.map((item, i) => (
                        <div key={i} className="bg-white rounded-3xl border border-gray-50 shadow-sm overflow-hidden group hover:border-rural-100 transition-all flex flex-col">
                            {item.image_url && (
                                <div className="h-48 overflow-hidden relative">
                                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    {item.video_url && (
                                        <a href={item.video_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors group">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                                <Play size={20} style={{ color: COLORS.primary }} fill={COLORS.primary} />
                                            </div>
                                        </a>
                                    )}
                                </div>
                            )}
                            <div className="p-6 flex-grow flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-rural-900 flex items-center gap-2">
                                        <ChevronRight size={14} style={{ color: COLORS.accent }} />
                                        {item.title}
                                    </h4>
                                    {(item.difficulty || item.duration) && (
                                        <div className="flex gap-2">
                                            {item.difficulty && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-rural-50 text-rural-400 rounded-full">{item.difficulty}</span>}
                                            {item.duration && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-rural-50 text-rural-400 rounded-full">{item.duration}</span>}
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                                    {item.description}
                                </p>

                                {item.location_url && (
                                    <div className="mt-auto">
                                        <a
                                            href={item.location_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold bg-gray-50 text-gray-500 hover:bg-rural-50 hover:text-rural-600 transition-all group"
                                        >
                                            <MapPin size={16} className="group-hover:animate-bounce" />
                                            Cómo llegar
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredGuides.length === 0 && (
                        <div className="col-span-full text-center p-10 bg-white rounded-3xl border border-dashed border-gray-100 text-gray-400 italic font-serif">
                            Próximamente más recomendaciones en esta sección.
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default ClientArea;

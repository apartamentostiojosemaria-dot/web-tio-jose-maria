import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useGuestGuides, useWebConfig, useMyBooking, useApartmentInstructions, useMyDiscountCodes, useLocalPlaces } from '../../hooks/useDatabase';
import WelcomePackage from './WelcomePackage';
import ReviewForm from './ReviewForm';
import WeatherWidget from '../WeatherWidget';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Download, LogOut, User, MapPin, Calendar, ExternalLink, Map, Utensils,
    Tent, Mountain, ChefHat, Info, ChevronRight, ShieldAlert, Play, Key, Wifi, Flame,
    Clock, Phone, Home, CheckCircle, AlertCircle, CreditCard, Tag, Sun, Cloud, Snowflake,
    Copy, Check, ThermometerSun, UtensilsCrossed, Shirt, DoorOpen
} from 'lucide-react';
import { logError, userErrorMessage } from '../../utils/logger';

const STATUS_MAP = {
    pending: { label: 'Pendiente de confirmar', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
    confirmed: { label: 'Confirmada', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
    cancelled: { label: 'Cancelada', color: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
    completed: { label: 'Completada', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle },
};

const INSTRUCTION_ICONS = {
    'map-pin': MapPin, 'key': Key, 'clock': Clock, 'wifi': Wifi, 'flame': Flame,
    'utensils-crossed': UtensilsCrossed, 'thermometer': ThermometerSun, 'shirt': Shirt,
    'door-open': DoorOpen, 'info': Info,
};

const ClientArea = () => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        const getData = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            setUser(authUser);

            if (authUser) {
                let { data: profileData } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();

                if (!profileData && authUser.email) {
                    const { data: preRegisteredProfile } = await supabase.from('profiles').select('*').eq('email', authUser.email.toLowerCase()).maybeSingle();
                    if (preRegisteredProfile) {
                        const { data: updatedProfile, error: linkError } = await supabase.from('profiles').update({ id: authUser.id }).eq('id', preRegisteredProfile.id).select().single();
                        if (!linkError) profileData = updatedProfile;
                    } else {
                        const { data: newProfile } = await supabase.from('profiles').insert({ id: authUser.id, email: authUser.email.toLowerCase(), full_name: authUser.user_metadata?.full_name || '', role: 'cliente' }).select().single();
                        profileData = newProfile;
                    }
                }

                if (profileData) {
                    setProfile(profileData);
                    if (profileData.is_active === false) { setAccessDenied(true); setLoading(false); return; }

                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const checkIn = profileData.check_in ? new Date(profileData.check_in) : null;
                    const checkOut = profileData.check_out ? new Date(profileData.check_out) : null;

                    if (profileData.access_mode === 'stay_only' && checkIn && checkOut) {
                        if (today < checkIn || today > checkOut) { setAccessDenied(true); setLoading(false); return; }
                    } else if (profileData.access_mode === 'stay_plus_7' && checkIn && checkOut) {
                        const ext = new Date(checkOut); ext.setDate(ext.getDate() + 7);
                        if (today < checkIn || today > ext) { setAccessDenied(true); setLoading(false); return; }
                    }
                }
            }

            const { data: docsData } = await supabase.from('documents').select('*').or(`visibility.eq.publico,visibility.eq.solo_clientes,profile_id.eq.${authUser.id}`).order('created_at', { ascending: false });
            if (docsData) setDocs(docsData);
            setLoading(false);
        };
        getData();
    }, []);

    const handleLogout = () => supabase.auth.signOut();

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-rural-50 font-serif italic text-gray-400">Cargando tu area personal...</div>;
    if (accessDenied) return <AccessDeniedView onLogout={handleLogout} profile={profile} />;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <header className="bg-white border-b border-gray-100 py-6 px-6 sticky top-0 z-40">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-primary">
                            <User size={20} />
                        </div>
                        <div>
                            <h2 className="font-serif text-lg font-bold text-text-primary">{profile?.full_name || 'Mi Area Personal'}</h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{user?.email}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-10">
                {!profile?.is_profile_completed ? (
                    <CompleteProfileView profile={profile} onComplete={(p) => setProfile(p)} />
                ) : (
                    <ClientAreaContent docs={docs} userEmail={user?.email} profile={profile} />
                )}
            </main>
        </div>
    );
};

const AccessDeniedView = ({ onLogout, profile }) => (
    <div className="min-h-screen bg-rural-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl border border-rural-100 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <ShieldAlert size={40} />
            </div>
            <h2 className="text-2xl font-serif font-bold mb-4 text-text-primary">Acceso Restringido</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
                {profile?.is_active === false
                    ? "Tu cuenta ha sido desactivada. Contacta con nosotros si crees que es un error."
                    : "Tu acceso solo esta permitido durante las fechas de tu reserva. Te esperamos pronto!"}
            </p>
            <a href="https://wa.me/34676344675" className="flex items-center justify-center gap-2 w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg">Contactar Soporte</a>
            <button onClick={onLogout} className="mt-4 text-sm font-bold text-gray-400 hover:text-rural-700">Cerrar Sesion</button>
        </div>
    </div>
);

export const ClientAreaContent = ({ docs = [], userEmail = '', profile = null }) => {
    const { config } = useWebConfig();
    const { booking, loading: bookingLoading } = useMyBooking(userEmail);
    const { instructions } = useApartmentInstructions(booking?.apartment_id);
    const { codes } = useMyDiscountCodes();
    const { places } = useLocalPlaces();

    const emergencyPlaces = places.filter(p => p.type === 'emergencia' || p.type === 'farmacia');
    const restaurants = places.filter(p => p.type === 'restaurante');

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const checkIn = profile?.check_in ? new Date(profile.check_in) : null;
    const checkOut = profile?.check_out ? new Date(profile.check_out) : null;
    const isDuringStay = checkIn && checkOut && today >= checkIn && today <= checkOut;
    const isBeforeStay = checkIn && today < checkIn;
    const isAfterStay = checkOut && today > checkOut;

    return (
        <div className="space-y-8">
            <WelcomePackage config={config} guestName={profile?.full_name} />

            {/* Mi Reserva */}
            <section>
                <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2 text-text-primary">
                    <Home size={20} className="text-primary" /> Mi Reserva
                </h3>
                {bookingLoading ? (
                    <div className="bg-white rounded-2xl p-8 text-center text-gray-400 italic">Cargando reserva...</div>
                ) : booking ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {booking.apartments?.images?.[0] && (
                            <img src={booking.apartments.images[0]} alt={booking.apartments.name} className="w-full h-48 object-cover" />
                        )}
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-serif text-2xl font-bold text-text-primary">{booking.apartments?.name || 'Apartamento'}</h4>
                                <StatusBadge status={booking.status} />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <InfoChip icon={Calendar} label="Entrada" value={formatDate(booking.check_in)} />
                                <InfoChip icon={Calendar} label="Salida" value={formatDate(booking.check_out)} />
                                <InfoChip icon={User} label="Huespedes" value={`${booking.pax_count} personas`} />
                                <InfoChip icon={CreditCard} label="Total" value={booking.total_price ? `${booking.total_price}\u20AC` : 'A confirmar'} />
                            </div>
                            {booking.notes && (
                                <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded-xl"><strong>Notas:</strong> {booking.notes}</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                        <p className="text-gray-400 italic font-serif">No se ha encontrado una reserva asociada a tu cuenta.</p>
                        <a href="https://wa.me/34676344675" className="text-sm font-bold text-primary mt-2 inline-block">Contactar para reservar</a>
                    </div>
                )}
            </section>

            {/* Guia del Apartamento */}
            {instructions.length > 0 && (
                <section>
                    <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2 text-text-primary">
                        <Key size={20} className="text-primary" /> {isBeforeStay ? 'Antes de llegar' : 'Guia de tu apartamento'}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3">
                        {instructions.map(inst => {
                            const Icon = INSTRUCTION_ICONS[inst.icon] || Info;
                            return (
                                <div key={inst.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Icon size={18} className="text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-text-primary mb-1">{inst.title}</h4>
                                            <p className="text-xs text-gray-500 leading-relaxed">{inst.content}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Meteo + Plan del dia */}
            {isDuringStay && (
                <section>
                    <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2 text-text-primary">
                        <Sun size={20} className="text-primary" /> Hoy en Hinojares
                    </h3>
                    <WeatherWidget stayDates={{ check_in: profile?.check_in, check_out: profile?.check_out }} />
                    <DayPlan />
                </section>
            )}

            {!isDuringStay && (
                <WeatherWidget stayDates={{ check_in: profile?.check_in, check_out: profile?.check_out }} />
            )}

            {/* Guia del Huesped */}
            <section>
                <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2 text-text-primary">
                    <Map size={20} className="text-primary" /> Guia Exclusiva del Huesped
                </h3>
                <GuestGuide />
            </section>

            {/* Numeros de emergencia */}
            {emergencyPlaces.length > 0 && (
                <section>
                    <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2 text-text-primary">
                        <ShieldAlert size={20} className="text-red-500" /> Numeros de Emergencia
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <EmergencyCard name="Emergencias" phone="112" desc="Policia, bomberos, ambulancia" alwaysShow />
                        {emergencyPlaces.map(place => (
                            <EmergencyCard key={place.id} name={place.name} phone={place.phone} desc={place.description} />
                        ))}
                    </div>
                </section>
            )}

            {/* Restaurantes */}
            {restaurants.length > 0 && (
                <section>
                    <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2 text-text-primary">
                        <Utensils size={20} className="text-primary" /> Donde comer
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {restaurants.map(r => (
                            <div key={r.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                <h4 className="font-bold text-text-primary mb-1">{r.name}</h4>
                                <p className="text-xs text-gray-500 mb-3">{r.description}</p>
                                <div className="flex gap-2">
                                    {r.phone && (
                                        <a href={`tel:${r.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold">
                                            <Phone size={12} /> Llamar
                                        </a>
                                    )}
                                    {r.web_url && (
                                        <a href={r.web_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                                            <ExternalLink size={12} /> Web
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Documentos */}
            <section>
                <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2 text-text-primary">
                    <FileText size={20} className="text-primary" /> Documentos
                </h3>
                <div className="space-y-3">
                    {docs.map(doc => (
                        <div key={doc.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-primary bg-surface-warm">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{doc.title}</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{doc.category || 'General'}</p>
                                </div>
                            </div>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center border border-gray-100 text-gray-400 hover:bg-primary hover:text-white transition-all">
                                <Download size={18} />
                            </a>
                        </div>
                    ))}
                    {docs.length === 0 && <p className="text-center p-8 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 italic text-sm">No hay documentos disponibles.</p>}
                </div>
            </section>

            {/* Ubicacion + Contacto */}
            <section className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h4 className="font-bold text-text-primary flex items-center gap-2"><MapPin size={16} className="text-primary" /> Ubicacion</h4>
                    <p className="text-sm text-gray-600">Calle Baja 1, 23486 Hinojares, Jaen</p>
                    <a href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary">Abrir en Google Maps <ExternalLink size={10} /></a>
                </div>
                <div className="bg-primary-dark rounded-2xl p-6 text-white">
                    <h4 className="font-bold mb-2">Necesitas ayuda?</h4>
                    <p className="text-xs opacity-70 mb-4">Estamos disponibles por WhatsApp para cualquier duda.</p>
                    <a href="https://wa.me/34676344675" target="_blank" rel="noopener noreferrer" className="inline-block px-5 py-2 bg-white text-primary-dark rounded-full text-xs font-bold hover:scale-105 transition-transform">
                        <Phone size={12} className="inline mr-1" /> WhatsApp
                    </a>
                </div>
            </section>

            {/* Codigo descuento */}
            {isAfterStay && codes.length > 0 && (
                <section>
                    <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2 text-text-primary">
                        <Tag size={20} className="text-primary" /> Tu descuento para volver
                    </h3>
                    {codes.map(code => (
                        <DiscountCard key={code.id} code={code} />
                    ))}
                </section>
            )}

            {/* Resena — solo despues de la estancia */}
            {(isAfterStay || isDuringStay) && <ReviewForm profile={profile} />}
        </div>
    );
};

// Sub-components

const StatusBadge = ({ status }) => {
    const s = STATUS_MAP[status] || STATUS_MAP.pending;
    const Icon = s.icon;
    return (
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${s.color}`}>
            <Icon size={12} /> {s.label}
        </span>
    );
};

const InfoChip = ({ icon: Icon, label, value }) => (
    <div className="bg-gray-50 rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1">
            <Icon size={12} className="text-gray-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
        </div>
        <p className="font-bold text-sm text-text-primary">{value}</p>
    </div>
);

const EmergencyCard = ({ name, phone, desc, alwaysShow }) => (
    <a href={`tel:${phone?.replace(/\s/g, '')}`} className={`flex items-center gap-4 p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md ${alwaysShow ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${alwaysShow ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500'}`}>
            <Phone size={20} />
        </div>
        <div className="flex-1">
            <h4 className="font-bold text-sm text-text-primary">{name}</h4>
            {desc && <p className="text-xs text-gray-500">{desc}</p>}
        </div>
        <span className="text-lg font-bold text-primary">{phone}</span>
    </a>
);

const DiscountCard = ({ code }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
                <p className="text-sm opacity-80 mb-1">Gracias por visitarnos! Usa este codigo en tu proxima reserva:</p>
                <p className="text-3xl font-bold tracking-wider">{code.discount_percent}% DTO</p>
                {code.valid_until && <p className="text-xs opacity-60 mt-1">Valido hasta {new Date(code.valid_until).toLocaleDateString('es-ES')}</p>}
            </div>
            <button onClick={handleCopy} className="flex items-center gap-2 px-5 py-3 bg-white text-primary rounded-xl font-bold text-sm hover:scale-105 transition-transform">
                {copied ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> {code.code}</>}
            </button>
        </div>
    );
};

const DayPlan = () => {
    const hour = new Date().getHours();
    let suggestion;
    if (hour < 10) suggestion = { emoji: '\u2615', text: 'Buenos dias! Desayuna tranquilo y sal a pasear por el pueblo antes de que caliente.' };
    else if (hour < 14) suggestion = { emoji: '\uD83E\uDD7E', text: 'Momento perfecto para una ruta de senderismo. Las de la manana son las mas frescas.' };
    else if (hour < 17) suggestion = { emoji: '\uD83C\uDF7D\uFE0F', text: 'Hora de comer. Prueba el cordero segureno en algun restaurante de la zona.' };
    else if (hour < 20) suggestion = { emoji: '\uD83D\uDEB6', text: 'La tarde es ideal para visitar el Embalse de la Bolera o pasear por Pozo Alcon.' };
    else suggestion = { emoji: '\u2B50', text: 'Noche estrellada en Hinojares. Sal a la terraza y mira al cielo — se ve la Via Lactea.' };

    return (
        <div className="bg-surface-warm rounded-2xl p-5 mt-4 flex items-start gap-3">
            <span className="text-2xl">{suggestion.emoji}</span>
            <div>
                <p className="font-bold text-sm text-text-primary mb-0.5">Sugerencia para ahora</p>
                <p className="text-sm text-secondary">{suggestion.text}</p>
            </div>
        </div>
    );
};

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

const GuestGuide = () => {
    const { guides, loading } = useGuestGuides();
    const [activeTab, setActiveTab] = useState('rutas');

    const sections = {
        rutas: { icon: Mountain, title: 'Rutas y Paisajes' },
        naturaleza: { icon: MapPin, title: 'Naturaleza' },
        gastronomia: { icon: ChefHat, title: 'Sabores Locales' },
        actividades: { icon: Tent, title: 'Aventura y Ocio' },
        cultura: { icon: Info, title: 'Historia y Cultura' },
        servicios: { icon: FileText, title: 'Servicios Utiles' },
        emergencias: { icon: ShieldAlert, title: 'Emergencias' }
    };

    if (loading) return <div className="p-8 text-center text-gray-400 font-serif italic">Cargando guia...</div>;

    const filteredGuides = guides.filter(g => g.category === activeTab);

    return (
        <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {Object.entries(sections).map(([key, section]) => {
                    const Icon = section.icon;
                    return (
                        <button key={key} onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === key ? 'text-white shadow-lg bg-primary' : 'bg-white text-gray-500 border border-gray-100 hover:border-rural-200'}`}>
                            <Icon size={16} /> {section.title}
                        </button>
                    );
                })}
            </div>
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="grid gap-4 md:grid-cols-2">
                    {filteredGuides.map((item, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-50 shadow-sm overflow-hidden group hover:border-rural-100 transition-all flex flex-col">
                            {item.image_url && (
                                <div className="h-44 overflow-hidden relative">
                                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    {item.video_url && (
                                        <a href={item.video_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                                                <Play size={20} className="text-primary fill-primary" />
                                            </div>
                                        </a>
                                    )}
                                </div>
                            )}
                            <div className="p-5 flex-grow flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-text-primary text-sm">{item.title}</h4>
                                    {(item.difficulty || item.duration) && (
                                        <div className="flex gap-1.5">
                                            {item.difficulty && <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-rural-50 text-rural-400 rounded-full">{item.difficulty}</span>}
                                            {item.duration && <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-rural-50 text-rural-400 rounded-full">{item.duration}</span>}
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed mb-4">{item.description}</p>
                                {item.location_url && (
                                    <a href={item.location_url} target="_blank" rel="noopener noreferrer" className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-xs bg-gray-50 text-gray-500 hover:bg-rural-50 hover:text-rural-600 transition-all">
                                        <MapPin size={14} /> Como llegar
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredGuides.length === 0 && (
                        <div className="col-span-full text-center p-10 bg-white rounded-2xl border border-dashed border-gray-100 text-gray-400 italic font-serif text-sm">
                            Proximamente mas recomendaciones en esta seccion.
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

const CompleteProfileView = ({ profile, onComplete }) => {
    const [name, setName] = useState(profile?.full_name || '');
    const [phone, setPhone] = useState(profile?.phone || '');
    const [address, setAddress] = useState(profile?.address || '');
    const [pax, setPax] = useState(profile?.pax_count || 1);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name || !phone) return alert('Indica tu nombre y telefono de contacto.');
        setSaving(true);
        const { data, error } = await supabase.from('profiles')
            .update({ full_name: name, phone, address, pax_count: parseInt(pax), is_profile_completed: true, updated_at: new Date().toISOString() })
            .eq('id', profile.id).select().single();
        if (error) { logError('ClientArea.handleSave', error); alert(userErrorMessage('Error al guardar.')); }
        else if (data) onComplete(data);
        setSaving(false);
    };

    return (
        <div className="max-w-2xl mx-auto py-10">
            <div className="bg-white rounded-3xl p-10 shadow-xl border border-rural-100">
                <header className="mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center mb-6 shadow-lg"><User size={32} /></div>
                    <h2 className="text-3xl font-serif font-bold mb-3 text-text-primary">Casi listo!</h2>
                    <p className="text-gray-500">Completa tu ficha para acceder a toda la informacion de tu estancia.</p>
                </header>
                <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="cp-name" className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Nombre Completo</label>
                            <input id="cp-name" type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-rural-100 outline-none" placeholder="Juan Garcia" />
                        </div>
                        <div>
                            <label htmlFor="cp-phone" className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Telefono</label>
                            <input id="cp-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-rural-100 outline-none" placeholder="600 000 000" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="cp-addr" className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Direccion (Opcional)</label>
                        <input id="cp-addr" type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-rural-100 outline-none" placeholder="Ciudad, Provincia..." />
                    </div>
                    <div>
                        <label htmlFor="cp-pax" className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Cuantas personas venis?</label>
                        <select id="cp-pax" value={pax} onChange={e => setPax(e.target.value)} className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-rural-100 outline-none font-bold">
                            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Persona' : 'Personas'}</option>)}
                        </select>
                    </div>
                    <button onClick={handleSave} disabled={saving} className="w-full py-5 bg-primary text-white rounded-2xl font-bold shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                        {saving ? 'Guardando...' : 'Confirmar y Entrar'} <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClientArea;

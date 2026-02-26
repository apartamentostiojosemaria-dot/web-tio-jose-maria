import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApartment, useBlockedDates } from '../hooks/useDatabase';
import { syncApartmentDates } from '../utils/syncService';
import { COLORS } from '../App';
import {
    ChevronLeft, Users, Flame, Wifi, Tv,
    UtensilsCrossed, Baby, MapPin, Calendar,
    Share2, Heart, ArrowRight, Home, Wind, Thermometer,
    Refrigerator, Microwave, Bath, Eraser, Dog, ShieldCheck,
    ChevronRight, AlertCircle
} from 'lucide-react';

const AMENITIES_ICONS = {
    tv: { label: 'TV Pantalla Plana', icon: Tv },
    wifi: { label: 'WiFi Gratis', icon: Wifi },
    heating: { label: 'Calefacción', icon: Thermometer },
    ac: { label: 'Aire Acondicionado', icon: Wind },
    fireplace: { label: 'Chimenea', icon: Flame },
    kitchen: { label: 'Vitrocerámica y Menaje', icon: UtensilsCrossed },
    fridge: { label: 'Frigorífico', icon: Refrigerator },
    microwave: { label: 'Microondas y Tostadora', icon: Microwave },
    bath: { label: 'Gel y Toallas', icon: Bath },
    hairdryer: { label: 'Secador de Pelo', icon: Eraser },
    no_pets: { label: 'No Mascotas', icon: Dog },
};

const AvailabilityCalendar = ({ apartmentId }) => {
    const { blockedDates, loading } = useBlockedDates(apartmentId);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    if (loading) return <div className="p-8 text-center animate-pulse text-rural-400">Cargando disponibilidad...</div>;

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay };
    };

    const isDateBlocked = (day) => {
        const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        checkDate.setHours(0, 0, 0, 0);

        return blockedDates.some(range => {
            const start = new Date(range.start_date);
            const end = new Date(range.end_date);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return checkDate >= start && checkDate <= end;
        });
    };

    const { days, firstDay } = getDaysInMonth(currentMonth);
    const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

    return (
        <div className="bg-rural-50 p-6 rounded-[2rem] border border-rural-100">
            <div className="flex justify-between items-center mb-6 px-2">
                <h4 className="font-serif font-bold text-rural-800">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h4>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 hover:bg-white rounded-full transition-colors"><ChevronLeft size={18} /></button>
                    <button onClick={nextMonth} className="p-2 hover:bg-white rounded-full transition-colors"><ChevronRight size={18} /></button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {dayNames.map(d => <span key={d} className="text-[10px] font-bold text-gray-400 uppercase">{d}</span>)}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                    const day = i + 1;
                    const blocked = isDateBlocked(day);
                    return (
                        <div
                            key={day}
                            className={`aspect-square flex items-center justify-center text-sm font-bold rounded-xl transition-all ${blocked
                                ? 'bg-red-50 text-red-300 line-through decoration-red-200'
                                : 'bg-white text-rural-700 hover:bg-rural-100 cursor-default'
                                }`}
                        >
                            {day}
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 flex gap-4 text-[10px] font-bold uppercase tracking-widest justify-center">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border border-gray-100 rounded-sm" /> Libre</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-50 rounded-sm" /> Ocupado</div>
            </div>
        </div>
    );
};

const ApartmentDetail = () => {
    const { slug } = useParams();
    const { apartment, loading } = useApartment(slug);
    const [activeImg, setActiveImg] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Auto-sync background
    React.useEffect(() => {
        if (apartment && (apartment.airbnb_ical_url || apartment.booking_ical_url)) {
            const autoSync = async () => {
                setIsSyncing(true);
                try {
                    await syncApartmentDates(apartment);
                    // No refrescamos forzosamente para no molestar al usuario, 
                    // la próxima vez que se cargue useBlockedDates ya tendrá los datos.
                    // O si queremos refrescar el estado local, podríamos llamar a una función de refresh.
                } catch (e) {
                    console.warn('Silent sync failed', e);
                } finally {
                    setIsSyncing(false);
                }
            };
            autoSync();
        }
    }, [apartment?.id]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-rural-50 font-serif italic text-rural-700 animate-pulse">
            Preparando tu estancia en {slug}...
        </div>
    );

    if (!apartment) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-rural-50">
            <h2 className="text-3xl font-serif font-bold text-rural-900 mb-4">Apartamento no encontrado</h2>
            <p className="text-gray-500 mb-8">Lo sentimos, no pudimos encontrar el alojamiento que buscas.</p>
            <Link to="/" className="px-8 py-3 bg-rural-700 text-white rounded-full font-bold shadow-lg hover:bg-rural-800 transition-all">
                Volver al inicio
            </Link>
        </div>
    );

    const images = apartment.images?.length > 0
        ? apartment.images
        : ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'];

    return (
        <div className="min-h-screen bg-white">
            <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2 text-rural-700 font-bold hover:gap-3 transition-all">
                        <ChevronLeft size={20} /> Volver
                    </Link>
                    <div className="hidden md:flex gap-4">
                        <button className="p-2 hover:bg-gray-50 rounded-full transition-colors"><Share2 size={20} /></button>
                        <button className="p-2 hover:bg-gray-50 rounded-full transition-colors"><Heart size={20} /></button>
                    </div>
                </div>
            </nav>

            <main className="pt-24 pb-20 px-6">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12">
                    <div className="space-y-4">
                        <motion.div
                            layoutId="main-img"
                            className="aspect-[4/3] rounded-[2.5rem] overflow-hidden shadow-2xl relative bg-gray-100"
                        >
                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={activeImg}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.5 }}
                                    src={images[activeImg]}
                                    className="w-full h-full object-cover"
                                />
                            </AnimatePresence>
                            <div className="absolute bottom-6 right-6 bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold tracking-widest">
                                {activeImg + 1} / {images.length}
                            </div>
                        </motion.div>

                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveImg(idx)}
                                    className={`relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden transition-all duration-300 ${activeImg === idx ? 'ring-4 ring-rural-600 scale-95 opacity-100' : 'opacity-60 hover:opacity-100'}`}
                                >
                                    <img src={img} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-10">
                        <div>
                            <div className="flex flex-wrap items-center gap-3 text-rural-600 font-bold uppercase tracking-widest text-[10px] mb-3">
                                <Home size={14} /> <span>Alojamiento Rural</span>
                                <span className="opacity-20">|</span>
                                <span className="flex items-center gap-1"><Users size={14} /> {apartment.capacity_people} plazas</span>
                                <span className="opacity-20">|</span>
                                <span className="flex items-center gap-1"><ShieldCheck size={14} /> {apartment.registration_number || 'A/JA/00060'}</span>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-serif font-bold text-rural-900 mb-6 leading-tight">
                                {apartment.name}
                            </h1>
                            <div className="flex items-center gap-2 text-gray-500 mb-8">
                                <MapPin size={18} className="text-rural-500" />
                                <span className="text-lg">Hinojares, Jaén · {apartment.bathrooms || 1} Baño privado</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 text-center space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Temporada Baja</p>
                                    <p className="text-4xl font-serif font-bold text-rural-800">{apartment.price_low || 60}<span className="text-lg">€</span></p>
                                    <p className="text-[10px] text-gray-400 leading-none italic">/ por noche</p>
                                </div>
                                <div className="p-6 bg-rural-50 rounded-3xl border border-rural-100 text-center space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rural-600">Temporada Alta</p>
                                    <p className="text-4xl font-serif font-bold text-rural-800">{apartment.price_high || 70}<span className="text-lg">€</span></p>
                                    <p className="text-[10px] text-rural-400 leading-none italic">Navidad, S. Santa y Puentes</p>
                                </div>
                            </div>

                            <div className="space-y-6 mb-8">
                                <h3 className="text-sm font-bold text-rural-700 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar size={16} /> Disponibilidad Actual
                                </h3>
                                <AvailabilityCalendar apartmentId={apartment.id} />
                                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800">
                                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                    <p className="text-xs font-serif italic">Las fechas marcadas en rojo están ocupadas. Si tienes dudas sobre alguna fecha específica, consúltanos sin compromiso.</p>
                                </div>
                            </div>

                            <div className="p-4 bg-rural-900 text-white rounded-3xl flex items-center justify-between group">
                                <div className="pl-4">
                                    <p className="text-xs opacity-60">Consultar disponibilidad</p>
                                    <p className="font-bold">WhatsApp Directo</p>
                                </div>
                                <a
                                    href={`https://api.whatsapp.com/send?phone=34676344675&text=Hola,%20me%20gustaría%20consultar%20disponibilidad%20para%20el%20apartamento%20${apartment.name}.`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-8 py-4 bg-white text-rural-900 rounded-2xl font-bold hover:bg-rural-50 transition-all flex items-center gap-2"
                                >
                                    <Calendar size={18} /> Reservar
                                </a>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-2xl font-serif font-bold text-rural-800 border-b border-gray-100 pb-4">Sobre el alojamiento</h3>
                            <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-line">
                                {apartment.description || 'Disfruta de una estancia única en plena naturaleza. Nuestros apartamentos están cuidadosamente decorados para ofrecerte el máximo confort respetando la esencia rústica del entorno.'}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-2xl font-serif font-bold text-rural-800 uppercase tracking-widest text-xs">Equipamiento y Servicios</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {(apartment.amenities && apartment.amenities.length > 0 ? apartment.amenities : ['tv', 'wifi', 'heating', 'ac', 'fireplace', 'kitchen', 'fridge', 'microwave', 'bath', 'hairdryer', 'no_pets']).map((id, i) => {
                                    const item = AMENITIES_ICONS[id];
                                    if (!item) return null;
                                    const Icon = item.icon;
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-3 p-6 bg-white border border-gray-100 rounded-[2rem] hover:border-rural-200 transition-all group text-center">
                                            <Icon size={32} className="text-rural-400 group-hover:text-rural-600 transition-colors" />
                                            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest leading-tight">{item.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <section className="bg-rural-900 py-20 px-6 text-white text-center">
                <div className="max-w-4xl mx-auto space-y-8">
                    <h2 className="text-4xl font-serif font-bold italic">¿Buscas algo diferente?</h2>
                    <p className="opacity-70 text-lg">Explora el resto de nuestros apartamentos situados en el corazón de Hinojares.</p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-rural-300 font-bold hover:text-white transition-colors border-b border-rural-300/30 pb-1"
                    >
                        Ver todos los apartamentos <ArrowRight size={20} />
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default ApartmentDetail;

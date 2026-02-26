import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApartment } from '../hooks/useDatabase';
import { COLORS } from '../App';
import {
    ChevronLeft, Users, Flame, Wifi, Tv,
    UtensilsCrossed, Baby, MapPin, Calendar,
    Share2, Heart, ArrowRight, Home
} from 'lucide-react';

const ApartmentDetail = () => {
    const { slug } = useParams();
    const { apartment, loading } = useApartment(slug);
    const [activeImg, setActiveImg] = useState(0);

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
            {/* Header / Nav */}
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
                    {/* Galería de Fotos */}
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

                    {/* Contenido */}
                    <div className="space-y-10">
                        <div>
                            <div className="flex items-center gap-3 text-rural-600 font-bold uppercase tracking-widest text-xs mb-3">
                                <Home size={16} /> <span>Apartamento Rural</span>
                                <span className="opacity-20">|</span>
                                <span className="flex items-center gap-1"><Users size={14} /> {apartment.capacity_people} plazas</span>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-serif font-bold text-rural-900 mb-6 leading-tight">
                                {apartment.name}
                            </h1>
                            <div className="flex items-center gap-2 text-gray-500 mb-8">
                                <MapPin size={18} className="text-rural-500" />
                                <span className="text-lg">Hinojares, Jaén · Sierra de Cazorla</span>
                            </div>
                            <div className="p-8 bg-rural-50 rounded-[2rem] border border-rural-100 flex flex-wrap gap-8">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-rural-400">Desde</span>
                                    <span className="text-3xl font-serif font-bold text-rural-800">Consultar</span>
                                </div>
                                <div className="flex-grow flex items-center justify-end">
                                    <a
                                        href={`https://api.whatsapp.com/send?phone=34676344675&text=Hola,%20me%20gustar%C3%ADa%20consultar%20disponibilidad%20para%20el%20apartamento%20${apartment.name}.`}
                                        target="_blank"
                                        className="px-10 py-5 bg-rural-700 text-white rounded-2xl font-bold shadow-xl hover:bg-rural-800 hover:-translate-y-1 transition-all flex items-center gap-3"
                                    >
                                        <Calendar size={22} />
                                        Reservar estancia
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-2xl font-serif font-bold text-rural-800 border-b border-gray-100 pb-4">Sobre el alojamiento</h3>
                            <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-line">
                                {apartment.description || 'Disfruta de una estancia única en plena naturaleza. Nuestros apartamentos están cuidadosamente decorados para ofrecerte el máximo confort respetando la esencia rústica del entorno.'}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-2xl font-serif font-bold text-rural-800">Equipamiento y Servicios</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[
                                    { icon: Flame, label: 'Chimenea' },
                                    { icon: Wifi, label: 'WiFi Gratis' },
                                    { icon: UtensilsCrossed, label: 'Cocina' },
                                    { icon: Tv, label: 'Smart TV' },
                                    { icon: Baby, label: 'Cuna disp.' },
                                    { icon: Home, label: 'Mascotas' }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl hover:border-rural-200 transition-colors group">
                                        <item.icon size={20} className="text-rural-400 group-hover:text-rural-600 transition-colors" />
                                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Sugerencias finales */}
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

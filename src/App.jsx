import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from './lib/supabase';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import ClientLogin from './components/client/ClientLogin';
import ClientArea from './components/client/ClientArea';
import ApartmentDetail from './components/ApartmentDetail';
import { Mail, Phone, MapPin, Instagram, Facebook, Menu, X, Flame, Wifi, Tv, UtensilsCrossed, Baby, Eye } from 'lucide-react';

export const COLORS = {
    primary: '#556B2F',
    primaryDark: '#3b4a20',
    secondary: '#8C8468',
    accent: '#D6CEB8',
    bg: '#FCFBF9',
    bgWarm: '#f5f2ea',
    text: '#2C3319',
};

const WP = 'https://www.tiojosemaria.com/wp-content/uploads';
const WHATSAPP_URL = 'https://api.whatsapp.com/send?phone=34676344675&text=Hola,%20estoy%20viendo%20la%20web%20y%20quer%C3%ADa%20consultar%20una%20duda.';

// --- FADE IN ON SCROLL ---
const FadeInUp = ({ children, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, delay, ease: 'easeOut' }}
    >
        {children}
    </motion.div>
);

// --- NAVIGATION ---
const Navigation = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const links = [
        { label: 'Apartamentos', href: '/#apartamentos' },
        { label: 'El Entorno', href: '/#entorno' },
        { label: 'Documentos', href: '/clientes' },
        { label: 'Contacto', href: '/#contacto' },
    ];

    return (
        <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl">
            <div
                className="flex items-center justify-between px-6 py-3 rounded-2xl shadow-xl transition-all duration-500"
                style={{
                    backgroundColor: isScrolled ? 'rgba(252, 251, 249, 0.85)' : 'rgba(252, 251, 249, 0.5)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: `1px solid ${isScrolled ? 'rgba(85,107,47,0.15)' : 'rgba(255,255,255,0.3)'}`,
                }}
            >
                {/* Logo */}
                <a href="#" className="flex items-center gap-3">
                    <img
                        src="/assets/logo.jpg"
                        alt="Logo Tío José María Apartamentos Rurales"
                        className="h-10 object-contain"
                    />
                </a>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-6">
                    {links.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            className="text-sm font-medium tracking-wide transition-colors duration-300"
                            style={{ color: COLORS.text }}
                            onMouseEnter={(e) => e.target.style.color = COLORS.primary}
                            onMouseLeave={(e) => e.target.style.color = COLORS.text}
                        >
                            {link.label}
                        </a>
                    ))}
                    <a
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        Reservar
                    </a>
                </div>

                {/* Mobile Toggle */}
                <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} style={{ color: COLORS.text }}>
                    {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 rounded-2xl p-6 shadow-xl flex flex-col items-center gap-4"
                    style={{ backgroundColor: 'rgba(252,251,249,0.95)', backdropFilter: 'blur(24px)' }}
                >
                    {links.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            className="text-lg font-medium"
                            style={{ color: COLORS.text }}
                        >
                            {link.label}
                        </a>
                    ))}
                    <a
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 px-8 py-3 rounded-full text-white font-bold shadow-lg"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        Reservar ahora
                    </a>
                </motion.div>
            )}
        </nav>
    );
};

// --- HERO ---
const HeroSection = ({ title, subtitle }) => (
    <header className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
            <img
                src={`${WP}/2018/12/slide1.jpg`}
                alt="Vista panorámica de Casa Rural Tío José María en Hinojares"
                className="w-full h-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)' }} />
        </div>

        <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="relative z-10 text-center px-6 max-w-4xl"
        >
            <p className="text-white/70 uppercase tracking-[0.3em] text-sm mb-5 font-sans">Hinojares, Jaén</p>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-white font-bold mb-6 leading-tight">
                {title.split(' en ')[0]} <br /> en <span style={{ color: COLORS.accent }}>{title.split(' en ')[1] || 'Cazorla'}</span>
            </h1>
            <p className="text-white/80 text-lg md:text-xl mb-10 max-w-2xl mx-auto font-light leading-relaxed">
                {subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                    href="#apartamentos"
                    className="px-10 py-4 rounded-full text-lg font-bold shadow-2xl text-white transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    Ver Apartamentos
                </a>
                <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-10 py-4 rounded-full text-lg font-bold bg-white/10 backdrop-blur-md border border-white/30 text-white hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-2"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.29-1.24l-.296-.18-3.119.82.836-3.04-.196-.312A7.978 7.978 0 014 12a8 8 0 1116 0 8 8 0 01-8 8z" /></svg>
                    Consultar Dudas
                </a>
            </div>
        </motion.div>
    </header>
);

// --- INTRO ---
const IntroSection = ({ text }) => (
    <section className="py-24 px-6" style={{ backgroundColor: 'white' }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <FadeInUp>
                <div className="relative">
                    <img
                        src={`${WP}/2018/12/slide5.jpg`}
                        alt="Interior rústico de los apartamentos Tío José María"
                        className="rounded-2xl shadow-2xl w-full h-[500px] object-cover"
                    />
                    <div className="absolute -bottom-6 -right-6 p-6 rounded-xl shadow-lg hidden md:block" style={{ backgroundColor: COLORS.bgWarm }}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-serif text-4xl font-bold" style={{ color: COLORS.primary }}>9.5</span>
                            <span className="text-xl opacity-50">/10</span>
                        </div>
                        <p className="text-sm uppercase tracking-wider font-bold" style={{ color: COLORS.secondary }}>Excepcional en Booking</p>
                    </div>
                </div>
            </FadeInUp>
            <FadeInUp delay={0.2}>
                <div>
                    <h2 className="font-serif text-4xl md:text-5xl mb-6" style={{ color: COLORS.text }}>
                        Más que una casa rural, <br /><span style={{ color: COLORS.primary }} className="italic">es historia viva.</span>
                    </h2>
                    <p className="text-lg mb-8 leading-relaxed whitespace-pre-line" style={{ color: COLORS.secondary }}>
                        {text || `Bienvenidos a Tío José María. Ubicados en el sur del Parque Natural de Cazorla, nuestros 4 apartamentos combinan la arquitectura tradicional andaluza con el confort moderno.\n\nMuros de piedra, techos de vigas de madera y el calor de la chimenea te esperan. Ideal para parejas que buscan intimidad o familias que desean reconectar con la naturaleza.`}
                    </p>
                    <ul className="space-y-3">
                        {['Ubicación privilegiada en Hinojares', 'Chimenea de leña en todos los apartamentos', 'WiFi gratuito y mascotas bienvenidas'].map((item) => (
                            <li key={item} className="flex items-center gap-3 text-base" style={{ color: COLORS.text }}>
                                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: COLORS.primary }}>✓</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </FadeInUp>
        </div>
    </section>
);

// --- REVIEWS SECTION ---
const ReviewsSection = ({ reviews }) => {
    const defaultReviews = [
        { name: 'Alejandro', text: 'El alojamiento estaba genial. Era una apartamento muy acogedor y bien equipado.', score: '10' },
        { name: 'Antonio', text: 'Acogedor y tranquilo. Muy limpio.', score: '10' },
        { name: 'Rubén', text: 'Casa del siglo XVII reformada 😍. Nos encantó el pueblo, muy tranquilo.', score: '10' },
        { name: 'Sebastián', text: 'El trato de los anfitriones. El apartamento es muy bonito, acogedor y todo estaba muy limpio.', score: '10' }
    ];

    const displayReviews = reviews && reviews.length > 0 ? reviews : defaultReviews;
    const [index, setIndex] = React.useState(0);
    const reviewsPerPage = 4;

    React.useEffect(() => {
        if (displayReviews.length <= reviewsPerPage) return;
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % displayReviews.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [displayReviews.length]);

    const visibleReviews = [];
    for (let i = 0; i < Math.min(reviewsPerPage, displayReviews.length); i++) {
        visibleReviews.push(displayReviews[(index + i) % displayReviews.length]);
    }

    return (
        <section className="py-24 px-6 bg-rural-100/30 overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
                    <div>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold" style={{ color: COLORS.primary }}>Opiniones Reales</span>
                        <h2 className="font-serif text-4xl md:text-5xl font-bold mt-3" style={{ color: COLORS.text }}>Lo que dicen nuestros huéspedes</h2>
                    </div>
                    <a href="https://www.booking.com/hotel/es/casa-rural-tio-jose-maria.es.html#tab-reviews" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/be/Booking.com_logo.svg" alt="Booking.com" className="h-5" />
                        <div className="text-right">
                            <p className="text-sm font-bold leading-none">9.5/10</p>
                            <p className="text-[10px] opacity-60">Puntuación Excepcional</p>
                        </div>
                    </a>
                </div>

                <div className={`grid gap-6 ${visibleReviews.length === 1 ? 'max-w-md mx-auto' : visibleReviews.length === 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' : visibleReviews.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
                    {visibleReviews.map((rev, i) => (
                        <motion.div
                            key={`${rev.name}-${index}-${i}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="bg-white p-8 rounded-2xl shadow-sm h-full flex flex-col border border-gray-50"
                        >
                            <div className="flex gap-1 mb-4 text-xs text-yellow-400">
                                {[...Array(5)].map((_, star) => <span key={star}>★</span>)}
                            </div>
                            <p className="text-sm italic flex-grow mb-6 leading-relaxed" style={{ color: COLORS.text }}>"{rev.text}"</p>
                            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                                <span className="font-bold text-sm" style={{ color: COLORS.text }}>{rev.name}</span>
                                <span className="bg-rural-100 px-2 py-1 rounded text-[10px] font-bold" style={{ color: COLORS.primary }}>{rev.score || '10'}</span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// --- APARTMENTS GRID ---
const ServicesGrid = ({ apartments }) => {
    const defaultApartments = [
        { name: 'Albahaca', tag: 'Romántico', capacity: '2 plazas', href: '/Albahaca.html', img: `${WP}/2018/12/ALBAHACA-1.jpg`, desc: 'Íntimo y acogedor. Diseñado para parejas. Disfruta de una cena romántica frente a la chimenea después de una ruta por el parque.', icons: [Flame, Wifi, Tv] },
        { name: 'Tomillo', tag: 'Con Vistas', capacity: '2 plazas', href: '/Tomillo.html', img: `${WP}/2018/12/TOMILLOHOME1.jpg`, desc: 'Ubicado en la segunda planta con balcón y vistas al valle. Techos de madera abuhardillados que le dan un encanto especial.', icons: [Eye, Wifi, Flame] },
        { name: 'Lavanda', tag: 'Familiar', capacity: '4 plazas', href: '/Lavanda.html', img: `${WP}/2018/12/LAVANDAHOME1.jpg`, desc: 'Espacioso y luminoso. Salón con chimenea, cocina completa, dormitorio de matrimonio y otro doble. Ideal para familias.', icons: [Flame, UtensilsCrossed, Baby] },
        { name: 'Romero', tag: 'Familiar', capacity: '4 plazas', href: '/Romero.html', img: `${WP}/2018/12/ROMEROHOME1.jpg`, desc: 'Confort rústico con todas las comodidades. Salón con chimenea para las noches de invierno y dos dormitorios independientes.', icons: [Flame, UtensilsCrossed, Wifi] },
    ];

    const displayApartments = apartments && apartments.length > 0
        ? apartments.map(apt => ({
            name: apt.name,
            tag: apt.capacity_people <= 2 ? 'Romántico' : 'Familiar',
            capacity: `${apt.capacity_people} plazas`,
            href: `/apartamento/${apt.slug}`,
            img: apt.images?.[0] || `${WP}/2018/12/ALBAHACA-1.jpg`,
            desc: apt.description,
            icons: apt.capacity_people <= 2 ? [Flame, Wifi, Tv] : [Flame, UtensilsCrossed, Wifi]
        }))
        : defaultApartments.map(apt => ({ ...apt, href: `/apartamento/${apt.name.toLowerCase()}` }));

    return (
        <section id="apartamentos" className="py-28 px-6" style={{ background: `linear-gradient(180deg, ${COLORS.bgWarm} 0%, ${COLORS.bg} 100%)` }}>
            <div className="max-w-7xl mx-auto">
                <FadeInUp>
                    <div className="text-center mb-20">
                        <span className="uppercase tracking-[0.2em] text-xs font-bold" style={{ color: COLORS.primary }}>Nuestros Alojamientos</span>
                        <h2 className="font-serif text-4xl md:text-5xl font-bold mt-3" style={{ color: COLORS.text }}>Elige tu rincón favorito</h2>
                    </div>
                </FadeInUp>

                <div className="grid md:grid-cols-2 gap-10">
                    {displayApartments.map((apt, idx) => (
                        <FadeInUp key={apt.name} delay={idx * 0.1}>
                            <Link to={apt.href} className="block group">
                                <div
                                    className="bg-white rounded-2xl overflow-hidden shadow-lg transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2"
                                    style={{ border: '1px solid transparent' }}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.accent}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                                >
                                    <div className="h-72 overflow-hidden relative">
                                        <img src={apt.img} alt={`Apartamento ${apt.name} - Casa Rural Tío José María`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        <div className="absolute top-5 right-5 bg-white/90 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm" style={{ color: COLORS.primaryDark }}>
                                            {apt.tag}
                                        </div>
                                    </div>
                                    <div className="p-8">
                                        <div className="flex justify-between items-baseline mb-3">
                                            <h3 className="font-serif text-2xl font-bold" style={{ color: COLORS.text }}>{apt.name}</h3>
                                            <span className="text-sm" style={{ color: COLORS.secondary }}>{apt.capacity}</span>
                                        </div>
                                        <p className="text-sm leading-relaxed mb-6" style={{ color: COLORS.secondary }}>{apt.desc}</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-3">
                                                {apt.icons.map((Icon, i) => (
                                                    <Icon key={i} size={16} style={{ color: COLORS.accent }} />
                                                ))}
                                            </div>
                                            <span className="text-sm font-bold transition-colors duration-300" style={{ color: COLORS.primary }}>
                                                Ver Detalles →
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </FadeInUp>
                    ))}
                </div>

                <FadeInUp>
                    <div className="text-center mt-14">
                        <p className="italic mb-3" style={{ color: COLORS.secondary }}>Todos nuestros apartamentos están equipados con ropa de cama, toallas y menaje de cocina.</p>
                        <a href="https://wa.me/34676344675" target="_blank" rel="noopener noreferrer" className="inline-block font-bold hover:underline" style={{ color: COLORS.primary }}>
                            ¿Tienes dudas sobre cuál elegir? Escríbenos →
                        </a>
                    </div>
                </FadeInUp>
            </div>
        </section>
    );
};

// --- ENTORNO ---
const EntornoSection = ({ places, routes }) => {
    const gastronomy = places.filter(p => p.type === 'restaurante').slice(0, 1);
    const starActivity = routes.slice(0, 1);

    return (
        <section id="entorno" className="py-24 px-6 bg-white overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold" style={{ color: COLORS.primary }}>Hinojares y el Valle del Turrilla</span>
                        <h2 className="font-serif text-4xl md:text-5xl font-bold mt-3 mb-8" style={{ color: COLORS.text }}>Un paraíso de contrastes entre desierto y pinar</h2>
                        <p className="text-lg leading-relaxed mb-6" style={{ color: COLORS.secondary }}>
                            Tío José María se ubica en <strong>Hinojares</strong>, un pueblo mágico de gredas blancas al sur del <strong>Parque Natural de la Sierra de Cazorla</strong>. Es un destino donde el agua de los ríos y embalses se funde con paisajes semidesérticos y bosques vírgenes.
                        </p>
                        <div className="grid grid-cols-2 gap-6 mt-10">
                            <div className="p-5 rounded-xl border border-rural-100 bg-rural-50">
                                <h4 className="font-serif text-xl font-bold mb-2" style={{ color: COLORS.primary }}>
                                    {starActivity[0]?.title || 'Rutas a Caballo'}
                                </h4>
                                <p className="text-sm opacity-80" style={{ color: COLORS.text }}>
                                    {starActivity[0]?.duration || 'La actividad estrella para recorrer los senderos del parque.'}
                                </p>
                            </div>
                            <div className="p-5 rounded-xl border border-rural-100 bg-rural-50">
                                <h4 className="font-serif text-xl font-bold mb-2" style={{ color: COLORS.primary }}>
                                    {gastronomy[0]?.name || 'Gastronomía'}
                                </h4>
                                <p className="text-sm opacity-80" style={{ color: COLORS.text }}>
                                    {gastronomy[0]?.description || 'No puedes irte sin probar el cordero al horno tradicional.'}
                                </p>
                            </div>
                        </div>
                    </FadeInUp>
                    <div className="grid grid-cols-2 gap-4">
                        <FadeInUp delay={0.2}>
                            <img src={places[0]?.image_url || "https://www.tiojosemaria.com/wp-content/uploads/2018/12/hinojaresPueblo.jpg"} alt="Entorno Local" className="rounded-2xl shadow-lg w-full h-64 object-cover mt-8" />
                        </FadeInUp>
                        <FadeInUp delay={0.3}>
                            <img src={routes[0]?.image_url || "https://www.tiojosemaria.com/wp-content/uploads/2018/12/MG_9540-1024x561.jpg"} alt="Rutas Sierra" className="rounded-2xl shadow-lg w-full h-80 object-cover" />
                        </FadeInUp>
                        <FadeInUp delay={0.4}>
                            <img src={places[1]?.image_url || "https://www.tiojosemaria.com/wp-content/uploads/2019/01/chuletas-de-cordero-al-horno2-1024x724.jpg"} alt="Gastronomía" className="rounded-2xl shadow-lg w-full h-64 object-cover -mt-16" />
                        </FadeInUp>
                        <FadeInUp delay={0.5}>
                            <img src={routes[1]?.image_url || "https://www.tiojosemaria.com/wp-content/uploads/2018/12/10-1024x768.jpg"} alt="Actividades" className="rounded-2xl shadow-lg w-full h-64 object-cover mt-4" />
                        </FadeInUp>
                    </div>
                </div>

                <FadeInUp>
                    <div className="rounded-3xl p-10 md:p-16 text-center text-white relative overflow-hidden shadow-2xl" style={{ backgroundColor: COLORS.primary }}>
                        <div className="absolute inset-0 opacity-10">
                            <img src={`${WP}/2018/12/slide3.jpg`} alt="Paisaje" className="w-full h-full object-cover" />
                        </div>
                        <div className="relative z-10">
                            <h3 className="font-serif text-3xl md:text-5xl font-bold mb-6">¿Preparado para tu desconexión?</h3>
                            <p className="text-lg opacity-90 max-w-2xl mx-auto mb-10 leading-relaxed">
                                Estamos en Calle Baja 1, Hinojares. Te facilitamos el camino para que solo tengas que preocuparte de disfrutar.
                            </p>
                            <a
                                href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-10 py-4 bg-white rounded-full text-lg font-bold transition-all duration-300 hover:shadow-xl hover:-translate-y-1 shadow-md"
                                style={{ color: COLORS.primary }}
                            >
                                <MapPin size={20} />
                                Cómo llegar al alojamiento
                            </a>
                        </div>
                    </div>
                </FadeInUp>
            </div>
        </section>
    );
};

// --- GUIA SECRETA ---
const GuiaSection = () => (
    <section id="guia" className="py-24 relative overflow-hidden text-white" style={{ backgroundColor: COLORS.primaryDark }}>
        <div className="absolute inset-0 opacity-20">
            <img src={`${WP}/2023/07/slide-1.jpg`} alt="Paisaje del entorno natural de Cazorla" className="w-full h-full object-cover" style={{ filter: 'grayscale(100%)' }} />
        </div>
        <div className="max-w-3xl mx-auto px-6 relative z-10 text-center">
            <FadeInUp>
                <p className="text-5xl mb-6">🗺️</p>
                <h2 className="font-serif text-3xl md:text-5xl font-bold mb-5">Descubre el Cazorla que no sale en las guías</h2>
                <p className="text-lg mb-10 opacity-90 leading-relaxed" style={{ color: COLORS.accent }}>
                    Hemos preparado una guía exclusiva con nuestras rutas favoritas, los mejores sitios para comer en Hinojares y secretos locales.
                </p>
                <form
                    className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto"
                    onSubmit={(e) => { e.preventDefault(); alert('¡Gracias! Pronto recibirás nuestra guía.'); }}
                >
                    <input
                        type="email"
                        placeholder="Tu correo electrónico"
                        required
                        className="px-6 py-4 rounded-full text-gray-900 focus:outline-none focus:ring-2 flex-grow"
                        style={{ '--tw-ring-color': COLORS.accent }}
                    />
                    <button
                        type="submit"
                        className="px-8 py-4 font-bold rounded-full transition-all duration-300 hover:scale-105 shadow-lg"
                        style={{ backgroundColor: COLORS.accent, color: COLORS.text }}
                    >
                        Enviar Guía
                    </button>
                </form>
                <p className="text-xs mt-5 opacity-60">Prometemos no enviar spam. Solo cosas bonitas del campo.</p>
            </FadeInUp>
        </div>
    </section>
);

// --- FOOTER ---
const Footer = () => (
    <footer id="contacto" className="py-20 px-6 text-white" style={{ backgroundColor: '#111827' }}>
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-16 mb-14">
            <div>
                <h3 className="font-serif text-2xl font-bold mb-6">Tío José María</h3>
                <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-6">
                    Vivienda turística de Alojamiento Rural registrada en la Junta de Andalucía (VTAR/JA/00044). Tu casa en Hinojares.
                </p>
                <div className="flex gap-3">
                    <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300" style={{ backgroundColor: '#1f2937' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.primary} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}>
                        <Facebook size={16} />
                    </a>
                    <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300" style={{ backgroundColor: '#1f2937' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.primary} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}>
                        <Instagram size={16} />
                    </a>
                </div>
            </div>
            <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-8" style={{ color: COLORS.accent }}>Contacto</h4>
                <ul className="space-y-4 text-sm text-white/60">
                    <li className="flex items-start gap-3">
                        <MapPin size={16} className="flex-shrink-0 mt-0.5" style={{ color: COLORS.primary }} />
                        <a
                            href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-white transition-colors leading-relaxed"
                        >
                            Calle Baja 1,<br />23486 Hinojares, Jaén
                        </a>
                    </li>
                    <li className="flex items-center gap-3">
                        <Phone size={16} className="flex-shrink-0" style={{ color: COLORS.primary }} />
                        <a href="tel:+34676344675" className="hover:text-white transition-colors">676 34 46 75</a>
                    </li>
                    <li className="flex items-center gap-3">
                        <Mail size={16} className="flex-shrink-0" style={{ color: COLORS.primary }} />
                        <a href="mailto:info@tiojosemaria.com" className="hover:text-white transition-colors">info@tiojosemaria.com</a>
                    </li>
                </ul>
            </div>
            <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-8" style={{ color: COLORS.accent }}>¿Dónde estamos?</h4>
                <a
                    href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden h-48 relative group cursor-pointer"
                    style={{ backgroundColor: '#1f2937' }}
                >
                    <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80" alt="Ubicación en mapa de Hinojares" className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-300" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-white text-gray-900 px-5 py-2.5 rounded-full text-sm font-bold shadow-lg">Ver en Google Maps</span>
                    </div>
                </a>
            </div>
        </div>
        <div className="border-t border-white/10 pt-8 text-center text-white/40 text-sm flex flex-col md:flex-row justify-center items-center gap-4">
            <span>© 2025 Apartamentos Tío José María.</span>
            <div className="flex gap-4">
                <a href="/admin" className="hover:text-white transition-colors">Acceso Administración</a>
                <span className="opacity-20">|</span>
                <a href="/clientes" className="hover:text-white transition-colors">Área Clientes</a>
            </div>
        </div>
    </footer>
);

// --- WHATSAPP FAB ---
const WhatsAppFab = () => (
    <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-2xl transition-all duration-300 hover:scale-110 flex items-center gap-2 group"
    >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.29-1.24l-.296-.18-3.119.82.836-3.04-.196-.312A7.978 7.978 0 014 12a8 8 0 1116 0 8 8 0 01-8 8z" /></svg>
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out whitespace-nowrap font-bold">¡Pregúntanos!</span>
    </a>
);

import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
    const { pathname, hash } = useLocation();
    useEffect(() => {
        if (!hash) {
            window.scrollTo(0, 0);
        } else {
            const id = hash.replace('#', '');
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [pathname, hash]);
    return null;
};

import { useWebConfig, useApartments, useReviews, useLocalPlaces, useRoutes } from './hooks/useDatabase';

// --- PUBLIC LANDING PAGE ---
const LandingPage = () => {
    const { config, loading: configLoading } = useWebConfig();
    const { apartments, loading: aptLoading } = useApartments();
    const { reviews, loading: revLoading } = useReviews();
    const { places, loading: placesLoading } = useLocalPlaces();
    const { routes, loading: routesLoading } = useRoutes();

    if (configLoading || aptLoading || revLoading || placesLoading || routesLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-rural-50 italic opacity-50 font-serif">Cargando Tío José María...</div>;
    }

    return (
        <div style={{ backgroundColor: COLORS.bg, fontFamily: '"Lato", sans-serif' }}>
            <Navigation />
            <HeroSection
                title={config.hero_title || 'Apartamentos Rurales Tío José María'}
                subtitle={config.hero_subtitle || 'Tu refugio histórico en Cazorla'}
            />
            <IntroSection text={config.intro_text} />
            <ReviewsSection reviews={reviews} />
            <ServicesGrid apartments={apartments} />
            <EntornoSection places={places} routes={routes} />
            <GuiaSection />
            <Footer />
            <WhatsAppFab />
        </div>
    );
};


// --- APP COMPONENT ---
export default function App() {
    const [session, setSession] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else setLoadingProfile(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else {
                setUserProfile(null);
                setLoadingProfile(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchProfile(userId) {
        setLoadingProfile(true);
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) setUserProfile(data);
        setLoadingProfile(false);
    }

    if (session && loadingProfile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-rural-50 font-serif p-6 text-center">
                <div className="animate-pulse text-rural-700 italic mb-4">Verificando credenciales...</div>
                <div className="text-[10px] text-gray-400 space-y-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm max-w-xs">
                    <p>Sesión activa para: <span className="text-gray-600 font-mono">{session.user.email}</span></p>
                    <p>ID: <span className="text-gray-300 font-mono">{session.user.id.substring(0, 8)}...</span></p>
                    <p>Estado perfil: <span className={userProfile ? "text-green-500" : "text-amber-500"}>{userProfile ? `Rol: ${userProfile.role}` : "Cargando datos..."}</span></p>
                </div>
            </div>
        );
    }

    return (
        <>
            <ScrollToTop />
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/apartamento/:slug" element={<ApartmentDetail />} />
                <Route
                    path="/admin"
                    element={!session ? <AdminLogin /> : (userProfile?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" replace />)}
                />
                <Route
                    path="/clientes"
                    element={!session ? <ClientLogin /> : <ClientArea />}
                />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
    );
}

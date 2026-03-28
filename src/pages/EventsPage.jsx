import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, Calendar, MapPin, Filter, Leaf, Sun, CloudRain, Snowflake,
    TreePine, UtensilsCrossed, Palette, PartyPopper, Mountain, RefreshCw
} from 'lucide-react';
import { useLocalEvents } from '../hooks/useDatabase';
import { COLORS } from '../constants/colors';

const SEASONS = [
    { key: 'todas', label: 'Todas', icon: Calendar },
    { key: 'primavera', label: 'Primavera', icon: Leaf },
    { key: 'verano', label: 'Verano', icon: Sun },
    { key: 'otoño', label: 'Otoño', icon: CloudRain },
    { key: 'invierno', label: 'Invierno', icon: Snowflake },
];

const CATEGORIES = [
    { key: 'todas', label: 'Todas', icon: Filter },
    { key: 'naturaleza', label: 'Naturaleza', icon: TreePine },
    { key: 'gastronomía', label: 'Gastronomía', icon: UtensilsCrossed },
    { key: 'cultura', label: 'Cultura', icon: Palette },
    { key: 'fiestas', label: 'Fiestas', icon: PartyPopper },
    { key: 'deportes', label: 'Deportes', icon: Mountain },
];

const SEASON_COLORS = {
    primavera: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
    verano: { bg: '#fef9c3', text: '#854d0e', border: '#fde68a' },
    otoño: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
    invierno: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    todo_el_año: { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
};

const SEASON_HERO = {
    todas: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600',
    primavera: 'https://images.unsplash.com/photo-1462275646964-a0e3c11f18a6?w=1600',
    verano: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600',
    otoño: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600',
    invierno: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1600',
};

const SEASON_LABELS = {
    primavera: 'Primavera',
    verano: 'Verano',
    otoño: 'Otoño',
    invierno: 'Invierno',
    todo_el_año: 'Todo el Año',
};

function formatDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

function formatDateRange(event) {
    if (event.is_recurring) return 'Cada luna llena';
    if (!event.event_date) return 'Consultar fechas';
    const start = formatDate(event.event_date);
    if (!event.end_date || event.event_date === event.end_date) return start;
    const end = formatDate(event.end_date);
    return `${start} - ${end}`;
}

const EventsPage = () => {
    const { events, loading } = useLocalEvents();
    const [seasonFilter, setSeasonFilter] = useState('todas');
    const [categoryFilter, setCategoryFilter] = useState('todas');

    const filteredEvents = useMemo(() => {
        return events.filter((e) => {
            const seasonMatch = seasonFilter === 'todas' || e.season === seasonFilter || e.season === 'todo_el_año';
            const catMatch = categoryFilter === 'todas' || e.category === categoryFilter;
            return seasonMatch && catMatch;
        });
    }, [events, seasonFilter, categoryFilter]);

    const heroImage = SEASON_HERO[seasonFilter] || SEASON_HERO.todas;

    return (
        <div className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
            {/* Hero Section */}
            <div className="relative h-[340px] md:h-[420px] overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={heroImage}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="absolute inset-0"
                    >
                        <img
                            src={heroImage}
                            alt="Sierra de Cazorla"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
                    </motion.div>
                </AnimatePresence>

                <div className="relative z-10 h-full flex flex-col justify-between p-4 md:p-8 max-w-7xl mx-auto">
                    <Link
                        to="/"
                        className="flex items-center gap-1 text-white/90 text-sm font-medium hover:text-white transition-colors w-fit"
                    >
                        <ChevronLeft size={18} /> Volver al inicio
                    </Link>

                    <div className="pb-4">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="font-serif text-3xl md:text-5xl font-bold text-white mb-3"
                        >
                            Eventos y Experiencias
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            className="text-white/85 text-base md:text-lg max-w-2xl leading-relaxed"
                        >
                            Descubre la magia de la Sierra de Cazorla a lo largo de las estaciones.
                            Naturaleza, cultura, gastronomía y tradición te esperan.
                        </motion.p>
                    </div>
                </div>
            </div>

            {/* Sticky Filters */}
            <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    {/* Season Tabs */}
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2">
                        {SEASONS.map((s) => {
                            const Icon = s.icon;
                            const isActive = seasonFilter === s.key;
                            return (
                                <button
                                    key={s.key}
                                    onClick={() => setSeasonFilter(s.key)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200"
                                    style={{
                                        backgroundColor: isActive ? COLORS.primary : 'white',
                                        color: isActive ? 'white' : COLORS.text,
                                        border: `1px solid ${isActive ? COLORS.primary : '#e5e7eb'}`,
                                    }}
                                >
                                    <Icon size={14} />
                                    {s.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Category Pills */}
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pt-1">
                        {CATEGORIES.map((c) => {
                            const Icon = c.icon;
                            const isActive = categoryFilter === c.key;
                            return (
                                <button
                                    key={c.key}
                                    onClick={() => setCategoryFilter(c.key)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200"
                                    style={{
                                        backgroundColor: isActive ? `${COLORS.primary}15` : 'transparent',
                                        color: isActive ? COLORS.primary : COLORS.secondary,
                                        border: `1px solid ${isActive ? `${COLORS.primary}40` : 'transparent'}`,
                                    }}
                                >
                                    <Icon size={12} />
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200" style={{ borderTopColor: COLORS.primary }} />
                        <p className="mt-4 text-sm italic" style={{ color: COLORS.secondary }}>Cargando eventos...</p>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-20"
                    >
                        <Calendar size={48} className="mx-auto mb-4 opacity-30" style={{ color: COLORS.secondary }} />
                        <p className="font-serif text-xl mb-2" style={{ color: COLORS.text }}>
                            No hay eventos para estos filtros
                        </p>
                        <p className="text-sm mb-6" style={{ color: COLORS.secondary }}>
                            Prueba con otra temporada o categoría
                        </p>
                        <button
                            onClick={() => { setSeasonFilter('todas'); setCategoryFilter('todas'); }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:shadow-lg"
                            style={{ backgroundColor: COLORS.primary }}
                        >
                            <RefreshCw size={14} /> Ver todos los eventos
                        </button>
                    </motion.div>
                ) : (
                    <>
                        <p className="text-sm mb-6" style={{ color: COLORS.secondary }}>
                            {filteredEvents.length} {filteredEvents.length === 1 ? 'evento encontrado' : 'eventos encontrados'}
                        </p>

                        <motion.div
                            layout
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            <AnimatePresence mode="popLayout">
                                {filteredEvents.map((event) => (
                                    <EventCard key={event.id} event={event} />
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    </>
                )}
            </div>

            {/* Footer CTA */}
            <div className="max-w-7xl mx-auto px-4 pb-12">
                <div
                    className="rounded-2xl p-6 md:p-8 text-center"
                    style={{ backgroundColor: COLORS.bgWarm }}
                >
                    <p className="font-serif text-lg md:text-xl mb-2" style={{ color: COLORS.text }}>
                        ¿Quieres vivir alguna de estas experiencias?
                    </p>
                    <p className="text-sm mb-5" style={{ color: COLORS.secondary }}>
                        Reserva tu alojamiento en Apartamentos Tío José María y te ayudamos a planificar tu visita.
                    </p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        Ver Apartamentos
                    </Link>
                </div>
            </div>
        </div>
    );
};

const EventCard = ({ event }) => {
    const seasonStyle = SEASON_COLORS[event.season] || SEASON_COLORS.todo_el_año;
    const categoryObj = CATEGORIES.find((c) => c.key === event.category);
    const CategoryIcon = categoryObj?.icon || Calendar;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden border border-gray-100"
        >
            {/* Image */}
            <div className="relative h-48 overflow-hidden">
                {event.image_url ? (
                    <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: COLORS.bgWarm }}>
                        <CategoryIcon size={40} style={{ color: COLORS.secondary, opacity: 0.4 }} />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                {/* Season Badge */}
                <span
                    className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{
                        backgroundColor: seasonStyle.bg,
                        color: seasonStyle.text,
                        border: `1px solid ${seasonStyle.border}`,
                    }}
                >
                    {SEASON_LABELS[event.season] || event.season}
                </span>

                {/* Recurring Badge */}
                {event.is_recurring && (
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-sm" style={{ color: COLORS.primary }}>
                        <RefreshCw size={10} className="inline mr-1" />
                        Recurrente
                    </span>
                )}

                {/* Category Badge */}
                <span className="absolute bottom-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 backdrop-blur-sm" style={{ color: COLORS.text }}>
                    <CategoryIcon size={12} />
                    {categoryObj?.label || event.category}
                </span>
            </div>

            {/* Content */}
            <div className="p-5">
                <h3 className="font-serif text-lg font-bold mb-2 leading-snug" style={{ color: COLORS.text }}>
                    {event.title}
                </h3>

                <div className="flex items-center gap-1.5 mb-2">
                    <Calendar size={13} style={{ color: COLORS.primary }} />
                    <span className="text-xs font-medium" style={{ color: COLORS.primary }}>
                        {formatDateRange(event)}
                    </span>
                </div>

                {event.location && (
                    <div className="flex items-center gap-1.5 mb-3">
                        <MapPin size={13} style={{ color: COLORS.secondary }} />
                        <span className="text-xs" style={{ color: COLORS.secondary }}>
                            {event.location}
                        </span>
                    </div>
                )}

                <p className="text-sm leading-relaxed line-clamp-3" style={{ color: COLORS.secondary }}>
                    {event.description}
                </p>
            </div>
        </motion.div>
    );
};

export default EventsPage;

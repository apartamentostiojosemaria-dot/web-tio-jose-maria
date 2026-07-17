import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, Calendar, MapPin, Filter, Leaf, Sun, CloudRain, Snowflake,
    TreePine, UtensilsCrossed, Palette, PartyPopper, Mountain, RefreshCw,
    Clock, Building2, X, ArrowRight,
} from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { BreadcrumbJsonLd, EventsListJsonLd } from '../components/seo/JsonLd';
import { useLocalEvents } from '../hooks/useDatabase';

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
    primavera: { bg: 'var(--color-season-spring-bg)', text: 'var(--color-season-spring)', border: 'var(--color-season-spring-border)' },
    verano: { bg: 'var(--color-season-summer-bg)', text: 'var(--color-season-summer)', border: 'var(--color-season-summer-border)' },
    otoño: { bg: 'var(--color-season-autumn-bg)', text: 'var(--color-season-autumn)', border: 'var(--color-season-autumn-border)' },
    invierno: { bg: 'var(--color-season-winter-bg)', text: 'var(--color-season-winter)', border: 'var(--color-season-winter-border)' },
    todo_el_año: { bg: 'var(--color-season-year-bg)', text: 'var(--color-season-year)', border: 'var(--color-season-year-border)' },
};

const SEASON_HERO = {
    todas: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600',
    primavera: 'https://images.unsplash.com/photo-1462275646964-a0e3c11f18a6?w=1600',
    verano: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600',
    otoño: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600',
    invierno: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1600',
};

const SEASON_LABELS = {
    primavera: 'Primavera', verano: 'Verano', otoño: 'Otoño',
    invierno: 'Invierno', todo_el_año: 'Todo el Año',
};

function formatDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

function formatDateRange(event) {
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
    const [openEvent, setOpenEvent] = useState(null);

    const filteredEvents = useMemo(() => {
        return events.filter((e) => {
            const seasonMatch = seasonFilter === 'todas' || e.season === seasonFilter || e.season === 'todo_el_año';
            const catMatch = categoryFilter === 'todas' || e.category === categoryFilter;
            return seasonMatch && catMatch;
        });
    }, [events, seasonFilter, categoryFilter]);

    // Próximos eventos: los que NO han terminado todavía, ordenados por fecha de inicio
    const upcoming = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        return events
            .filter(e => (e.end_date || e.event_date) >= today)
            .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
            .slice(0, 3);
    }, [events]);

    const heroImage = SEASON_HERO[seasonFilter] || SEASON_HERO.todas;

    return (
        <div className="min-h-screen bg-surface">
            <PageHead
                title="Eventos y Experiencias en la Sierra de Cazorla"
                description="Descubre la magia de la Sierra de Cazorla a lo largo de las estaciones. Naturaleza, cultura, gastronomía y tradición en Hinojares y alrededores."
                path="/eventos"
            />
            <BreadcrumbJsonLd items={[
                { name: 'Inicio', url: 'https://tiojosemaria.com/' },
                { name: 'Eventos', url: 'https://tiojosemaria.com/eventos' }
            ]} />
            <EventsListJsonLd events={events} />
            {/* Hero */}
            <div className="relative h-[340px] md:h-[420px] overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div key={heroImage} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="absolute inset-0">
                        <img src={heroImage} alt="Sierra de Cazorla" fetchpriority="high" decoding="async" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
                    </motion.div>
                </AnimatePresence>
                <div className="relative z-10 h-full flex flex-col justify-between p-4 md:p-8 max-w-7xl mx-auto">
                    <Link to="/" className="flex items-center gap-1 text-white/90 text-sm font-medium hover:text-white transition-colors w-fit">
                        <ChevronLeft size={18} /> Volver al inicio
                    </Link>
                    <div className="pb-4">
                        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="font-serif text-3xl md:text-5xl font-bold text-white mb-3">Eventos y Experiencias</motion.h1>
                        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="text-white/85 text-base md:text-lg max-w-2xl leading-relaxed">
                            Descubre la magia de la Sierra de Cazorla a lo largo de las estaciones. Naturaleza, cultura, gastronomia y tradicion te esperan.
                        </motion.p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2" role="tablist" aria-label="Filtrar por temporada">
                        {SEASONS.map((s) => {
                            const Icon = s.icon;
                            const isActive = seasonFilter === s.key;
                            return (
                                <button
                                    key={s.key}
                                    onClick={() => setSeasonFilter(s.key)}
                                    role="tab"
                                    aria-selected={isActive}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 border ${
                                        isActive ? 'bg-primary text-white border-primary' : 'bg-white text-text-primary border-gray-200'
                                    }`}
                                >
                                    <Icon size={14} />
                                    {s.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pt-1" role="tablist" aria-label="Filtrar por categoría">
                        {CATEGORIES.map((c) => {
                            const Icon = c.icon;
                            const isActive = categoryFilter === c.key;
                            return (
                                <button
                                    key={c.key}
                                    onClick={() => setCategoryFilter(c.key)}
                                    role="tab"
                                    aria-selected={isActive}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 border ${
                                        isActive ? 'bg-primary/10 text-primary border-primary/30' : 'text-secondary border-transparent'
                                    }`}
                                >
                                    <Icon size={12} />
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Próximos eventos destacados */}
            {!loading && upcoming.length > 0 && (
                <div className="max-w-7xl mx-auto px-4 pt-8">
                    <div className="flex items-baseline justify-between mb-4">
                        <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary">Próximos eventos</h2>
                        <span className="text-xs uppercase tracking-widest font-bold text-gray-500">{upcoming.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {upcoming.map((ev) => <UpcomingEventCard key={ev.id} event={ev} onOpen={() => setOpenEvent(ev)} />)}
                    </div>
                </div>
            )}

            {/* Content: todos los eventos con filtros */}
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-primary" />
                        <p className="mt-4 text-sm italic text-secondary">Cargando eventos...</p>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
                        <Calendar size={48} className="mx-auto mb-4 opacity-30 text-secondary" />
                        <p className="font-serif text-xl mb-2 text-text-primary">No hay eventos para estos filtros</p>
                        <p className="text-sm mb-6 text-secondary">Prueba con otra temporada o categoría</p>
                        <button onClick={() => { setSeasonFilter('todas'); setCategoryFilter('todas'); }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white bg-primary transition-all hover:shadow-lg">
                            <RefreshCw size={14} /> Ver todos los eventos
                        </button>
                    </motion.div>
                ) : (
                    <>
                        <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-2">Calendario completo</h2>
                        <p className="text-sm mb-6 text-secondary">{filteredEvents.length} {filteredEvents.length === 1 ? 'evento' : 'eventos'} · Pulsa una tarjeta para ver el cartel y el programa.</p>
                        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <AnimatePresence mode="popLayout">
                                {filteredEvents.map((event) => <EventCard key={event.id} event={event} onOpen={() => setOpenEvent(event)} />)}
                            </AnimatePresence>
                        </motion.div>
                    </>
                )}
            </div>

            {/* Modal detalle con cartel grande + programa */}
            <AnimatePresence>
                {openEvent && <EventDetailModal event={openEvent} onClose={() => setOpenEvent(null)} />}
            </AnimatePresence>

            {/* CTA */}
            <div className="max-w-7xl mx-auto px-4 pb-12">
                <div className="rounded-2xl p-6 md:p-8 text-center bg-surface-warm">
                    <p className="font-serif text-lg md:text-xl mb-2 text-text-primary">¿Quieres vivir alguna de estas experiencias?</p>
                    <p className="text-sm mb-5 text-secondary">Reserva tu alojamiento en Apartamentos Tío José María y te ayudamos a planificar tu visita.</p>
                    <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white bg-primary shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5">
                        Ver Apartamentos
                    </Link>
                </div>
            </div>
        </div>
    );
};

const EventCard = ({ event, onOpen }) => {
    const seasonStyle = SEASON_COLORS[event.season] || SEASON_COLORS.todo_el_año;
    const categoryObj = CATEGORIES.find((c) => c.key === event.category);
    const CategoryIcon = categoryObj?.icon || Calendar;
    const hasProgram = Array.isArray(event.program) && event.program.length > 0;

    return (
        <motion.article layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
            <button onClick={onOpen}
                className="group block w-full text-left bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden border border-gray-100">
                <div className="relative h-48 overflow-hidden bg-gray-100">
                    {/* Placeholder always underneath; image hides itself on error. */}
                    <EventPlaceholder event={event} size="large" />
                    {event.image_url && (
                        <img src={event.image_url} alt={event.title} loading="lazy" decoding="async"
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ backgroundColor: seasonStyle.bg, color: seasonStyle.text, border: `1px solid ${seasonStyle.border}` }}>
                        {SEASON_LABELS[event.season] || event.season}
                    </span>
                    {event.is_recurring && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-sm text-primary">
                            <RefreshCw size={10} className="inline mr-1" /> Anual
                        </span>
                    )}
                    <span className="absolute bottom-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 backdrop-blur-sm text-text-primary">
                        <CategoryIcon size={12} /> {categoryObj?.label || event.category}
                    </span>
                </div>
                <div className="p-5">
                    <h3 className="font-serif text-lg font-bold mb-2 leading-snug text-text-primary group-hover:text-primary transition-colors">{event.title}</h3>
                    <div className="flex items-center gap-1.5 mb-2">
                        <Calendar size={13} className="text-primary" />
                        <span className="text-xs font-medium text-primary">{formatDateRange(event)}</span>
                    </div>
                    {event.location && (
                        <div className="flex items-center gap-1.5 mb-2">
                            <MapPin size={13} className="text-secondary" />
                            <span className="text-xs text-secondary">{event.location}</span>
                        </div>
                    )}
                    {event.organizer && (
                        <div className="flex items-center gap-1.5 mb-3">
                            <Building2 size={13} className="text-secondary" />
                            <span className="text-xs text-secondary">{event.organizer}</span>
                        </div>
                    )}
                    {event.description && (
                        <p className="text-sm leading-relaxed line-clamp-2 text-secondary">{event.description}</p>
                    )}
                    {hasProgram && (
                        <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
                            <Clock size={11} /> Ver programa completo
                        </p>
                    )}
                </div>
            </button>
        </motion.article>
    );
};

// Placeholder visual para eventos sin imagen: gradiente cálido + icono de categoría grande
const EventPlaceholder = ({ event, size = 'large' }) => {
    const categoryObj = CATEGORIES.find((c) => c.key === event.category);
    const CategoryIcon = categoryObj?.icon || Calendar;
    const sizes = {
        small: { icon: 22, padding: 'p-3' },
        large: { icon: 48, padding: 'p-6' },
    };
    const s = sizes[size];
    return (
        <div className={`w-full h-full ${s.padding} flex flex-col items-center justify-center text-center`}
            style={{ background: 'linear-gradient(135deg, var(--color-surface-warm) 0%, #E8DFC9 100%)' }}>
            <CategoryIcon size={s.icon} style={{ color: 'var(--color-primary)' }} className="opacity-60 mb-2" strokeWidth={1.5} />
            {size === 'large' && (
                <p className="font-serif text-sm text-text-primary leading-tight line-clamp-2 px-2 max-w-[220px]">{event.title}</p>
            )}
        </div>
    );
};

// Tarjeta horizontal compacta para "Próximos eventos" arriba
const UpcomingEventCard = ({ event, onOpen }) => {
    const dateStr = formatDateRange(event);
    return (
        <button onClick={onOpen}
            className="group block w-full text-left bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-100">
            <div className="flex gap-3 p-3">
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-surface-warm">
                    {event.image_url ? (
                        <img src={event.image_url} alt={event.title} className="w-full h-full object-cover"
                            loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                        <EventPlaceholder event={event} size="small" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-primary">{dateStr}</p>
                    <h3 className="font-serif text-base font-bold text-text-primary leading-tight mt-0.5 group-hover:text-primary transition-colors line-clamp-2">{event.title}</h3>
                    {event.location && (
                        <p className="text-xs text-secondary mt-1 flex items-center gap-1">
                            <MapPin size={10} /> {event.location}
                        </p>
                    )}
                </div>
            </div>
        </button>
    );
};

// Modal con cartel completo + programa horario + datos
const EventDetailModal = ({ event, onClose }) => {
    const categoryObj = CATEGORIES.find((c) => c.key === event.category);
    const CategoryIcon = categoryObj?.icon || Calendar;
    const seasonStyle = SEASON_COLORS[event.season] || SEASON_COLORS.todo_el_año;

    // Bloquear scroll del body cuando el modal está abierto
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
            onClick={onClose}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                className="bg-white sm:rounded-3xl w-full sm:max-w-2xl shadow-2xl overflow-hidden max-h-screen sm:max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}>

                {/* Header con cierre */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                            style={{ backgroundColor: seasonStyle.bg, color: seasonStyle.text }}>
                            {SEASON_LABELS[event.season] || event.season}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-gray-500 inline-flex items-center gap-1">
                            <CategoryIcon size={10} /> {categoryObj?.label || event.category}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1">
                    {/* Cartel completo */}
                    {event.image_url && (
                        <div className="bg-gray-100">
                            <img src={event.image_url} alt={event.title}
                                className="w-full max-h-[70vh] object-contain mx-auto" />
                        </div>
                    )}

                    <div className="p-5 sm:p-6 space-y-5">
                        <div>
                            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary leading-tight">
                                {event.title}
                            </h2>
                            <p className="text-sm font-medium text-primary mt-2 inline-flex items-center gap-1.5">
                                <Calendar size={14} /> {formatDateRange(event)}
                            </p>
                        </div>

                        {event.description && (
                            <p className="text-sm sm:text-base text-text-primary leading-relaxed whitespace-pre-wrap">
                                {event.description}
                            </p>
                        )}

                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                            {event.location && (
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-0.5">Lugar</p>
                                    <p className="text-sm text-text-primary inline-flex items-start gap-1">
                                        <MapPin size={12} className="mt-0.5 shrink-0" /> {event.location}
                                    </p>
                                </div>
                            )}
                            {event.organizer && (
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-0.5">Organiza</p>
                                    <p className="text-sm text-text-primary inline-flex items-start gap-1">
                                        <Building2 size={12} className="mt-0.5 shrink-0" /> {event.organizer}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Programa horario */}
                        {Array.isArray(event.program) && event.program.length > 0 && (
                            <div className="pt-4 border-t border-gray-100">
                                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3 flex items-center gap-1">
                                    <Clock size={11} /> Programa
                                </p>
                                <div className="space-y-3">
                                    {event.program.map((item, idx) => (
                                        <div key={idx} className="flex gap-4 pb-3 border-b border-gray-50 last:border-b-0 last:pb-0">
                                            <div className="w-16 sm:w-20 shrink-0">
                                                <span className="font-mono font-bold text-base text-primary tabular-nums">{item.time || '—'}</span>
                                            </div>
                                            <p className="text-sm sm:text-base text-text-primary leading-snug flex-1">{item.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* CTA reservar */}
                        <div className="pt-4 border-t border-gray-100">
                            <Link to="/reservar"
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold text-white bg-primary shadow-lg hover:shadow-xl transition-all">
                                ¿Vienes? Reserva apartamento <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default EventsPage;

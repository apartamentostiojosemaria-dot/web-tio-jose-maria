import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, Clock, Car, Footprints, Star, ChevronDown, Navigation } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { BreadcrumbJsonLd, RoutesListJsonLd } from '../components/seo/JsonLd';
import { useRoutes } from '../hooks/useDatabase';
import InteractiveMap from '../components/maps/InteractiveMap';

const CATEGORIES = [
    { key: 'walk', label: 'Andando desde casa', icon: '\uD83D\uDEB6', description: 'Sales por la puerta y empiezas a caminar', ids: [9, 10, 11] },
    { key: 'near', label: 'Muy cerca (15-20 min)', icon: '\uD83D\uDE97', description: 'Un paseo corto en coche y llegas', ids: [12, 13] },
    { key: 'medium', label: 'Media hora en coche', icon: '\u26F0\uFE0F', description: 'Excursiones que merecen mucho la pena', ids: [14, 15, 16] },
    { key: 'day', label: 'Excursión de día', icon: '🌄', description: 'Las joyas de la Sierra de Cazorla', ids: [17, 18, 19, 20] },
];

const LEVEL_LABEL = {
    'Facil': { label: 'Para todos', color: 'var(--color-level-easy)', bg: 'var(--color-level-easy-bg)', icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66' },
    'Media': { label: 'Algo de forma física', color: 'var(--color-level-medium)', bg: 'var(--color-level-medium-bg)', icon: '\uD83E\uDD7E' },
    'Media-Alta': { label: 'Buena forma física', color: 'var(--color-level-hard)', bg: 'var(--color-level-hard-bg)', icon: '\uD83D\uDCAA' },
    'Alta': { label: 'Solo expertos', color: 'var(--color-level-expert)', bg: 'var(--color-level-expert-bg)', icon: '\u26F0\uFE0F' },
};

const MapPage = () => {
    const { routes, loading } = useRoutes();
    const [expandedRoute, setExpandedRoute] = useState(null);
    const [showMap, setShowMap] = useState(false);

    const getRoutesByCategory = (cat) => routes.filter(r => cat.ids.includes(r.id));

    return (
        <div className="min-h-screen bg-rural-50">
            <PageHead
                title="Rutas y Excursiones cerca de Hinojares"
                description="Paseos, cascadas, ríos turquesa y pueblos con encanto. Rutas de senderismo desde la puerta de casa hasta las joyas de la Sierra de Cazorla."
                path="/rutas"
            />
            <BreadcrumbJsonLd items={[
                { name: 'Inicio', url: 'https://tiojosemaria.com/' },
                { name: 'Rutas y Excursiones', url: 'https://tiojosemaria.com/rutas' }
            ]} />
            <RoutesListJsonLd routes={routes} />
            <header className="relative bg-white border-b border-gray-100">
                <div className="max-w-5xl mx-auto px-4 pt-6 pb-8">
                    <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium mb-6 text-primary hover:opacity-70 transition-opacity">
                        <ChevronLeft size={18} /> Volver al inicio
                    </Link>
                    <h1 className="font-serif text-3xl md:text-4xl font-bold mb-3 text-text-primary">Qué ver y hacer cerca de Hinojares</h1>
                    <p className="text-base md:text-lg max-w-2xl text-secondary">
                        Paseos, cascadas, ríos turquesa y pueblos con encanto. Desde rutas que salen de la puerta de casa hasta las joyas de la Sierra de Cazorla.
                    </p>
                    <button
                        onClick={() => setShowMap(!showMap)}
                        className={`mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-primary ${
                            showMap ? 'bg-primary text-white' : 'bg-white text-primary'
                        }`}
                    >
                        <MapPin size={16} />
                        {showMap ? 'Ocultar mapa' : 'Ver en el mapa'}
                    </button>
                </div>
            </header>

            {showMap && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 400, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4 }} className="w-full overflow-hidden">
                    <InteractiveMap routes={routes} selectedRoute={expandedRoute ? routes.find(r => r.id === expandedRoute) : null} onSelectRoute={(r) => { setExpandedRoute(r.id); setShowMap(false); }} compact />
                </motion.div>
            )}

            {loading ? (
                <div className="py-24 text-center">
                    <div className="animate-pulse text-gray-400 font-serif italic">Cargando excursiones...</div>
                </div>
            ) : (
                <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">
                    {CATEGORIES.map((cat) => {
                        const catRoutes = getRoutesByCategory(cat);
                        if (catRoutes.length === 0) return null;
                        return (
                            <section key={cat.key}>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-2xl">{cat.icon}</span>
                                    <div>
                                        <h2 className="font-serif text-xl md:text-2xl font-bold text-text-primary">{cat.label}</h2>
                                        <p className="text-sm text-secondary">{cat.description}</p>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-3">
                                    {catRoutes.map((route, i) => {
                                        const isExpanded = expandedRoute === route.id;
                                        const level = LEVEL_LABEL[route.difficulty] || LEVEL_LABEL['Media'];
                                        return (
                                            <motion.div key={route.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <button onClick={() => setExpandedRoute(isExpanded ? null : route.id)} className="w-full text-left p-4 md:p-5 flex gap-4" aria-expanded={isExpanded}>
                                                    {route.image_url && <img src={route.image_url} alt={route.title} className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover flex-shrink-0" loading="lazy" />}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h3 className="font-serif font-bold text-base md:text-lg leading-snug text-text-primary">{route.title}</h3>
                                                            <ChevronDown size={18} className={`flex-shrink-0 mt-1 text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: level.bg, color: level.color }}>
                                                                {level.icon} {level.label}
                                                            </span>
                                                            {route.duration && (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                                                    <Clock size={12} /> {route.duration}
                                                                </span>
                                                            )}
                                                            {route.distance_km && (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                                                    <Footprints size={12} /> {route.distance_km} km
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                                {isExpanded && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.3 }} className="px-4 md:px-5 pb-5 border-t border-gray-50">
                                                        <p className="text-sm leading-relaxed mt-4 mb-4 text-text-primary">{route.description}</p>
                                                        {route.highlights?.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mb-4">
                                                                {route.highlights.map((h, j) => (
                                                                    <span key={j} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary">
                                                                        <Star size={10} className="fill-primary" /> {h}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {(route.map_url || (route.start_lat && route.start_lon)) && (
                                                            <a
                                                                href={route.map_url || `https://www.google.com/maps/dir/?api=1&destination=${route.start_lat},${route.start_lon}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold bg-primary transition-all hover:shadow-lg hover:-translate-y-0.5"
                                                            >
                                                                <Navigation size={16} /> Cómo llegar al inicio
                                                            </a>
                                                        )}
                                                        {route.image_credit && (
                                                            <p className="mt-4 text-[10px] text-gray-400 italic">Foto: {route.image_credit}</p>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                    <div className="text-center py-8">
                        <p className="text-sm text-secondary">¿Necesitas más ideas? Pregúntanos por WhatsApp — conocemos cada rincón de la zona.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapPage;

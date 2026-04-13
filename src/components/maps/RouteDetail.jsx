import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, TrendingUp, Mountain, ChevronLeft, Navigation, Star } from 'lucide-react';

const DIFFICULTY_BADGE = {
    'Fácil': { bg: '#dcfce7', color: '#166534', label: 'Fácil' },
    'Media': { bg: '#fef3c7', color: '#92400e', label: 'Media' },
    'Media-Alta': { bg: '#ffedd5', color: '#9a3412', label: 'Media-Alta' },
    'Alta': { bg: '#fee2e2', color: '#991b1b', label: 'Alta' },
};

const RouteDetail = ({ route, onClose, onNavigate }) => {
    if (!route) return null;

    const badge = DIFFICULTY_BADGE[route.difficulty] || DIFFICULTY_BADGE['Media'];

    return (
        <AnimatePresence>
            <motion.div
                key={route.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: 'spring', damping: 25 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
            >
                {/* Image header */}
                {route.image_url && (
                    <div className="relative h-48 overflow-hidden">
                        <img
                            src={route.image_url}
                            alt={route.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <button
                            onClick={onClose}
                            className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white transition-colors shadow-sm"
                        >
                            <ChevronLeft size={18} className="text-text-primary" />
                        </button>
                        <div className="absolute bottom-3 left-4 right-4">
                            <h3 className="text-white font-serif text-xl font-bold leading-tight drop-shadow-lg">
                                {route.title}
                            </h3>
                        </div>
                    </div>
                )}

                <div className="p-5 space-y-4">
                    {/* Stats row */}
                    <div className="flex flex-wrap gap-2">
                        <span
                            className="px-3 py-1 rounded-full text-xs font-bold"
                            style={{ backgroundColor: badge.bg, color: badge.color }}
                        >
                            {badge.label}
                        </span>
                        {route.duration && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                <Clock size={12} /> {route.duration}
                            </span>
                        )}
                        {route.distance_km && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                <MapPin size={12} /> {route.distance_km} km
                            </span>
                        )}
                        {route.elevation_gain && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                <TrendingUp size={12} /> +{route.elevation_gain}m
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    <p className="text-sm leading-relaxed text-text-primary">
                        {route.description}
                    </p>

                    {/* Highlights */}
                    {route.highlights?.length > 0 && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                Puntos de interés
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {route.highlights.map((h, i) => (
                                    <span
                                        key={i}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary"
                                    >
                                        <Star size={10} className="fill-primary" /> {h}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                        {route.map_url && (
                            <a
                                href={route.map_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg hover:-translate-y-0.5 bg-primary"
                            >
                                <Navigation size={16} />
                                Cómo llegar
                            </a>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default RouteDetail;

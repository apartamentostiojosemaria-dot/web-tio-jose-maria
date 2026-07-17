import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Sección "Próximos eventos en Hinojares y la sierra" para la home pública.
// Muestra los 3 eventos activos más cercanos (hoy o futuro), con foto, fecha
// y enlace a la página completa.

const formatRange = (event) => {
    if (!event.event_date) return 'Consultar fechas';
    const start = new Date(event.event_date + 'T00:00:00');
    if (!event.end_date || event.event_date === event.end_date) {
        return start.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const end = new Date(event.end_date + 'T00:00:00');
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        return `${start.getDate()} – ${end.getDate()} ${start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
    }
    return `${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

const UpcomingEventsSection = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const today = new Date().toISOString().slice(0, 10);
            const { data } = await supabase
                .from('local_events')
                .select('id, title, description, event_date, end_date, location, image_url, category, organizer')
                .eq('active', true)
                .or(`end_date.gte.${today},and(end_date.is.null,event_date.gte.${today})`)
                .order('event_date', { ascending: true })
                .limit(3);
            setEvents(data || []);
            setLoading(false);
        })();
    }, []);

    if (loading || events.length === 0) return null;

    return (
        <section className="py-16 md:py-24 bg-surface-warm" aria-labelledby="proximos-eventos-title">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 md:mb-12">
                    <div>
                        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-primary mb-2">
                            <Sparkles size={12} /> Agenda
                        </p>
                        <h2 id="proximos-eventos-title" className="font-serif text-3xl md:text-4xl font-bold text-text-primary leading-tight">
                            Próximos eventos en Hinojares y la sierra
                        </h2>
                        <p className="text-sm md:text-base text-secondary mt-2 max-w-2xl">
                            Fiestas patronales, romerías, mercados, observación de fauna y conciertos. Lo que está por venir cerca del alojamiento.
                        </p>
                    </div>
                    <Link to="/eventos"
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-primary hover:underline shrink-0">
                        Ver todo el calendario <ArrowRight size={14} />
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {events.map((ev, idx) => (
                        <motion.div key={ev.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-100px' }}
                            transition={{ delay: idx * 0.1, duration: 0.5 }}>
                            <Link to="/eventos"
                                className="group block bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all overflow-hidden border border-gray-100 h-full">
                                <div className="relative h-48 overflow-hidden">
                                    {/* Placeholder always underneath; the image sits on top and hides
                                        itself on load error, so a dead URL never shows a broken icon. */}
                                    <div className="w-full h-full flex flex-col items-center justify-center px-4 text-center"
                                        style={{ background: 'linear-gradient(135deg, var(--color-surface-warm) 0%, #E8DFC9 100%)' }}>
                                        <Sparkles size={32} style={{ color: 'var(--color-primary)' }} className="opacity-60 mb-2" strokeWidth={1.5} />
                                        <p className="font-serif text-sm text-text-primary leading-tight line-clamp-2">{ev.title}</p>
                                    </div>
                                    {ev.image_url && (
                                        <img src={ev.image_url} alt={ev.title}
                                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                            loading="lazy" decoding="async"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                    )}
                                </div>
                                <div className="p-5">
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">
                                        {formatRange(ev)}
                                    </p>
                                    <h3 className="font-serif text-xl font-bold text-text-primary leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                        {ev.title}
                                    </h3>
                                    {ev.location && (
                                        <p className="text-xs text-secondary mt-2 inline-flex items-center gap-1">
                                            <MapPin size={11} /> {ev.location}
                                        </p>
                                    )}
                                    {ev.description && (
                                        <p className="text-sm text-secondary mt-3 line-clamp-2 leading-relaxed">
                                            {ev.description}
                                        </p>
                                    )}
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default UpcomingEventsSection;

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { COLORS } from '../../constants/colors';

const ReviewsSection = ({ reviews }) => {
    const displayReviews = reviews && reviews.length > 0
        ? reviews.map(r => ({
            name: r.author,
            text: r.content,
            score: r.rating ? (r.rating * 2).toString() : '10',
            source: r.source || 'Booking.com'
        }))
        : [
            { name: 'Alejandro', text: 'El alojamiento estaba genial. Era un apartamento muy acogedor y bien equipado.', score: '10', source: 'Booking.com' },
            { name: 'Antonio', text: 'Acogedor y tranquilo. Muy limpio. Perfecto para desconectar.', score: '10', source: 'Booking.com' },
            { name: 'Rubén', text: 'Casa del siglo XVII reformada. Nos encantó el pueblo, muy tranquilo.', score: '10', source: 'Booking.com' },
            { name: 'Sebastián', text: 'El trato de los anfitriones. El apartamento es muy bonito, acogedor y todo estaba muy limpio.', score: '10', source: 'Booking.com' }
        ];

    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [direction, setDirection] = useState(1);
    const [reviewsPerPage, setReviewsPerPage] = useState(4);

    useEffect(() => {
        const updatePerPage = () => {
            const w = window.innerWidth;
            setReviewsPerPage(w < 640 ? 1 : w < 1024 ? 2 : 4);
        };
        updatePerPage();
        window.addEventListener('resize', updatePerPage);
        return () => window.removeEventListener('resize', updatePerPage);
    }, []);

    const goNext = useCallback(() => {
        setDirection(1);
        setIndex((prev) => (prev + 1) % displayReviews.length);
    }, [displayReviews.length]);

    const goPrev = useCallback(() => {
        setDirection(-1);
        setIndex((prev) => (prev - 1 + displayReviews.length) % displayReviews.length);
    }, [displayReviews.length]);

    useEffect(() => {
        if (displayReviews.length <= reviewsPerPage || paused) return;
        const timer = setInterval(goNext, 4000);
        return () => clearInterval(timer);
    }, [displayReviews.length, paused, goNext, reviewsPerPage]);

    const visibleReviews = [];
    for (let i = 0; i < Math.min(reviewsPerPage, displayReviews.length); i++) {
        visibleReviews.push({
            ...displayReviews[(index + i) % displayReviews.length],
            _idx: (index + i) % displayReviews.length
        });
    }

    const sourceIcon = (source) => {
        if (source?.includes('Booking')) return '🅱️';
        if (source?.includes('Escapada')) return '🏡';
        if (source?.includes('Google')) return '🔍';
        return '⭐';
    };

    return (
        <section className="py-24 px-6 bg-rural-100/30 overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 md:mb-16 gap-6">
                    <div>
                        <span className="uppercase tracking-[0.2em] text-[10px] md:text-xs font-bold" style={{ color: COLORS.primary }}>Opiniones Reales</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3" style={{ color: COLORS.text }}>Lo que dicen nuestros huéspedes</h2>
                    </div>
                    <a href="https://www.booking.com/hotel/es/casa-rural-tio-jose-maria.es.html#tab-reviews" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white px-4 md:px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/be/Booking.com_logo.svg" alt="Booking.com" className="h-4 md:h-5" />
                        <div className="text-right">
                            <p className="text-xs md:text-sm font-bold leading-none">9.5/10</p>
                            <p className="text-[9px] md:text-[10px] opacity-60">Puntuación Excepcional</p>
                        </div>
                    </a>
                </div>

                <div
                    className="relative"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                >
                    {displayReviews.length > reviewsPerPage && (
                        <>
                            <button
                                onClick={goPrev}
                                className="absolute -left-3 md:-left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-rural-50 transition-colors border border-gray-100"
                                aria-label="Reseñas anteriores"
                            >
                                <ChevronLeft size={18} style={{ color: COLORS.text }} />
                            </button>
                            <button
                                onClick={goNext}
                                className="absolute -right-3 md:-right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-rural-50 transition-colors border border-gray-100"
                                aria-label="Siguientes reseñas"
                            >
                                <ChevronRight size={18} style={{ color: COLORS.text }} />
                            </button>
                        </>
                    )}

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: direction * 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction * -40 }}
                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                            className={`grid gap-6 ${reviewsPerPage === 1 ? 'grid-cols-1 max-w-md mx-auto' : reviewsPerPage === 2 ? 'grid-cols-2 max-w-2xl mx-auto' : 'grid-cols-2 lg:grid-cols-4'}`}
                        >
                            {visibleReviews.map((rev, i) => (
                                <div
                                    key={rev._idx}
                                    className="bg-white p-8 rounded-2xl shadow-sm h-full flex flex-col border border-gray-50 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex gap-1 text-xs text-yellow-400">
                                            {[...Array(5)].map((_, star) => <span key={star}>★</span>)}
                                        </div>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{rev.source}</span>
                                    </div>
                                    <p className="text-sm italic flex-grow mb-6 leading-relaxed" style={{ color: COLORS.text }}>
                                        "{rev.text}"
                                    </p>
                                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                                        <span className="font-bold text-sm" style={{ color: COLORS.text }}>{rev.name}</span>
                                        <span className="bg-rural-100 px-2.5 py-1 rounded-lg text-[11px] font-bold" style={{ color: COLORS.primary }}>{rev.score}</span>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {displayReviews.length > reviewsPerPage && (
                    <div className="flex justify-center gap-1.5 mt-8">
                        {displayReviews.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => { setDirection(1); setIndex(i); }}
                                className="w-2 h-2 rounded-full transition-all"
                                style={{
                                    width: i === index ? 24 : 8,
                                    backgroundColor: i === index ? COLORS.primary : COLORS.accent
                                }}
                                aria-label={`Reseña ${i + 1}`}
                            />
                        ))}
                    </div>
                )}

                {/* Counter */}
                <p className="text-center mt-4 text-xs text-gray-400">
                    {displayReviews.length} opiniones verificadas
                </p>
            </div>
        </section>
    );
};

export default ReviewsSection;

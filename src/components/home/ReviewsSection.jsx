import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Paleta tierra/olivo coherente con la marca para los avatares de iniciales.
const AVATAR_COLORS = [
    { bg: '#556B2F', fg: '#FFFFFF' }, // primary olivo
    { bg: '#8B7355', fg: '#FFFFFF' }, // marron tierra
    { bg: '#A0522D', fg: '#FFFFFF' }, // siena
    { bg: '#6B8E3D', fg: '#FFFFFF' }, // olivo claro
    { bg: '#7D8C5A', fg: '#FFFFFF' }, // verde salvia
    { bg: '#9B7E47', fg: '#FFFFFF' }, // ocre
];

const colorForName = (name) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase();

const ReviewsSection = ({ reviews }) => {
    const displayReviews = reviews && reviews.length > 0
        ? reviews.map(r => ({
            name: r.author,
            text: r.content,
            score: r.rating ? (r.rating * 2).toString() : '10',
            source: r.source || 'Booking.com',
            avatarUrl: r.avatar_url,
        }))
        : [];

    if (displayReviews.length === 0) {
        return (
            <section className="py-24 px-6 bg-rural-100/30" aria-label="Reseñas">
                <div className="max-w-4xl mx-auto text-center">
                    <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Opiniones reales</span>
                    <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-8 text-text-primary">Lee las opiniones de nuestros huéspedes</h2>
                    <a href="https://www.booking.com/hotel/es/casa-rural-tio-jose-maria.es.html#tab-reviews" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-4 bg-white px-8 py-5 rounded-2xl shadow-md hover:shadow-xl transition-shadow">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/be/Booking.com_logo.svg" alt="Booking.com" loading="lazy" decoding="async" className="h-6" />
                        <div className="text-left">
                            <p className="text-2xl font-bold leading-none text-text-primary">9.5/10</p>
                            <p className="text-xs opacity-70 mt-1">Puntuación Excepcional · Ver reseñas</p>
                        </div>
                    </a>
                </div>
            </section>
        );
    }

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

    return (
        <section className="py-24 px-6 bg-rural-100/30 overflow-hidden" aria-label="Reseñas de huéspedes">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 md:mb-16 gap-6">
                    <div>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Opiniones Reales</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 text-text-primary">Lo que dicen nuestros huéspedes</h2>
                    </div>
                    <a href="https://www.booking.com/hotel/es/casa-rural-tio-jose-maria.es.html#tab-reviews" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white px-4 md:px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/be/Booking.com_logo.svg" alt="Booking.com" loading="lazy" decoding="async" className="h-4 md:h-5" />
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
                    role="region"
                    aria-roledescription="carrusel"
                    aria-label="Reseñas de clientes"
                >
                    {displayReviews.length > reviewsPerPage && (
                        <>
                            <button
                                onClick={goPrev}
                                className="absolute -left-3 md:-left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-rural-50 transition-colors border border-gray-100"
                                aria-label="Reseñas anteriores"
                            >
                                <ChevronLeft size={18} className="text-text-primary" />
                            </button>
                            <button
                                onClick={goNext}
                                className="absolute -right-3 md:-right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-rural-50 transition-colors border border-gray-100"
                                aria-label="Siguientes reseñas"
                            >
                                <ChevronRight size={18} className="text-text-primary" />
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
                            aria-live="polite"
                        >
                            {visibleReviews.map((rev) => (
                                <article
                                    key={rev._idx}
                                    className="bg-white p-8 rounded-2xl shadow-sm h-full flex flex-col border border-gray-50 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex gap-1 text-xs text-yellow-400" aria-label="5 estrellas">
                                            {[...Array(5)].map((_, star) => <span key={star} aria-hidden="true">&#9733;</span>)}
                                        </div>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{rev.source}</span>
                                    </div>
                                    <p className="text-sm italic flex-grow mb-6 leading-relaxed text-text-primary">
                                        &ldquo;{rev.text}&rdquo;
                                    </p>
                                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                                        <div className="flex items-center gap-2.5">
                                            {rev.avatarUrl ? (
                                                <img
                                                    src={rev.avatarUrl}
                                                    alt={rev.name}
                                                    loading="lazy"
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <span
                                                    aria-hidden="true"
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-serif flex-shrink-0"
                                                    style={{ backgroundColor: colorForName(rev.name).bg, color: colorForName(rev.name).fg }}
                                                >
                                                    {initialOf(rev.name)}
                                                </span>
                                            )}
                                            <span className="font-bold text-sm text-text-primary">{rev.name}</span>
                                        </div>
                                        <span className="bg-rural-100 px-2.5 py-1 rounded-lg text-[11px] font-bold text-primary">{rev.score}</span>
                                    </div>
                                </article>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {displayReviews.length > reviewsPerPage && (
                    <div className="flex justify-center gap-1.5 mt-8" role="tablist" aria-label="Páginas de reseñas">
                        {displayReviews.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => { setDirection(1); setIndex(i); }}
                                className="h-2 rounded-full transition-all"
                                style={{ width: i === index ? 24 : 8 }}
                                aria-label={`Reseña ${i + 1}`}
                                aria-selected={i === index}
                                role="tab"
                            >
                                <span className={`block w-full h-full rounded-full ${i === index ? 'bg-primary' : 'bg-accent'}`} />
                            </button>
                        ))}
                    </div>
                )}

                <p className="text-center mt-4 text-xs text-gray-400">
                    {displayReviews.length} opiniones verificadas
                </p>
            </div>
        </section>
    );
};

export default ReviewsSection;

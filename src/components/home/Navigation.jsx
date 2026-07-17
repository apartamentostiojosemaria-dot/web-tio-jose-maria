import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const Navigation = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // WCAG 2.1 (2.1.2): el menú debe cerrarse con teclado y devolver el foco.
    useEffect(() => {
        if (!mobileOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') setMobileOpen(false);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [mobileOpen]);

    const links = [
        { label: 'Apartamentos', href: '/#apartamentos' },
        { label: 'El Entorno', href: '/#entorno' },
        { label: 'Hinojares', href: '/hinojares' },
        { label: 'Qué ver', href: '/rutas' },
        { label: 'Contacto', href: '/#contacto' },
    ];

    return (
        <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl" role="navigation" aria-label="Navegación principal">
            <div
                className={`flex items-center justify-between px-4 md:px-6 py-2 md:py-3 rounded-2xl shadow-xl transition-all duration-500 backdrop-blur-xl ${
                    isScrolled
                        ? 'bg-rural-50/85 border border-primary/15'
                        : 'bg-rural-50/50 border border-white/30'
                }`}
            >
                <a href="#" className="flex items-center gap-3">
                    {/* SVG traced from the original raster (docs: gotcha — the source
                        wordmark is calligraphic; vector keeps identity crisp on retina) */}
                    <img
                        src="/assets/logo.svg"
                        alt="Logo Tío José María Apartamentos Rurales"
                        width="125"
                        height="40"
                        className="h-8 md:h-10 w-auto object-contain"
                    />
                </a>

                <div className="hidden md:flex items-center gap-6">
                    {links.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            className="text-sm font-medium tracking-wide text-text-primary hover:text-primary transition-colors duration-300"
                        >
                            {link.label}
                        </a>
                    ))}
                    <a
                        href="/#apartamentos"
                        className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-primary shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                    >
                        Ver disponibilidad
                    </a>
                </div>

                <button
                    className="md:hidden text-text-primary"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-expanded={mobileOpen}
                    aria-controls="mobile-menu"
                    aria-label={mobileOpen ? 'Cerrar menu' : 'Abrir menu'}
                >
                    {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {mobileOpen && (
                <motion.div
                    id="mobile-menu"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 rounded-2xl p-6 shadow-xl flex flex-col items-center gap-4 bg-rural-50/95 backdrop-blur-xl"
                    role="menu"
                >
                    {links.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            className="text-lg font-medium text-text-primary hover:text-primary transition-colors"
                            role="menuitem"
                        >
                            {link.label}
                        </a>
                    ))}
                    <a
                        href="/#apartamentos"
                        onClick={() => setMobileOpen(false)}
                        className="mt-2 px-8 py-3 rounded-full text-white font-bold bg-primary shadow-lg"
                        role="menuitem"
                    >
                        Reservar ahora
                    </a>
                </motion.div>
            )}
        </nav>
    );
};

export default Navigation;

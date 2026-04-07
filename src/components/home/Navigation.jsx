import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { COLORS } from '../../constants/colors';

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
        { label: 'Hinojares', href: '/hinojares' },
        { label: 'Qué ver', href: '/rutas' },
        { label: 'Eventos', href: '/eventos' },
        { label: 'Mi Estancia', href: '/clientes' },
        { label: 'Contacto', href: '/#contacto' },
    ];

    return (
        <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl">
            <div
                className="flex items-center justify-between px-4 md:px-6 py-2 md:py-3 rounded-2xl shadow-xl transition-all duration-500"
                style={{
                    backgroundColor: isScrolled ? 'rgba(252, 251, 249, 0.85)' : 'rgba(252, 251, 249, 0.5)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: `1px solid ${isScrolled ? 'rgba(85,107,47,0.15)' : 'rgba(255,255,255,0.3)'}`,
                }}
            >
                <a href="#" className="flex items-center gap-3">
                    <img
                        src="/assets/logo.jpg"
                        alt="Logo Tío José María Apartamentos Rurales"
                        className="h-8 md:h-10 object-contain"
                    />
                </a>

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
                        href="/#apartamentos"
                        className="px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        Reservar
                    </a>
                </div>

                <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} style={{ color: COLORS.text }}>
                    {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

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
                        href="/#apartamentos"
                        onClick={() => setMobileOpen(false)}
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

export default Navigation;

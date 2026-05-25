import { useEffect, useRef, useState } from 'react';

/**
 * Animacion de fade-up con IntersectionObserver y CSS puro.
 * Elimina la dependencia de framer-motion para esta animacion comun,
 * lo que permite que componentes que solo usaban FadeInUp no carguen
 * motion en absoluto si no usan otras features.
 */
const FadeInUp = ({ children, delay = 0, className = '' }) => {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        // Si el navegador respeta reduced-motion o no soporta IO, mostrar ya.
        const prefersReduced = typeof window !== 'undefined'
            && window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced || typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setVisible(true);
                        observer.unobserve(entry.target);
                    }
                }
            },
            { rootMargin: '-50px 0px' }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const style = {
        transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
        transitionDelay: `${delay}s`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        willChange: visible ? 'auto' : 'opacity, transform',
    };

    return <div ref={ref} style={style} className={className}>{children}</div>;
};

export default FadeInUp;

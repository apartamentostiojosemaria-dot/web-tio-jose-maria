import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Map, ArrowRight } from 'lucide-react';
import FadeInUp from '../shared/FadeInUp';
import { WP } from '../../constants/urls';

// Leaflet pesa ~146 KB. Lo aislamos en su propio chunk y solo lo cargamos
// cuando la seccion del mapa entra en viewport — la mayoria de visitantes
// movil se quedan arriba mirando apartamentos y nunca llegan a verlo.
const InteractiveMap = lazy(() => import('../maps/InteractiveMap'));

const MapWhenVisible = ({ routes }) => {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (visible) return;
        const obs = new IntersectionObserver(
            (entries) => entries.forEach(e => e.isIntersecting && setVisible(true)),
            { rootMargin: '200px' }
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [visible]);
    return (
        <div ref={ref} className="rounded-2xl overflow-hidden shadow-lg border border-gray-100 min-h-[300px] bg-rural-50">
            {visible ? (
                <Suspense fallback={<div className="h-[300px] flex items-center justify-center text-rural-700 italic font-serif animate-pulse">Cargando mapa...</div>}>
                    <InteractiveMap routes={routes} compact />
                </Suspense>
            ) : (
                <div className="h-[300px]" aria-hidden="true" />
            )}
        </div>
    );
};

const GRID_IMAGES = [
    { fallback: `${WP}/hinojaresPueblo.jpg`, alt: 'Hinojares pueblo blanco' },
    { fallback: `${WP}/MG_9540-1024x561.jpg`, alt: 'Rutas de senderismo en la Sierra' },
    { fallback: `${WP}/chuletas-de-cordero-al-horno2-1024x724.jpg`, alt: 'Gastronomía local'},
    { fallback: `${WP}/10-1024x768.jpg`, alt: 'Kayak en el Embalse de la Bolera' },
];

const EntornoSection = ({ places, routes }) => {
    // Build unique images from places/routes, falling back to curated defaults
    const allSources = [
        ...places.filter(p => p.image_url).map(p => p.image_url),
        ...routes.filter(r => r.image_url).map(r => r.image_url),
    ];
    const uniqueSources = [...new Set(allSources)];
    const gridImages = GRID_IMAGES.map((img, i) => ({
        src: uniqueSources[i] || img.fallback,
        alt: img.alt,
    }));

    return (
    <section id="entorno" className="py-24 px-6 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center mb-12 md:mb-20">
                <FadeInUp>
                    <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Hinojares y el Valle del Turrilla</span>
                    <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-6 md:mb-8 text-text-primary">Un paraíso de contrastes entre desierto y pinar</h2>
                    <p className="text-base md:text-lg leading-relaxed mb-6 text-secondary">
                        Tío José María se ubica en <strong>Hinojares</strong>, un pueblo mágico de gredas blancas al sur del <strong>Parque Natural de la Sierra de Cazorla</strong>. Es un destino donde el agua de los ríos y embalses se funde con paisajes semidesérticos y bosques vírgenes.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
                        <Link to="/rutas" className="p-6 rounded-2xl border border-rural-100 bg-rural-50 hover:bg-white hover:shadow-xl transition-all group block">
                            <span className="text-2xl mb-2 block">&#x1F40E;</span>
                            <h4 className="font-serif text-xl font-bold mb-2 text-primary">
                                Actividades Estrella
                            </h4>
                            <p className="text-sm opacity-80 text-text-primary">
                                Desde rutas a caballo en el pueblo hasta kayak y parapente en los embalses cercanos.
                            </p>
                            <span className="text-xs font-bold mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all text-primary">
                                Ver actividades <ArrowRight size={12} />
                            </span>
                        </Link>
                        <Link to="/hinojares#gastronomia" className="p-6 rounded-2xl border border-rural-100 bg-rural-50 hover:bg-white hover:shadow-xl transition-all group block">
                            <span className="text-2xl mb-2 block">&#x1F958;</span>
                            <h4 className="font-serif text-xl font-bold mb-2 text-primary">
                                Sabor Tradicional
                            </h4>
                            <p className="text-sm opacity-80 text-text-primary">
                                Prueba el cordero segureno y los platos tipicos de la comarca, un placer para los sentidos.
                            </p>
                            <span className="text-xs font-bold mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all text-primary">
                                Ver gastronomia <ArrowRight size={12} />
                            </span>
                        </Link>
                    </div>
                </FadeInUp>
                <div className="grid grid-cols-2 gap-3 md:gap-4 md:mt-0">
                    <FadeInUp delay={0.2}>
                        <img src={gridImages[0].src} alt={gridImages[0].alt} loading="lazy" className="rounded-2xl shadow-lg w-full h-40 md:h-64 object-cover md:mt-8" />
                    </FadeInUp>
                    <FadeInUp delay={0.3}>
                        <img src={gridImages[1].src} alt={gridImages[1].alt} loading="lazy" className="rounded-2xl shadow-lg w-full h-48 md:h-80 object-cover" />
                    </FadeInUp>
                    <FadeInUp delay={0.4}>
                        <img src={gridImages[2].src} alt={gridImages[2].alt} loading="lazy" className="rounded-2xl shadow-lg w-full h-40 md:h-64 object-cover md:-mt-16" />
                    </FadeInUp>
                    <FadeInUp delay={0.5}>
                        <img src={gridImages[3].src} alt={gridImages[3].alt} loading="lazy" className="rounded-2xl shadow-lg w-full h-40 md:h-64 object-cover mt-4" />
                    </FadeInUp>
                </div>
            </div>

            {routes?.length > 0 && (
                <FadeInUp>
                    <div className="mb-12 md:mb-20">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                            <div>
                                <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Explora la Sierra</span>
                                <h3 className="font-serif text-2xl md:text-3xl font-bold mt-2 text-text-primary">Rutas de senderismo desde tu puerta</h3>
                            </div>
                            <Link
                                to="/rutas"
                                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white bg-primary transition-all hover:shadow-lg hover:-translate-y-0.5"
                            >
                                <Map size={16} />
                                Ver mapa completo
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                        <MapWhenVisible routes={routes} />
                    </div>
                </FadeInUp>
            )}

            <FadeInUp>
                <div id="como-llegar" className="rounded-3xl p-10 md:p-16 text-white relative overflow-hidden shadow-2xl bg-primary">
                    <div className="absolute inset-0 opacity-10">
                        <img src={`${WP}/slide3.jpg`} alt="Paisaje" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    </div>
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                        <div className="text-center lg:text-left">
                            <h3 className="font-serif text-3xl md:text-5xl font-bold mb-6">Preparado para tu desconexion?</h3>
                            <p className="text-lg opacity-90 max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                                Estamos en Calle Baja 1, Hinojares. Te facilitamos el camino para que solo tengas que preocuparte de disfrutar.
                            </p>
                            <a
                                href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-10 py-4 bg-white rounded-full text-lg font-bold text-primary transition-all duration-300 hover:shadow-xl hover:-translate-y-1 shadow-md"
                            >
                                <MapPin size={20} />
                                Cómo llegar al alojamiento
                            </a>
                        </div>
                        <div className="rounded-2xl overflow-hidden shadow-lg w-full h-64 md:h-80">
                            <iframe
                                title="Ubicación Apartamentos Tío José María"
                                src="https://maps.google.com/maps?q=Apartamentos+Rurales+Tio+Jose+Maria+Hinojares+Jaen&z=15&ie=UTF8&iwloc=&output=embed"
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen=""
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                    </div>
                </div>
            </FadeInUp>
        </div>
    </section>
    );
};

export default EntornoSection;

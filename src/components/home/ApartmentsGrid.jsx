import { Link } from 'react-router-dom';
import { Users, Bath, Flame } from 'lucide-react';
import FadeInUp from '../shared/FadeInUp';
import ApartmentComparison from './ApartmentComparison';
import { WP, whatsappLink } from '../../constants/urls';
import { imgAttrs } from '../../utils/supabaseImage';

const ApartmentsGrid = ({ apartments }) => {
    const defaultApartments = [
        { name: 'Albahaca', tag: 'Romántico', capacityPeople: 2, bathrooms: 1, href: '/Albahaca.html', img: `${WP}/ALBAHACA-1.jpg`, desc: 'Íntimo y acogedor. Diseñado para parejas. Disfruta de una cena romántica frente a la chimenea después de una ruta por el parque.' },
        { name: 'Tomillo', tag: 'Con Vistas', capacityPeople: 2, bathrooms: 1, href: '/Tomillo.html', img: `${WP}/TOMILLOHOME1.jpg`, desc: 'Ubicado en la segunda planta con balcón y vistas al valle. Techos de madera abuhardillados que le dan un encanto especial.' },
        { name: 'Lavanda', tag: 'Familiar', capacityPeople: 4, bathrooms: 2, href: '/Lavanda.html', img: `${WP}/LAVANDAHOME1.jpg`, desc: 'Espacioso y luminoso. Salón con chimenea, cocina completa, dormitorio de matrimonio y otro doble. Ideal para familias.' },
        { name: 'Romero', tag: 'Familiar', capacityPeople: 4, bathrooms: 2, href: '/Romero.html', img: `${WP}/ROMEROHOME1.jpg`, desc: 'Confort rústico con todas las comodidades. Salón con chimenea para las noches de invierno y dos dormitorios independientes.' },
    ];

    const activeApartments = apartments?.filter(apt => apt.is_active) || [];

    const displayApartments = activeApartments.length > 0
        ? activeApartments.map(apt => ({
            name: apt.name,
            // Dato diferenciador de BD; si no está poblado aún para este apartamento,
            // caemos en silencio al tag automático por aforo (nunca badge vacío).
            badge: apt.highlight || (apt.capacity_people <= 2 ? 'Romántico' : 'Familiar'),
            capacityPeople: apt.capacity_people,
            bathrooms: apt.bathrooms || 1,
            priceFrom: apt.price_low,
            href: `/apartamento/${apt.slug}`,
            img: apt.images?.[0] || `${WP}/ALBAHACA-1.jpg`,
            desc: apt.description,
        }))
        : defaultApartments.map(apt => ({ ...apt, badge: apt.tag, href: `/apartamento/${apt.name.toLowerCase()}` }));

    return (
        <section id="apartamentos" className="py-28 px-6 bg-gradient-to-b from-surface-warm to-surface">
            <div className="max-w-7xl mx-auto">
                <FadeInUp>
                    <div className="text-center mb-12 md:mb-20">
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Nuestros Alojamientos</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 text-text-primary">Elige tu rincón favorito</h2>
                    </div>
                </FadeInUp>

                <div className="grid md:grid-cols-2 gap-10 items-stretch">
                    {displayApartments.map((apt, idx) => (
                        <FadeInUp key={apt.name} delay={idx * 0.1} className="h-full">
                            <Link to={apt.href} className="block group h-full">
                                <article className="bg-white rounded-2xl overflow-hidden shadow-lg border border-transparent hover:border-accent transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2 h-full flex flex-col">
                                    <div className="h-72 overflow-hidden relative flex-shrink-0">
                                        <img
                                            {...imgAttrs(apt.img, { width: 720, height: 480, quality: 78 })}
                                            alt={`Apartamento ${apt.name} - Casa Rural Tío José María`}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        />
                                        {apt.badge && (
                                            <div className="absolute top-5 left-5 right-5 flex">
                                                <span className="max-w-full truncate bg-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm text-rural-900">
                                                    {apt.badge}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-6 md:p-8 flex-grow flex flex-col">
                                        <h3 className="font-serif text-xl md:text-2xl font-bold text-text-primary mb-2">{apt.name}</h3>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs md:text-sm text-secondary" aria-label="Características del apartamento">
                                            <span className="flex items-center gap-1.5">
                                                <Users size={15} className="text-accent" aria-hidden="true" /> {apt.capacityPeople} plazas
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Bath size={15} className="text-accent" aria-hidden="true" /> {apt.bathrooms} baño{apt.bathrooms !== 1 ? 's' : ''}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Flame size={15} className="text-accent" aria-hidden="true" /> Chimenea
                                            </span>
                                        </div>

                                        {apt.priceFrom && (
                                            <p className="text-sm text-secondary mb-3">
                                                Desde <span className="font-serif text-lg font-bold text-text-primary">{apt.priceFrom}€</span> <span className="text-xs">/ noche</span>
                                            </p>
                                        )}

                                        <p className="text-xs md:text-sm leading-relaxed mb-5 text-secondary line-clamp-2 flex-grow">{apt.desc}</p>

                                        <div className="mt-auto">
                                            <span className="text-sm font-bold text-primary transition-colors duration-300">
                                                Ver disponibilidad &rarr;
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            </Link>
                        </FadeInUp>
                    ))}
                </div>

                <FadeInUp>
                    <ApartmentComparison apartments={displayApartments} />
                </FadeInUp>

                <FadeInUp>
                    <div className="text-center mt-14">
                        <p className="italic mb-3 text-secondary">Todos nuestros apartamentos están equipados con ropa de cama, toallas y menaje de cocina.</p>
                        <a href={whatsappLink('Hola, estoy viendo los apartamentos y tengo dudas sobre cuál es el mejor para nosotros. ¿Me podríais ayudar a elegir?')} target="_blank" rel="noopener noreferrer" className="inline-block font-bold text-primary hover:underline">
                            ¿Tienes dudas sobre cuál elegir? Escríbenos &rarr;
                        </a>
                    </div>
                </FadeInUp>
            </div>
        </section>
    );
};

export default ApartmentsGrid;

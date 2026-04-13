import { Link } from 'react-router-dom';
import { Flame, Wifi, Tv, UtensilsCrossed, Baby, Eye } from 'lucide-react';
import FadeInUp from '../shared/FadeInUp';
import { WP } from '../../constants/urls';

const ApartmentsGrid = ({ apartments }) => {
    const defaultApartments = [
        { name: 'Albahaca', tag: 'Romantico', capacity: '2 plazas', href: '/Albahaca.html', img: `${WP}/ALBAHACA-1.jpg`, desc: 'Intimo y acogedor. Disenado para parejas. Disfruta de una cena romantica frente a la chimenea despues de una ruta por el parque.', icons: [Flame, Wifi, Tv] },
        { name: 'Tomillo', tag: 'Con Vistas', capacity: '2 plazas', href: '/Tomillo.html', img: `${WP}/TOMILLOHOME1.jpg`, desc: 'Ubicado en la segunda planta con balcon y vistas al valle. Techos de madera abuhardillados que le dan un encanto especial.', icons: [Eye, Wifi, Flame] },
        { name: 'Lavanda', tag: 'Familiar', capacity: '4 plazas', href: '/Lavanda.html', img: `${WP}/LAVANDAHOME1.jpg`, desc: 'Espacioso y luminoso. Salon con chimenea, cocina completa, dormitorio de matrimonio y otro doble. Ideal para familias.', icons: [Flame, UtensilsCrossed, Baby] },
        { name: 'Romero', tag: 'Familiar', capacity: '4 plazas', href: '/Romero.html', img: `${WP}/ROMEROHOME1.jpg`, desc: 'Confort rustico con todas las comodidades. Salon con chimenea para las noches de invierno y dos dormitorios independientes.', icons: [Flame, UtensilsCrossed, Wifi] },
    ];

    const activeApartments = apartments?.filter(apt => apt.is_active) || [];

    const displayApartments = activeApartments.length > 0
        ? activeApartments.map(apt => ({
            name: apt.name,
            tag: apt.capacity_people <= 2 ? 'Romantico' : 'Familiar',
            capacity: `${apt.capacity_people} plazas`,
            href: `/apartamento/${apt.slug}`,
            img: apt.images?.[0] || `${WP}/ALBAHACA-1.jpg`,
            desc: apt.description,
            icons: apt.capacity_people <= 2 ? [Flame, Wifi, Tv] : [Flame, UtensilsCrossed, Wifi]
        }))
        : defaultApartments.map(apt => ({ ...apt, href: `/apartamento/${apt.name.toLowerCase()}` }));

    return (
        <section id="apartamentos" className="py-28 px-6 bg-gradient-to-b from-surface-warm to-surface">
            <div className="max-w-7xl mx-auto">
                <FadeInUp>
                    <div className="text-center mb-12 md:mb-20">
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Nuestros Alojamientos</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 text-text-primary">Elige tu rincon favorito</h2>
                    </div>
                </FadeInUp>

                <div className="grid md:grid-cols-2 gap-10">
                    {displayApartments.map((apt, idx) => (
                        <FadeInUp key={apt.name} delay={idx * 0.1}>
                            <Link to={apt.href} className="block group">
                                <article className="bg-white rounded-2xl overflow-hidden shadow-lg border border-transparent hover:border-accent transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2">
                                    <div className="h-72 overflow-hidden relative">
                                        <img src={apt.img} alt={`Apartamento ${apt.name} - Casa Rural Tio Jose Maria`} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        <div className="absolute top-5 right-5 bg-white/90 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm text-primary-dark">
                                            {apt.tag}
                                        </div>
                                    </div>
                                    <div className="p-6 md:p-8">
                                        <div className="flex justify-between items-baseline mb-3">
                                            <h3 className="font-serif text-xl md:text-2xl font-bold text-text-primary">{apt.name}</h3>
                                            <span className="text-xs md:text-sm text-secondary">{apt.capacity}</span>
                                        </div>
                                        <p className="text-xs md:text-sm leading-relaxed mb-6 text-secondary">{apt.desc}</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-3">
                                                {apt.icons.map((Icon, i) => (
                                                    <Icon key={i} size={16} className="text-accent" />
                                                ))}
                                            </div>
                                            <span className="text-sm font-bold text-primary transition-colors duration-300">
                                                Ver Detalles &rarr;
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            </Link>
                        </FadeInUp>
                    ))}
                </div>

                <FadeInUp>
                    <div className="text-center mt-14">
                        <p className="italic mb-3 text-secondary">Todos nuestros apartamentos estan equipados con ropa de cama, toallas y menaje de cocina.</p>
                        <a href="https://wa.me/34676344675" target="_blank" rel="noopener noreferrer" className="inline-block font-bold text-primary hover:underline">
                            Tienes dudas sobre cual elegir? Escribenos &rarr;
                        </a>
                    </div>
                </FadeInUp>
            </div>
        </section>
    );
};

export default ApartmentsGrid;

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Map, ArrowRight } from 'lucide-react';
import FadeInUp from '../shared/FadeInUp';
import InteractiveMap from '../maps/InteractiveMap';
import { COLORS } from '../../constants/colors';
import { WP } from '../../constants/urls';

const EntornoSection = ({ places, routes }) => (
    <section id="entorno" className="py-24 px-6 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center mb-12 md:mb-20">
                <FadeInUp>
                    <span className="uppercase tracking-[0.2em] text-[10px] md:text-xs font-bold" style={{ color: COLORS.primary }}>Hinojares y el Valle del Turrilla</span>
                    <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-6 md:mb-8" style={{ color: COLORS.text }}>Un paraíso de contrastes entre desierto y pinar</h2>
                    <p className="text-base md:text-lg leading-relaxed mb-6" style={{ color: COLORS.secondary }}>
                        Tío José María se ubica en <strong>Hinojares</strong>, un pueblo mágico de gredas blancas al sur del <strong>Parque Natural de la Sierra de Cazorla</strong>. Es un destino donde el agua de los ríos y embalses se funde con paisajes semidesérticos y bosques vírgenes.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
                        <Link to="/rutas" className="p-6 rounded-2xl border border-rural-100 bg-rural-50 hover:bg-white hover:shadow-xl transition-all group block">
                            <span className="text-2xl mb-2 block">🐎</span>
                            <h4 className="font-serif text-xl font-bold mb-2" style={{ color: COLORS.primary }}>
                                Actividades Estrella
                            </h4>
                            <p className="text-sm opacity-80" style={{ color: COLORS.text }}>
                                Desde rutas a caballo en el pueblo hasta kayak y parapente en los embalses cercanos.
                            </p>
                            <span className="text-xs font-bold mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: COLORS.primary }}>
                                Ver actividades <ArrowRight size={12} />
                            </span>
                        </Link>
                        <Link to="/hinojares#gastronomia" className="p-6 rounded-2xl border border-rural-100 bg-rural-50 hover:bg-white hover:shadow-xl transition-all group block">
                            <span className="text-2xl mb-2 block">🥘</span>
                            <h4 className="font-serif text-xl font-bold mb-2" style={{ color: COLORS.primary }}>
                                Sabor Tradicional
                            </h4>
                            <p className="text-sm opacity-80" style={{ color: COLORS.text }}>
                                Prueba el cordero segureño y los platos típicos de la comarca, un placer para los sentidos.
                            </p>
                            <span className="text-xs font-bold mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: COLORS.primary }}>
                                Ver gastronomía <ArrowRight size={12} />
                            </span>
                        </Link>
                    </div>
                </FadeInUp>
                <div className="grid grid-cols-2 gap-3 md:gap-4 md:mt-0">
                    <FadeInUp delay={0.2}>
                        <img src={places[0]?.image_url || "https://www.tiojosemaria.com/wp-content/uploads/2018/12/hinojaresPueblo.jpg"} alt="Entorno Local" loading="lazy" className="rounded-2xl shadow-lg w-full h-40 md:h-64 object-cover md:mt-8" />
                    </FadeInUp>
                    <FadeInUp delay={0.3}>
                        <img src={routes[0]?.image_url || "https://www.tiojosemaria.com/wp-content/uploads/2018/12/MG_9540-1024x561.jpg"} alt="Rutas Sierra" loading="lazy" className="rounded-2xl shadow-lg w-full h-48 md:h-80 object-cover" />
                    </FadeInUp>
                    <FadeInUp delay={0.4}>
                        <img src={places[1]?.image_url || "https://www.tiojosemaria.com/wp-content/uploads/2019/01/chuletas-de-cordero-al-horno2-1024x724.jpg"} alt="Gastronomía" loading="lazy" className="rounded-2xl shadow-lg w-full h-40 md:h-64 object-cover md:-mt-16" />
                    </FadeInUp>
                    <FadeInUp delay={0.5}>
                        <img src={routes[1]?.image_url || "https://www.tiojosemaria.com/wp-content/uploads/2018/12/10-1024x768.jpg"} alt="Actividades" loading="lazy" className="rounded-2xl shadow-lg w-full h-40 md:h-64 object-cover mt-4" />
                    </FadeInUp>
                </div>
            </div>

            {/* Mini mapa de rutas */}
            {routes?.length > 0 && (
                <FadeInUp>
                    <div className="mb-12 md:mb-20">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                            <div>
                                <span className="uppercase tracking-[0.2em] text-[10px] md:text-xs font-bold" style={{ color: COLORS.primary }}>
                                    Explora la Sierra
                                </span>
                                <h3 className="font-serif text-2xl md:text-3xl font-bold mt-2" style={{ color: COLORS.text }}>
                                    Rutas de senderismo desde tu puerta
                                </h3>
                            </div>
                            <Link
                                to="/rutas"
                                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:shadow-lg hover:-translate-y-0.5"
                                style={{ backgroundColor: COLORS.primary }}
                            >
                                <Map size={16} />
                                Ver mapa completo
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                        <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100">
                            <InteractiveMap routes={routes} compact />
                        </div>
                    </div>
                </FadeInUp>
            )}

            <FadeInUp>
                <div id="como-llegar" className="rounded-3xl p-10 md:p-16 text-white relative overflow-hidden shadow-2xl" style={{ backgroundColor: COLORS.primary }}>
                    <div className="absolute inset-0 opacity-10">
                        <img src={`${WP}/2018/12/slide3.jpg`} alt="Paisaje" className="w-full h-full object-cover" />
                    </div>
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                        <div className="text-center lg:text-left">
                            <h3 className="font-serif text-3xl md:text-5xl font-bold mb-6">¿Preparado para tu desconexión?</h3>
                            <p className="text-lg opacity-90 max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                                Estamos en Calle Baja 1, Hinojares. Te facilitamos el camino para que solo tengas que preocuparte de disfrutar.
                            </p>
                            <a
                                href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-10 py-4 bg-white rounded-full text-lg font-bold transition-all duration-300 hover:shadow-xl hover:-translate-y-1 shadow-md"
                                style={{ color: COLORS.primary }}
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

export default EntornoSection;

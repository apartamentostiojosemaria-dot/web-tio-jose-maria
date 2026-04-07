import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, ChevronDown, ArrowLeft, ExternalLink, Utensils, Shield, Landmark, TreePine, ShoppingBag, Activity } from 'lucide-react';
import { COLORS } from '../constants/colors';
import { WP } from '../constants/urls';
import { useLocalPlaces } from '../hooks/useDatabase';
import FadeInUp from '../components/shared/FadeInUp';

const TYPE_CONFIG = {
    restaurante: { icon: Utensils, label: 'Restaurantes', color: '#e67e22' },
    turismo_activo: { icon: Activity, label: 'Turismo Activo', color: '#27ae60' },
    emergencia: { icon: Shield, label: 'Emergencias y Salud', color: '#e74c3c' },
    farmacia: { icon: Shield, label: 'Farmacias', color: '#e74c3c' },
    patrimonio: { icon: Landmark, label: 'Patrimonio', color: '#8e44ad' },
    naturaleza: { icon: TreePine, label: 'Naturaleza', color: '#2ecc71' },
    supermercado: { icon: ShoppingBag, label: 'Compras', color: '#3498db' },
    gasolinera: { icon: MapPin, label: 'Gasolinera', color: '#f39c12' },
    banco: { icon: MapPin, label: 'Bancos y Cajeros', color: '#2c3e50' },
};

const HISTORY_SECTIONS = [
    {
        title: 'Orígenes ancestrales',
        content: 'Hinojares tiene raíces que se remontan al menos al siglo IV a.C. El yacimiento ibérico de Castellones de Ceal, descubierto en 1955 a 5 km del pueblo, revela un oppidum fortificado con ~90 tumbas y cerámica griega, punto clave en la ruta entre el Guadalquivir y el Sureste peninsular.'
    },
    {
        title: 'De Traxinum a Hins-Nojar',
        content: 'Los romanos lo llamaron Traxinum. En época árabe pasó a ser Hins-Nojar, por la abundancia de hinojos silvestres en la zona. Durante siglos fue una aldea dependiente de Pozo Alcón.'
    },
    {
        title: 'Marquesado de Hinojares (1690)',
        content: 'El rey Carlos II creó el Marquesado de Hinojares, otorgando al pueblo estatus de villa. Hoy conserva tres barrios históricos: el Barrio Bajo (el más antiguo, con la Iglesia de San Marcos del s.XVII), el Barrio Alto (junto al río, con huertos familiares) y Cuevas Nuevas (viviendas trogloditas del s.XX que mantienen 18-22°C).'
    },
    {
        title: 'El pueblo más pequeño de Jaén',
        content: 'Con ~343 habitantes, Hinojares es el municipio más pequeño de la provincia. Su encanto reside en esa escala humana: calles blancas de greda, silencio, cielos estrellados y una comunidad que recibe al viajero como parte de la familia.'
    }
];

const TRADITIONS = [
    {
        title: 'Fiestas de San Marcos — 25 de abril',
        emoji: '🎉',
        content: 'Fiesta patronal con procesión de San Marcos y San Blas, decorados con flores y haces de trigo. Se reparten las tradicionales tortas de San Marcos bendecidas: dulces redondos con bordes decorados mediante moldes de madera artesanos.'
    },
    {
        title: 'Jornadas del Aceite de Oliva',
        emoji: '🫒',
        content: 'Inmersión en la cultura del AOVE. Programa: recolección de aceituna, comida campera, visita a almazara y cena-degustación con aceite de primera prensada en frío.'
    },
    {
        title: 'Fiestas de Agosto',
        emoji: '🎆',
        content: 'Verbenas, juegos tradicionales, concursos y actividades para toda la familia en las calles del pueblo durante mediados de agosto.'
    }
];

const GASTRONOMY = [
    { name: 'Migas', desc: 'Pan rallado con ajo y aceite, acompañado de chorizo, panceta y pimientos' },
    { name: 'Rin-Ran', desc: 'Ensalada fría de bacalao desalado, patatas, pimientos rojos y cebolla' },
    { name: 'Cordero Segureño (IGP)', desc: 'Carne tierna criada en los pastos de la sierra, la estrella de la comarca' },
    { name: 'Gachamigas', desc: 'Plato artesanal de harina, tradición centenaria de la cocina serrana' },
    { name: 'Habas con Jamón', desc: 'Habas frescas de Hinojares guisadas con jamón de la sierra' },
    { name: 'Carne de Caza', desc: 'Jabalí, ciervo y perdiz en guisos y estofados tradicionales' },
];

export default function HinojaresPage() {
    const { places, loading } = useLocalPlaces();
    const [activeSection, setActiveSection] = useState(null);

    const groupedPlaces = places.reduce((acc, place) => {
        const key = place.type;
        if (!acc[key]) acc[key] = [];
        acc[key].push(place);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-white">
            {/* Hero */}
            <section className="relative h-[70vh] min-h-[500px] flex items-end overflow-hidden">
                <div className="absolute inset-0">
                    <img
                        src={`${WP}/hinojaresPueblo.jpg`}
                        alt="Hinojares pueblo blanco"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                </div>
                <div className="relative z-10 max-w-7xl mx-auto w-full px-6 pb-16">
                    <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> Volver al inicio
                    </Link>
                    <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4">
                        Descubre Hinojares
                    </h1>
                    <p className="text-white/80 text-lg md:text-xl max-w-2xl leading-relaxed">
                        El pueblo más pequeño de Jaén, con 2.500 años de historia entre gredas blancas y la Sierra de Cazorla
                    </p>
                </div>
            </section>

            {/* Quick stats */}
            <section className="py-6 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 flex flex-wrap gap-8 justify-center text-center">
                    {[
                        { value: '~343', label: 'Habitantes' },
                        { value: 's.IV a.C.', label: 'Orígenes' },
                        { value: '780m', label: 'Altitud' },
                        { value: '3', label: 'Barrios históricos' },
                    ].map((stat, i) => (
                        <div key={i} className="px-6">
                            <p className="text-2xl md:text-3xl font-serif font-bold" style={{ color: COLORS.primary }}>{stat.value}</p>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Historia */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-[10px] md:text-xs font-bold" style={{ color: COLORS.primary }}>De Traxinum a Hinojares</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-12" style={{ color: COLORS.text }}>Una historia milenaria</h2>
                    </FadeInUp>
                    <div className="space-y-6">
                        {HISTORY_SECTIONS.map((section, i) => (
                            <FadeInUp key={i} delay={i * 0.1}>
                                <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
                                    <h3 className="font-serif text-xl font-bold mb-3" style={{ color: COLORS.text }}>{section.title}</h3>
                                    <p className="text-gray-600 leading-relaxed">{section.content}</p>
                                </div>
                            </FadeInUp>
                        ))}
                    </div>
                </div>
            </section>

            {/* Tradiciones y Fiestas */}
            <section className="py-20 px-6" style={{ backgroundColor: COLORS.bgWarm }}>
                <div className="max-w-4xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-[10px] md:text-xs font-bold" style={{ color: COLORS.primary }}>Tradiciones vivas</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-12" style={{ color: COLORS.text }}>Fiestas y celebraciones</h2>
                    </FadeInUp>
                    <div className="grid md:grid-cols-3 gap-6">
                        {TRADITIONS.map((t, i) => (
                            <FadeInUp key={i} delay={i * 0.15}>
                                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 h-full">
                                    <span className="text-3xl mb-4 block">{t.emoji}</span>
                                    <h3 className="font-serif text-lg font-bold mb-3" style={{ color: COLORS.primary }}>{t.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{t.content}</p>
                                </div>
                            </FadeInUp>
                        ))}
                    </div>
                </div>
            </section>

            {/* Gastronomía */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-[10px] md:text-xs font-bold" style={{ color: COLORS.primary }}>Sabor serrano</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-12" style={{ color: COLORS.text }}>Gastronomía típica</h2>
                    </FadeInUp>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {GASTRONOMY.map((dish, i) => (
                            <FadeInUp key={i} delay={i * 0.1}>
                                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <h4 className="font-bold mb-2" style={{ color: COLORS.text }}>{dish.name}</h4>
                                    <p className="text-sm text-gray-500 leading-relaxed">{dish.desc}</p>
                                </div>
                            </FadeInUp>
                        ))}
                    </div>
                </div>
            </section>

            {/* Directorio de lugares y servicios */}
            <section className="py-20 px-6" style={{ backgroundColor: COLORS.bgWarm }}>
                <div className="max-w-5xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-[10px] md:text-xs font-bold" style={{ color: COLORS.primary }}>Todo lo que necesitas</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-4" style={{ color: COLORS.text }}>Directorio local</h2>
                        <p className="text-gray-500 mb-12 max-w-2xl">Restaurantes, servicios de emergencia, farmacias, bancos y todo lo que un viajero puede necesitar en Hinojares y alrededores.</p>
                    </FadeInUp>

                    {loading ? (
                        <div className="text-center py-20 text-gray-400 font-serif italic">Cargando directorio...</div>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(TYPE_CONFIG).map(([type, config]) => {
                                const items = groupedPlaces[type];
                                if (!items || items.length === 0) return null;
                                const Icon = config.icon;
                                return (
                                    <FadeInUp key={type}>
                                        <div>
                                            <button
                                                onClick={() => setActiveSection(activeSection === type ? null : type)}
                                                className="w-full flex items-center justify-between bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.color + '15', color: config.color }}>
                                                        <Icon size={24} />
                                                    </div>
                                                    <div className="text-left">
                                                        <h3 className="font-bold text-lg" style={{ color: COLORS.text }}>{config.label}</h3>
                                                        <p className="text-xs text-gray-400">{items.length} {items.length === 1 ? 'lugar' : 'lugares'}</p>
                                                    </div>
                                                </div>
                                                <ChevronDown
                                                    size={20}
                                                    className="text-gray-400 transition-transform"
                                                    style={{ transform: activeSection === type ? 'rotate(180deg)' : 'rotate(0)' }}
                                                />
                                            </button>

                                            {activeSection === type && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="mt-3 space-y-3"
                                                >
                                                    {items.map((place) => (
                                                        <div key={place.id} className="bg-white rounded-xl p-5 border border-gray-50 shadow-sm ml-4">
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex-1">
                                                                    <h4 className="font-bold" style={{ color: COLORS.text }}>{place.name}</h4>
                                                                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{place.description}</p>
                                                                    {place.address && (
                                                                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                                            <MapPin size={12} /> {place.address}
                                                                        </p>
                                                                    )}
                                                                    {place.phone && (
                                                                        <a href={`tel:${place.phone.replace(/\s/g, '')}`} className="text-xs font-bold mt-1 flex items-center gap-1" style={{ color: COLORS.primary }}>
                                                                            <Phone size={12} /> {place.phone}
                                                                        </a>
                                                                    )}
                                                                </div>
                                                                {place.web_url && (
                                                                    <a href={place.web_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 ml-4">
                                                                        <ExternalLink size={16} />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </div>
                                    </FadeInUp>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <FadeInUp>
                        <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6" style={{ color: COLORS.text }}>
                            Vive Hinojares desde dentro
                        </h2>
                        <p className="text-gray-500 mb-10 max-w-xl mx-auto">
                            Alójate en Tío José María y descubre por qué este rincón de la Sierra de Cazorla enamora a quien lo visita.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                to="/"
                                className="px-8 py-4 rounded-full text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                style={{ backgroundColor: COLORS.primary }}
                            >
                                Ver apartamentos
                            </Link>
                            <Link
                                to="/rutas"
                                className="px-8 py-4 rounded-full font-bold border-2 hover:-translate-y-0.5 transition-all"
                                style={{ borderColor: COLORS.primary, color: COLORS.primary }}
                            >
                                Explorar rutas
                            </Link>
                        </div>
                    </FadeInUp>
                </div>
            </section>

            {/* Footer mini */}
            <footer className="py-8 px-6 border-t border-gray-100 text-center">
                <Link to="/" className="text-sm font-medium" style={{ color: COLORS.primary }}>
                    &larr; Volver a Apartamentos Tío José María
                </Link>
            </footer>
        </div>
    );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, ChevronDown, ArrowLeft, ExternalLink, Utensils, Shield, Landmark, TreePine, ShoppingBag, Activity } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { BreadcrumbJsonLd } from '../components/seo/JsonLd';
import { WP } from '../constants/urls';
import { useLocalPlaces } from '../hooks/useDatabase';
import FadeInUp from '../components/shared/FadeInUp';

const TYPE_CONFIG = {
    restaurante: { icon: Utensils, label: 'Restaurantes', color: 'var(--color-place-restaurant)' },
    turismo_activo: { icon: Activity, label: 'Turismo Activo', color: 'var(--color-place-active)' },
    emergencia: { icon: Shield, label: 'Emergencias y Salud', color: 'var(--color-place-emergency)' },
    farmacia: { icon: Shield, label: 'Farmacias', color: 'var(--color-place-emergency)' },
    patrimonio: { icon: Landmark, label: 'Patrimonio', color: 'var(--color-place-heritage)' },
    naturaleza: { icon: TreePine, label: 'Naturaleza', color: 'var(--color-place-nature)' },
    supermercado: { icon: ShoppingBag, label: 'Compras', color: 'var(--color-place-shopping)' },
    gasolinera: { icon: MapPin, label: 'Gasolinera', color: 'var(--color-place-gas)' },
    banco: { icon: MapPin, label: 'Bancos y Cajeros', color: 'var(--color-place-bank)' },
};

const HISTORY_SECTIONS = [
    { title: 'Origenes ancestrales', content: 'Hinojares tiene raices que se remontan al menos al siglo IV a.C. El yacimiento iberico de Castellones de Ceal, descubierto en 1955 a 5 km del pueblo, revela un oppidum fortificado con ~90 tumbas y ceramica griega, punto clave en la ruta entre el Guadalquivir y el Sureste peninsular.' },
    { title: 'De Traxinum a Hins-Nojar', content: 'Los romanos lo llamaron Traxinum. En epoca arabe paso a ser Hins-Nojar, por la abundancia de hinojos silvestres en la zona. Durante siglos fue una aldea dependiente de Pozo Alcon.' },
    { title: 'Marquesado de Hinojares (1690)', content: 'El rey Carlos II creo el Marquesado de Hinojares, otorgando al pueblo estatus de villa. Hoy conserva tres barrios historicos: el Barrio Bajo (el mas antiguo, con la Iglesia de San Marcos del s.XVII), el Barrio Alto (junto al rio, con huertos familiares) y Cuevas Nuevas (viviendas trogloditas del s.XX que mantienen 18-22 grados).' },
    { title: 'El pueblo mas pequeno de Jaen', content: 'Con ~343 habitantes, Hinojares es el municipio mas pequeno de la provincia. Su encanto reside en esa escala humana: calles blancas de greda, silencio, cielos estrellados y una comunidad que recibe al viajero como parte de la familia.' }
];

const TRADITIONS = [
    { title: 'Fiestas de San Marcos — 25 de abril', emoji: '\uD83C\uDF89', content: 'Fiesta patronal con procesion de San Marcos y San Blas, decorados con flores y haces de trigo. Se reparten las tradicionales tortas de San Marcos bendecidas: dulces redondos con bordes decorados mediante moldes de madera artesanos.' },
    { title: 'Jornadas del Aceite de Oliva', emoji: '\uD83E\uDED2', content: 'Inmersion en la cultura del AOVE. Programa: recoleccion de aceituna, comida campera, visita a almazara y cena-degustacion con aceite de primera prensada en frio.' },
    { title: 'Fiestas de Agosto', emoji: '\uD83C\uDF86', content: 'Verbenas, juegos tradicionales, concursos y actividades para toda la familia en las calles del pueblo durante mediados de agosto.' }
];

const GASTRONOMY = [
    { name: 'Migas', desc: 'Pan rallado con ajo y aceite, acompanado de chorizo, panceta y pimientos' },
    { name: 'Rin-Ran', desc: 'Ensalada fria de bacalao desalado, patatas, pimientos rojos y cebolla' },
    { name: 'Cordero Segureno (IGP)', desc: 'Carne tierna criada en los pastos de la sierra, la estrella de la comarca' },
    { name: 'Gachamigas', desc: 'Plato artesanal de harina, tradicion centenaria de la cocina serrana' },
    { name: 'Habas con Jamon', desc: 'Habas frescas de Hinojares guisadas con jamon de la sierra' },
    { name: 'Carne de Caza', desc: 'Jabali, ciervo y perdiz en guisos y estofados tradicionales' },
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
            <PageHead
                title="Descubre Hinojares — Historia, Tradiciones y Gastronomia"
                description="Hinojares, el pueblo mas pequeno de Jaen con 2.500 anos de historia. Descubre sus tradiciones, gastronomia tipica y directorio de servicios en la Sierra de Cazorla."
                path="/hinojares"
            />
            <BreadcrumbJsonLd items={[
                { name: 'Inicio', url: 'https://tiojosemaria.com/' },
                { name: 'Hinojares', url: 'https://tiojosemaria.com/hinojares' }
            ]} />
            {/* Hero */}
            <section className="relative h-[70vh] min-h-[500px] flex items-end overflow-hidden">
                <div className="absolute inset-0">
                    <img src={`${WP}/hinojaresPueblo.jpg`} alt="Hinojares pueblo blanco" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                </div>
                <div className="relative z-10 max-w-7xl mx-auto w-full px-6 pb-16">
                    <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> Volver al inicio
                    </Link>
                    <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4">Descubre Hinojares</h1>
                    <p className="text-white/80 text-lg md:text-xl max-w-2xl leading-relaxed">
                        El pueblo mas pequeno de Jaen, con 2.500 anos de historia entre gredas blancas y la Sierra de Cazorla
                    </p>
                </div>
            </section>

            {/* Quick stats */}
            <section className="py-6 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 flex flex-wrap gap-8 justify-center text-center">
                    {[
                        { value: '~343', label: 'Habitantes' },
                        { value: 's.IV a.C.', label: 'Origenes' },
                        { value: '780m', label: 'Altitud' },
                        { value: '3', label: 'Barrios historicos' },
                    ].map((stat, i) => (
                        <div key={i} className="px-6">
                            <p className="text-2xl md:text-3xl font-serif font-bold text-primary">{stat.value}</p>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Historia */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">De Traxinum a Hinojares</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-12 text-text-primary">Una historia milenaria</h2>
                    </FadeInUp>
                    <div className="space-y-6">
                        {HISTORY_SECTIONS.map((section, i) => (
                            <FadeInUp key={i} delay={i * 0.1}>
                                <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
                                    <h3 className="font-serif text-xl font-bold mb-3 text-text-primary">{section.title}</h3>
                                    <p className="text-gray-600 leading-relaxed">{section.content}</p>
                                </div>
                            </FadeInUp>
                        ))}
                    </div>
                </div>
            </section>

            {/* Tradiciones */}
            <section className="py-20 px-6 bg-surface-warm">
                <div className="max-w-4xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Tradiciones vivas</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-12 text-text-primary">Fiestas y celebraciones</h2>
                    </FadeInUp>
                    <div className="grid md:grid-cols-3 gap-6">
                        {TRADITIONS.map((t, i) => (
                            <FadeInUp key={i} delay={i * 0.15}>
                                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 h-full">
                                    <span className="text-3xl mb-4 block">{t.emoji}</span>
                                    <h3 className="font-serif text-lg font-bold mb-3 text-primary">{t.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{t.content}</p>
                                </div>
                            </FadeInUp>
                        ))}
                    </div>
                </div>
            </section>

            {/* Gastronomia */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Sabor serrano</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-12 text-text-primary">Gastronomia tipica</h2>
                    </FadeInUp>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {GASTRONOMY.map((dish, i) => (
                            <FadeInUp key={i} delay={i * 0.1}>
                                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <h4 className="font-bold mb-2 text-text-primary">{dish.name}</h4>
                                    <p className="text-sm text-gray-500 leading-relaxed">{dish.desc}</p>
                                </div>
                            </FadeInUp>
                        ))}
                    </div>
                </div>
            </section>

            {/* Directorio */}
            <section className="py-20 px-6 bg-surface-warm">
                <div className="max-w-5xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Todo lo que necesitas</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-4 text-text-primary">Directorio local</h2>
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
                                                aria-expanded={activeSection === type}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.color + '15', color: config.color }}>
                                                        <Icon size={24} />
                                                    </div>
                                                    <div className="text-left">
                                                        <h3 className="font-bold text-lg text-text-primary">{config.label}</h3>
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
                                                                    <h4 className="font-bold text-text-primary">{place.name}</h4>
                                                                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{place.description}</p>
                                                                    {place.address && (
                                                                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                                            <MapPin size={12} /> {place.address}
                                                                        </p>
                                                                    )}
                                                                    {place.phone && (
                                                                        <a href={`tel:${place.phone.replace(/\s/g, '')}`} className="text-xs font-bold mt-1 flex items-center gap-1 text-primary">
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
                        <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6 text-text-primary">Vive Hinojares desde dentro</h2>
                        <p className="text-gray-500 mb-10 max-w-xl mx-auto">
                            Alojate en Tio Jose Maria y descubre por que este rincon de la Sierra de Cazorla enamora a quien lo visita.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/" className="px-8 py-4 rounded-full text-white font-bold bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                                Ver apartamentos
                            </Link>
                            <Link to="/rutas" className="px-8 py-4 rounded-full font-bold border-2 border-primary text-primary hover:-translate-y-0.5 transition-all">
                                Explorar rutas
                            </Link>
                        </div>
                    </FadeInUp>
                </div>
            </section>

            <footer className="py-8 px-6 border-t border-gray-100 text-center">
                <Link to="/" className="text-sm font-medium text-primary">&larr; Volver a Apartamentos Tio Jose Maria</Link>
            </footer>
        </div>
    );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, ChevronDown, ArrowLeft, ExternalLink, Utensils, Shield, Landmark, TreePine, ShoppingBag, Activity } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { BreadcrumbJsonLd, TouristDestinationJsonLd, FAQPageJsonLd, HowToJsonLd } from '../components/seo/JsonLd';
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
    { title: 'De Traxinum a Hins-Nojar', content: 'Los romanos lo llamaron Traxinum. En época árabe pasó a ser Hins-Nojar, por la abundancia de hinojos silvestres en la zona. Durante siglos fue una aldea dependiente de Pozo Alcón.' },
    { title: 'Marquesado de Hinojares (1690)', content: 'El rey Carlos II creó el Marquesado de Hinojares, otorgando al pueblo estatus de villa. Hoy conserva tres barrios históricos: el Barrio Bajo (el más antiguo, con la Iglesia de San Marcos del s.XVII), el Barrio Alto (junto al río, con huertos familiares) y Cuevas Nuevas (viviendas trogloditas del s.XX que mantienen 18-22 grados).' },
    { title: 'El pueblo más pequeño de Jaén', content: 'Con ~343 habitantes, Hinojares es el municipio más pequeño de la provincia. Su encanto reside en esa escala humana: calles blancas de greda, silencio, cielos estrellados y una comunidad que recibe al viajero como parte de la familia.' }
];

const TRADITIONS = [
    { title: 'Fiestas de San Marcos — 25 de abril', emoji: '\uD83C\uDF89', content: 'Fiesta patronal con procesion de San Marcos y San Blas, decorados con flores y haces de trigo. Se reparten las tradicionales tortas de San Marcos bendecidas: dulces redondos con bordes decorados mediante moldes de madera artesanos.' },
    { title: 'Jornadas del Aceite de Oliva', emoji: '\uD83E\uDED2', content: 'Inmersion en la cultura del AOVE. Programa: recoleccion de aceituna, comida campera, visita a almazara y cena-degustacion con aceite de primera prensada en frio.' },
    { title: 'Fiestas de Agosto', emoji: '\uD83C\uDF86', content: 'Verbenas, juegos tradicionales, concursos y actividades para toda la familia en las calles del pueblo durante mediados de agosto.' }
];

// Datos cuantitativos verificables que los LLMs citan bien (distancias, clima, altitud).
// Si en algún momento se afina con datos oficiales (AEMET, Google Maps), actualizar aquí.
const PRACTICAL_FACTS = [
    { label: 'Población', value: '~343 habitantes', detail: 'El municipio más pequeño de la provincia de Jaén' },
    { label: 'Altitud', value: '780 m', detail: 'Sobre el nivel del mar, en plena Sierra de Cazorla' },
    { label: 'Comarca', value: 'Sierra de Cazorla, Segura y Las Villas', detail: 'Mayor espacio protegido de España (Parque Natural)' },
    { label: 'Código postal', value: '23486', detail: 'Provincia de Jaén, Andalucía' },
    { label: 'Clima', value: 'Mediterráneo serrano', detail: 'Inviernos suaves (3-10 °C), veranos cálidos y secos (20-32 °C)' },
    { label: 'Mejor época para visitar', value: 'Abril–junio · septiembre–noviembre', detail: 'Temperaturas agradables y paisajes en su mejor momento (almendros en flor en primavera, ocres del olivar en otoño)' },
];

const DISTANCES = [
    { city: 'Cazorla (pueblo)', km: 50, time: '1 h' },
    { city: 'Úbeda', km: 70, time: '1 h' },
    { city: 'Jaén (capital)', km: 120, time: '1 h 30' },
    { city: 'Granada', km: 140, time: '1 h 50' },
    { city: 'Almería', km: 175, time: '2 h 10' },
    { city: 'Córdoba', km: 220, time: '2 h 40' },
    { city: 'Madrid', km: 380, time: '4 h' },
];

const FAQ_ITEMS = [
    {
        question: '¿Dónde está Hinojares y cómo llegar?',
        answer: 'Hinojares es un pueblo de la provincia de Jaén (Andalucía, España), en la comarca de la Sierra de Cazorla, Segura y Las Villas. Está a unos 120 km de Jaén capital (1 h 30 en coche), 140 km de Granada (1 h 50), 70 km de Úbeda (1 h) y 380 km de Madrid (4 h). El acceso se hace por carretera, no hay tren ni autobús directo desde grandes ciudades. Aeropuertos más cercanos: Granada-Jaén (1 h 50) y Almería (2 h 10).'
    },
    {
        question: '¿Cuál es la mejor época para visitar Hinojares y la Sierra de Cazorla?',
        answer: 'Primavera (abril-junio) y otoño (septiembre-noviembre) son las mejores épocas: temperaturas agradables (15-25 °C), paisajes en plena explosión (almendros en flor en primavera, ocres del olivar en otoño) y menos afluencia. El verano es cálido pero seco (20-32 °C) y permite disfrutar de ríos y piscinas naturales. En invierno (3-10 °C) la sierra ofrece silencio, cielos limpios y planes junto a la chimenea.'
    },
    {
        question: '¿Qué se puede hacer en Hinojares y alrededores?',
        answer: 'Senderismo en el Parque Natural de la Sierra de Cazorla (el mayor espacio protegido de España), visita a pueblos blancos cercanos (Cazorla, Quesada, Pozo Alcón), baño en ríos y piscinas naturales en verano, observación de fauna (cabra montés, buitre leonado, ciervo), turismo gastronómico (cordero segureño IGP, aceite de oliva virgen extra) y patrimonio cultural (Castellones de Ceal, yacimiento ibérico del siglo IV a.C.; Marquesado de Hinojares fundado en 1690 por Carlos II).'
    },
    {
        question: '¿Qué historia tiene Hinojares?',
        answer: 'Hinojares tiene más de 2.500 años de historia. Sus orígenes documentados se remontan al siglo IV a.C. con el oppidum ibérico de Castellones de Ceal (a 5 km del pueblo). Los romanos lo llamaron Traxinum; en época árabe pasó a ser Hins-Nojar (por los hinojos silvestres). En 1690 el rey Carlos II creó el Marquesado de Hinojares. Hoy conserva tres barrios históricos: Barrio Bajo (con la iglesia de San Marcos del siglo XVII), Barrio Alto y Cuevas Nuevas (viviendas trogloditas que mantienen 18-22 °C todo el año).'
    },
    {
        question: '¿Cuál es la gastronomía típica de Hinojares?',
        answer: 'La cocina de Hinojares es serrana y de raíz: migas con chorizo y panceta, rin-ran (ensalada fría de bacalao, patatas y pimientos), cordero segureño (carne de oveja con Indicación Geográfica Protegida), gachamigas (harina y agua, plato centenario), habas con jamón y carne de caza (jabalí, ciervo, perdiz). El aceite de oliva virgen extra de la comarca es uno de los mejores del mundo.'
    },
    {
        question: '¿Cuándo son las fiestas de Hinojares?',
        answer: 'Las fiestas principales son San Marcos el 25 de abril (procesión, tortas de San Marcos bendecidas y decoración con flores y trigo), las Fiestas de Agosto (verbenas, juegos tradicionales y actividades familiares a mediados de mes) y las Jornadas del Aceite de Oliva (otoño, con recolección, almazara y degustaciones).'
    },
    {
        question: '¿Se admiten mascotas en Apartamentos Tío José María?',
        answer: 'No, en la actualidad los apartamentos no admiten mascotas. Si tienes dudas sobre alojamientos pet-friendly en la comarca, escríbenos por WhatsApp y te ayudamos a encontrar alternativas.'
    },
    {
        question: '¿Cuánto cuestan los apartamentos y cómo se reservan?',
        answer: 'Los precios van desde 60 € por noche en temporada baja. Cada apartamento (Albahaca, Tomillo, Lavanda, Romero) tiene su propia tarifa según capacidad y temporada. La reserva se hace directamente desde tiojosemaria.com sin comisiones de intermediarios. Para consultas concretas o estancias largas, contacta al +34 676 34 46 75 o apartamentostiojosemaria@gmail.com.'
    },
];

const HOW_TO_VISIT_STEPS = [
    { name: 'Llegar en coche', text: 'Hinojares se encuentra al sureste de la provincia de Jaén. Desde la A-44 (Madrid–Granada) tomar la salida hacia Quesada–Pozo Alcón y seguir la A-326 hasta Hinojares. Aparcamiento gratuito en el pueblo.' },
    { name: 'Reservar alojamiento', text: 'Elige tu apartamento (Albahaca, Tomillo, Lavanda o Romero) en tiojosemaria.com según número de personas y reserva online sin comisiones.', url: 'https://tiojosemaria.com/#apartamentos' },
    { name: 'Planificar la estancia', text: 'Consulta las rutas y excursiones de la comarca (desde paseos andando hasta excursiones de día completo a los grandes atractivos de Cazorla).', url: 'https://tiojosemaria.com/rutas' },
    { name: 'Disfrutar del pueblo y la sierra', text: 'Recorre los tres barrios históricos, conoce la historia milenaria, prueba la gastronomía local y descubre el Parque Natural de la Sierra de Cazorla, el mayor espacio protegido de España.' },
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
                title="Descubre Hinojares — Historia, Tradiciones y Gastronomía"
                description="Hinojares, el pueblo más pequeño de Jaén con 2.500 años de historia. Descubre sus tradiciones, gastronomía típica y directorio de servicios en la Sierra de Cazorla."
                path="/hinojares"
                image={`${WP}/hinojaresPueblo.jpg`}
            />
            <BreadcrumbJsonLd items={[
                { name: 'Inicio', url: 'https://tiojosemaria.com/' },
                { name: 'Hinojares', url: 'https://tiojosemaria.com/hinojares' }
            ]} />
            <TouristDestinationJsonLd />
            <FAQPageJsonLd id="https://tiojosemaria.com/hinojares#faq" items={FAQ_ITEMS} />
            <HowToJsonLd
                id="https://tiojosemaria.com/hinojares#how-to-visit"
                name="Cómo visitar Hinojares y la Sierra de Cazorla"
                description="Guía paso a paso para llegar a Hinojares, reservar alojamiento, planificar la estancia y disfrutar del Parque Natural de la Sierra de Cazorla."
                totalTime="P3D"
                image={`${WP}/hinojaresPueblo.jpg`}
                steps={HOW_TO_VISIT_STEPS}
            />
            {/* Hero */}
            <section className="relative h-[70vh] min-h-[500px] flex items-end overflow-hidden">
                <div className="absolute inset-0">
                    <img src={`${WP}/hinojaresPueblo.jpg`} alt="Hinojares pueblo blanco" fetchpriority="high" decoding="async" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                </div>
                <div className="relative z-10 max-w-7xl mx-auto w-full px-6 pb-16">
                    <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> Volver al inicio
                    </Link>
                    <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4">Descubre Hinojares</h1>
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
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-12 text-text-primary">Gastronomía típica</h2>
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

            {/* Datos prácticos */}
            <section className="py-20 px-6 bg-surface-warm">
                <div className="max-w-5xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Datos prácticos</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-4 text-text-primary">Hinojares en cifras</h2>
                        <p className="text-gray-500 mb-10 max-w-2xl">Lo esencial para planificar tu viaje: dónde está, cómo es el clima y cuál es la mejor época para venir.</p>
                    </FadeInUp>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {PRACTICAL_FACTS.map((fact, i) => (
                            <FadeInUp key={i} delay={i * 0.05}>
                                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full">
                                    <p className="text-xs uppercase tracking-widest font-bold text-primary mb-2">{fact.label}</p>
                                    <p className="font-serif text-xl font-bold text-text-primary mb-2">{fact.value}</p>
                                    <p className="text-sm text-gray-500 leading-relaxed">{fact.detail}</p>
                                </div>
                            </FadeInUp>
                        ))}
                    </div>
                </div>
            </section>

            {/* Distancias desde ciudades */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Cómo llegar</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-4 text-text-primary">Distancias desde las principales ciudades</h2>
                        <p className="text-gray-500 mb-10 max-w-2xl">Hinojares se llega en coche; no hay tren ni autobús directo desde grandes ciudades. Aeropuertos más cercanos: Granada-Jaén (1 h 50) y Almería (2 h 10).</p>
                    </FadeInUp>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-surface-warm border-b border-gray-100">
                                <tr>
                                    <th className="text-left px-6 py-4 font-bold text-text-primary uppercase tracking-widest text-xs">Origen</th>
                                    <th className="text-right px-6 py-4 font-bold text-text-primary uppercase tracking-widest text-xs">Distancia</th>
                                    <th className="text-right px-6 py-4 font-bold text-text-primary uppercase tracking-widest text-xs">En coche</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DISTANCES.map((d, i) => (
                                    <tr key={d.city} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                                        <td className="px-6 py-3 text-text-primary font-medium">{d.city}</td>
                                        <td className="px-6 py-3 text-right text-secondary tabular-nums">{d.km} km</td>
                                        <td className="px-6 py-3 text-right text-secondary tabular-nums">{d.time}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-20 px-6 bg-surface-warm">
                <div className="max-w-3xl mx-auto">
                    <FadeInUp>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Lo que más nos preguntan</span>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-10 text-text-primary">Preguntas frecuentes sobre Hinojares</h2>
                    </FadeInUp>
                    <div className="space-y-3">
                        {FAQ_ITEMS.map((item, i) => (
                            <FadeInUp key={i} delay={i * 0.03}>
                                <details className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                    <summary className="cursor-pointer list-none px-6 py-5 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors">
                                        <h3 className="font-serif font-bold text-text-primary text-base md:text-lg leading-snug">{item.question}</h3>
                                        <ChevronDown size={20} className="flex-shrink-0 mt-1 text-secondary transition-transform group-open:rotate-180" aria-hidden="true" />
                                    </summary>
                                    <div className="px-6 pb-6 -mt-1 text-sm md:text-base text-gray-600 leading-relaxed">
                                        {item.answer}
                                    </div>
                                </details>
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
                            Alójate en Tío José María y descubre por qué este rincón de la Sierra de Cazorla enamora a quien lo visita.
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
                <Link to="/" className="text-sm font-medium text-primary">&larr; Volver a Apartamentos Tío José María</Link>
            </footer>
        </div>
    );
}

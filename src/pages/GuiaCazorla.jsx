import { Link } from 'react-router-dom';
import { ChevronLeft, Map as MapIcon, Calendar, UtensilsCrossed, Leaf, Mountain, Sparkles, AlertCircle, Home, Phone } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { whatsappLink, WHATSAPP_URL } from '../constants/urls';

// Guia editorial "Descubre el Cazorla que no sale en las guias".
// Pagina indexable, mobile-first, sin login. Sirve dos propositos:
// 1) Lead magnet: la enviamos por email a quien se suscribe al newsletter
// 2) SEO: contenido largo y especifico de la zona Hinojares/Sur de Cazorla
//    que casa con long-tail queries reales (rutas, sitios, fiestas)

const Section = ({ icon: Icon, title, children }) => (
    <section className="mb-14 md:mb-20">
        <div className="flex items-center gap-3 mb-6 md:mb-8">
            <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon size={20} className="text-primary" />
            </span>
            <h2 className="font-serif text-2xl md:text-4xl font-bold text-text-primary">{title}</h2>
        </div>
        <div className="space-y-4 text-base md:text-lg leading-relaxed text-text-primary">
            {children}
        </div>
    </section>
);

const RouteCard = ({ name, level, duration, km, body, tip }) => (
    <article className="bg-white border border-gray-100 rounded-2xl p-5 md:p-6 shadow-sm">
        <h3 className="font-serif text-lg md:text-xl font-bold text-text-primary mb-2">{name}</h3>
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-rural-50 text-primary font-bold">{level}</span>
            <span className="px-2.5 py-1 rounded-full bg-gray-50 text-secondary">{duration}</span>
            <span className="px-2.5 py-1 rounded-full bg-gray-50 text-secondary">{km}</span>
        </div>
        <p className="text-sm md:text-base text-secondary leading-relaxed">{body}</p>
        {tip && (
            <p className="mt-3 text-xs md:text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{tip}</span>
            </p>
        )}
    </article>
);

const GuiaCazorla = () => (
    <div className="min-h-screen bg-surface">
        <PageHead
            title="Guía del Cazorla que no sale en las guías — Hinojares, Castril, Tíscar"
            description="Rutas, sitios para comer, fiestas, almazaras y secretos locales de la Sierra de Cazorla desde Hinojares. Guía honesta hecha por la familia de Apartamentos Tío José María."
            path="/guia-cazorla"
        />

        {/* Nav top */}
        <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
            <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
                <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-70 transition-opacity">
                    <ChevronLeft size={16} /> Inicio
                </Link>
                <span className="text-xs font-medium text-secondary">Apartamentos Tío José María</span>
            </div>
        </nav>

        {/* Hero */}
        <header className="px-6 pt-16 pb-12 md:pt-24 md:pb-20 max-w-3xl mx-auto text-center">
            <p className="uppercase tracking-[0.25em] text-xs font-bold text-primary mb-4">Guía local</p>
            <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl font-bold text-text-primary leading-tight mb-6">
                Descubre el Cazorla<br /><span className="italic text-primary">que no sale en las guías</span>
            </h1>
            <p className="text-base md:text-lg text-secondary leading-relaxed max-w-2xl mx-auto">
                Esto es lo que les contamos a quienes vienen a quedarse con nosotros: rutas, sitios, fiestas y secretos del sur del Parque Natural de Cazorla, escrito desde Hinojares por la familia que lleva la casa.
            </p>
        </header>

        <main className="max-w-3xl mx-auto px-6 pb-20">
            <Section icon={Home} title="La casa y quien la lleva">
                <p>La casa lleva el nombre del bisabuelo, <strong>Tío José María</strong>, que vivió aquí y dejó esta casona del siglo XVII en pie. Cuatro generaciones después, la siguen llevando los suyos: <strong>Mari Carmen y Jesús</strong>, en persona. Si necesitas algo durante la estancia, son ellos quienes te lo arreglan.</p>
                <p>Cuando tocó restaurarla, respetamos lo que merecía respeto: los muros originales de piedra y barro a la vista, los techos de madera y caña, la chimenea de leña en cada salón. Lo demás —cocina equipada, calefacción, aire, WiFi— lo añadimos para que vivirla sea cómodo, no incómodamente auténtico.</p>
                <p><strong>Albahaca</strong> y <strong>Tomillo</strong> son para dos personas que vienen a desconectar. <strong>Lavanda</strong> y <strong>Romero</strong>, para familias o grupos pequeños. Los cuatro tienen chimenea, los cuatro tienen vistas al Valle del Guadiana Menor, y los cuatro son independientes: nadie cruza tu salón.</p>
            </Section>

            <Section icon={Sparkles} title="Hinojares: el pueblo más pequeño de Jaén">
                <p>Hinojares vive en un valle al sur del Parque Natural de la Sierra de Cazorla, Segura y Las Villas, a 672 m de altitud. Tres barrios articulan el pueblo:</p>
                <ul className="list-disc pl-6 space-y-2 text-secondary">
                    <li><strong>Barrio Bajo</strong>, el más antiguo, en torno a la Fuente de las Ranas y la Fuente de Hinojares.</li>
                    <li><strong>Barrio Alto</strong>, surgido a mediados del siglo XX sobre viviendas trogloditas que existían desde siglos antes.</li>
                    <li><strong>Cuevas Nuevas</strong>, ya en ladera, donde empieza propiamente la sierra.</li>
                </ul>
                <p>A 5 km, el yacimiento ibérico de <strong>Castellones de Ceal</strong> documenta presencia humana continuada desde el siglo VII a.C. — fue punto fronterizo entre bastetanos y oretanos hasta su destrucción en la romanización. En 1690, Carlos II creó el <em>Marquesado de Hinojares</em>, separándolo de Pozo Alcón.</p>
                <p className="bg-rural-50 border-l-4 border-primary p-4 italic text-secondary">Por qué aquí y no en Cazorla pueblo: en agosto y puentes, Cazorla se satura. Hinojares queda en el lado sur del parque, con tráfico bajo, cielo oscuro de verdad, y acceso directo al Embalse de la Bolera, Castril y Tíscar sin pasar por las gargantas turísticas del norte.</p>
            </Section>

            <Section icon={Mountain} title="Rutas de senderismo">
                <p className="mb-6">Once rutas con dificultad real y datos verificados. Encontrarás el listado completo con coordenadas y mapas <Link to="/rutas" className="text-primary font-bold underline">en la sección Rutas</Link>. Aquí van las que recomendamos según con quién vengas.</p>
                <div className="grid gap-4 not-prose">
                    <RouteCard name="PR-A 256: Cerros de Hinojares" level="Media" duration="3-4 h" km="10.5 km"
                        body="Sale del pueblo. Barrancos de tierras rojizas, vistas a la Sierra del Pozo, paisaje subdesértico que sorprende. Forma parte de la red municipal inaugurada en 2022."
                        tip="En verano hay muy poca sombra. Lleva agua, gorra. Descarga el track de Wikiloc antes de salir." />
                    <RouteCard name="Cerrada del Río Castril" level="Fácil" duration="1-1.5 h" km="2.5 km"
                        body="Pasarela colgante de madera anclada al cantil, puente colgante y túnel excavado en la roca. Una de las rutas más impactantes del entorno y accesible para familias."
                        tip="Entrada: 2,50€ adulto, 2€ niño, gratis menores de 3 años. Solo efectivo. Aforo limitado en el puente — paciencia en festivos." />
                    <RouteCard name="Cascada de Guazalamanco" level="Fácil" duration="1-1.5 h" km="3.5 km"
                        body="Arroyo con cascadas y pozas, pasarelas y escaleras de madera. Frescor garantizado en verano y pequeño barranquismo para los que quieren mojarse."
                        tip="Acceso por pista forestal de 6 km, no apta para coches muy bajos. Aparcamiento pequeño — llega temprano." />
                    <RouteCard name="Río Borosa — Cerrada de Elías" level="Media" duration="2-7 h" km="6-22 km"
                        body="La ruta estrella del parque. Pista junto al río Borosa que se estrecha en la Cerrada de Elías: pasarela de madera sobre el río en un cañón de paredes verticales. Versión corta hasta la Cerrada, versión larga hasta la Laguna de Valdeazores."
                        tip="Llegar muy temprano. El aparcamiento del Torre del Vinagre se colapsa en temporada alta." />
                    <RouteCard name="Nacimiento del Guadalquivir y Tejos Milenarios" level="Fácil" duration="1-3 h" km="5 km"
                        body="Cañada de las Fuentes, a 1.350 m de altitud. Llegas al nacimiento simbólico del río y, ampliando, a tejos con más de mil años. Sombra y frescor garantizados en verano."
                        tip="Acceso por la JF-7092, pista asfaltada estrecha. Conducir despacio." />
                    <RouteCard name="Pico Gilillo (1.848 m)" level="Alta" duration="5-7 h" km="14 km"
                        body="Cumbre más alta de la Sierra de Cazorla por la variante desde la carretera del Chorro. Vistas 360º del parque, bosques de pino laricio, paso de manos puntual en el tramo final."
                        tip="Solo senderistas con forma. Mayo-junio y septiembre-octubre. Sin agua en ruta — llévala toda contigo." />
                </div>
                <p className="mt-6 text-secondary">Otras 6 rutas detalladas (Aldea de Cuenca, Río Turrillas, Embalse de la Bolera circular, Tranco del Lobo para expertos, Cueva del Agua de Tíscar, Cerrada del Utrero) las encuentras en <Link to="/rutas" className="text-primary font-bold underline">/rutas</Link>.</p>
            </Section>

            <Section icon={MapIcon} title="Embalse de la Bolera">
                <p>A 15-20 min en coche, en término de Pozo Alcón. Aguas turquesas en el río Guadalentín, rodeado de pinares. Bajo el agua se esconde la cueva sumergida PB-4 (más de 9 km), considerada el verdadero nacimiento del Guadalentín.</p>
                <p><strong>Actividades verificadas</strong>: kayak, canoa, piragua, pádel-surf, hidropedal, pesca con licencia andaluza. La empresa <strong>Aventura Sport</strong> alquila kayaks. El <strong>Camping La Bolera</strong> es base logística. Zonas de baño en El Hoyo de los Pinos y la rampa junto al restaurante del embalse.</p>
                <p className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-secondary text-sm md:text-base"><strong>Pegas reales</strong>: el nivel del agua varía mucho según año hidrológico. En sequía, las rampas quedan altas y secas. Mosquitos al atardecer en zonas de juncos. Viento de tarde en verano levanta oleaje. <strong>Mejor época</strong>: junio y septiembre para baño con menos gente.</p>
            </Section>

            <Section icon={Mountain} title="Castril y su parque natural">
                <p>A 30-40 minutos por la A-326. Pueblo de calles empedradas dominado por el <strong>Peñón de Castril</strong> — al atardecer la luz lateral lo enciende en naranja.</p>
                <p>El plato fuerte es la <strong>Cerrada del Río Castril</strong>: pasarela de madera anclada al cañón, puente colgante y túnel excavado. Empieza desde el casco y baja a la antigua central eléctrica embutida en la roca. Más allá, ya en el <strong>Parque Natural de la Sierra de Castril</strong>, está el nacimiento del río.</p>
                <p><strong>Para comer</strong>: <strong>Restaurante El Peñón</strong>. Cocina local con migas con remojón, maimones (setas con patata, cebolla, ajo y pimentón) y fideos con liebre.</p>
            </Section>

            <Section icon={MapIcon} title="Pueblos cercanos, por qué valen el viaje">
                <ul className="list-none space-y-4 text-secondary">
                    <li><strong className="text-text-primary">Pozo Alcón (~10 min)</strong> — el pueblo grande de servicios. Supermercado, farmacia, gasolinera (no hay otra hasta Cazorla), bares. Base logística para el Bosque Encantado y para todo lo de la Bolera.</li>
                    <li><strong className="text-text-primary">Quesada (~30 min)</strong> — merece medio día. Casco antiguo en ladera, <strong>Museo Rafael Zabaleta</strong> (pintor local importante). La excursión a <strong>Cueva del Agua de Tíscar + Santuario + Castillo de Peñas Negras</strong> está a 14 km del pueblo por la A-6206.</li>
                    <li><strong className="text-text-primary">Huesa (~15 min)</strong> — pequeño, luminoso, margen derecha del Guadiana Menor. Ruta del aceite, almazaras visitables.</li>
                    <li><strong className="text-text-primary">Larva (~25 min)</strong> — balcón entre Sierra Mágina y Cazorla. Subir a Majada Blanquilla (1.144 m) y al mirador de La Cañada.</li>
                    <li><strong className="text-text-primary">Cazorla pueblo (~1 h)</strong> — el grande. Castillo de la Yedra, Plaza de Santa María con las ruinas de Santa María de Gracia (única iglesia europea sobre río embovedado), Balcón de Zabaleta. <strong>Honesto</strong>: saturado en agosto y puentes. Ve entre semana o fuera de temporada.</li>
                </ul>
            </Section>

            <Section icon={UtensilsCrossed} title="Dónde comer y qué pedir">
                <div className="bg-rural-50 rounded-2xl p-5 md:p-6 space-y-4">
                    <div>
                        <h3 className="font-serif text-lg md:text-xl font-bold text-text-primary mb-2">Hotel Valle del Turrilla</h3>
                        <p className="text-xs text-secondary mb-2"><strong>Hinojares</strong> · cazorlatur.com · cocina casera</p>
                        <p className="text-sm md:text-base text-secondary">El restaurante del pueblo. Pilar y Raquel hacen que te sientas en casa. Carta con cocina de aquí con toque actual. En verano, terraza al aire libre. <strong>Reserva siempre</strong>.</p>
                    </div>
                    <div className="pt-4 border-t border-rural-100">
                        <h3 className="font-serif text-lg md:text-xl font-bold text-text-primary mb-2">Bar Casa El Músico</h3>
                        <p className="text-xs text-secondary mb-2"><strong>Pozo Alcón</strong> · Avda. Ntra. Sra. de los Dolores 67 · 953 73 80 80</p>
                        <p className="text-sm md:text-base text-secondary">Cocina serrana clásica, raciones generosas, ambiente animado con música en directo por la noche. <strong>Lo que tienes que pedir</strong>: choto al ajillo, lomo de orza, setas en salsa. Si vais en fin de semana, llegad pronto: se llena.</p>
                    </div>
                    <div className="pt-4 border-t border-rural-100">
                        <h3 className="font-serif text-lg md:text-xl font-bold text-text-primary mb-2">Restaurante El Peñón</h3>
                        <p className="text-xs text-secondary mb-2"><strong>Castril</strong> · restauranteelpenyon.es</p>
                        <p className="text-sm md:text-base text-secondary">Gastronomía local con migas con remojón, maimones (setas con patata, cebolla, ajo y pimentón) y fideos con liebre. Buena parada después de la Cerrada del Río Castril.</p>
                    </div>
                </div>
                <p className="mt-6"><strong>Platos a probar en la zona</strong>: andrajos o talarines (tiras de masa con caldo de caza y menta, plato más identitario), gachamigas, rin-ran (puré frío de patata con bacalao), cordero segureño al horno, ajo hachero (de leñadores), maimones, migas con tropezones de matanza.</p>
                <p>El <strong>cordero segureño</strong> es IGP de la comarca limítrofe. En matanza (invierno), aprovecha para chorizo, morcilla y lomo de orza en aceite.</p>
            </Section>

            <Section icon={Leaf} title="Almazaras: el aceite de aquí">
                <p>Estamos dentro de la <strong>D.O. Sierra de Cazorla</strong> (Picual y Royal — esta última, variedad endémica solo de aquí). Si te interesa el AOVE, estas son las almazaras que conocemos:</p>
                <div className="bg-rural-50 border-l-4 border-primary rounded-r-2xl p-5 md:p-6 my-6">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">⭐ Recomendada para visita</p>
                    <h3 className="font-serif text-xl md:text-2xl font-bold text-text-primary mb-2">Tropicual</h3>
                    <p className="text-sm md:text-base text-secondary mb-3">Cuatro generaciones de familia. Aceite <strong>ecológico</strong> con la variedad Royal endémica. Han ganado 3 medallas de oro en el Japan Olive Oil Prize 2025 y 3 en el NY International 2026. Premio Ecotrama 2024 a mejor pequeño productor. Hacen tours (consultar) y tienen un programa "Apadrina un olivo" que regala unos 6 litros de aceite al año más una casita de pájaros o insectos.</p>
                    <p className="text-sm"><strong>Contacto</strong>: WhatsApp <a href="https://wa.me/34722835778" className="text-primary font-bold">+34 722 835 778</a> · Instagram <a href="https://instagram.com/tropicual_evoo" target="_blank" rel="noopener noreferrer" className="text-primary font-bold">@tropicual_evoo</a></p>
                </div>
                <p>Otras almazaras de la zona (todas en Pozo Alcón): <strong>Aceites Picón Hernández</strong> (familiar, producción integrada), <strong>Almazara La Andaluza</strong> (marca "El Nono"), <strong>Cooperativa San Isidro</strong>, <strong>Aceites La Ñora</strong>, <strong>Caserío de Pozo Alcón</strong> y la <strong>Cooperativa de Regantes de Pozo Alcón e Hinojares</strong>.</p>
            </Section>

            <Section icon={Calendar} title="Calendario de fiestas">
                <div className="grid gap-3 text-secondary">
                    <p><strong className="text-text-primary">2 febrero — Candelaria</strong>: hogueras al toque de campana en Hinojares (procesión con palomas) y en Pozo Alcón (Virgen de Belén).</p>
                    <p><strong className="text-text-primary">25 abril — San Marcos (Hinojares)</strong>: patrón. Procesión con el santo portando un pan. El ayuntamiento reparte las <strong>tortas redondas tradicionales</strong> entre vecinos y forasteros — ritual comunitario centenario. <strong>Las tortas solo se dan ese día</strong>, no se venden, no se encargan.</p>
                    <p><strong className="text-text-primary">1er sábado de mayo — Traída de la Virgen de Tíscar</strong>: la Virgen baja en peregrinación desde su Santuario hasta Quesada (14 km), donde se queda hasta finales de agosto.</p>
                    <p><strong className="text-text-primary">9 mayo — Romería de San Gregorio (Pozo Alcón)</strong>.</p>
                    <p><strong className="text-text-primary">25-30 julio — Santa Ana (Pozo Alcón)</strong>: feria mayor con verbenas y juegos.</p>
                    <p><strong className="text-text-primary">21-23 agosto — Santísimo Cristo del Perdón (Hinojares)</strong>: fiestas patronales de verano.</p>
                    <p><strong className="text-text-primary">29 agosto — Subida de la Virgen de Tíscar</strong>: al amanecer, procesión desde Quesada hasta la cruz del Humilladero. Despedida emotiva.</p>
                    <p><strong className="text-text-primary">1er domingo de septiembre — Romería de la Virgen de Tíscar</strong>: una de las romerías más concurridas de Andalucía, ~15.000 personas en el santuario.</p>
                    <p><strong className="text-text-primary">7 diciembre — Fiesta de la Viva (Pozo Alcón)</strong>: víspera de la Inmaculada.</p>
                </div>
            </Section>

            <Section icon={Leaf} title="Naturaleza y vida salvaje">
                <p>El Parque Natural más grande de España (210.000 hectáreas). Fauna estable:</p>
                <ul className="list-disc pl-6 space-y-1 text-secondary">
                    <li><strong>Cabra montés</strong> (Capra pyrenaica hispanica) en zonas escarpadas, fácil al amanecer.</li>
                    <li><strong>Buitre leonado</strong> con colonias estables en los cortados — la Ruta de los Cortados del Chorro es punto fiable.</li>
                    <li><strong>Quebrantahuesos</strong> reintroducido.</li>
                    <li><strong>Ciervo, gamo, muflón</strong> observables en semilibertad en el Parque Cinegético Collado del Almendral.</li>
                    <li><strong>Águila real, búho real, halcón peregrino</strong>.</li>
                </ul>
                <p><strong>Berrea del ciervo</strong>: finales de septiembre y primera quincena de octubre. Máxima actividad al amanecer y atardecer. Es uno de los espectáculos naturales del año.</p>
                <p><strong>Cielo nocturno</strong>: el Valle del Guadiana Menor tiene muy poca contaminación lumínica. La Vía Láctea se ve a ojo desnudo en noches sin luna. Mejor en luna nueva entre junio y septiembre.</p>
            </Section>

            <Section icon={Sparkles} title="Secretos y consejos prácticos">
                <ul className="space-y-3 text-secondary">
                    <li><strong className="text-text-primary">El Peñón de Castril al atardecer</strong>: 30 min antes del ocaso, desde el mirador del pueblo. La luz lateral lo enciende en naranja.</li>
                    <li><strong className="text-text-primary">Tíscar al amanecer</strong>: pocos visitantes, luz frontal sobre el castillo de Peñas Negras.</li>
                    <li><strong className="text-text-primary">Bosque Encantado de Higueras</strong>: ir entre semana fuera de agosto. Fines de semana de julio/agosto se llena.</li>
                    <li><strong className="text-text-primary">Cerrada de Castril</strong>: aparcamiento del pueblo se satura. Bajar antes de las 11 h o aparcar fuera y caminar.</li>
                    <li><strong className="text-text-primary">Aviso GPS</strong>: Google Maps en esta zona a veces propone <strong>pistas forestales</strong> entre Pozo Alcón–Hinojares y entre Quesada–Tíscar–Pozo Alcón. Quédate en las A-326, A-315, A-319 y A-6206. Las pistas concretas las conoce el lugareño.</li>
                    <li><strong className="text-text-primary">Cobertura móvil</strong>: irregular en el Valle del Guadalentín y en el Embalse de la Bolera (sombras de antena). Cazorla, Pozo Alcón y Castril casco tienen buena cobertura.</li>
                    <li><strong className="text-text-primary">Gasolina</strong>: gasolinera más cercana fiable es Pozo Alcón. No esperes a Hinojares ni a aldeas.</li>
                    <li><strong className="text-text-primary">A-319 Pozo Alcón–Tranco</strong>: curvas espectaculares en el tramo del puerto, hermosas para conducir despacio. <strong>Inviables con remolque o conductor novel</strong> en otoño-invierno (hielo en sombras).</li>
                </ul>
            </Section>

            <Section icon={Calendar} title="Mejor época para qué">
                <div className="grid gap-4 text-secondary">
                    <div>
                        <p className="font-serif font-bold text-text-primary mb-1">🌸 Primavera (marzo-mayo)</p>
                        <p>La estación reina aquí. Cerrada de Castril con caudal alto, rutas de Hinojares con flor, San Marcos el 25 de abril, fotografía. Evita Semana Santa si quieres tranquilidad: Cazorla se satura.</p>
                    </div>
                    <div>
                        <p className="font-serif font-bold text-text-primary mb-1">☀️ Verano (junio-septiembre)</p>
                        <p>Embalse de la Bolera (kayak y baño), Bosque Encantado (sombra), fiestas patronales (Santa Ana en Pozo Alcón a final de julio, Cristo del Perdón en Hinojares 21-23 ago), observación estelar. Evita caminar a mediodía (40 °C en el valle) y Cazorla pueblo en agosto.</p>
                    </div>
                    <div>
                        <p className="font-serif font-bold text-text-primary mb-1">🍂 Otoño (octubre-noviembre)</p>
                        <p>La joya escondida. Berrea del ciervo en la primera quincena de octubre, setas y caza en mesa, colores en los pinares de la Sierra del Pozo, rutas largas con temperatura ideal. Evita pasarelas tras lluvias fuertes (resbalan).</p>
                    </div>
                    <div>
                        <p className="font-serif font-bold text-text-primary mb-1">❄️ Invierno (diciembre-febrero)</p>
                        <p>Chimenea, gastronomía de matanza, Candelaria el 2 de febrero con sus hogueras, nieve ocasional en cumbres. Evita la A-319 al puerto con hielo y excursiones tarde — anochece a las 18:00.</p>
                    </div>
                </div>
            </Section>

            {/* Cierre */}
            <section className="bg-primary text-white rounded-3xl p-8 md:p-12 text-center mt-16 md:mt-20">
                <h2 className="font-serif text-2xl md:text-4xl font-bold mb-4">¿Quieres vivirlo?</h2>
                <p className="text-white/90 mb-8 max-w-xl mx-auto">Mari Carmen y Jesús te esperan en Hinojares. Cuatro apartamentos con alma en una casona del siglo XVII.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/#apartamentos" className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-white text-primary rounded-full font-bold shadow-lg hover:-translate-y-0.5 transition-transform">
                        Ver disponibilidad
                    </Link>
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary-dark border border-white/30 text-white rounded-full font-bold hover:bg-white/10 transition-colors">
                        <Phone size={16} /> Pregúntanos por WhatsApp
                    </a>
                </div>
                <p className="text-xs text-white/60 mt-8">Guía escrita y mantenida por la familia de Apartamentos Tío José María. Si encuentras algo desactualizado, <a href={whatsappLink('Hola, una correccion para la guia de Cazorla:')} className="underline">avísanos</a>.</p>
            </section>
        </main>
    </div>
);

export default GuiaCazorla;

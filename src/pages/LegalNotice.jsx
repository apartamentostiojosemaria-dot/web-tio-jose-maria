import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PageHead from '../components/seo/PageHead';

const LegalNotice = () => (
    <div className="min-h-screen bg-white">
        <PageHead
            title="Aviso Legal"
            description="Aviso legal de Apartamentos Rurales Tío José María. Información del prestador, condiciones de uso, propiedad intelectual y normativa aplicable conforme a la LSSI-CE."
            path="/aviso-legal"
            noindex={false}
        />
        <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
            <div className="max-w-4xl mx-auto flex items-center">
                <Link to="/" className="flex items-center gap-2 text-rural-700 font-bold hover:gap-3 transition-all">
                    <ChevronLeft size={20} aria-hidden="true" /> Volver
                </Link>
            </div>
        </nav>

        <main className="pt-24 pb-20 px-6">
            <div className="max-w-4xl mx-auto prose prose-gray">
                <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2 text-text-primary">Aviso Legal</h1>
                <p className="text-sm text-gray-400 mb-10">Última actualización: 21 de junio de 2026</p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">1. Identificación del prestador del servicio</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    En cumplimiento de lo dispuesto en el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la
                    Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los siguientes datos del
                    titular de este sitio web:
                </p>
                <ul className="text-gray-700 leading-relaxed mb-6 list-disc pl-6">
                    <li><strong>Denominación:</strong> Apartamentos Rurales Tío José María</li>
                    <li><strong>Domicilio:</strong> Calle Baja 1, 23486 Hinojares, Jaén (España)</li>
                    <li><strong>Teléfono:</strong> +34 676 34 46 75</li>
                    <li><strong>Email:</strong> info@tiojosemaria.com</li>
                    <li>
                        <strong>Inscripción turística:</strong> Vivienda Turística de Alojamiento Rural inscrita en el
                        Registro de Turismo de Andalucía con código <strong>VTAR/JA/00044</strong>.
                    </li>
                    <li><strong>NIF:</strong> 26433801Q</li>
                </ul>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">2. Objeto y ámbito</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Este sitio web tiene por objeto presentar los apartamentos rurales gestionados por el titular y permitir
                    la reserva de los mismos, la consulta de información del entorno (Hinojares y Sierra de Cazorla) y la
                    comunicación con los huéspedes a través del área de cliente.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">3. Condiciones de uso</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    El acceso al sitio es gratuito. La utilización del sitio implica la aceptación plena de las presentes
                    condiciones. El usuario se compromete a hacer un uso adecuado de los contenidos y servicios, y a no
                    emplearlos para incurrir en actividades ilícitas, lesivas de derechos o intereses de terceros, ni a
                    causar daños al sitio o a su normal funcionamiento.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">4. Propiedad intelectual e industrial</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Todos los contenidos del sitio (textos, fotografías, gráficos, imágenes, iconos, tecnología, software,
                    nombres comerciales, marcas o cualquier otro signo distintivo) son propiedad del titular o de sus
                    licenciantes. Queda prohibida cualquier reproducción, distribución o comunicación pública sin
                    autorización expresa y por escrito.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">5. Enlaces a terceros</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    El sitio puede contener enlaces a webs de terceros (mapas, redes sociales, plataformas de reserva).
                    El titular no se responsabiliza del contenido, prácticas o políticas de privacidad de dichos sitios.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">6. Protección de datos</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    El tratamiento de datos personales recogidos a través de este sitio se rige por la{' '}
                    <Link to="/privacidad" className="underline text-rural-700">Política de Privacidad</Link>, conforme al
                    Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos
                    Personales y garantía de los derechos digitales (LOPDGDD).
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">7. Sistemas de inteligencia artificial</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Conforme al artículo 50 del Reglamento (UE) 2024/1689 (AI Act), informamos de que algunas interacciones
                    automatizadas de este sitio (por ejemplo, el asistente de ayuda al huésped, cuando esté disponible)
                    están basadas en modelos de inteligencia artificial. El usuario será informado de manera clara cuando
                    interactúe con un sistema de IA, y en ningún caso dichas interacciones sustituyen la responsabilidad
                    del titular respecto a los datos generados o las decisiones tomadas.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">8. Hojas de reclamaciones</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    El establecimiento dispone de hojas de reclamaciones a disposición de los usuarios. Pueden solicitarse
                    en el alojamiento o presentarse de forma electrónica a través de la Consejería de Turismo de la Junta
                    de Andalucía:{' '}
                    <a
                        href="https://www.juntadeandalucia.es/organismos/turismoculturayeducacion/areas/turismo/calidad/hojas-reclamaciones.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-rural-700"
                    >
                        Hojas de reclamaciones — Junta de Andalucía
                    </a>.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">9. Resolución de litigios en línea</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    De conformidad con el Reglamento (UE) 524/2013, se informa al usuario de la existencia de una plataforma
                    de resolución de litigios en línea de la Comisión Europea:{' '}
                    <a
                        href="https://ec.europa.eu/consumers/odr/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-rural-700"
                    >
                        ec.europa.eu/consumers/odr
                    </a>.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">10. Legislación aplicable y jurisdicción</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Las presentes condiciones se rigen por la legislación española. Para la resolución de cualquier
                    controversia, las partes se someten a los Juzgados y Tribunales del domicilio del usuario, sin
                    perjuicio de la normativa de consumo aplicable.
                </p>
            </div>
        </main>
    </div>
);

export default LegalNotice;

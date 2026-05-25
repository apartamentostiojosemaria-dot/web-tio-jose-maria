import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PageHead from '../components/seo/PageHead';

const PrivacyPolicy = () => (
    <div className="min-h-screen bg-white">
        <PageHead
            title="Política de Privacidad"
            description="Política de privacidad de Apartamentos Rurales Tío José María. Información sobre el tratamiento de datos personales, cookies y derechos del usuario."
            path="/privacidad"
        />
        <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
            <div className="max-w-4xl mx-auto flex items-center">
                <Link to="/" className="flex items-center gap-2 text-rural-700 font-bold hover:gap-3 transition-all">
                    <ChevronLeft size={20} /> Volver
                </Link>
            </div>
        </nav>

        <main className="pt-24 pb-20 px-6">
            <div className="max-w-4xl mx-auto prose prose-gray">
                <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2 text-text-primary">
                    Política de Privacidad
                </h1>
                <p className="text-sm text-gray-400 mb-10">Última actualización: 28 de marzo de 2026</p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">1. Responsable del tratamiento</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                    <strong>Apartamentos Rurales Tío José María</strong><br />
                    Calle Baja 1, 23486 Hinojares, Jaén (España)<br />
                    Email: info@tiojosemaria.com<br />
                    Teléfono: 676 34 46 75<br />
                    Registro: VTAR/JA/00044
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">2. Datos que recopilamos</h2>
                <p className="text-gray-600 leading-relaxed mb-2">Recopilamos los siguientes datos personales:</p>
                <ul className="text-gray-600 space-y-1 mb-4 list-disc pl-6">
                    <li><strong>Formulario de suscripción:</strong> dirección de correo electrónico.</li>
                    <li><strong>Área de clientes:</strong> nombre, email, teléfono, dirección, número de acompañantes.</li>
                    <li><strong>Reservas:</strong> fechas de entrada/salida, apartamento reservado.</li>
                </ul>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">3. Finalidad del tratamiento</h2>
                <ul className="text-gray-600 space-y-1 mb-4 list-disc pl-6">
                    <li>Gestión de reservas y comunicación con los huéspedes.</li>
                    <li>Envío de la guía exclusiva de la zona a suscriptores.</li>
                    <li>Acceso al área privada de clientes durante la estancia.</li>
                    <li>Cumplimiento de obligaciones legales (registro de viajeros).</li>
                </ul>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">4. Base legal</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                    El tratamiento se basa en: (a) el consentimiento del usuario al suscribirse o registrarse; (b) la ejecución del contrato de alojamiento; (c) el cumplimiento de obligaciones legales aplicables al sector turístico.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">5. Conservación de datos</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                    Los datos de suscripción se conservan hasta que el usuario solicite su eliminación. Los datos de reservas se conservan durante el período legalmente exigido (5 años).
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">6. Destinatarios</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                    Los datos no se ceden a terceros salvo obligación legal. Utilizamos Supabase como proveedor de alojamiento de datos, con servidores en la UE.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">7. Derechos del usuario</h2>
                <p className="text-gray-600 leading-relaxed mb-2">Puedes ejercer tus derechos de:</p>
                <ul className="text-gray-600 space-y-1 mb-4 list-disc pl-6">
                    <li>Acceso, rectificación, supresión y portabilidad de tus datos.</li>
                    <li>Limitación u oposición al tratamiento.</li>
                    <li>Retirar el consentimiento en cualquier momento.</li>
                </ul>
                <p className="text-gray-600 leading-relaxed mb-4">
                    Para ejercer estos derechos, contacta con nosotros en <a href="mailto:info@tiojosemaria.com" className="underline text-primary">info@tiojosemaria.com</a>. También puedes presentar una reclamación ante la <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="underline text-primary">Agencia Española de Protección de Datos</a>.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">8. Cookies</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                    Este sitio web utiliza únicamente cookies técnicas necesarias para el funcionamiento de la autenticación de usuarios. No utilizamos cookies de seguimiento, publicidad ni analíticas de terceros.
                </p>
            </div>
        </main>
    </div>
);

export default PrivacyPolicy;

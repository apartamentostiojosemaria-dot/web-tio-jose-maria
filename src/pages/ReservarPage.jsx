import { Link } from 'react-router-dom';
import { ChevronLeft, MessageCircle, Phone, Shield } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { whatsappLink, WHATSAPP_URL } from '../constants/urls';

// Si está configurada la URL del motor MisterPlan en env, se muestra como
// iframe responsive. Si no, se muestra un placeholder con CTAs alternativas.
// Cuando llegue la URL final solo hay que poner VITE_BOOKING_ENGINE_URL y
// VITE_BOOKING_ENGINE_HEIGHT (opcional) en el .env y redeploy.
const BOOKING_URL = import.meta.env.VITE_BOOKING_ENGINE_URL;
const BOOKING_HEIGHT = import.meta.env.VITE_BOOKING_ENGINE_HEIGHT || '900';

const ReservarPage = () => (
    <div className="min-h-screen bg-white">
        <PageHead
            title="Reservar — Apartamentos Tío José María"
            description="Reserva directa sin comisiones de intermediarios para los apartamentos rurales Tío José María en Hinojares, Sierra de Cazorla. Elige fechas, comprueba disponibilidad y reserva al instante."
            path="/reservar"
        />

        <nav className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-100 px-6 py-4">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2 text-rural-700 font-bold hover:gap-3 transition-all">
                    <ChevronLeft size={20} aria-hidden="true" /> Volver
                </Link>
                <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                        <Shield size={14} aria-hidden="true" className="text-rural-700" />
                        Pago seguro
                    </span>
                    <span>·</span>
                    <span>Sin comisiones</span>
                    <span>·</span>
                    <span>VTAR/JA/00044</span>
                </div>
            </div>
        </nav>

        <main className="pt-24 pb-16 px-4 md:px-6">
            <div className="max-w-5xl mx-auto">
                <header className="text-center mb-10 max-w-3xl mx-auto">
                    <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Reserva directa</span>
                    <h1 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-4 text-text-primary">
                        Comprueba disponibilidad y reserva
                    </h1>
                    <p className="text-gray-600 leading-relaxed">
                        Sin comisiones de intermediarios. Confirmación al instante, pago seguro con tarjeta o transferencia, y atención personal por WhatsApp si surge cualquier duda.
                    </p>
                </header>

                {BOOKING_URL ? (
                    <div className="rounded-3xl overflow-hidden border border-gray-100 shadow-xl bg-rural-50">
                        <iframe
                            src={BOOKING_URL}
                            title="Motor de reservas Apartamentos Tío José María"
                            className="w-full block bg-white"
                            style={{ height: `${BOOKING_HEIGHT}px`, border: 0 }}
                            loading="lazy"
                            allow="payment; clipboard-write"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>
                ) : (
                    <BookingPlaceholder />
                )}

                <p className="mt-8 text-center text-sm text-gray-500 max-w-2xl mx-auto">
                    Al iniciar la reserva aceptas la{' '}
                    <Link to="/privacidad" className="underline text-rural-700">política de privacidad</Link>{' '}
                    y las condiciones del{' '}
                    <Link to="/aviso-legal" className="underline text-rural-700">aviso legal</Link>.
                </p>
            </div>
        </main>
    </div>
);

const BookingPlaceholder = () => (
    <div className="rounded-3xl border border-gray-100 shadow-xl bg-gradient-to-br from-rural-50 to-white p-10 md:p-14 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-rural-100 flex items-center justify-center text-rural-700">
            <Phone size={28} aria-hidden="true" />
        </div>
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-3">
            Hablemos directamente
        </h2>
        <p className="text-gray-600 leading-relaxed mb-8 max-w-xl mx-auto">
            El motor de reservas online está terminándose de configurar. Mientras tanto, cuéntanos por WhatsApp qué fechas tienes en mente y te confirmamos disponibilidad y precio en el momento — sin compromiso, sin comisiones.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <a
                href={whatsappLink('Hola, me gustaría reservar en Tío José María. Estoy mirando estas fechas:')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-white bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
                <MessageCircle size={18} aria-hidden="true" /> Escribir por WhatsApp
            </a>
            <a
                href="tel:+34676344675"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold border-2 border-primary text-primary hover:-translate-y-0.5 transition-all"
            >
                <Phone size={18} aria-hidden="true" /> Llamar: 676 34 46 75
            </a>
        </div>

        <p className="text-xs text-gray-400 max-w-md mx-auto">
            Respuesta media en menos de 1 hora durante horario diurno (Hinojares, España). Aceptamos reservas de hasta 4 personas por apartamento.
        </p>
    </div>
);

export default ReservarPage;

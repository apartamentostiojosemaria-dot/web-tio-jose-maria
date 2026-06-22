import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Calendar, Users, Search, Shield, MessageCircle, Phone } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { whatsappLink } from '../constants/urls';

// Página /reservar — esqueleto del motor de reservas PROPIO.
// =============================================================
// Este es el front-end de la futura experiencia de reserva. La lógica de
// disponibilidad, precios y pago se construye en Sprints 5-9 (motor propio,
// SES.HOSPEDAJES, Verifactu, channel manager).
//
// Mientras la lógica no esté: el formulario captura la intención y la
// redirige a WhatsApp con un mensaje pre-rellenado. NO usamos MisterPlan.

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

const ReservarPage = () => {
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [guests, setGuests] = useState(2);

    const onSubmit = (e) => {
        e.preventDefault();
        // Sprint 5: aquí irá la búsqueda real contra Supabase (availability + pricing).
        // Hoy redirigimos a WhatsApp con el mensaje pre-rellenado.
        const msg = [
            `Hola, quiero reservar en Tío José María.`,
            checkIn ? `Entrada: ${checkIn}` : null,
            checkOut ? `Salida: ${checkOut}` : null,
            `Personas: ${guests}`,
        ].filter(Boolean).join('. ');
        window.open(whatsappLink(msg), '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="min-h-screen bg-white">
            <PageHead
                title="Reservar — Apartamentos Tío José María"
                description="Reserva directa sin intermediarios para los apartamentos rurales Tío José María en Hinojares, Sierra de Cazorla. Elige fechas, comprueba disponibilidad y reserva al instante."
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
                        <span aria-hidden="true">·</span>
                        <span>Sin intermediarios</span>
                        <span aria-hidden="true">·</span>
                        <span>VTAR/JA/00044</span>
                    </div>
                </div>
            </nav>

            <main className="pt-24 pb-16 px-4 md:px-6">
                <div className="max-w-3xl mx-auto">
                    <header className="text-center mb-10">
                        <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">Reserva directa</span>
                        <h1 className="font-serif text-3xl md:text-5xl font-bold mt-3 mb-4 text-text-primary">
                            Comprueba disponibilidad
                        </h1>
                        <p className="text-gray-600 leading-relaxed max-w-xl mx-auto">
                            Elige fechas y número de personas. Te confirmamos qué apartamento encaja, el precio total y los siguientes pasos.
                        </p>
                    </header>

                    <form
                        onSubmit={onSubmit}
                        className="bg-gradient-to-br from-rural-50 to-white rounded-3xl border border-gray-100 shadow-xl p-6 md:p-10"
                    >
                        <div className="grid sm:grid-cols-2 gap-4 mb-4">
                            <Field
                                icon={Calendar}
                                label="Entrada"
                                input={
                                    <input
                                        type="date"
                                        required
                                        min={today()}
                                        value={checkIn}
                                        onChange={(e) => setCheckIn(e.target.value)}
                                        aria-label="Fecha de entrada"
                                        className="w-full bg-transparent outline-none text-text-primary font-medium"
                                    />
                                }
                            />
                            <Field
                                icon={Calendar}
                                label="Salida"
                                input={
                                    <input
                                        type="date"
                                        required
                                        min={checkIn || tomorrow()}
                                        value={checkOut}
                                        onChange={(e) => setCheckOut(e.target.value)}
                                        aria-label="Fecha de salida"
                                        className="w-full bg-transparent outline-none text-text-primary font-medium"
                                    />
                                }
                            />
                        </div>

                        <Field
                            icon={Users}
                            label="Personas"
                            input={
                                <select
                                    value={guests}
                                    onChange={(e) => setGuests(Number(e.target.value))}
                                    aria-label="Número de personas"
                                    className="w-full bg-transparent outline-none text-text-primary font-medium appearance-none cursor-pointer"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                        <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>
                                    ))}
                                </select>
                            }
                        />

                        <button
                            type="submit"
                            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-white bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                        >
                            <Search size={18} aria-hidden="true" /> Comprobar disponibilidad
                        </button>

                        <p className="mt-4 text-xs text-center text-gray-500">
                            Aún estamos puliendo el flujo completo de reserva online. Al pulsar "Comprobar disponibilidad" se abrirá WhatsApp con tus datos para confirmarte al momento. Sin compromiso.
                        </p>
                    </form>

                    {/* Alternativas */}
                    <section className="mt-10 grid sm:grid-cols-2 gap-3" aria-label="Otras formas de contactar">
                        <a
                            href={whatsappLink('Hola, me gustaría reservar en Tío José María.')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="w-10 h-10 rounded-full bg-rural-100 flex items-center justify-center text-rural-700">
                                <MessageCircle size={18} aria-hidden="true" />
                            </div>
                            <div>
                                <p className="font-bold text-text-primary">WhatsApp</p>
                                <p className="text-xs text-gray-500">Respuesta en menos de 1 h</p>
                            </div>
                        </a>
                        <a
                            href="tel:+34676344675"
                            className="flex items-center gap-3 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="w-10 h-10 rounded-full bg-rural-100 flex items-center justify-center text-rural-700">
                                <Phone size={18} aria-hidden="true" />
                            </div>
                            <div>
                                <p className="font-bold text-text-primary">676 34 46 75</p>
                                <p className="text-xs text-gray-500">Llamada directa</p>
                            </div>
                        </a>
                    </section>

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
};

const Field = ({ icon: Icon, label, input }) => (
    <label className="block bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:border-rural-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all cursor-pointer">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            <Icon size={12} aria-hidden="true" /> {label}
        </span>
        {input}
    </label>
);

export default ReservarPage;

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ArrowLeft, Mail, MessageCircle } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { supabase } from '../lib/supabase';
import { whatsappLink } from '../constants/urls';

const formatPrice = (p) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(p));

const ReservaConfirmada = () => {
    const [params] = useSearchParams();
    const code = (params.get('code') || '').toUpperCase();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) { setError('Código no válido'); setLoading(false); return; }

        // Polling corto: el webhook tarda 1-3 segundos en marcar confirmed
        const tries = [0, 1500, 3000, 5000, 8000];
        const attempt = async (i = 0) => {
            const { data, error: err } = await supabase
                .from('guest_bookings')
                .select('booking_code, status, payment_status, total_price, check_in, check_out, guest_name, apartments(name)')
                .eq('booking_code', code)
                .maybeSingle();
            if (cancelled) return;
            if (err) { setError(err.message); setLoading(false); return; }
            if (data && data.status === 'confirmed') { setBooking(data); setLoading(false); return; }
            if (i < tries.length - 1) {
                setTimeout(() => attempt(i + 1), tries[i + 1]);
            } else {
                // Aun no confirmada pero el pago debe ir bien — mostramos lo que tengamos
                setBooking(data || null);
                setLoading(false);
            }
        };
        attempt(0);
        return () => { cancelled = true; };
    }, [code]);

    return (
        <div className="min-h-screen bg-white">
            <PageHead
                title="Reserva confirmada — Tío José María"
                description="Tu reserva está confirmada."
                path="/reservar/confirmada"
                noindex
            />

            <nav className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-100 px-6 py-4">
                <div className="max-w-3xl mx-auto">
                    <Link to="/" className="flex items-center gap-2 text-rural-700 font-bold hover:gap-3 transition-all">
                        <ArrowLeft size={18} aria-hidden="true" /> Volver al inicio
                    </Link>
                </div>
            </nav>

            <main className="pt-24 pb-16 px-4 md:px-6">
                <div className="max-w-2xl mx-auto">
                    {loading ? (
                        <p className="text-center text-gray-500 font-serif italic py-20">Confirmando tu reserva…</p>
                    ) : error ? (
                        <ErrorBox message={error} />
                    ) : !booking ? (
                        <ErrorBox message={`No encontramos la reserva ${code}. Si has pagado y ves este mensaje, escríbenos por WhatsApp con tu código.`} code={code} />
                    ) : booking.status === 'confirmed' ? (
                        <Confirmed booking={booking} />
                    ) : (
                        <PendingBox booking={booking} />
                    )}
                </div>
            </main>
        </div>
    );
};

const Confirmed = ({ booking }) => {
    const aptName = booking.apartments?.name || 'tu apartamento';
    return (
        <div className="bg-gradient-to-br from-rural-50 to-white rounded-3xl border border-gray-100 shadow-xl p-8 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-rural-700 flex items-center justify-center text-white">
                <Check size={28} aria-hidden="true" />
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-text-primary mb-3">Reserva confirmada</h1>
            <p className="text-gray-700 mb-6 leading-relaxed">
                Hola {booking.guest_name?.split(' ')[0]}, tu reserva en <strong>{aptName}</strong> está confirmada. Te hemos enviado los detalles a tu email.
            </p>

            <dl className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 grid grid-cols-2 gap-y-3 gap-x-4 text-left text-sm">
                <dt className="text-gray-500 font-medium">Código</dt>
                <dd className="font-mono font-bold text-primary text-right">{booking.booking_code}</dd>
                <dt className="text-gray-500 font-medium">Apartamento</dt>
                <dd className="text-text-primary font-bold text-right">{aptName}</dd>
                <dt className="text-gray-500 font-medium">Entrada</dt>
                <dd className="text-text-primary text-right">{booking.check_in}</dd>
                <dt className="text-gray-500 font-medium">Salida</dt>
                <dd className="text-text-primary text-right">{booking.check_out}</dd>
                <dt className="text-gray-500 font-medium">Total pagado</dt>
                <dd className="text-text-primary font-bold text-right">{formatPrice(booking.total_price)}</dd>
            </dl>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                Unos días antes de la entrada te enviaremos las instrucciones de llegada y el formulario de precheckin. Si necesitas cualquier cosa, escríbenos.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href={whatsappLink(`Hola, soy ${booking.guest_name}, mi reserva es ${booking.booking_code}.`)}
                   target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-white bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    <MessageCircle size={18} aria-hidden="true" /> Escribirnos
                </a>
                <Link to="/hinojares" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold border-2 border-primary text-primary hover:-translate-y-0.5 transition-all">
                    Conocer Hinojares
                </Link>
            </div>
        </div>
    );
};

const PendingBox = ({ booking }) => (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 md:p-12 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Mail size={22} aria-hidden="true" />
        </div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-3">Estamos confirmando tu reserva…</h1>
        <p className="text-gray-700 mb-6 leading-relaxed">
            Hemos recibido tu pago. Estamos terminando de confirmar la reserva <strong className="font-mono">{booking.booking_code}</strong>. Suele tardar menos de un minuto. Recarga esta página en breve o escríbenos por WhatsApp si te quedas con la duda.
        </p>
        <a href={whatsappLink(`Hola, estoy esperando confirmación de la reserva ${booking.booking_code}.`)}
           target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-white bg-primary shadow-lg hover:shadow-xl">
            <MessageCircle size={18} aria-hidden="true" /> Escribirnos
        </a>
    </div>
);

const ErrorBox = ({ message, code }) => (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 md:p-12 text-center">
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-3">Algo ha ido raro</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <a href={whatsappLink(code ? `Hola, tengo dudas con mi reserva ${code}.` : 'Hola, tengo dudas con una reserva online.')}
           target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-white bg-primary shadow-lg hover:shadow-xl">
            <MessageCircle size={18} aria-hidden="true" /> Escribirnos por WhatsApp
        </a>
    </div>
);

export default ReservaConfirmada;

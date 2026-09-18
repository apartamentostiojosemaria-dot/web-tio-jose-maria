import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { supabase } from '../lib/supabase';
import { whatsappLink } from '../constants/urls';

const ReservaConfirmada = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const code = (params.get('code') || '').toUpperCase();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Después del pago, Stripe manda aquí. El webhook tarda 1-3 s en marcar la
    // reserva como confirmada; se pregunta unas veces a la función pública
    // (tjm_ficha_huesped: sin sesión no se puede leer la tabla) y, en cuanto
    // está confirmada, se va a la ficha del huésped, que es donde vive todo.
    useEffect(() => {
        let cancelled = false;
        if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) { setError('Código no válido'); setLoading(false); return; }

        const tries = [0, 1500, 3000, 5000, 8000];
        const attempt = async (i = 0) => {
            const { data, error: err } = await supabase.rpc('tjm_ficha_huesped', { p_booking_code: code });
            if (cancelled) return;
            if (err) { setError(err.message); setLoading(false); return; }
            if (data?.ventana === 'abierta') { navigate(`/guia/${code}`, { replace: true }); return; }
            if (data?.ventana === 'sin_confirmar' && i < tries.length - 1) {
                setTimeout(() => attempt(i + 1), tries[i + 1]);
                return;
            }
            setBooking(data || null);
            setLoading(false);
        };
        attempt(0);
        return () => { cancelled = true; };
    }, [code, navigate]);

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
                    ) : booking?.ventana === 'sin_confirmar' ? (
                        <PendingBox booking={{ booking_code: code }} />
                    ) : booking?.ventana === 'cancelada' ? (
                        <ErrorBox message={`La reserva ${code} está cancelada. Si crees que es un error, escríbenos por WhatsApp.`} code={code} />
                    ) : (
                        <ErrorBox message={`No encontramos la reserva ${code}. Si has pagado y ves este mensaje, escríbenos por WhatsApp con tu código.`} code={code} />
                    )}
                </div>
            </main>
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

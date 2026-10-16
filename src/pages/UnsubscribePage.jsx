import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';

// Página de baja accesible vía enlace de pie de email de marketing/reseñas.
// El token es opaco (16 bytes hex) y solo sirve para identificar al cliente.
// purpose: 'marketing' o 'review'

const UnsubscribePage = () => {
    const [params] = useSearchParams();
    const token = params.get('token');
    const purpose = params.get('purpose') || 'marketing';

    const [status, setStatus] = useState('loading');  // loading | ready | done | error
    const [customer, setCustomer] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        (async () => {
            if (!token) { setStatus('error'); setError('Enlace inválido.'); return; }
            // customers is not readable by anon: the token is checked server-side.
            const { data, error } = await supabase.rpc('tjm_baja_leer', { p_token: token });
            if (error || !data) {
                setStatus('error');
                setError('No hemos podido identificar tu cuenta. El enlace puede estar caducado.');
                return;
            }
            setCustomer(data);
            setStatus('ready');
        })();
    }, [token]);

    const confirm = async () => {
        if (!customer) return;
        setStatus('loading');
        try {
            const { data: ok, error: err } = await supabase.rpc('tjm_baja_confirmar', {
                p_token: token,
                p_purpose: purpose === 'marketing' ? 'marketing' : 'review',
                p_user_agent: navigator.userAgent,
            });
            if (err || !ok) throw err || new Error('baja no aplicada');
            setStatus('done');
        } catch (e) {
            setStatus('error');
            setError('No hemos podido procesar la baja. Escríbenos por email y lo hacemos manualmente.');
        }
    };

    const purposeText = purpose === 'marketing' ? 'promociones y novedades' : 'peticiones de reseña';

    return (
        <div className="min-h-screen bg-rural-50/40 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-3xl border border-gray-100 shadow-lg p-8">
                <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck size={22} className="text-rural-700" />
                    <h1 className="font-serif text-2xl font-bold text-text-primary">Gestionar suscripción</h1>
                </div>

                {status === 'loading' && (
                    <div className="flex items-center gap-2 text-gray-500 py-8">
                        <Loader2 className="animate-spin" size={16} /> <span>Cargando…</span>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-4 flex gap-2">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <p>{error}</p>
                    </div>
                )}

                {status === 'ready' && customer && (
                    <>
                        <p className="text-sm text-gray-700 mb-3">
                            Cuenta: <strong>{customer.email}</strong>
                        </p>
                        <p className="text-sm text-gray-700 mb-5 leading-relaxed">
                            Estás a punto de darte de baja de los emails de <strong>{purposeText}</strong> de Apartamentos Rurales Tío José María.
                        </p>
                        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                            Los emails operativos de tus reservas (confirmación, recordatorios, bienvenida) se seguirán enviando porque forman parte de la prestación del servicio.
                        </p>
                        <button onClick={confirm}
                            className="w-full py-3 bg-rural-700 text-white font-bold rounded-2xl hover:bg-rural-800">
                            Confirmar baja
                        </button>
                        <Link to="/" className="block text-center text-xs text-gray-500 mt-3 hover:underline">
                            No, mejor déjame como estoy
                        </Link>
                    </>
                )}

                {status === 'done' && (
                    <>
                        <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-4">
                            <p className="text-sm text-green-900 font-bold">Hecho.</p>
                            <p className="text-sm text-green-800 mt-1">
                                Ya no te mandaremos más {purposeText}. Si en algún momento quieres volver a recibirlos, escríbenos a <a href="mailto:apartamentostiojosemaria@gmail.com" className="underline">apartamentostiojosemaria@gmail.com</a>.
                            </p>
                        </div>
                        <Link to="/" className="block text-center text-sm text-rural-700 font-bold hover:underline">
                            Volver al inicio
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
};

export default UnsubscribePage;

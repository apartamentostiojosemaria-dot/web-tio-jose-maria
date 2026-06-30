import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { logError } from '../../utils/logger';
import FadeInUp from '../shared/FadeInUp';
import { WP } from '../../constants/urls';

const GuiaSection = () => {
    const [email, setEmail] = useState('');
    const [accept, setAccept] = useState(false);
    const [status, setStatus] = useState('idle');

    const handleSubmit = async (e) => {
        e.preventDefault();
        // RGPD/LSSI: sin consentimiento informado no damos de alta en la lista.
        if (!accept) return;
        setStatus('sending');

        const { error } = await supabase
            .from('email_subscribers')
            .insert({ email, source: 'guia_section' });

        // Si el insert fue OK o si ya estaba suscrito (23505), enviamos la guía
        const alreadyExists = error?.code === '23505';
        const inserted = !error;

        if (inserted || alreadyExists) {
            // RGPD: registrar el consentimiento de marketing (el newsletter es lista de marketing).
            // Mismo RPC de auditoría que usa el formulario de reserva. Fallo silencioso.
            try {
                await supabase.rpc('record_marketing_consent', {
                    p_email: email.trim(),
                    p_granted: true,
                    p_source: 'guia_section',
                    p_user_agent: navigator.userAgent,
                    p_legal_version: '1.0',
                    p_booking_code: null,
                });
            } catch { /* no bloquea el envío de la guía si la auditoría falla */ }

            try {
                await supabase.functions.invoke('send-guide', { body: { email } });
            } catch (e) {
                logError('GuiaSection.sendGuide', e);
                // No bloqueamos el éxito visual aunque falle el email — el subscriber está guardado
            }
            setStatus('success');
        } else {
            logError('GuiaSection.subscribe', error);
            setStatus('error');
        }

        setEmail('');
        setAccept(false);
    };

    return (
        <section id="guia" className="py-24 relative overflow-hidden text-white bg-primary-dark">
            <div className="absolute inset-0 opacity-20">
                <img src={`${WP}/slide-1.jpg`} alt="Paisaje del entorno natural de Cazorla" loading="lazy" decoding="async" className="w-full h-full object-cover grayscale" />
            </div>
            <div className="max-w-3xl mx-auto px-6 relative z-10 text-center">
                <FadeInUp>
                    <p className="text-4xl md:text-5xl mb-6" aria-hidden="true">&#x1F5FA;&#xFE0F;</p>
                    <h2 className="font-serif text-2xl md:text-5xl font-bold mb-5">Descubre el Cazorla <br className="md:hidden" /> que no sale en las guías</h2>
                    <p className="text-base md:text-lg mb-10 opacity-90 leading-relaxed text-accent">
                        Hemos preparado una guía exclusiva con nuestras rutas favoritas, los mejores sitios para comer, las almazaras de la zona y secretos locales. Déjanos tu correo y te la enviamos al momento.
                    </p>

                    <AnimatePresence mode="wait">
                        {status === 'success' ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto"
                                role="alert"
                            >
                                <p className="text-3xl mb-3" aria-hidden="true">&#x2705;</p>
                                <p className="font-bold text-lg mb-1">¡Enviada!</p>
                                <p className="text-sm opacity-80">Mira tu correo. Si no la ves en unos minutos, revisa la carpeta de promociones o spam.</p>
                            </motion.div>
                        ) : (
                            <motion.form
                                key="form"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="max-w-md mx-auto"
                                onSubmit={handleSubmit}
                            >
                                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                    <label htmlFor="guia-email" className="sr-only">Tu correo electrónico</label>
                                    <input
                                        id="guia-email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Tu correo electrónico"
                                        required
                                        disabled={status === 'sending'}
                                        className="px-6 py-4 rounded-full bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent flex-grow disabled:opacity-50"
                                    />
                                    <button
                                        type="submit"
                                        disabled={status === 'sending' || !accept}
                                        className="px-8 py-4 font-bold rounded-full bg-accent text-text-primary transition-all duration-300 hover:scale-105 shadow-lg disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        {status === 'sending' ? 'Enviando...' : 'Enviar Guía'}
                                    </button>
                                </div>
                                <label className="flex items-start gap-2 mt-4 text-left">
                                    <input
                                        type="checkbox"
                                        required
                                        checked={accept}
                                        onChange={(e) => setAccept(e.target.checked)}
                                        disabled={status === 'sending'}
                                        className="mt-0.5 h-4 w-4 accent-accent cursor-pointer shrink-0"
                                    />
                                    <span className="text-xs opacity-80 leading-relaxed">
                                        Acepto recibir la guía y novedades ocasionales por email y he leído la{' '}
                                        <Link to="/privacidad" target="_blank" className="underline">política de privacidad</Link>.
                                    </span>
                                </label>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    {status === 'error' && (
                        <p className="text-xs mt-4 text-red-300" role="alert">Ha ocurrido un error. Intentalo de nuevo.</p>
                    )}
                    {status !== 'success' && (
                        <p className="text-xs mt-5 opacity-60">Prometemos no enviar spam. Solo cosas bonitas del campo.</p>
                    )}
                </FadeInUp>
            </div>
        </section>
    );
};

export default GuiaSection;

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, ChevronLeft, RefreshCw, Loader2, AlertCircle, Check } from 'lucide-react';

// Login OTP de 6 dígitos — sin password. Editorial mobile-first.
// Edge functions: request-otp + verify-otp (devuelve magic link Supabase).

const ClientLogin = () => {
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [resendCooldown, setResendCooldown] = useState(0);
    const codeRefs = useRef([]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    const requestCode = async () => {
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Necesitamos un correo válido para mandarte el código.');
            return;
        }
        setLoading(true); setError(null);
        try {
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-otp`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json();
            if (data?.error === 'too_many_requests') {
                setError('Demasiados intentos. Espera unos minutos antes de pedir otro código.');
                return;
            }
            if (!res.ok) {
                setError('No hemos podido mandar el código. Inténtalo en un momento.');
                return;
            }
            setStep('code');
            setResendCooldown(60);
            setTimeout(() => codeRefs.current[0]?.focus(), 100);
        } catch {
            setError('Sin conexión. Comprueba tu red e inténtalo de nuevo.');
        } finally { setLoading(false); }
    };

    const handleCodeChange = (idx, val) => {
        const cleaned = val.replace(/\D/g, '').slice(-1);
        const next = [...code];
        next[idx] = cleaned;
        setCode(next);
        if (cleaned && idx < 5) codeRefs.current[idx + 1]?.focus();
        if (next.every(d => d !== '') && next.join('').length === 6) verifyCode(next.join(''));
    };

    const handlePaste = (e) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length !== 6) return;
        e.preventDefault();
        setCode(pasted.split(''));
        verifyCode(pasted);
    };

    const handleKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !code[idx] && idx > 0) codeRefs.current[idx - 1]?.focus();
    };

    const verifyCode = async (fullCode) => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ email: email.trim().toLowerCase(), code: fullCode }),
            });
            const data = await res.json();
            if (!res.ok || !data.action_link) {
                setError('Código incorrecto o caducado. Pide otro o vuelve a teclearlo.');
                setCode(['', '', '', '', '', '']);
                codeRefs.current[0]?.focus();
                return;
            }
            setStep('success');
            window.location.href = data.action_link;
        } catch {
            setError('Sin conexión. Vuelve a intentarlo.');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--color-papel)' }}>
            {/* Textura papel */}
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #2C3319 1px, transparent 1px), radial-gradient(circle at 80% 70%, #2C3319 1px, transparent 1px)', backgroundSize: '24px 24px, 32px 32px' }} />

            <header className="relative px-6 pt-10 pb-6 max-w-md mx-auto">
                <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.3em] text-stone-500 mb-1">Apartamentos Rurales</p>
                <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontStyle: 'italic' }} className="text-3xl text-stone-800 leading-none">
                    Tío José María
                </h1>
                <div className="mt-2 h-px w-12" style={{ background: 'var(--color-rural-600)' }} />
            </header>

            <main className="relative px-6 max-w-md mx-auto pb-20">
                <AnimatePresence mode="wait">
                    {step === 'email' && (
                        <motion.div key="email"
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.3 }}>
                            <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-lg leading-relaxed text-stone-700 mb-1">
                                Te enviamos un código de seis dígitos al correo para entrar.
                            </p>
                            <p style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic' }} className="text-sm text-stone-500 mb-8">
                                Sin contraseña, sin recordar nada.
                            </p>

                            <form onSubmit={(e) => { e.preventDefault(); requestCode(); }}>
                                <label className="block">
                                    <span style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.25em] font-semibold text-stone-500 mb-2 block">Tu correo</span>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                            placeholder="ejemplo@correo.com"
                                            autoComplete="email" autoFocus inputMode="email"
                                            style={{ fontFamily: 'var(--font-ui)' }}
                                            className="w-full pl-12 pr-4 py-4 bg-white border border-stone-200 rounded-xl text-base outline-none focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 transition-all" />
                                    </div>
                                </label>

                                {error && (
                                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        style={{ fontFamily: 'var(--font-editorial)' }}
                                        className="mt-3 text-sm flex items-start gap-2"
                                        role="alert">
                                        <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-terracota)' }} />
                                        <span style={{ color: 'var(--color-terracota)' }}>{error}</span>
                                    </motion.p>
                                )}

                                <button type="submit" disabled={loading || !email}
                                    style={{ background: 'var(--color-rural-600)', fontFamily: 'var(--font-ui)' }}
                                    className="mt-6 w-full py-4 text-white rounded-xl font-semibold tracking-wide flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-40 active:scale-[0.98]">
                                    {loading ? <><Loader2 size={16} className="animate-spin" /> Enviando…</> : <>Enviar código <ArrowRight size={16} /></>}
                                </button>
                            </form>

                            <div className="mt-16 pt-8 border-t border-stone-200/60">
                                <p style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic' }} className="text-sm text-stone-500 leading-relaxed">
                                    "Aquí cada huésped es alguien que viene a casa."
                                </p>
                                <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }} className="text-xs text-stone-400 mt-2">
                                    Mari Carmen <span className="text-stone-300">·</span> Jesús
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {step === 'code' && (
                        <motion.div key="code"
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.3 }}>
                            <button onClick={() => { setStep('email'); setCode(['','','','','','']); setError(null); }}
                                style={{ fontFamily: 'var(--font-ui)' }}
                                className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 mb-6">
                                <ChevronLeft size={14} /> Cambiar correo
                            </button>

                            <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-lg leading-relaxed text-stone-700 mb-1">
                                Hemos mandado un código a
                            </p>
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }} className="text-base text-stone-900 mb-8 break-all">
                                {email}
                            </p>

                            <div className="flex justify-between gap-2 mb-6">
                                {code.map((digit, idx) => (
                                    <input key={idx}
                                        ref={el => codeRefs.current[idx] = el}
                                        type="text" inputMode="numeric" maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleCodeChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(idx, e)}
                                        onPaste={idx === 0 ? handlePaste : undefined}
                                        disabled={loading}
                                        style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
                                        className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl bg-white border-2 border-stone-200 rounded-xl outline-none focus:border-stone-900 transition-all" />
                                ))}
                            </div>

                            {loading && (
                                <p style={{ fontFamily: 'var(--font-ui)' }} className="text-xs text-stone-500 text-center flex items-center justify-center gap-2">
                                    <Loader2 size={12} className="animate-spin" /> Comprobando…
                                </p>
                            )}

                            {error && (
                                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    style={{ fontFamily: 'var(--font-editorial)' }}
                                    className="mt-3 text-sm flex items-start gap-2"
                                    role="alert">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-terracota)' }} />
                                    <span style={{ color: 'var(--color-terracota)' }}>{error}</span>
                                </motion.p>
                            )}

                            <div className="mt-8 text-center">
                                <button onClick={requestCode} disabled={resendCooldown > 0 || loading}
                                    style={{ fontFamily: 'var(--font-ui)' }}
                                    className="text-xs text-stone-600 hover:text-stone-900 inline-flex items-center gap-1.5 disabled:opacity-40">
                                    <RefreshCw size={11} /> {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
                                </button>
                            </div>

                            <p style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic' }}
                                className="mt-12 text-xs text-stone-400 text-center leading-relaxed">
                                Si no encuentras el correo, mira en spam o promociones.
                                <br />
                                A veces tardan uno o dos minutos en llegar.
                            </p>
                        </motion.div>
                    )}

                    {step === 'success' && (
                        <motion.div key="success"
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="py-20 text-center">
                            <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
                                style={{ background: 'var(--color-rural-600)' }}>
                                <Check size={28} className="text-white" />
                            </div>
                            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }} className="text-2xl text-stone-800">
                                Entrando…
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default ClientLogin;

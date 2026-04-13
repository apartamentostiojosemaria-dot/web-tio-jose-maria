import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LogIn, Mail, Lock, AlertCircle, Clock } from 'lucide-react';
import { useRateLimit } from '../../hooks/useRateLimit';

const ClientLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { isLocked, remainingSeconds, attempts, maxAttempts, checkLimit, recordFailure, recordSuccess } = useRateLimit();
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (!isLocked) { setCountdown(0); return; }
        setCountdown(remainingSeconds);
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(timer); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isLocked, remainingSeconds]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!checkLimit()) return;

        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            recordFailure();
            setError('Credenciales incorrectas. Revisa tu email y contrasena.');
        } else {
            recordSuccess();
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-rural-50 px-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 border border-rural-100">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-surface-warm rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Lock size={32} className="text-primary" />
                    </div>
                    <h1 className="text-3xl font-serif font-bold text-text-primary">Area de Clientes</h1>
                    <p className="text-gray-500 mt-2">Accede con tu cuenta para ver tus documentos</p>
                </div>

                {isLocked && countdown > 0 && (
                    <div className="flex items-center gap-2 p-4 bg-amber-50 text-amber-700 rounded-xl text-sm border border-amber-100 mb-6" role="alert">
                        <Clock size={16} className="shrink-0" />
                        <span>Demasiados intentos. Espera <strong>{countdown}s</strong> antes de volver a intentarlo.</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label htmlFor="client-email" className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                id="client-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-rural-200 disabled:opacity-50"
                                placeholder="tu@email.com"
                                required
                                disabled={isLocked}
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="client-password" className="block text-sm font-bold text-gray-700 mb-2">Contrasena</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                id="client-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-rural-200 disabled:opacity-50"
                                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                                required
                                disabled={isLocked}
                                autoComplete="current-password"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100" role="alert">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                            {attempts > 2 && <span className="ml-auto text-red-400 text-[10px]">{attempts}/{maxAttempts}</span>}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || isLocked}
                        className="w-full py-4 rounded-xl text-white font-bold text-lg bg-primary shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {loading ? 'Entrando...' : <><LogIn size={20} /> Entrar</>}
                    </button>

                    <p className="text-center text-xs text-gray-400 mt-6">
                        Si no tienes cuenta, contacta con nosotros para recibir tus credenciales de acceso.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default ClientLogin;

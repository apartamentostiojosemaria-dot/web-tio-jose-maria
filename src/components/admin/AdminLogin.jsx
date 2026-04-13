import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, User, LogIn, AlertCircle, Clock } from 'lucide-react';
import { useRateLimit } from '../../hooks/useRateLimit';

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
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
            setError('Email o contrasena incorrectos. Revisa tus datos e intentalo de nuevo.');
        } else {
            recordSuccess();
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        if (!checkLimit()) return;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/admin' }
        });
        if (error) {
            recordFailure();
            setError('No se pudo conectar con Google. Intentalo de nuevo.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <div className="p-10">
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-surface-warm rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Lock className="text-primary" size={32} />
                        </div>
                        <h1 className="font-serif text-3xl font-bold text-text-primary">Panel de Control</h1>
                        <p className="text-sm text-gray-500 mt-2">Acceso exclusivo para propietarios</p>
                    </div>

                    {isLocked && countdown > 0 && (
                        <div className="flex items-center gap-2 p-4 bg-amber-50 text-amber-700 rounded-xl text-sm border border-amber-100 mb-6" role="alert">
                            <Clock size={16} className="shrink-0" />
                            <span>Demasiados intentos. Espera <strong>{countdown}s</strong> antes de volver a intentarlo.</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="admin-email" className="block text-xs font-bold uppercase tracking-widest mb-2 text-primary">Email</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                                <input
                                    id="admin-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isLocked}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                                    placeholder="admin@tiojosemaria.com"
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="admin-password" className="block text-xs font-bold uppercase tracking-widest mb-2 text-primary">Contrasena</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                                <input
                                    id="admin-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isLocked}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                                    placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs border border-red-100" role="alert">
                                <AlertCircle size={14} className="shrink-0" />
                                <span>{error}</span>
                                {attempts > 2 && <span className="ml-auto text-red-400 text-[10px]">{attempts}/{maxAttempts}</span>}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || isLocked}
                            className="w-full py-4 rounded-xl text-white font-bold bg-primary flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {loading ? 'Entrando...' : <><LogIn size={20} /> Entrar al Panel</>}
                        </button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-100"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                            <span className="px-4 bg-white text-gray-400 font-serif italic">o tambien</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        disabled={isLocked}
                        className="w-full py-4 border border-gray-100 rounded-xl font-bold flex items-center justify-center gap-3 transition-all hover:bg-gray-50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                        <GoogleIcon />
                        Continuar con Google
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;

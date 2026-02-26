import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { Lock, User, LogIn } from 'lucide-react';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/admin'
            }
        });
        if (error) setError(error.message);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <div className="p-10">
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-rural-100 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: COLORS.bgWarm }}>
                            <Lock style={{ color: COLORS.primary }} size={32} />
                        </div>
                        <h1 className="font-serif text-3xl font-bold" style={{ color: COLORS.text }}>Panel de Control</h1>
                        <p className="text-sm text-gray-500 mt-2">Acceso exclusivo para propietarios</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: COLORS.primary }}>Email</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2"
                                    style={{ '--tw-ring-color': COLORS.primary }}
                                    placeholder="admin@tiojosemaria.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: COLORS.primary }}>Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2"
                                    style={{ '--tw-ring-color': COLORS.primary }}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && <p className="text-red-500 text-xs bg-red-50 p-3 rounded-lg text-center">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:opacity-50"
                            style={{ backgroundColor: COLORS.primary }}
                        >
                            {loading ? 'Entrando...' : <><LogIn size={20} /> Entrar al Panel</>}
                        </button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-100"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                            <span className="px-4 bg-white text-gray-400 font-serif italic">o también</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        className="w-full py-4 border border-gray-100 rounded-xl font-bold flex items-center justify-center gap-3 transition-all hover:bg-gray-50 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                        Continuar con Google
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;

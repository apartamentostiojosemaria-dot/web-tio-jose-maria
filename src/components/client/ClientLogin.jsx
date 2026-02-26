import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';

const ClientLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) setError('Credenciales incorrectas. Por favor, revisa tu email y contraseña.');
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-rural-50 px-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 border border-rural-100">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-rural-100 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: COLORS.bgWarm }}>
                        <Lock size={32} style={{ color: COLORS.primary }} />
                    </div>
                    <h1 className="text-3xl font-serif font-bold" style={{ color: COLORS.text }}>Área de Clientes</h1>
                    <p className="text-gray-500 mt-2">Accede con tu cuenta para ver tus documentos</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-rural-200"
                                placeholder="tu@email.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-rural-200"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        {loading ? 'Entrando...' : (
                            <>
                                <LogIn size={20} /> Entrar
                            </>
                        )}
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

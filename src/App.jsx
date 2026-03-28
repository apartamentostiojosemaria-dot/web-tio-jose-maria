import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import ScrollToTop from './components/shared/ScrollToTop';
import CookieConsent from './components/shared/CookieConsent';
import HomePage from './pages/HomePage';
import ApartmentDetail from './components/ApartmentDetail';
import PrivacyPolicy from './pages/PrivacyPolicy';
import MapPage from './pages/MapPage';
import EventsPage from './pages/EventsPage';
import HinojaresPage from './pages/HinojaresPage';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import ClientLogin from './components/client/ClientLogin';
import ClientArea from './components/client/ClientArea';

// Re-export for backwards compatibility with existing component imports
export { COLORS } from './constants/colors';

export default function App() {
    const [session, setSession] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else setLoadingProfile(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else {
                setUserProfile(null);
                setLoadingProfile(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchProfile(userId) {
        setLoadingProfile(true);
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) setUserProfile(data);
        setLoadingProfile(false);
    }

    if (session && loadingProfile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-rural-50 font-serif p-6 text-center">
                <div className="animate-pulse text-rural-700 italic mb-4">Verificando credenciales...</div>
                <div className="text-[10px] text-gray-400 space-y-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm max-w-xs">
                    <p>Sesión activa para: <span className="text-gray-600 font-mono">{session.user.email}</span></p>
                    <p>ID: <span className="text-gray-300 font-mono">{session.user.id.substring(0, 8)}...</span></p>
                    <p>Estado perfil: <span className={userProfile ? "text-green-500" : "text-amber-500"}>{userProfile ? `Rol: ${userProfile.role}` : "Cargando datos..."}</span></p>
                </div>
            </div>
        );
    }

    return (
        <>
            <ScrollToTop />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/apartamento/:slug" element={<ApartmentDetail />} />
                <Route path="/privacidad" element={<PrivacyPolicy />} />
                <Route path="/rutas" element={<MapPage />} />
                <Route path="/eventos" element={<EventsPage />} />
                <Route path="/hinojares" element={<HinojaresPage />} />
                <Route
                    path="/admin"
                    element={!session ? <AdminLogin /> : (userProfile?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" replace />)}
                />
                <Route
                    path="/clientes"
                    element={!session ? <ClientLogin /> : <ClientArea />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <CookieConsent />
        </>
    );
}

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import ScrollToTop from './components/shared/ScrollToTop';
import CookieConsent from './components/shared/CookieConsent';

// BotChat sólo se monta en rutas públicas (no admin, no panel de cliente).
const BotChat = lazy(() => import('./components/shared/BotChat'));

const PublicBotChat = () => {
    const { pathname } = useLocation();
    if (pathname.startsWith('/admin') || pathname.startsWith('/clientes')) return null;
    // Bot deshabilitado por defecto. Activar con VITE_BOT_ENABLED=true cuando
    // AWS Bedrock + indexer KB estén configurados y verificados.
    if (import.meta.env.VITE_BOT_ENABLED !== 'true') return null;
    return (
        <Suspense fallback={null}>
            <BotChat />
        </Suspense>
    );
};

// Eager load — always needed on first paint
import HomePage from './pages/HomePage';

// Lazy load — only when navigated to
const ApartmentDetail = lazy(() => import('./components/ApartmentDetail'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const LegalNotice = lazy(() => import('./pages/LegalNotice'));
const UnsubscribePage = lazy(() => import('./pages/UnsubscribePage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const HinojaresPage = lazy(() => import('./pages/HinojaresPage'));
const ReservarPage = lazy(() => import('./pages/ReservarPage'));
const ReservaConfirmada = lazy(() => import('./pages/ReservaConfirmada'));
const PrecheckinPage = lazy(() => import('./pages/PrecheckinPage'));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminResponse = lazy(() => import('./pages/AdminResponse'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostDetail = lazy(() => import('./pages/BlogPostDetail'));
const GuiaCazorla = lazy(() => import('./pages/GuiaCazorla'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center bg-rural-50">
        <div className="animate-pulse text-rural-700 font-serif italic">Cargando...</div>
    </div>
);

// Pantalla explicativa cuando el usuario está logueado pero su perfil no
// es admin (o no se ha podido cargar). Antes esto era un Navigate to / que
// confundía al operador: clicaba "Acceso administración" y aparecía en la home.
const AdminNoPermission = ({ email, profileLoaded }) => (
    <div className="min-h-screen flex items-center justify-center bg-rural-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
            <h1 className="font-serif text-2xl font-bold text-text-primary mb-3">
                {profileLoaded ? 'Esta cuenta no tiene acceso al panel' : 'No hemos podido cargar tu perfil'}
            </h1>
            <p className="text-gray-600 mb-2 text-sm">
                {profileLoaded
                    ? `Estás dentro como ${email || 'usuario'}, pero esta cuenta no está marcada como administradora.`
                    : `Estás dentro como ${email || 'usuario'}, pero no hemos podido leer tu perfil. Puede ser un problema temporal de conexión.`}
            </p>
            <p className="text-gray-500 text-xs mt-4">
                Si esto no debería pasar, escríbenos al WhatsApp del administrador y lo revisamos.
            </p>
            <div className="flex gap-3 justify-center mt-6">
                <button onClick={() => supabase.auth.signOut().then(() => window.location.assign('/admin'))}
                    className="text-sm font-bold text-rural-700 hover:text-primary px-4 py-2 rounded-xl border border-gray-200">
                    Cerrar sesión y volver al login
                </button>
            </div>
        </div>
    </div>
);

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
                <div className="animate-pulse text-rural-700 italic">Verificando acceso...</div>
            </div>
        );
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Saltar al contenido</a>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
                <div id="main-content">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/apartamento/:slug" element={<ApartmentDetail />} />
                        <Route path="/privacidad" element={<PrivacyPolicy />} />
                        <Route path="/aviso-legal" element={<LegalNotice />} />
                        <Route path="/baja" element={<UnsubscribePage />} />
                        <Route path="/rutas" element={<MapPage />} />
                        <Route path="/eventos" element={<EventsPage />} />
                        <Route path="/hinojares" element={<HinojaresPage />} />
                        <Route path="/reservar" element={<ReservarPage />} />
                        <Route path="/reservar/confirmada" element={<ReservaConfirmada />} />
                        <Route path="/precheckin" element={<PrecheckinPage />} />
                        <Route path="/blog" element={<BlogPage />} />
                        <Route path="/blog/:slug" element={<BlogPostDetail />} />
                        <Route path="/guia-cazorla" element={<GuiaCazorla />} />
                        <Route
                            path="/admin"
                            element={
                                !session
                                    ? <AdminLogin />
                                    : userProfile?.role === 'admin'
                                        ? <AdminDashboard />
                                        : <AdminNoPermission email={session?.user?.email} profileLoaded={!loadingProfile && userProfile !== null} />
                            }
                        />
                        <Route path="/admin/respuesta" element={<AdminResponse />} />
                        <Route path="/clientes" element={<Navigate to="/" replace />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </div>
            </Suspense>
            <PublicBotChat />
            <CookieConsent />
        </>
    );
}

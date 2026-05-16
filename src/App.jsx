import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import ScrollToTop from './components/shared/ScrollToTop';
import CookieConsent from './components/shared/CookieConsent';

// Eager load — always needed on first paint
import HomePage from './pages/HomePage';

// Lazy load — only when navigated to
const ApartmentDetail = lazy(() => import('./components/ApartmentDetail'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const MapPage = lazy(() => import('./pages/MapPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const HinojaresPage = lazy(() => import('./pages/HinojaresPage'));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostDetail = lazy(() => import('./pages/BlogPostDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center bg-rural-50">
        <div className="animate-pulse text-rural-700 font-serif italic">Cargando...</div>
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
                        <Route path="/rutas" element={<MapPage />} />
                        <Route path="/eventos" element={<EventsPage />} />
                        <Route path="/hinojares" element={<HinojaresPage />} />
                        <Route path="/blog" element={<BlogPage />} />
                        <Route path="/blog/:slug" element={<BlogPostDetail />} />
                        <Route
                            path="/admin"
                            element={!session ? <AdminLogin /> : (userProfile?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" replace />)}
                        />
                        <Route path="/clientes" element={<Navigate to="/" replace />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </div>
            </Suspense>
            <CookieConsent />
        </>
    );
}

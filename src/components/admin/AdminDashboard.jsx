import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import ApartmentsManager from './ApartmentsManager';
import WebConfigManager from './WebConfigManager';
import DocumentsManager from './DocumentsManager';
import AvailabilityManager from './AvailabilityManager';
import SeasonsManager from './SeasonsManager';
import GuestGuidesManager from './GuestGuidesManager';
import GuestUserManager from './GuestUserManager';
import { ClientAreaContent } from '../client/ClientArea';
import AnalyticsDashboard from './AnalyticsDashboard';
import QRCodeManager from './QRCodeManager';
import BookingsManager from './BookingsManager';
import RoutesManager from './RoutesManager';
import ReviewsManager from './ReviewsManager';
import EventsManager from './EventsManager';
import PlacesManager from './PlacesManager';
import { usePendingBookingsCount } from '../../hooks/useDatabase';
import { LayoutDashboard, Home, Map, FileText, Settings, LogOut, Calendar, Star, Eye, Users, BarChart3, QrCode, CalendarCheck, Route, MessageSquare, PartyPopper, MapPin, Menu, X } from 'lucide-react';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [stats, setStats] = useState({ apartments: 0, routes: 0, documents: 0 });
    const pendingBookings = usePendingBookingsCount();

    useEffect(() => {
        const fetchStats = async () => {
            const [apts, routes, docs] = await Promise.all([
                supabase.from('apartments').select('id', { count: 'exact', head: true }),
                supabase.from('routes').select('id', { count: 'exact', head: true }),
                supabase.from('documents').select('id', { count: 'exact', head: true })
            ]);
            setStats({ apartments: apts.count || 0, routes: routes.count || 0, documents: docs.count || 0 });
        };
        fetchStats();
    }, []);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSidebarOpen(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Mobile header */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                <h2 className="font-serif text-lg font-bold text-text-primary">Tio Jose Maria</h2>
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-2 rounded-xl hover:bg-gray-100"
                    aria-expanded={sidebarOpen}
                    aria-label={sidebarOpen ? 'Cerrar menu' : 'Abrir menu'}
                >
                    {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`fixed md:static z-50 md:z-auto top-0 left-0 h-full w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-8 border-b border-gray-50 hidden md:block">
                    <h2 className="font-serif text-xl font-bold text-text-primary">Tio Jose Maria</h2>
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">Administracion</p>
                </div>

                {/* Spacer for mobile header */}
                <div className="h-14 md:hidden" />

                <nav className="flex-grow p-4 space-y-2 overflow-y-auto" aria-label="Menu de administracion">
                    <SidebarLink icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
                    <SidebarLink icon={<Home size={18} />} label="Apartamentos" active={activeTab === 'apartamentos'} onClick={() => handleTabChange('apartamentos')} />
                    <SidebarLink icon={<Star size={18} />} label="Guia del Huesped" active={activeTab === 'guias'} onClick={() => handleTabChange('guias')} />
                    <SidebarLink icon={<Route size={18} />} label="Rutas" active={activeTab === 'rutas'} onClick={() => handleTabChange('rutas')} />
                    <SidebarLink icon={<Calendar size={18} />} label="Disponibilidad" active={activeTab === 'disponibilidad'} onClick={() => handleTabChange('disponibilidad')} />
                    <SidebarLink icon={<Star size={18} />} label="Temporadas" active={activeTab === 'temporadas'} onClick={() => handleTabChange('temporadas')} />
                    <SidebarLink icon={<CalendarCheck size={18} />} label="Reservas" active={activeTab === 'reservas'} onClick={() => handleTabChange('reservas')} badge={pendingBookings} />
                    <SidebarLink icon={<FileText size={18} />} label="Documentos" active={activeTab === 'documentos'} onClick={() => handleTabChange('documentos')} />
                    <SidebarLink icon={<Users size={18} />} label="Huespedes" active={activeTab === 'huespedes'} onClick={() => handleTabChange('huespedes')} />
                    <SidebarLink icon={<PartyPopper size={18} />} label="Eventos" active={activeTab === 'eventos'} onClick={() => handleTabChange('eventos')} />
                    <SidebarLink icon={<MapPin size={18} />} label="Directorio Local" active={activeTab === 'directorio'} onClick={() => handleTabChange('directorio')} />
                    <SidebarLink icon={<BarChart3 size={18} />} label="Analitica" active={activeTab === 'analitica'} onClick={() => handleTabChange('analitica')} />
                    <SidebarLink icon={<MessageSquare size={18} />} label="Resenas" active={activeTab === 'resenas'} onClick={() => handleTabChange('resenas')} />
                    <SidebarLink icon={<QrCode size={18} />} label="Codigos QR" active={activeTab === 'qrcodes'} onClick={() => handleTabChange('qrcodes')} />
                    <div className="pt-4 mt-4 border-t border-gray-50">
                        <SidebarLink icon={<Eye size={18} />} label="Vista Huesped" active={activeTab === 'vista_huesped'} onClick={() => handleTabChange('vista_huesped')} />
                    </div>
                    <SidebarLink icon={<Settings size={18} />} label="Configuracion" active={activeTab === 'configuracion'} onClick={() => handleTabChange('configuracion')} />
                </nav>

                <div className="p-4 border-t border-gray-50">
                    <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-bold">
                        <LogOut size={18} /> Cerrar Sesion
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow p-4 md:p-10 pt-18 md:pt-10 h-screen overflow-y-auto">
                {activeTab === 'dashboard' && (
                    <>
                        <header className="mb-10">
                            <h1 className="text-3xl font-serif font-bold text-text-primary">Bienvenido al Panel de Control</h1>
                            <p className="text-gray-500">Que quieres gestionar hoy?</p>
                        </header>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <StatCard label="Apartamentos Activos" value={stats.apartments} />
                            <StatCard label="Rutas Publicadas" value={stats.routes} />
                            <StatCard label="Documentos" value={stats.documents} />
                        </div>
                    </>
                )}
                {activeTab === 'apartamentos' && <ApartmentsManager />}
                {activeTab === 'rutas' && <RoutesManager />}
                {activeTab === 'disponibilidad' && <AvailabilityManager />}
                {activeTab === 'temporadas' && <SeasonsManager />}
                {activeTab === 'reservas' && <BookingsManager />}
                {activeTab === 'guias' && <GuestGuidesManager />}
                {activeTab === 'documentos' && <DocumentsManager />}
                {activeTab === 'huespedes' && <GuestUserManager />}
                {activeTab === 'configuracion' && <WebConfigManager />}
                {activeTab === 'analitica' && <AnalyticsDashboard />}
                {activeTab === 'resenas' && <ReviewsManager />}
                {activeTab === 'eventos' && <EventsManager />}
                {activeTab === 'directorio' && <PlacesManager />}
                {activeTab === 'qrcodes' && <QRCodeManager />}
                {activeTab === 'vista_huesped' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-6 flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                            <div className="flex items-center gap-3 text-amber-900">
                                <Eye size={20} />
                                <span className="font-bold text-sm">Modo Vista Previa: Estas viendo lo mismo que veria un cliente.</span>
                            </div>
                        </div>
                        <ClientAreaContent docs={[]} />
                    </div>
                )}
            </main>
        </div>
    );
};

const SidebarLink = ({ icon, label, active = false, onClick, badge = 0 }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${
            active ? 'bg-surface-warm text-primary' : 'hover:bg-gray-50 opacity-60 hover:opacity-100'
        }`}
    >
        {icon}
        <span className="flex-grow text-left">{label}</span>
        {badge > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{badge}</span>
        )}
    </button>
);

const StatCard = ({ label, value }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <p className="text-xs uppercase tracking-widest font-bold opacity-40 mb-2">{label}</p>
        <p className="text-4xl font-serif font-bold text-primary">{value}</p>
    </div>
);

export default AdminDashboard;

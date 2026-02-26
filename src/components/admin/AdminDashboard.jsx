import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import ApartmentsManager from './ApartmentsManager';
import WebConfigManager from './WebConfigManager';
import DocumentsManager from './DocumentsManager';
import AvailabilityManager from './AvailabilityManager';
import SeasonsManager from './SeasonsManager';
import GuestGuidesManager from './GuestGuidesManager';
import GuestUserManager from './GuestUserManager';
import { ClientAreaContent } from '../client/ClientArea';
import { LayoutDashboard, Home, Map, FileText, Settings, LogOut, Calendar, Star, Eye, Users } from 'lucide-react';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState({ apartments: 0, routes: 0, documents: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            const [apts, routes, docs] = await Promise.all([
                supabase.from('apartments').select('id', { count: 'exact', head: true }),
                supabase.from('routes').select('id', { count: 'exact', head: true }),
                supabase.from('documents').select('id', { count: 'exact', head: true })
            ]);
            setStats({
                apartments: apts.count || 0,
                routes: routes.count || 0,
                documents: docs.count || 0
            });
        };
        fetchStats();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-100 flex flex-col">
                <div className="p-8 border-b border-gray-50">
                    <h2 className="font-serif text-xl font-bold" style={{ color: COLORS.text }}>Tío José María</h2>
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">Administración</p>
                </div>

                <nav className="flex-grow p-4 space-y-2">
                    <SidebarLink
                        icon={<LayoutDashboard size={18} />}
                        label="Dashboard"
                        active={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                    />
                    <SidebarLink
                        icon={<Home size={18} />}
                        label="Apartamentos"
                        active={activeTab === 'apartamentos'}
                        onClick={() => setActiveTab('apartamentos')}
                    />
                    <SidebarLink
                        icon={<Star size={18} />}
                        label="Guía del Huésped"
                        active={activeTab === 'guias'}
                        onClick={() => setActiveTab('guias')}
                    />
                    <SidebarLink
                        icon={<Calendar size={18} />}
                        label="Disponibilidad"
                        active={activeTab === 'disponibilidad'}
                        onClick={() => setActiveTab('disponibilidad')}
                    />
                    <SidebarLink
                        icon={<Star size={18} />}
                        label="Temporadas"
                        active={activeTab === 'temporadas'}
                        onClick={() => setActiveTab('temporadas')}
                    />
                    <SidebarLink
                        icon={<FileText size={18} />}
                        label="Documentos"
                        active={activeTab === 'documentos'}
                        onClick={() => setActiveTab('documentos')}
                    />
                    <SidebarLink
                        icon={<Users size={18} />}
                        label="Huéspedes"
                        active={activeTab === 'huespedes'}
                        onClick={() => setActiveTab('huespedes')}
                    />
                    <div className="pt-4 mt-4 border-t border-gray-50">
                        <SidebarLink
                            icon={<Eye size={18} />}
                            label="Vista Huésped"
                            active={activeTab === 'vista_huesped'}
                            onClick={() => setActiveTab('vista_huesped')}
                        />
                    </div>
                    <SidebarLink
                        icon={<Settings size={18} />}
                        label="Configuración"
                        active={activeTab === 'configuracion'}
                        onClick={() => setActiveTab('configuracion')}
                    />
                </nav>

                <div className="p-4 border-t border-gray-50">
                    <button
                        onClick={() => supabase.auth.signOut()}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-bold"
                    >
                        <LogOut size={18} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow p-10 h-screen overflow-y-auto">
                {activeTab === 'dashboard' && (
                    <>
                        <header className="mb-10">
                            <h1 className="text-3xl font-serif font-bold" style={{ color: COLORS.text }}>Bienvenido al Panel de Control</h1>
                            <p className="text-gray-500">¿Qué quieres gestionar hoy?</p>
                        </header>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <StatCard label="Apartamentos Activos" value={stats.apartments} />
                            <StatCard label="Rutas Publicadas" value={stats.routes} />
                            <StatCard label="Documentos" value={stats.documents} />
                        </div>
                    </>
                )}

                {activeTab === 'apartamentos' && <ApartmentsManager />}
                {activeTab === 'disponibilidad' && <AvailabilityManager />}
                {activeTab === 'temporadas' && <SeasonsManager />}
                {activeTab === 'guias' && <GuestGuidesManager />}
                {activeTab === 'documentos' && <DocumentsManager />}
                {activeTab === 'huespedes' && <GuestUserManager />}
                {activeTab === 'configuracion' && <WebConfigManager />}
                {activeTab === 'vista_huesped' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-6 flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                            <div className="flex items-center gap-3 text-amber-900">
                                <Eye size={20} />
                                <span className="font-bold text-sm">Modo Vista Previa: Estás viendo lo mismo que vería un cliente.</span>
                            </div>
                        </div>
                        <ClientAreaContent docs={[]} />
                    </div>
                )}
            </main>
        </div>
    );
};

const SidebarLink = ({ icon, label, active = false, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${active ? 'bg-rural-100' : 'hover:bg-gray-50 opacity-60 hover:opacity-100'}`}
        style={active ? { backgroundColor: COLORS.bgWarm, color: COLORS.primary } : {}}
    >
        {icon}
        {label}
    </button>
);

const StatCard = ({ label, value }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <p className="text-xs uppercase tracking-widest font-bold opacity-40 mb-2">{label}</p>
        <p className="text-4xl font-serif font-bold" style={{ color: COLORS.primary }}>{value}</p>
    </div>
);

export default AdminDashboard;

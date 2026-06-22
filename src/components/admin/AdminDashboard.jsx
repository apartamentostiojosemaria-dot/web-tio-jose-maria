import React, { useState, lazy, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import { usePendingBookingsCount } from '../../hooks/useDatabase';
import {
    LayoutDashboard, Home, Map, FileText, Settings, LogOut, Calendar, Star, Eye, Users,
    BarChart3, QrCode, CalendarCheck, Route, MessageSquare, PartyPopper, MapPin, Menu, X,
    BookOpen, ClipboardList,
    Shield, Brush, KeyRound, Euro, Link2, Bot, Tag,
} from 'lucide-react';

// Operaciones core (carga inmediata, son los más usados)
import AdminHome from './AdminHome';
import BookingsManagerV2 from './BookingsManagerV2';
import HelpButton from './HelpButton';

// Resto lazy para no añadir bytes al primer paint
const ApartmentsManager     = lazy(() => import('./ApartmentsManager'));
const WebConfigManager      = lazy(() => import('./WebConfigManager'));
const DocumentsManager      = lazy(() => import('./DocumentsManager'));
const AvailabilityManager   = lazy(() => import('./AvailabilityManager'));
const SeasonsManager        = lazy(() => import('./SeasonsManager'));
const GuestGuidesManager    = lazy(() => import('./GuestGuidesManager'));
const GuestUserManager      = lazy(() => import('./GuestUserManager'));
const AnalyticsDashboard    = lazy(() => import('./AnalyticsDashboard'));
const QRCodeManager         = lazy(() => import('./QRCodeManager'));
const RoutesManager         = lazy(() => import('./RoutesManager'));
const ReviewsManager        = lazy(() => import('./ReviewsManager'));
const EventsManager         = lazy(() => import('./EventsManager'));
const PlacesManager         = lazy(() => import('./PlacesManager'));
const BlogManager           = lazy(() => import('./BlogManager'));
const InstructionsManager   = lazy(() => import('./InstructionsManager'));
const InvoicesManager       = lazy(() => import('./InvoicesManager'));
const TravelersManager      = lazy(() => import('./TravelersManager'));
const CleaningManager       = lazy(() => import('./CleaningManager'));
const AccessCodesManager    = lazy(() => import('./AccessCodesManager'));
const PricingRulesManager   = lazy(() => import('./PricingRulesManager'));
const ChannelSyncManager    = lazy(() => import('./ChannelSyncManager'));
const BotLogsManager        = lazy(() => import('./BotLogsManager'));
const PlanningCalendar      = lazy(() => import('./PlanningCalendar'));
const Customer360           = lazy(() => import('./Customer360'));
const ProtocolsManager      = lazy(() => import('./ProtocolsManager'));
const InternalDocsManager   = lazy(() => import('./InternalDocsManager'));

// Sidebar pensado para personas sin formación técnica.
// Cero anglicismos, cero jerga, cero acrónimos.
const NAV_GROUPS = [
    {
        title: 'Día a día',
        items: [
            { id: 'dashboard',     label: 'Inicio',                 icon: LayoutDashboard },
            { id: 'planning',      label: 'Calendario de reservas', icon: Calendar },
            { id: 'reservas',      label: 'Lista de reservas',      icon: CalendarCheck, badgeKey: 'pendingBookings' },
            { id: 'cleaning',      label: 'Limpiezas',              icon: Brush },
            { id: 'travelers',     label: 'Parte de viajeros',      icon: Shield },
            { id: 'disponibilidad',label: 'Bloquear fechas',        icon: Calendar },
        ],
    },
    {
        title: 'Dinero',
        items: [
            { id: 'invoices',  label: 'Facturas',               icon: FileText },
            { id: 'pricing',   label: 'Recargos y descuentos',  icon: Tag },
            { id: 'temporadas',label: 'Temporada alta y baja',  icon: Star },
        ],
    },
    {
        title: 'Huéspedes',
        items: [
            { id: 'channel_sync', label: 'Sincronizar con Airbnb y Booking', icon: Link2 },
            { id: 'customer_360', label: 'Ficha de huéspedes',               icon: Users },
            { id: 'huespedes',    label: 'Acceso de huéspedes a la web',     icon: Users },
            { id: 'resenas',      label: 'Opiniones de huéspedes',           icon: MessageSquare },
        ],
    },
    {
        title: 'Tu página web',
        items: [
            { id: 'apartamentos',  label: 'Apartamentos',            icon: Home },
            { id: 'rutas',         label: 'Rutas y excursiones',     icon: Route },
            { id: 'eventos',       label: 'Eventos y fiestas',       icon: PartyPopper },
            { id: 'directorio',    label: 'Restaurantes y servicios',icon: MapPin },
            { id: 'blog',          label: 'Blog y artículos',        icon: BookOpen },
            { id: 'guias',         label: 'Guía para el huésped',    icon: Star },
            { id: 'instrucciones', label: 'Instrucciones del apartamento', icon: ClipboardList },
        ],
    },
    {
        title: 'Ayuda',
        items: [
            { id: 'protocols',       label: 'Manual y protocolos',  icon: BookOpen },
            { id: 'internal_docs',   label: 'Documentos internos',  icon: FileText },
        ],
    },
    {
        title: 'Más',
        items: [
            { id: 'bot_logs',     label: 'Conversaciones del asistente', icon: Bot },
            { id: 'analitica',    label: 'Estadísticas',                 icon: BarChart3 },
            { id: 'documentos',   label: 'Documentos para huéspedes',    icon: FileText },
            { id: 'qrcodes',      label: 'Códigos QR',                   icon: QrCode },
            { id: 'configuracion',label: 'Ajustes generales',            icon: Settings },
        ],
    },
];

const FALLBACK = (
    <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 font-serif italic">Cargando…</p>
    </div>
);

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pendingBookings = usePendingBookingsCount();
    const badges = { pendingBookings };

    const go = (tab) => { setActiveTab(tab); setSidebarOpen(false); };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Mobile header */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                <h2 className="font-serif text-lg font-bold text-text-primary">Tío José María</h2>
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl hover:bg-gray-100"
                    aria-expanded={sidebarOpen} aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}>
                    {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            <aside className={`fixed md:static z-50 md:z-auto top-0 left-0 h-full w-72 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-6 border-b border-gray-50 hidden md:block">
                    <h2 className="font-serif text-xl font-bold text-text-primary">Tío José María</h2>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mt-1">Panel de gestión</p>
                </div>
                <div className="h-14 md:hidden" />

                <nav className="flex-grow p-3 space-y-5 overflow-y-auto" aria-label="Menú de administración">
                    {NAV_GROUPS.map(group => (
                        <div key={group.title}>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400 px-3 mb-1.5">{group.title}</p>
                            <div className="space-y-1">
                                {group.items.map(item => (
                                    <SidebarLink key={item.id} icon={<item.icon size={16} />} label={item.label}
                                        active={activeTab === item.id} onClick={() => go(item.id)}
                                        badge={item.badgeKey ? badges[item.badgeKey] : 0} />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-3 border-t border-gray-50">
                    <button onClick={() => supabase.auth.signOut()}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-bold">
                        <LogOut size={16} /> Cerrar sesión
                    </button>
                </div>
            </aside>

            <main className="flex-grow p-4 md:p-8 pt-18 md:pt-8 h-screen overflow-y-auto">
                <Suspense fallback={FALLBACK}>
                    {activeTab === 'dashboard'      && <AdminHome onNavigate={go} />}
                    {activeTab === 'planning'       && <PlanningCalendar />}
                    {activeTab === 'reservas'       && <BookingsManagerV2 />}
                    {activeTab === 'cleaning'       && <CleaningManager />}
                    {activeTab === 'access_codes'   && <AccessCodesManager />}
                    {activeTab === 'travelers'      && <TravelersManager />}
                    {activeTab === 'disponibilidad' && <AvailabilityManager />}
                    {activeTab === 'invoices'       && <InvoicesManager />}
                    {activeTab === 'pricing'        && <PricingRulesManager />}
                    {activeTab === 'temporadas'     && <SeasonsManager />}
                    {activeTab === 'channel_sync'   && <ChannelSyncManager />}
                    {activeTab === 'customer_360'   && <Customer360 />}
                    {activeTab === 'huespedes'      && <GuestUserManager />}
                    {activeTab === 'resenas'        && <ReviewsManager />}
                    {activeTab === 'apartamentos'   && <ApartmentsManager />}
                    {activeTab === 'rutas'          && <RoutesManager />}
                    {activeTab === 'eventos'        && <EventsManager />}
                    {activeTab === 'directorio'     && <PlacesManager />}
                    {activeTab === 'blog'           && <BlogManager />}
                    {activeTab === 'guias'          && <GuestGuidesManager />}
                    {activeTab === 'instrucciones'  && <InstructionsManager />}
                    {activeTab === 'protocols'      && <ProtocolsManager />}
                    {activeTab === 'internal_docs'  && <InternalDocsManager />}
                    {activeTab === 'bot_logs'       && <BotLogsManager />}
                    {activeTab === 'analitica'      && <AnalyticsDashboard />}
                    {activeTab === 'documentos'     && <DocumentsManager />}
                    {activeTab === 'qrcodes'        && <QRCodeManager />}
                    {activeTab === 'configuracion'  && <WebConfigManager />}
                </Suspense>
            </main>

            {/* Botón "?" flotante. No aparece en la vista de protocolos (sería redundante). */}
            {activeTab !== 'protocols' && <HelpButton tabId={activeTab} onNavigate={go} />}
        </div>
    );
};

const SidebarLink = ({ icon, label, active, onClick, badge }) => (
    <button onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
            active ? 'bg-rural-50 text-rural-700 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-text-primary'
        }`}>
        <span className={active ? 'text-primary' : 'text-gray-400'}>{icon}</span>
        <span className="flex-grow text-left">{label}</span>
        {badge > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{badge}</span>
        )}
    </button>
);

export default AdminDashboard;

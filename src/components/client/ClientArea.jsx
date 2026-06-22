import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LogOut, Mail, Phone, MapPin, Wifi, Copy, Check, ChevronDown,
    Compass, BookOpen, ShoppingBag, MessageCircle, Calendar,
    Users, Sparkles, Mountain, ChefHat, Tent, ShieldAlert, Info,
    ExternalLink, FileText, Flame, Home, Download,
    UtensilsCrossed, ThermometerSun, Shirt, DoorOpen, Clock, Key,
    ArrowRight, Loader2, Utensils, Play, AlertCircle, Receipt, History,
    CheckCircle, XCircle, CalendarCheck, MoreHorizontal, ChevronRight,
} from 'lucide-react';
import {
    useGuestGuides, useApartmentInstructions, useMyDiscountCodes, useLocalPlaces,
} from '../../hooks/useDatabase';

const fmtLongDate = (s) => s ? new Date(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

const INSTRUCTION_ICONS = {
    'map-pin': MapPin, 'key': Key, 'clock': Clock, 'wifi': Wifi, 'flame': Flame,
    'utensils-crossed': UtensilsCrossed, 'thermometer': ThermometerSun, 'shirt': Shirt,
    'door-open': DoorOpen, 'info': Info,
};

const GUIDE_CATEGORIES = [
    { key: 'rutas',        label: 'Rutas',        icon: Mountain },
    { key: 'naturaleza',   label: 'Naturaleza',   icon: Tent },
    { key: 'gastronomia',  label: 'Gastronomía',  icon: ChefHat },
    { key: 'actividades',  label: 'Actividades',  icon: Sparkles },
    { key: 'cultura',      label: 'Cultura',      icon: BookOpen },
    { key: 'servicios',    label: 'Servicios',    icon: Info },
];

// ────────────────────────────────────────────────────────────────────────────

const ClientArea = () => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [allBookings, setAllBookings] = useState([]);
    const [activeBooking, setActiveBooking] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [guidebook, setGuidebook] = useState(null);
    const [addons, setAddons] = useState([]);
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        (async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) { setLoading(false); return; }
            setUser(authUser);

            let { data: p } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
            if (!p && authUser.email) {
                const { data: pre } = await supabase.from('profiles').select('*').eq('email', authUser.email.toLowerCase()).maybeSingle();
                if (pre) {
                    const { data: linked } = await supabase.from('profiles').update({ id: authUser.id }).eq('id', pre.id).select().single();
                    p = linked;
                } else {
                    const { data: nu } = await supabase.from('profiles').insert({
                        id: authUser.id, email: authUser.email.toLowerCase(),
                        full_name: authUser.user_metadata?.full_name || '',
                        role: 'cliente',
                    }).select().single();
                    p = nu;
                }
            }
            if (p?.is_active === false) { setAccessDenied(true); setLoading(false); return; }
            setProfile(p);

            // TODAS las reservas del huésped (cualquier estado, ordenadas check_in desc)
            const { data: bookings } = await supabase
                .from('guest_bookings')
                .select('*, apartments(id, name, slug, images, description)')
                .ilike('guest_email', authUser.email)
                .order('check_in', { ascending: false });
            const list = bookings || [];
            setAllBookings(list);

            // Determinar reserva activa: la próxima/actual (in stay o futura). Fallback: la más reciente.
            const today = new Date().toISOString().slice(0, 10);
            const upcoming = list.find(b =>
                ['confirmed', 'completed'].includes(b.status) &&
                b.check_out >= today
            ) || list.find(b => ['confirmed', 'completed'].includes(b.status));
            setActiveBooking(upcoming || null);

            // Facturas de TODAS las reservas
            const bookingIds = list.map(b => b.id);
            if (bookingIds.length > 0) {
                const { data: inv } = await supabase.from('invoices')
                    .select('*')
                    .in('booking_id', bookingIds)
                    .order('fecha_emision', { ascending: false });
                setInvoices(inv || []);
            }

            if (upcoming?.apartment_id) {
                const { data: g } = await supabase.from('guidebooks').select('*').eq('apartment_id', upcoming.apartment_id).maybeSingle();
                setGuidebook(g);
                const { data: ad } = await supabase.from('addons').select('*').eq('active', true)
                    .or(`apartment_id.is.null,apartment_id.eq.${upcoming.apartment_id}`).order('sort_order');
                setAddons(ad || []);
            }

            // Documentos generales
            const { data: dx } = await supabase.from('documents')
                .select('*')
                .or(`visibility.eq.publico,visibility.eq.solo_clientes,profile_id.eq.${authUser.id}`)
                .order('created_at', { ascending: false });
            setDocs(dx || []);

            setLoading(false);
        })();
    }, []);

    const handleLogout = () => supabase.auth.signOut();

    if (loading) return <LoadingState />;
    if (accessDenied) return <AccessDenied onLogout={handleLogout} />;
    if (!user) return <div className="min-h-screen flex items-center justify-center"><Link to="/clientes" className="text-rural-700 font-bold">Iniciar sesión</Link></div>;

    return <Layout profile={profile} booking={activeBooking} allBookings={allBookings} invoices={invoices}
        guidebook={guidebook} addons={addons} docs={docs}
        onLogout={handleLogout} userEmail={user.email} />;
};

// ────────────────────────────────────────────────────────────────────────────
// Layout con menú de secciones (tabs)
// ────────────────────────────────────────────────────────────────────────────

const Layout = ({ profile, booking, allBookings, invoices, guidebook, addons, docs, onLogout, userEmail }) => {
    const [activeSection, setActiveSection] = useState('estancia');
    const [activeSheet, setActiveSheet] = useState(null);

    const today = new Date(); today.setHours(0,0,0,0);
    const checkIn = booking?.check_in ? new Date(booking.check_in) : null;
    const checkOut = booking?.check_out ? new Date(booking.check_out) : null;
    const daysLeft = checkIn ? daysBetween(today, checkIn) : null;
    const phase = !checkIn ? 'unknown'
        : daysLeft > 0 ? 'before'
        : (checkOut && today <= checkOut) ? 'during'
        : 'after';

    // Bottom navigation: 4 secciones principales + "Más" (resto)
    // El criterio: lo que el huésped usa más en móvil va a la barra; el resto al sheet "Más".
    const PRIMARY_NAV = [
        { key: 'estancia',    label: 'Estancia',  icon: Home,    hide: !booking },
        { key: 'apartamento', label: 'Casa',      icon: Key,     hide: !booking },
        { key: 'zona',        label: 'La zona',   icon: MapPin },
        { key: 'reservas',    label: 'Reservas',  icon: History },
    ].filter(s => !s.hide);

    const SECONDARY_NAV = [
        { key: 'guia',   label: 'Guía completa', icon: BookOpen, description: 'Rutas, naturaleza, gastronomía, cultura' },
        { key: 'extras', label: 'Extras',        icon: ShoppingBag, description: 'Cesta de bienvenida, late check-out, desayuno...', hide: phase !== 'before' || addons.length === 0 },
        { key: 'docs',   label: 'Documentos',    icon: FileText, description: 'Facturas, contratos y descargas' },
    ].filter(s => !s.hide);

    const allSections = [...PRIMARY_NAV, ...SECONDARY_NAV];
    const activeMeta = allSections.find(s => s.key === activeSection);
    // Si la sección activa NO está en PRIMARY_NAV, marcamos "Más" como activo en la barra
    const isInPrimary = PRIMARY_NAV.some(s => s.key === activeSection);

    const handleNavClick = (key) => {
        if (key === '__more__') {
            setActiveSheet({ type: 'more' });
        } else {
            setActiveSection(key);
            setActiveSheet(null);
            // Scroll al top al cambiar de sección
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        // pb-24 móvil: deja sitio para la bottom tab bar fija
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
            <TopBar profile={profile} onLogout={onLogout} userEmail={userEmail} />

            {!booking ? (
                <NoBookingState userEmail={userEmail} />
            ) : (
                <>
                    <HeroSummary booking={booking} daysLeft={daysLeft} phase={phase} />

                    {/* Etiqueta de sección visible (lo que en desktop sería el título de tab) */}
                    {activeMeta && (
                        <div className="max-w-2xl mx-auto px-4 mb-2">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 inline-flex items-center gap-1.5">
                                <activeMeta.icon size={11} />
                                {activeMeta.label}
                            </p>
                        </div>
                    )}

                    {/* Contenido de la sección activa */}
                    <main className="max-w-2xl mx-auto px-4">
                        <AnimatePresence mode="wait">
                            <motion.div key={activeSection}
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}>
                                {activeSection === 'estancia'    && <StayPanel booking={booking} guidebook={guidebook} onOpen={setActiveSheet} />}
                                {activeSection === 'apartamento' && <ApartmentPanel booking={booking} guidebook={guidebook} />}
                                {activeSection === 'guia'        && <GuidePanel />}
                                {activeSection === 'zona'        && <ZonePanel booking={booking} />}
                                {activeSection === 'extras'      && <ExtrasPanel addons={addons} booking={booking} onOpen={setActiveSheet} />}
                                {activeSection === 'reservas'    && <BookingsPanel allBookings={allBookings} invoices={invoices} activeBookingId={booking?.id} />}
                                {activeSection === 'docs'        && <DocsPanel docs={docs} phase={phase} />}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </>
            )}

            {/* BOTTOM TAB BAR — fija en móvil */}
            {booking && (
                <BottomNav
                    primary={PRIMARY_NAV}
                    hasSecondary={SECONDARY_NAV.length > 0}
                    activeKey={activeSection}
                    isInPrimary={isInPrimary}
                    onNav={handleNavClick} />
            )}

            <AnimatePresence>
                {activeSheet && <BottomSheet onClose={() => setActiveSheet(null)}>
                    {activeSheet.type === 'more'
                        ? <MoreSheet items={SECONDARY_NAV} activeKey={activeSection}
                            onSelect={(key) => { setActiveSection(key); setActiveSheet(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            onContact={() => setActiveSheet({ type: 'contact' })} />
                        : <SheetContent type={activeSheet.type} data={activeSheet.data} guidebook={guidebook} booking={booking} />
                    }
                </BottomSheet>}
            </AnimatePresence>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// BOTTOM TAB BAR — patrón mobile-first
// ────────────────────────────────────────────────────────────────────────────

const BottomNav = ({ primary, hasSecondary, activeKey, isInPrimary, onNav }) => {
    const items = hasSecondary
        ? [...primary, { key: '__more__', label: 'Más', icon: MoreHorizontal }]
        : primary;

    return (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            aria-label="Navegación principal">
            <div className="max-w-2xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
                {items.map(item => {
                    const Icon = item.icon;
                    const isActive = item.key === '__more__'
                        ? !isInPrimary
                        : item.key === activeKey;
                    return (
                        <button key={item.key} onClick={() => onNav(item.key)}
                            className="flex flex-col items-center justify-center gap-0.5 py-2.5 active:bg-gray-50 transition-colors relative"
                            aria-current={isActive ? 'page' : undefined}>
                            <Icon size={20} className={isActive ? 'text-rural-700' : 'text-gray-400'} strokeWidth={isActive ? 2.2 : 1.8} />
                            <span className={`text-[10px] font-semibold ${isActive ? 'text-rural-700' : 'text-gray-500'}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-rural-700" />
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

// Contenido del bottom sheet "Más" — lista de secciones secundarias + acceso a contacto
const MoreSheet = ({ items, activeKey, onSelect, onContact }) => (
    <div>
        <div className="px-5 pt-2 pb-3 border-b border-gray-200">
            <h2 className="font-serif text-xl font-bold text-gray-900">Más</h2>
        </div>
        <div className="p-3 space-y-1.5">
            {items.map(item => {
                const Icon = item.icon;
                const isActive = item.key === activeKey;
                return (
                    <button key={item.key} onClick={() => onSelect(item.key)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${isActive ? 'bg-rural-50 border border-rural-200' : 'hover:bg-gray-50'}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-rural-700 text-white' : 'bg-gray-100 text-rural-700'}`}>
                            <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-900">{item.label}</p>
                            {item.description && <p className="text-xs text-gray-500 truncate">{item.description}</p>}
                        </div>
                        <ChevronRight size={16} className="text-gray-300 shrink-0" />
                    </button>
                );
            })}
            <div className="pt-2 mt-2 border-t border-gray-100">
                <button onClick={onContact}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-rural-700 text-white hover:bg-rural-800 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                        <MessageCircle size={18} />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-bold text-sm">Contactar con nosotros</p>
                        <p className="text-xs opacity-90">WhatsApp, llamar o correo</p>
                    </div>
                    <ArrowRight size={16} className="shrink-0" />
                </button>
            </div>
        </div>
    </div>
);

// ────────────────────────────────────────────────────────────────────────────
// TopBar
// ────────────────────────────────────────────────────────────────────────────

const TopBar = ({ profile, onLogout, userEmail }) => (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Apartamentos Tío José María</p>
                <p className="font-serif text-base font-bold text-gray-900 truncate">
                    {profile?.full_name || userEmail?.split('@')[0]}
                </p>
            </div>
            <button onClick={onLogout} className="text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1 px-3 py-1.5">
                <LogOut size={13} /> Salir
            </button>
        </div>
    </header>
);

// ────────────────────────────────────────────────────────────────────────────
// Hero resumen reserva
// ────────────────────────────────────────────────────────────────────────────

const HeroSummary = ({ booking, daysLeft, phase }) => {
    const apt = booking.apartments;
    let kicker;
    if (phase === 'before') {
        if (daysLeft === 0) kicker = 'Hoy llegas';
        else if (daysLeft === 1) kicker = 'Mañana llegas';
        else kicker = `En ${daysLeft} días`;
    } else if (phase === 'during') kicker = 'Estás aquí';
    else if (phase === 'after') kicker = 'Estancia terminada';
    else kicker = '';

    return (
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {apt?.images?.[0] && (
                    <div className="relative h-44 sm:h-56 bg-gray-200">
                        <img src={apt.images[0]} alt={apt.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4 text-white">
                            {kicker && <p className="text-[10px] uppercase tracking-widest font-bold opacity-90 mb-1">{kicker}</p>}
                            <h1 className="font-serif text-2xl sm:text-3xl font-bold leading-tight">{apt.name}</h1>
                        </div>
                        <div className="absolute top-3 right-3 backdrop-blur-md bg-white/80 rounded-lg px-2 py-1">
                            <p className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Reserva</p>
                            <p className="text-xs font-mono font-bold text-rural-700">{booking.booking_code}</p>
                        </div>
                    </div>
                )}
                <div className="p-4 grid grid-cols-3 gap-2 text-center divide-x divide-gray-100">
                    <div>
                        <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Entrada</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">{new Date(booking.check_in).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <div>
                        <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Salida</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">{new Date(booking.check_out).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <div>
                        <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Personas</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">{booking.pax_count}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// PANEL: Mi estancia
// ────────────────────────────────────────────────────────────────────────────

const StayPanel = ({ booking, guidebook, onOpen }) => {
    const nights = daysBetween(booking.check_in, booking.check_out);
    return (
        <div className="space-y-4">
            {/* Quick actions */}
            <div className="grid grid-cols-4 gap-2">
                <QuickAction icon={Wifi} label="WiFi" onClick={() => onOpen({ type: 'wifi' })} disabled={!guidebook?.wifi_password} />
                <QuickAction icon={Compass} label="Llegar" onClick={() => onOpen({ type: 'arrival' })} />
                <QuickAction icon={MessageCircle} label="Contactar" onClick={() => onOpen({ type: 'contact' })} />
                <QuickAction icon={BookOpen} label="Normas" onClick={() => onOpen({ type: 'rules' })} disabled={!guidebook?.house_rules} />
            </div>

            {/* Detalles reserva */}
            <Section title="Detalles de tu reserva">
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
                    <DetailRow label="Llegada" value={fmtLongDate(booking.check_in)} hint="desde las 16:00" />
                    <DetailRow label="Salida" value={fmtLongDate(booking.check_out)} hint="hasta las 12:00" />
                    <DetailRow label="Noches" value={`${nights} ${nights === 1 ? 'noche' : 'noches'}`} />
                    <DetailRow label="Personas" value={`${booking.pax_count} ${booking.pax_count === 1 ? 'persona' : 'personas'}`} />
                    {booking.total_price && <DetailRow label="Total" value={`${Math.round(booking.total_price)} €`}
                        hint={booking.payment_status === 'paid' || booking.payment_status === 'paid_offline' ? 'Pagado' : 'Pendiente'} />}
                </div>
            </Section>

            {guidebook?.welcome_message && (
                <Section title="Bienvenida">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {guidebook.welcome_message}
                    </div>
                </Section>
            )}
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// PANEL: Apartamento (descripción + guidebook + instructions de admin)
// ────────────────────────────────────────────────────────────────────────────

const ApartmentPanel = ({ booking, guidebook }) => {
    const apt = booking?.apartments;
    const { instructions } = useApartmentInstructions(apt?.id);

    return (
        <div className="space-y-4">
            {apt?.description && (
                <Section title={apt.name}>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed">
                        {apt.description}
                    </div>
                </Section>
            )}

            {/* Instrucciones específicas del admin (apartment_instructions) */}
            {instructions.length > 0 && (
                <Section title="Cosas útiles del apartamento">
                    <div className="grid sm:grid-cols-2 gap-2">
                        {instructions.map(inst => {
                            const Icon = INSTRUCTION_ICONS[inst.icon] || Info;
                            return (
                                <div key={inst.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-rural-50 text-rural-700 flex items-center justify-center shrink-0">
                                        <Icon size={14} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-gray-900">{inst.title}</p>
                                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{inst.content}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Section>
            )}

            {/* Aparatos del guidebook */}
            {guidebook?.appliance_instructions && (
                <Section title="Cómo usar los aparatos">
                    <ExpandableCard icon={Flame} title="Calefacción, chimenea, electrodomésticos…" defaultOpen>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{guidebook.appliance_instructions}</p>
                    </ExpandableCard>
                </Section>
            )}

            {guidebook?.parking_info && (
                <Section title="Aparcamiento">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {guidebook.parking_info}
                    </div>
                </Section>
            )}

            {guidebook?.house_rules && (
                <Section title="Normas de la casa">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {guidebook.house_rules}
                    </div>
                </Section>
            )}
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// PANEL: Guía (datos reales de guest_guides)
// ────────────────────────────────────────────────────────────────────────────

const GuidePanel = () => {
    const { guides, loading } = useGuestGuides();
    const [activeCat, setActiveCat] = useState('rutas');

    if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Cargando guía…</div>;

    const categoriesWithContent = GUIDE_CATEGORIES.filter(c => guides.some(g => g.category === c.key));
    const filtered = guides.filter(g => g.category === activeCat);

    if (categoriesWithContent.length === 0) {
        return <EmptyState message="Aún no hay contenido en la guía." />;
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
                {categoriesWithContent.map(c => {
                    const Icon = c.icon;
                    const active = activeCat === c.key;
                    return (
                        <button key={c.key} onClick={() => setActiveCat(c.key)}
                            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                                active ? 'bg-rural-700 text-white' : 'bg-white text-gray-600 border border-gray-200'
                            }`}>
                            <Icon size={12} /> {c.label}
                        </button>
                    );
                })}
            </div>

            {filtered.length === 0 ? <EmptyState message="Pronto añadiremos cosas en esta categoría." /> : (
                <div className="grid gap-3">
                    {filtered.map(g => (
                        <article key={g.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            {g.image_url && (
                                <div className="h-44 relative overflow-hidden">
                                    <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" loading="lazy" />
                                    {g.video_url && (
                                        <a href={g.video_url} target="_blank" rel="noopener noreferrer"
                                            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                                                <Play size={20} className="text-rural-700 fill-rural-700" />
                                            </div>
                                        </a>
                                    )}
                                </div>
                            )}
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <h3 className="font-bold text-gray-900 text-sm">{g.title}</h3>
                                    <div className="flex gap-1 shrink-0">
                                        {g.difficulty && <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-rural-50 text-rural-700 rounded-full">{g.difficulty}</span>}
                                        {g.duration && <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-rural-50 text-rural-700 rounded-full">{g.duration}</span>}
                                    </div>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed mb-3">{g.description}</p>
                                {g.location_url && (
                                    <a href={g.location_url} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-rural-700 hover:underline">
                                        <MapPin size={12} /> Cómo llegar
                                    </a>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// PANEL: La zona (local_places: emergencias + restaurantes)
// ────────────────────────────────────────────────────────────────────────────

const ZonePanel = ({ booking }) => {
    const { places, loading } = useLocalPlaces();
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [openEvent, setOpenEvent] = useState(null);

    useEffect(() => {
        (async () => {
            if (!booking?.check_in || !booking?.check_out) { setEventsLoading(false); return; }
            // Eventos cuyo rango (event_date - end_date) se solapa con la estancia
            const { data } = await supabase.from('local_events')
                .select('*')
                .eq('active', true)
                .lte('event_date', booking.check_out)
                .or(`end_date.gte.${booking.check_in},end_date.is.null`)
                .order('event_date');
            // Filtro extra: si end_date es null tratar como event_date
            const filtered = (data || []).filter(e => {
                const start = e.event_date;
                const end = e.end_date || e.event_date;
                return start && end && start <= booking.check_out && end >= booking.check_in;
            });
            setEvents(filtered);
            setEventsLoading(false);
        })();
    }, [booking?.check_in, booking?.check_out]);

    if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Cargando…</div>;

    const emergencies = places.filter(p => p.type === 'emergencia' || p.type === 'farmacia');
    const restaurants = places.filter(p => p.type === 'restaurante');

    return (
        <div className="space-y-5">
            {/* Eventos durante la estancia — destacado arriba */}
            {!eventsLoading && events.length > 0 && (
                <Section title="Durante tu estancia" icon={Sparkles}>
                    <p className="text-sm text-gray-600 mb-3">
                        {events.length === 1 ? 'Esto pasa en la zona mientras estás aquí:' : `${events.length} eventos coinciden con tus fechas:`}
                    </p>
                    <div className="space-y-3">
                        {events.map(ev => <EventCard key={ev.id} event={ev} onOpen={() => setOpenEvent(ev)} />)}
                    </div>
                </Section>
            )}

            {openEvent && (
                <EventDetailSheet event={openEvent} onClose={() => setOpenEvent(null)} />
            )}

            <Section title="Emergencias" icon={ShieldAlert}>
                <a href="tel:112" className="block p-4 rounded-xl bg-red-50 border border-red-200 mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-500 text-white flex items-center justify-center">
                            <Phone size={18} />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-red-900 text-sm">Emergencias</p>
                            <p className="text-xs text-red-700">Policía, bomberos, ambulancia</p>
                        </div>
                        <span className="text-2xl font-bold text-red-700">112</span>
                    </div>
                </a>
                {emergencies.length > 0 && (
                    <div className="space-y-2">
                        {emergencies.map(p => (
                            <a key={p.id} href={`tel:${p.phone?.replace(/\s/g, '')}`}
                                className="block p-3 bg-white rounded-xl border border-gray-200 hover:shadow-sm transition-all">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-gray-900 truncate">{p.name}</p>
                                        {p.description && <p className="text-xs text-gray-600 truncate">{p.description}</p>}
                                    </div>
                                    {p.phone && <span className="text-sm font-bold text-rural-700 shrink-0">{p.phone}</span>}
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </Section>

            {restaurants.length > 0 && (
                <Section title="Dónde comer" icon={Utensils}>
                    <div className="grid gap-2">
                        {restaurants.map(r => (
                            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-3">
                                <p className="font-bold text-sm text-gray-900">{r.name}</p>
                                {r.description && <p className="text-xs text-gray-600 mt-0.5">{r.description}</p>}
                                <div className="flex gap-2 mt-2.5">
                                    {r.phone && (
                                        <a href={`tel:${r.phone.replace(/\s/g, '')}`}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rural-50 text-rural-700 rounded-full text-xs font-bold">
                                            <Phone size={11} /> Llamar
                                        </a>
                                    )}
                                    {r.web_url && (
                                        <a href={r.web_url} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
                                            <ExternalLink size={11} /> Ver web
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            <Section title="Ubicación" icon={MapPin}>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-700">Calle Baja 1, 23486 Hinojares (Jaén)</p>
                    <a href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-rural-700 hover:underline mt-2">
                        Abrir en Google Maps <ExternalLink size={11} />
                    </a>
                </div>
            </Section>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Event Card + sheet detalle
// ────────────────────────────────────────────────────────────────────────────

const CATEGORY_LABEL = {
    fiestas: 'Fiestas y romerías',
    gastronomía: 'Gastronomía',
    cultura: 'Cultura',
    naturaleza: 'Naturaleza',
    deportes: 'Deportes',
};

const fmtEventDate = (start, end) => {
    if (!start) return '—';
    const s = new Date(start);
    if (!end || start === end) return s.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const e = new Date(end);
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${s.getDate()} – ${e.getDate()} ${s.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
    }
    return `${s.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

const EventCard = ({ event, onOpen }) => (
    <button onClick={onOpen}
        className="w-full bg-white rounded-2xl border border-gray-200 overflow-hidden text-left hover:shadow-md transition-shadow active:scale-[0.99]">
        {event.image_url && (
            <div className="h-40 bg-gray-100 overflow-hidden">
                <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" loading="lazy" />
            </div>
        )}
        <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] uppercase tracking-widest font-bold text-rural-700 bg-rural-50 px-2 py-0.5 rounded-full">
                    {CATEGORY_LABEL[event.category] || event.category}
                </span>
                {Array.isArray(event.program) && event.program.length > 0 && (
                    <span className="text-[9px] uppercase font-bold text-gray-500 inline-flex items-center gap-1">
                        <Clock size={9} /> Con programa
                    </span>
                )}
            </div>
            <h3 className="font-bold text-sm text-gray-900 leading-tight">{event.title}</h3>
            <p className="text-xs text-gray-500 mt-1 tabular-nums">{fmtEventDate(event.event_date, event.end_date)}</p>
            {event.location && (
                <p className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1">
                    <MapPin size={10} /> {event.location}
                </p>
            )}
            {event.description && (
                <p className="text-xs text-gray-600 mt-2 line-clamp-2 leading-relaxed">{event.description}</p>
            )}
        </div>
    </button>
);

const EventDetailSheet = ({ event, onClose }) => (
    <BottomSheet onClose={onClose}>
        <div>
            {event.image_url && (
                <div className="bg-gray-100">
                    <img src={event.image_url} alt={event.title} className="w-full max-h-[60vh] object-contain" />
                </div>
            )}
            <div className="p-5 space-y-4">
                <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-rural-700 bg-rural-50 px-2 py-0.5 rounded-full">
                        {CATEGORY_LABEL[event.category] || event.category}
                    </span>
                    <h2 className="font-serif text-2xl font-bold text-gray-900 mt-2 leading-tight">{event.title}</h2>
                    <p className="text-sm text-gray-600 mt-1 tabular-nums font-medium">{fmtEventDate(event.event_date, event.end_date)}</p>
                </div>

                {event.description && (
                    <p className="text-sm text-gray-700 leading-relaxed">{event.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    {event.location && (
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Lugar</p>
                            <p className="text-sm text-gray-900">{event.location}</p>
                        </div>
                    )}
                    {event.organizer && (
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Organiza</p>
                            <p className="text-sm text-gray-900">{event.organizer}</p>
                        </div>
                    )}
                </div>

                {/* Programa horario */}
                {Array.isArray(event.program) && event.program.length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3 flex items-center gap-1">
                            <Clock size={11} /> Programa
                        </p>
                        <div className="space-y-2.5">
                            {event.program.map((item, idx) => (
                                <div key={idx} className="flex gap-3">
                                    <div className="w-14 shrink-0">
                                        <span className="font-mono font-bold text-sm text-rural-700 tabular-nums">{item.time || '—'}</span>
                                    </div>
                                    <p className="text-sm text-gray-700 leading-snug flex-1">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    </BottomSheet>
);

// ────────────────────────────────────────────────────────────────────────────
// PANEL: Extras (addons, solo pre-llegada)
// ────────────────────────────────────────────────────────────────────────────

const fmtCents = (c) => `${(c / 100).toFixed(0)}€`;
const PER_LABEL = { stay: 'por estancia', night: 'por noche', person_night: 'por persona y noche' };

const ExtrasPanel = ({ addons, booking, onOpen }) => (
    <div className="space-y-2">
        <p className="text-sm text-gray-600 mb-3">Cosas opcionales que puedes añadir a tu estancia.</p>
        {addons.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-rural-50 text-rural-700 flex items-center justify-center shrink-0">
                    <ShoppingBag size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900">{a.name}</p>
                    {a.description && <p className="text-xs text-gray-600 mt-0.5 leading-snug">{a.description}</p>}
                    <div className="mt-2 flex items-center justify-between">
                        <p className="text-sm">
                            <span className="font-bold text-gray-900">{fmtCents(a.price_cents)}</span>
                            <span className="text-gray-500 ml-1.5 text-xs">{PER_LABEL[a.per]}</span>
                        </p>
                        <button onClick={() => onOpen({ type: 'addon', data: a })}
                            className="text-xs font-bold text-white bg-rural-700 px-3 py-1.5 rounded-full">
                            Añadir
                        </button>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

// ────────────────────────────────────────────────────────────────────────────
// PANEL: Mis reservas (histórico completo + facturas)
// ────────────────────────────────────────────────────────────────────────────

const BOOKING_STATUS = {
    hold:      { label: 'Pendiente de pago', cls: 'bg-blue-50 text-blue-700 border-blue-200',     icon: Clock },
    pending:   { label: 'Sin confirmar',     cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: Clock },
    confirmed: { label: 'Confirmada',        cls: 'bg-green-50 text-green-700 border-green-200',   icon: CheckCircle },
    completed: { label: 'Finalizada',        cls: 'bg-gray-100 text-gray-700 border-gray-200',     icon: CalendarCheck },
    cancelled: { label: 'Cancelada',         cls: 'bg-red-50 text-red-700 border-red-200',         icon: XCircle },
    expired:   { label: 'Caducada',          cls: 'bg-gray-100 text-gray-500 border-gray-200',     icon: XCircle },
};

const BookingsPanel = ({ allBookings, invoices, activeBookingId }) => {
    if (allBookings.length === 0) {
        return <EmptyState message="No tienes reservas todavía." />;
    }

    // Separar activas/futuras vs pasadas/canceladas
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = allBookings.filter(b =>
        ['confirmed', 'completed'].includes(b.status) && b.check_out >= today
    );
    const past = allBookings.filter(b =>
        b.check_out < today || ['cancelled', 'expired'].includes(b.status)
    );

    const invoicesByBooking = invoices.reduce((acc, inv) => {
        if (!acc[inv.booking_id]) acc[inv.booking_id] = [];
        acc[inv.booking_id].push(inv);
        return acc;
    }, {});

    return (
        <div className="space-y-5">
            {upcoming.length > 0 && (
                <Section title={upcoming.length === 1 ? 'Tu próxima estancia' : 'Estancias próximas'}>
                    <div className="space-y-2">
                        {upcoming.map(b => (
                            <BookingCard key={b.id} booking={b}
                                invoices={invoicesByBooking[b.id] || []}
                                isActive={b.id === activeBookingId} />
                        ))}
                    </div>
                </Section>
            )}

            {past.length > 0 && (
                <Section title="Historial" icon={History}>
                    <div className="space-y-2">
                        {past.map(b => (
                            <BookingCard key={b.id} booking={b}
                                invoices={invoicesByBooking[b.id] || []} />
                        ))}
                    </div>
                </Section>
            )}

            {/* Resumen del huésped */}
            <Section title="Tu balance con nosotros">
                <BalanceCard allBookings={allBookings} invoices={invoices} />
            </Section>
        </div>
    );
};

const BookingCard = ({ booking, invoices, isActive }) => {
    const [expanded, setExpanded] = useState(isActive);
    const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.pending;
    const StatusIcon = status.icon;
    const nights = daysBetween(booking.check_in, booking.check_out);
    const apt = booking.apartments;

    return (
        <div className={`bg-white rounded-xl border overflow-hidden ${isActive ? 'border-rural-300 ring-2 ring-rural-100' : 'border-gray-200'}`}>
            <button onClick={() => setExpanded(e => !e)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 text-left">
                {apt?.images?.[0] ? (
                    <img src={apt.images[0]} alt={apt.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Home size={18} className="text-gray-400" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${status.cls}`}>
                            <StatusIcon size={9} /> {status.label}
                        </span>
                        {isActive && <span className="text-[10px] font-bold text-rural-700">Activa</span>}
                    </div>
                    <p className="font-bold text-sm text-gray-900 truncate">{apt?.name || 'Apartamento'}</p>
                    <p className="text-xs text-gray-500 tabular-nums">
                        {new Date(booking.check_in).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        {' → '}
                        {new Date(booking.check_out).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    {booking.total_price && (
                        <p className="font-bold text-sm text-gray-900 tabular-nums">{Math.round(booking.total_price)} €</p>
                    )}
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ml-auto mt-1 ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-4 pb-4 pt-1 space-y-3 text-sm border-t border-gray-100">
                            {/* Detalles */}
                            <div className="grid grid-cols-2 gap-3 pt-3">
                                <DetailMini label="Código" value={<span className="font-mono">{booking.booking_code || `#${booking.id}`}</span>} />
                                <DetailMini label="Personas" value={booking.pax_count} />
                                <DetailMini label="Noches" value={nights} />
                                <DetailMini label="Origen" value={booking.source || 'Web'} className="capitalize" />
                            </div>

                            {/* Pago */}
                            <div className="pt-3 border-t border-gray-100">
                                <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Pago</p>
                                <p className="text-sm text-gray-900">
                                    {booking.payment_status === 'paid' && '✓ Pagado online'}
                                    {booking.payment_status === 'paid_offline' && '✓ Pagado en efectivo / transferencia'}
                                    {booking.payment_status === 'partial' && 'Pagada la señal'}
                                    {booking.payment_status === 'refunded' && 'Reembolsado'}
                                    {booking.payment_status === 'failed' && 'Pago fallido'}
                                    {(!booking.payment_status || booking.payment_status === 'pending') && 'Pendiente'}
                                </p>
                            </div>

                            {/* Facturas */}
                            {invoices.length > 0 && (
                                <div className="pt-3 border-t border-gray-100">
                                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-2 flex items-center gap-1">
                                        <Receipt size={11} /> Facturas
                                    </p>
                                    <div className="space-y-1.5">
                                        {invoices.map(inv => (
                                            <div key={inv.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-lg">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-gray-900 truncate">
                                                        {inv.serie}-{inv.numero}
                                                        {inv.tipo === 'rectificativa' && <span className="ml-2 text-[9px] uppercase font-bold text-red-600">Rectificativa</span>}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {inv.fecha_emision && new Date(inv.fecha_emision).toLocaleDateString('es-ES')}
                                                        {inv.total && ` · ${Number(inv.total).toFixed(2)} €`}
                                                    </p>
                                                </div>
                                                {inv.pdf_url ? (
                                                    <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer"
                                                        className="w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-rural-700 hover:text-white text-gray-600 flex items-center justify-center transition-all shrink-0">
                                                        <Download size={13} />
                                                    </a>
                                                ) : (
                                                    <span className="text-[10px] text-gray-400 italic">PDF pendiente</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Si no hay factura pero la reserva está confirmada/completada, indicarlo */}
                            {invoices.length === 0 && ['confirmed', 'completed'].includes(booking.status) && booking.total_price && (
                                <div className="pt-3 border-t border-gray-100">
                                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 flex items-center gap-1">
                                        <Receipt size={11} /> Factura
                                    </p>
                                    <p className="text-xs text-gray-500 italic">Aún no se ha emitido. Si la necesitas, pídela por WhatsApp.</p>
                                </div>
                            )}

                            {booking.notes && (
                                <div className="pt-3 border-t border-gray-100">
                                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Notas</p>
                                    <p className="text-xs text-gray-700">{booking.notes}</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const DetailMini = ({ label, value, className = '' }) => (
    <div>
        <p className="text-[10px] uppercase font-bold text-gray-500">{label}</p>
        <p className={`text-sm text-gray-900 mt-0.5 ${className}`}>{value}</p>
    </div>
);

const BalanceCard = ({ allBookings, invoices }) => {
    const confirmed = allBookings.filter(b => ['confirmed', 'completed'].includes(b.status));
    const totalSpent = confirmed.reduce((s, b) => s + Number(b.total_price || 0), 0);
    const totalNights = confirmed.reduce((s, b) => s + daysBetween(b.check_in, b.check_out), 0);
    const firstStay = confirmed.length ? [...confirmed].sort((a, b) => a.check_in.localeCompare(b.check_in))[0] : null;

    return (
        <div className="bg-gradient-to-br from-rural-700 to-rural-800 rounded-xl p-5 text-white">
            <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">Estancias</p>
                    <p className="text-2xl font-serif font-bold mt-1">{confirmed.length}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">Noches</p>
                    <p className="text-2xl font-serif font-bold mt-1">{totalNights}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">Total</p>
                    <p className="text-2xl font-serif font-bold mt-1 tabular-nums">{Math.round(totalSpent)} €</p>
                </div>
            </div>
            {firstStay && (
                <p className="text-xs opacity-70 text-center mt-4 pt-3 border-t border-white/20">
                    Primera vez con nosotros: {new Date(firstStay.check_in).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </p>
            )}
            {invoices.length > 0 && (
                <p className="text-xs opacity-70 text-center mt-2">
                    {invoices.length} {invoices.length === 1 ? 'factura emitida' : 'facturas emitidas'}
                </p>
            )}
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// PANEL: Documentos + descuento
// ────────────────────────────────────────────────────────────────────────────

const DocsPanel = ({ docs, phase }) => {
    const { codes } = useMyDiscountCodes();
    return (
        <div className="space-y-4">
            {phase === 'after' && codes.length > 0 && (
                <Section title="Tu descuento para volver">
                    {codes.map(c => <DiscountCard key={c.id} code={c} />)}
                </Section>
            )}

            <Section title="Documentos">
                {docs.length === 0 ? <EmptyState message="No hay documentos disponibles todavía." /> : (
                    <div className="space-y-2">
                        {docs.map(d => (
                            <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-rural-50 text-rural-700 flex items-center justify-center shrink-0">
                                        <FileText size={14} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-gray-900 truncate">{d.title}</p>
                                        <p className="text-[10px] uppercase font-bold text-gray-400">{d.category || 'General'}</p>
                                    </div>
                                </div>
                                <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                                    className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-rural-700 hover:text-white text-gray-600 flex items-center justify-center transition-all shrink-0">
                                    <Download size={14} />
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </Section>
        </div>
    );
};

const DiscountCard = ({ code }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="bg-gradient-to-br from-rural-700 to-rural-800 rounded-2xl p-5 text-white">
            <p className="text-xs opacity-80 mb-1">Gracias por venir. Para tu próxima reserva:</p>
            <p className="text-3xl font-serif font-bold mb-2">{code.discount_percent}% descuento</p>
            {code.valid_until && <p className="text-[10px] opacity-60 mb-3">Válido hasta {new Date(code.valid_until).toLocaleDateString('es-ES')}</p>}
            <button onClick={handleCopy} className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-white text-rural-800 rounded-xl font-bold text-sm">
                {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar {code.code}</>}
            </button>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ────────────────────────────────────────────────────────────────────────────

const Section = ({ title, icon: Icon, children }) => (
    <section>
        <div className="flex items-center gap-2 mb-2 px-1">
            {Icon && <Icon size={14} className="text-rural-700" />}
            <h2 className="font-serif text-lg font-bold text-gray-900">{title}</h2>
        </div>
        {children}
    </section>
);

const QuickAction = ({ icon: Icon, label, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}
        className="flex flex-col items-center gap-1.5 py-3 bg-white border border-gray-200 rounded-xl active:scale-95 disabled:opacity-40 transition-all">
        <Icon size={18} className="text-rural-700" />
        <span className="text-[11px] font-bold text-gray-700">{label}</span>
    </button>
);

const DetailRow = ({ label, value, hint }) => (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{label}</p>
        <div className="text-right">
            <p className="text-sm font-bold text-gray-900 capitalize">{value}</p>
            {hint && <p className="text-[10px] text-gray-500">{hint}</p>}
        </div>
    </div>
);

const ExpandableCard = ({ icon: Icon, title, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setOpen(o => !o)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                {Icon && <Icon size={14} className="text-rural-700 shrink-0" />}
                <span className="font-bold text-sm text-gray-800 flex-1 text-left">{title}</span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-4 pb-4">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const EmptyState = ({ message }) => (
    <div className="text-center py-10 bg-white rounded-xl border-2 border-dashed border-gray-200">
        <p className="text-gray-400 text-sm italic">{message}</p>
    </div>
);


// ────────────────────────────────────────────────────────────────────────────
// BottomSheet + contenidos
// ────────────────────────────────────────────────────────────────────────────

const BottomSheet = ({ children, onClose }) => (
    <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl max-h-[88vh] overflow-hidden flex flex-col">
            <div className="pt-3 pb-1 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="overflow-y-auto flex-1">{children}</div>
        </motion.div>
    </>
);

const SheetContent = ({ type, data, guidebook, booking }) => {
    if (type === 'wifi')    return <WifiSheet guidebook={guidebook} />;
    if (type === 'arrival') return <ArrivalSheet guidebook={guidebook} />;
    if (type === 'contact') return <ContactSheet />;
    if (type === 'rules')   return <RulesSheet guidebook={guidebook} />;
    if (type === 'addon')   return <AddonSheet addon={data} booking={booking} />;
    return null;
};

const SheetHeader = ({ title }) => (
    <div className="px-5 pt-2 pb-3 border-b border-gray-200">
        <h2 className="font-serif text-xl font-bold text-gray-900">{title}</h2>
    </div>
);

const WifiSheet = ({ guidebook }) => {
    const [copied, setCopied] = useState(null);
    const copy = (v, k) => { navigator.clipboard.writeText(v); setCopied(k); setTimeout(() => setCopied(null), 1500); };
    return (
        <div>
            <SheetHeader title="WiFi" />
            <div className="p-5 space-y-3">
                {guidebook?.wifi_name && (
                    <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500">Red</p>
                            <p className="font-mono font-bold text-gray-900">{guidebook.wifi_name}</p>
                        </div>
                        <button onClick={() => copy(guidebook.wifi_name, 'n')} className="p-2 bg-white rounded-lg">
                            {copied === 'n' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        </button>
                    </div>
                )}
                {guidebook?.wifi_password && (
                    <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500">Contraseña</p>
                            <p className="font-mono font-bold text-gray-900 break-all">{guidebook.wifi_password}</p>
                        </div>
                        <button onClick={() => copy(guidebook.wifi_password, 'p')} className="p-2 bg-white rounded-lg shrink-0 ml-2">
                            {copied === 'p' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const ArrivalSheet = ({ guidebook }) => (
    <div>
        <SheetHeader title="Cómo llegar" />
        <div className="p-5 space-y-4 text-sm">
            <div>
                <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Dirección</p>
                <p className="text-gray-900">Calle Baja 1, 23486 Hinojares (Jaén)</p>
                <a href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-rural-50 text-rural-700 rounded-full text-xs font-bold">
                    Abrir en Maps <ExternalLink size={11} />
                </a>
            </div>
            {guidebook?.checkin_instructions && (
                <div className="pt-3 border-t border-gray-100">
                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Al llegar</p>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{guidebook.checkin_instructions}</p>
                </div>
            )}
            {guidebook?.parking_info && (
                <div className="pt-3 border-t border-gray-100">
                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Aparcamiento</p>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{guidebook.parking_info}</p>
                </div>
            )}
        </div>
    </div>
);

const ContactSheet = () => (
    <div>
        <SheetHeader title="Hablamos cuando quieras" />
        <div className="p-5 space-y-2">
            <a href="https://wa.me/34676344675" className="flex items-center justify-between p-4 bg-rural-700 text-white rounded-xl">
                <div className="flex items-center gap-3">
                    <MessageCircle size={18} />
                    <div className="text-left">
                        <p className="font-bold">WhatsApp</p>
                        <p className="text-xs opacity-80">Lo respondemos rápido</p>
                    </div>
                </div>
                <ArrowRight size={16} />
            </a>
            <a href="tel:+34676344675" className="flex items-center justify-between p-4 bg-gray-100 text-gray-900 rounded-xl">
                <div className="flex items-center gap-3">
                    <Phone size={18} />
                    <div className="text-left">
                        <p className="font-bold">Llamar</p>
                        <p className="text-xs text-gray-600">+34 676 34 46 75</p>
                    </div>
                </div>
                <ArrowRight size={16} />
            </a>
            <a href="mailto:apartamentostiojosemaria@gmail.com" className="flex items-center justify-between p-4 bg-gray-100 text-gray-900 rounded-xl">
                <div className="flex items-center gap-3">
                    <Mail size={18} />
                    <div className="text-left">
                        <p className="font-bold">Correo</p>
                        <p className="text-xs text-gray-600 truncate max-w-[200px]">apartamentostiojosemaria@gmail.com</p>
                    </div>
                </div>
                <ArrowRight size={16} />
            </a>
        </div>
    </div>
);

const RulesSheet = ({ guidebook }) => (
    <div>
        <SheetHeader title="Normas de la casa" />
        <div className="p-5">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {guidebook?.house_rules || 'Sin normas específicas configuradas.'}
            </p>
        </div>
    </div>
);

const AddonSheet = ({ addon, booking }) => {
    const [qty, setQty] = useState(1);
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);

    const handleAdd = async () => {
        setAdding(true);
        const { error } = await supabase.from('booking_addons').insert({
            booking_id: booking.id, addon_id: addon.id,
            name_snapshot: addon.name, unit_price_cents: addon.price_cents, quantity: qty,
        });
        setAdding(false);
        if (!error) setAdded(true);
    };

    return (
        <div>
            <SheetHeader title={addon.name} />
            <div className="p-5">
                {addon.description && <p className="text-sm text-gray-700 mb-4 leading-relaxed">{addon.description}</p>}
                <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase font-bold text-gray-500">Precio</p>
                        <p className="text-xl font-bold text-gray-900">{fmtCents(addon.price_cents * qty)}<span className="text-xs font-normal text-gray-500 ml-1">{PER_LABEL[addon.per]}</span></p>
                    </div>
                    <div className="flex items-center gap-1 bg-white rounded-full p-1">
                        <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-7 h-7 rounded-full hover:bg-gray-100 font-bold text-gray-700">−</button>
                        <span className="w-6 text-center font-bold">{qty}</span>
                        <button onClick={() => setQty(q => Math.min(10, q + 1))} className="w-7 h-7 rounded-full hover:bg-gray-100 font-bold text-gray-700">+</button>
                    </div>
                </div>
                {added ? (
                    <div className="text-center py-3">
                        <Check size={28} className="mx-auto mb-2 text-green-600" />
                        <p className="text-sm text-gray-700">Anotado. Lo verás cuando llegues.</p>
                    </div>
                ) : (
                    <button onClick={handleAdd} disabled={adding}
                        className="w-full py-3 bg-rural-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                        {adding ? <Loader2 size={14} className="animate-spin" /> : <>Añadir a la reserva <ArrowRight size={14} /></>}
                    </button>
                )}
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Estados auxiliares
// ────────────────────────────────────────────────────────────────────────────

const LoadingState = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={20} className="animate-spin text-gray-400" />
    </div>
);

const AccessDenied = ({ onLogout }) => (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
        <div className="max-w-md w-full text-center bg-white rounded-2xl border border-gray-200 p-8">
            <ShieldAlert size={32} className="text-red-500 mx-auto mb-3" />
            <h2 className="font-serif text-2xl font-bold text-gray-900 mb-2">Cuenta desactivada</h2>
            <p className="text-sm text-gray-600 mb-6">Si crees que es un error, escríbenos por WhatsApp y lo miramos.</p>
            <a href="https://wa.me/34676344675" className="inline-block py-3 px-6 bg-rural-700 text-white rounded-full font-bold text-sm">Contactar</a>
            <button onClick={onLogout} className="block mx-auto mt-4 text-xs text-gray-500">Cerrar sesión</button>
        </div>
    </div>
);

const NoBookingState = ({ userEmail }) => (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <Calendar size={32} className="text-gray-300 mx-auto mb-3" />
            <h2 className="font-serif text-xl font-bold text-gray-900 mb-2">Aún no vemos ninguna reserva</h2>
            <p className="text-sm text-gray-600 mb-6">
                No encontramos reservas asociadas a <strong className="text-gray-900">{userEmail}</strong>.
                Si reservaste con otro correo, escríbenos y lo vinculamos a mano.
            </p>
            <a href="https://wa.me/34676344675" className="inline-block py-3 px-6 bg-rural-700 text-white rounded-full font-bold text-sm">Contactar por WhatsApp</a>
        </div>
    </div>
);

export default ClientArea;

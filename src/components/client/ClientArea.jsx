import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
    LogOut, Mail, Phone, MapPin, Wifi, Copy, Check, ChevronDown, ChevronRight,
    Compass, BookOpen, ShoppingBag, MessageCircle, AlertTriangle, Calendar,
    Users, Hash, Sparkles, Mountain, ChefHat, Tent, ShieldAlert,
    Volume2, Pause, Play, X, ExternalLink, FileText, KeyRound, Flame, Home,
    Cloud, Sunrise, ArrowRight, Quote, Coffee, Loader2,
} from 'lucide-react';

const fmtLongDate = (s) => s ? new Date(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
const fmtShortDate = (s) => s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—';
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// ────────────────────────────────────────────────────────────────────────────
// Componente raíz
// ────────────────────────────────────────────────────────────────────────────

const ClientArea = () => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [booking, setBooking] = useState(null);
    const [guidebook, setGuidebook] = useState(null);
    const [addons, setAddons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        (async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) { setLoading(false); return; }
            setUser(authUser);

            // Profile (auto-create/link si no existe)
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

            // Booking más reciente del huésped
            const { data: b } = await supabase
                .from('guest_bookings')
                .select('*, apartments(id, name, slug, images, description)')
                .ilike('guest_email', authUser.email)
                .in('status', ['confirmed', 'completed'])
                .order('check_in', { ascending: false })
                .limit(1)
                .maybeSingle();
            setBooking(b);

            // Guidebook del apartamento
            if (b?.apartment_id) {
                const { data: g } = await supabase.from('guidebooks').select('*').eq('apartment_id', b.apartment_id).maybeSingle();
                setGuidebook(g);

                // Addons disponibles para este apartamento
                const { data: ad } = await supabase.from('addons')
                    .select('*')
                    .eq('active', true)
                    .or(`apartment_id.is.null,apartment_id.eq.${b.apartment_id}`)
                    .order('sort_order');
                setAddons(ad || []);
            }

            setLoading(false);
        })();
    }, []);

    const handleLogout = () => supabase.auth.signOut();

    if (loading) return <LoadingState />;
    if (accessDenied) return <AccessDenied onLogout={handleLogout} />;
    if (!user) return <Link to="/clientes">Iniciar sesión</Link>;

    return <Layout profile={profile} booking={booking} guidebook={guidebook} addons={addons} onLogout={handleLogout} userEmail={user.email} />;
};

// ────────────────────────────────────────────────────────────────────────────
// Layout principal
// ────────────────────────────────────────────────────────────────────────────

const Layout = ({ profile, booking, guidebook, addons, onLogout, userEmail }) => {
    const [activeSheet, setActiveSheet] = useState(null);
    const heroRef = useRef(null);

    const today = new Date(); today.setHours(0,0,0,0);
    const checkIn = booking?.check_in ? new Date(booking.check_in) : null;
    const checkOut = booking?.check_out ? new Date(booking.check_out) : null;
    const daysLeft = checkIn ? daysBetween(today, checkIn) : null;
    const phase = !checkIn ? 'unknown'
        : daysLeft > 0 ? 'before'
        : (checkOut && today <= checkOut) ? 'during'
        : 'after';

    return (
        <div className="min-h-screen relative" style={{ background: 'var(--color-papel)' }}>
            {/* Textura papel global */}
            <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
                style={{ backgroundImage: 'radial-gradient(circle at 25% 35%, #2C3319 0.5px, transparent 0.5px), radial-gradient(circle at 75% 65%, #2C3319 0.5px, transparent 0.5px)', backgroundSize: '20px 20px, 28px 28px' }} />

            <TopBar profile={profile} onLogout={onLogout} userEmail={userEmail} />

            <main className="relative z-10 pb-32">
                {booking ? (
                    <>
                        <Hero booking={booking} daysLeft={daysLeft} phase={phase} profile={profile} />
                        <QuickActions onOpen={setActiveSheet} guidebook={guidebook} />
                        <SectionDivider number="01" title="La estancia" />
                        <StayDetails booking={booking} phase={phase} />
                        <SectionDivider number="02" title="Tu apartamento" />
                        <ApartmentInfo guidebook={guidebook} booking={booking} onOpenSheet={setActiveSheet} />
                        <SectionDivider number="03" title="Carta de los anfitriones" />
                        <HostsLetter booking={booking} phase={phase} />
                        <SectionDivider number="04" title="Por aquí" />
                        <EditorialGuide guidebook={guidebook} />
                        {phase === 'before' && addons.length > 0 && (
                            <>
                                <SectionDivider number="05" title="Si te apetece" subtitle="Extras opcionales para tu estancia" />
                                <AddonsSection addons={addons} onAdd={(a) => setActiveSheet({ type: 'addon', data: a })} />
                            </>
                        )}
                        {phase === 'after' && <ReviewPrompt booking={booking} />}
                    </>
                ) : (
                    <NoBookingState userEmail={userEmail} />
                )}
            </main>

            <StickyContact onClick={() => setActiveSheet({ type: 'contact' })} />

            <AnimatePresence>
                {activeSheet && <BottomSheet onClose={() => setActiveSheet(null)}>
                    <SheetContent type={activeSheet.type} data={activeSheet.data} guidebook={guidebook} booking={booking} />
                </BottomSheet>}
            </AnimatePresence>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// TopBar minimalista
// ────────────────────────────────────────────────────────────────────────────

const TopBar = ({ profile, onLogout, userEmail }) => (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-white/70 border-b border-stone-200/40">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
            <div>
                <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[9px] uppercase tracking-[0.3em] text-stone-500">Tu cuenta</p>
                <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500 }} className="text-base text-stone-800 leading-tight">
                    {profile?.full_name?.split(' ')[0] || userEmail?.split('@')[0]}
                </p>
            </div>
            <button onClick={onLogout}
                style={{ fontFamily: 'var(--font-ui)' }}
                className="text-xs text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 px-2 py-1">
                <LogOut size={11} /> Salir
            </button>
        </div>
    </header>
);

// ────────────────────────────────────────────────────────────────────────────
// Hero — la pieza central
// ────────────────────────────────────────────────────────────────────────────

const Hero = ({ booking, daysLeft, phase, profile }) => {
    const apt = booking.apartments;
    const firstName = (profile?.full_name || booking.guest_name || '').split(' ')[0] || 'Bienvenido';

    let kicker, headline;
    if (phase === 'before') {
        if (daysLeft === 0) { kicker = 'Hoy'; headline = `Te recibimos en ${apt?.name}`; }
        else if (daysLeft === 1) { kicker = 'Mañana'; headline = `Te esperamos en ${apt?.name}`; }
        else if (daysLeft < 7) { kicker = `En ${daysLeft} días`; headline = `Casi en Hinojares`; }
        else if (daysLeft < 30) { kicker = `En ${daysLeft} días`; headline = `Estás cerca, ${firstName}`; }
        else { kicker = `En ${daysLeft} días`; headline = `${firstName}, ya estás en nuestra agenda`; }
    } else if (phase === 'during') {
        kicker = 'Ahora mismo'; headline = `Estás en ${apt?.name}`;
    } else if (phase === 'after') {
        kicker = 'Hasta la próxima'; headline = `Gracias por venir, ${firstName}`;
    } else {
        kicker = 'Hola'; headline = `${firstName}, bienvenido`;
    }

    return (
        <section className="relative pt-6 pb-2">
            <div className="max-w-md mx-auto px-5">
                {/* Kicker */}
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    style={{ fontFamily: 'var(--font-ui)' }}
                    className="text-[10px] uppercase tracking-[0.35em] font-semibold text-stone-500 mb-3">
                    {kicker}
                </motion.p>

                {/* Headline editorial */}
                <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 0.95, letterSpacing: '-0.02em' }}
                    className="text-[2.5rem] sm:text-5xl text-stone-900 mb-1">
                    {headline.split(' ').map((w, i) => (
                        <span key={i} className={i % 3 === 1 ? 'italic' : ''}>{w} </span>
                    ))}
                </motion.h1>

                {/* Línea separadora */}
                <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
                    className="h-px w-16 mt-4 mb-6 origin-left" style={{ background: 'var(--color-rural-600)' }} />

                {/* Foto del apartamento — full bleed mobile */}
                {apt?.images?.[0] && (
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
                        className="relative -mx-5 sm:mx-0 sm:rounded-3xl overflow-hidden bg-stone-200 aspect-[4/5] sm:aspect-[3/2]">
                        <img src={apt.images[0]} alt={apt.name} className="w-full h-full object-cover" loading="eager" />
                        {/* Sello con número de reserva */}
                        <div className="absolute bottom-4 left-4 backdrop-blur-md bg-white/80 rounded-xl px-3 py-2">
                            <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[9px] uppercase tracking-[0.25em] text-stone-500">Reserva</p>
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }} className="text-sm text-stone-900 tabular-nums">
                                {booking.booking_code}
                            </p>
                        </div>
                        {/* Phase chip */}
                        {phase === 'during' && (
                            <div className="absolute top-4 right-4 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5"
                                style={{ background: 'rgba(85, 107, 47, 0.92)' }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                <span style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-widest font-bold text-white">En tu estancia</span>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </section>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Quick Actions chips
// ────────────────────────────────────────────────────────────────────────────

const QuickActions = ({ onOpen, guidebook }) => {
    const actions = [
        { type: 'wifi',    label: 'WiFi',         icon: Wifi,     hide: !guidebook?.wifi_password },
        { type: 'arrival', label: 'Cómo llegar',  icon: Compass },
        { type: 'contact', label: 'Contactar',    icon: MessageCircle },
        { type: 'rules',   label: 'Normas',       icon: BookOpen, hide: !guidebook?.house_rules },
    ].filter(a => !a.hide);

    return (
        <div className="max-w-md mx-auto px-5 mt-6">
            <div className="grid grid-cols-4 gap-2">
                {actions.map((a, i) => (
                    <motion.button key={a.type}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                        onClick={() => onOpen({ type: a.type })}
                        className="flex flex-col items-center gap-2 py-3 bg-white border border-stone-200/60 rounded-2xl hover:border-stone-300 active:scale-95 transition-all">
                        <a.icon size={18} className="text-stone-700" strokeWidth={1.5} />
                        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 500 }} className="text-[11px] text-stone-700">{a.label}</span>
                    </motion.button>
                ))}
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Section Divider editorial
// ────────────────────────────────────────────────────────────────────────────

const SectionDivider = ({ number, title, subtitle }) => (
    <div className="max-w-md mx-auto px-5 mt-16 mb-6">
        <div className="flex items-baseline gap-3 mb-1">
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-dorado)' }}
                className="text-2xl tabular-nums">
                {number}
            </span>
            <div className="h-px flex-1" style={{ background: 'var(--color-rural-300)' }} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.01em' }}
            className="text-2xl text-stone-900">
            {title}
        </h2>
        {subtitle && (
            <p style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic' }}
                className="text-sm text-stone-500 mt-1">{subtitle}</p>
        )}
    </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Detalles de la estancia
// ────────────────────────────────────────────────────────────────────────────

const StayDetails = ({ booking, phase }) => {
    const nights = booking.check_in && booking.check_out ? daysBetween(booking.check_in, booking.check_out) : 0;
    return (
        <div className="max-w-md mx-auto px-5">
            <div className="bg-white border border-stone-200/60 rounded-2xl divide-y divide-stone-100">
                <DetailRow icon={Calendar} label="Llegada" value={fmtLongDate(booking.check_in)} valueDetail="desde las 16:00" />
                <DetailRow icon={Calendar} label="Salida" value={fmtLongDate(booking.check_out)} valueDetail="hasta las 12:00" />
                <DetailRow icon={Users} label="Personas" value={`${booking.pax_count} ${booking.pax_count === 1 ? 'persona' : 'personas'}`} valueDetail={`${nights} ${nights === 1 ? 'noche' : 'noches'}`} />
                {booking.total_price && (
                    <DetailRow icon={Hash} label="Total reserva" value={`${Math.round(booking.total_price)} €`}
                        valueDetail={booking.payment_status === 'paid' || booking.payment_status === 'paid_offline' ? 'Pagado' : 'Pendiente'} />
                )}
            </div>
        </div>
    );
};

const DetailRow = ({ icon: Icon, label, value, valueDetail }) => (
    <div className="flex items-center gap-4 px-5 py-4">
        <Icon size={16} className="text-stone-400 shrink-0" strokeWidth={1.5} />
        <div className="flex-1 min-w-0">
            <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{label}</p>
            <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-base text-stone-900 capitalize">{value}</p>
        </div>
        {valueDetail && (
            <p style={{ fontFamily: 'var(--font-ui)' }} className="text-xs text-stone-500 text-right">{valueDetail}</p>
        )}
    </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Info apartamento (descripción + acceso al guidebook completo)
// ────────────────────────────────────────────────────────────────────────────

const ApartmentInfo = ({ guidebook, booking, onOpenSheet }) => {
    const apt = booking?.apartments;
    if (!apt) return null;
    return (
        <div className="max-w-md mx-auto px-5">
            {apt.description && (
                <p style={{ fontFamily: 'var(--font-editorial)' }}
                    className="text-base leading-relaxed text-stone-700 mb-5 first-letter:text-3xl first-letter:font-semibold first-letter:mr-1 first-letter:float-left first-letter:leading-[0.85]"
                    >
                    {apt.description.slice(0, 280)}{apt.description.length > 280 ? '…' : ''}
                </p>
            )}

            <div className="space-y-2">
                {guidebook?.appliance_instructions && (
                    <ExpandableCard icon={Flame} title="Cómo usar los aparatos">
                        <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-sm leading-relaxed text-stone-700 whitespace-pre-wrap">{guidebook.appliance_instructions}</p>
                    </ExpandableCard>
                )}
                {guidebook?.parking_info && (
                    <ExpandableCard icon={MapPin} title="Aparcamiento">
                        <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-sm leading-relaxed text-stone-700 whitespace-pre-wrap">{guidebook.parking_info}</p>
                    </ExpandableCard>
                )}
            </div>
        </div>
    );
};

const ExpandableCard = ({ icon: Icon, title, children }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="bg-white border border-stone-200/60 rounded-2xl overflow-hidden">
            <button onClick={() => setOpen(o => !o)}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-stone-50/60 active:bg-stone-100">
                <Icon size={16} className="text-stone-500 shrink-0" strokeWidth={1.5} />
                <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }} className="text-sm text-stone-800 flex-1 text-left">{title}</span>
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={16} className="text-stone-400" />
                </motion.span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }} className="overflow-hidden">
                        <div className="px-5 pb-5">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// HOSTS LETTER — pieza editorial firmada
// ────────────────────────────────────────────────────────────────────────────

const HostsLetter = ({ booking, phase }) => {
    const firstName = (booking.guest_name || '').split(' ')[0] || '';
    let body;
    if (phase === 'before') {
        body = `Llevamos años recibiendo gente en esta casa y cada vez se nos hace nuevo. Si necesitas cualquier cosa antes de venir —una hora de llegada distinta, alguna alergia, una duda por tonta que parezca— escríbenos sin más. Estaremos esperándote en la puerta.`;
    } else if (phase === 'during') {
        body = `Esperamos que la casa te esté tratando bien. Si hay algo que mejorar, dínoslo ahora mejor que después: estamos a un mensaje y vivimos cerca. Disfruta de Hinojares: por la tarde da mucho gusto pasear hasta el mirador.`;
    } else {
        body = `Gracias por venir. La sierra es generosa con quien la sabe escuchar y nos alegra mucho que hayas formado parte de eso unos días. Si en algún momento te apetece volver, ya sabes dónde encontrarnos.`;
    }

    return (
        <div className="max-w-md mx-auto px-5">
            <div className="relative bg-white border border-stone-200/60 rounded-2xl p-6 pt-8">
                <Quote size={28} className="absolute -top-3 left-6 bg-white px-1" style={{ color: 'var(--color-dorado)' }} strokeWidth={1.5} />
                <p style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: '1.0625rem', lineHeight: 1.6 }}
                    className="text-stone-700">
                    {firstName && <span className="not-italic font-medium text-stone-900">Querido {firstName}, </span>}
                    {body}
                </p>
                <div className="mt-5 pt-5 border-t border-stone-200/60">
                    <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500 }}
                        className="text-lg text-stone-900">
                        Mari Carmen y Jesús
                    </p>
                    <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.25em] text-stone-500 mt-1">
                        Los anfitriones
                    </p>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// EDITORIAL GUIDE — recomendaciones de la zona con voz primera persona
// ────────────────────────────────────────────────────────────────────────────

const EDITORIAL_PICKS = [
    {
        kicker: 'Mari Carmen recomienda',
        title: 'Una merienda como Dios manda',
        body: 'En la panadería de la Plaza, Paco abre a las 7:30. Si pides un panecillo recién hecho con jamón y un café de puchero, ya tienes la mañana. Cierra de 14:30 a 18:00 — al pueblo va con calma.',
        location: 'Panadería del centro · Hinojares',
        emoji: '🥖',
    },
    {
        kicker: 'A Jesús le gusta',
        title: 'Subir al mirador antes del amanecer',
        body: 'Vale la pena madrugar una vez. Sales por la Calle Alta, sigues el camino de tierra unos 15 minutos, y desde arriba se ve toda la sierra todavía azul. Llévate algo de abrigo aunque sea verano.',
        location: 'Mirador del Castillo · 15 min andando',
        emoji: '⛰️',
    },
    {
        kicker: 'Si te gusta el aceite',
        title: 'La cooperativa de Quesada',
        body: 'A quince minutos en coche. Hacen un picual de los buenos. Si vas en horario de mañana, te enseñan el molino y catas tres aceites distintos. Llévate una garrafa para casa.',
        location: 'Cooperativa Olivarera · Quesada',
        emoji: '🫒',
    },
    {
        kicker: 'Para cenar bien',
        title: 'Cabra y vino del Cazorla',
        body: 'En El Mirador, Pilar borda el segureño (cabra al horno). Cenas por 25-30€ con vino del Cazorla. Mejor reservar antes — son seis mesas.',
        location: 'Restaurante El Mirador · Pozo Alcón',
        emoji: '🍷',
    },
];

const EditorialGuide = ({ guidebook }) => {
    return (
        <div className="max-w-md mx-auto px-5">
            <div className="space-y-4">
                {EDITORIAL_PICKS.map((pick, i) => (
                    <motion.article key={i}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ delay: i * 0.08, duration: 0.5 }}
                        className="bg-white border border-stone-200/60 rounded-2xl p-5">
                        <div className="flex items-start gap-3 mb-3">
                            <span className="text-2xl mt-0.5">{pick.emoji}</span>
                            <div>
                                <p style={{ fontFamily: 'var(--font-ui)', color: 'var(--color-dorado)' }}
                                    className="text-[10px] uppercase tracking-[0.25em] font-semibold">
                                    {pick.kicker}
                                </p>
                                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontStyle: 'italic' }}
                                    className="text-xl text-stone-900 leading-tight mt-1">
                                    {pick.title}
                                </h3>
                            </div>
                        </div>
                        <p style={{ fontFamily: 'var(--font-editorial)' }}
                            className="text-[15px] leading-relaxed text-stone-700">
                            {pick.body}
                        </p>
                        <p style={{ fontFamily: 'var(--font-ui)' }}
                            className="text-xs text-stone-500 mt-3 flex items-center gap-1.5">
                            <MapPin size={11} /> {pick.location}
                        </p>
                    </motion.article>
                ))}

                {guidebook?.nearby_recommendations && (
                    <div className="bg-stone-100/50 border border-stone-200/60 rounded-2xl p-5">
                        <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.25em] font-semibold text-stone-500 mb-2">
                            Más recomendaciones
                        </p>
                        <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-sm leading-relaxed text-stone-700 whitespace-pre-wrap">
                            {guidebook.nearby_recommendations}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// ADDONS — extras como tarjetas con foto
// ────────────────────────────────────────────────────────────────────────────

const fmtCents = (c) => `${(c / 100).toFixed(0)}€`;
const PER_LABEL = { stay: 'por estancia', night: 'por noche', person_night: 'por persona y noche' };

const AddonsSection = ({ addons, onAdd }) => (
    <div className="max-w-md mx-auto px-5">
        <div className="space-y-3">
            {addons.map((a, i) => (
                <motion.div key={a.id}
                    initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white border border-stone-200/60 rounded-2xl p-5 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'var(--color-rural-100)' }}>
                        <ShoppingBag size={18} className="text-stone-700" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }} className="text-lg text-stone-900 leading-tight">
                            {a.name}
                        </h3>
                        {a.description && (
                            <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-sm text-stone-600 mt-1 leading-snug line-clamp-2">
                                {a.description}
                            </p>
                        )}
                        <div className="mt-3 flex items-center justify-between">
                            <p style={{ fontFamily: 'var(--font-ui)' }} className="text-sm">
                                <span className="font-semibold text-stone-900">{fmtCents(a.price_cents)}</span>
                                <span className="text-stone-500 ml-1.5 text-xs">{PER_LABEL[a.per]}</span>
                            </p>
                            <button onClick={() => onAdd(a)}
                                style={{ fontFamily: 'var(--font-ui)', background: 'var(--color-terracota)' }}
                                className="text-xs font-semibold text-white px-3 py-1.5 rounded-full active:scale-95 transition-transform">
                                Añadir
                            </button>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    </div>
);

// ────────────────────────────────────────────────────────────────────────────
// REVIEW PROMPT — post estancia
// ────────────────────────────────────────────────────────────────────────────

const ReviewPrompt = ({ booking }) => (
    <div className="max-w-md mx-auto px-5 mt-16">
        <div className="bg-stone-900 rounded-2xl p-8 text-white text-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full" style={{ background: 'var(--color-dorado)', opacity: 0.15 }} />
            <Sparkles size={24} className="mx-auto mb-3" style={{ color: 'var(--color-dorado)' }} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontStyle: 'italic' }} className="text-2xl mb-2">
                ¿Cómo fue?
            </h3>
            <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-sm text-stone-300 mb-6 leading-relaxed max-w-xs mx-auto">
                Una reseña en Google nos cambia el mes. Si tienes dos minutos…
            </p>
            <a href="https://g.page/r/CTDH4snlte-aEBM/review" target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-ui)', background: 'var(--color-dorado)' }}
                className="inline-flex items-center gap-2 px-6 py-3 text-stone-900 rounded-full text-sm font-semibold">
                Dejar reseña <ExternalLink size={14} />
            </a>
        </div>
    </div>
);

// ────────────────────────────────────────────────────────────────────────────
// STICKY CONTACT
// ────────────────────────────────────────────────────────────────────────────

const StickyContact = ({ onClick }) => (
    <div className="fixed bottom-0 inset-x-0 z-20 pointer-events-none">
        <div className="max-w-md mx-auto px-5 pb-6 pt-4 bg-gradient-to-t from-papel via-papel/90 to-transparent"
            style={{ background: 'linear-gradient(to top, var(--color-papel) 60%, transparent)' }}>
            <button onClick={onClick}
                style={{ background: 'var(--color-rural-600)', fontFamily: 'var(--font-ui)' }}
                className="pointer-events-auto w-full py-4 text-white rounded-2xl font-semibold tracking-wide shadow-lg shadow-stone-900/10 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <MessageCircle size={16} /> Contactar con Mari Carmen y Jesús
            </button>
        </div>
    </div>
);

// ────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET
// ────────────────────────────────────────────────────────────────────────────

const BottomSheet = ({ children, onClose }) => (
    <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40" />
        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl max-h-[88vh] overflow-hidden flex flex-col"
            drag="y" dragConstraints={{ top: 0 }} dragElastic={0.2}
            onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}>
            <div className="pt-3 pb-1 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>
            <div className="overflow-y-auto flex-1">{children}</div>
        </motion.div>
    </>
);

// ────────────────────────────────────────────────────────────────────────────
// SHEET CONTENT — contenido según tipo
// ────────────────────────────────────────────────────────────────────────────

const SheetContent = ({ type, data, guidebook, booking }) => {
    if (type === 'wifi') return <WifiSheet guidebook={guidebook} />;
    if (type === 'arrival') return <ArrivalSheet guidebook={guidebook} booking={booking} />;
    if (type === 'contact') return <ContactSheet />;
    if (type === 'rules') return <RulesSheet guidebook={guidebook} />;
    if (type === 'addon') return <AddonSheet addon={data} booking={booking} />;
    return null;
};

const SheetHeader = ({ title, kicker }) => (
    <div className="px-6 pt-2 pb-4 border-b border-stone-200/60">
        {kicker && <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.3em] text-stone-500">{kicker}</p>}
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontStyle: 'italic' }} className="text-2xl text-stone-900 mt-0.5">{title}</h2>
    </div>
);

const WifiSheet = ({ guidebook }) => {
    const [copied, setCopied] = useState(null);
    const copy = (v, k) => { navigator.clipboard.writeText(v); setCopied(k); setTimeout(() => setCopied(null), 1500); };
    return (
        <div>
            <SheetHeader kicker="Conexión" title="WiFi" />
            <div className="p-6 space-y-3">
                {guidebook?.wifi_name && (
                    <div className="bg-stone-50 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                            <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Red</p>
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }} className="text-base text-stone-900 break-all">{guidebook.wifi_name}</p>
                        </div>
                        <button onClick={() => copy(guidebook.wifi_name, 'name')}
                            className="p-3 rounded-xl bg-white text-stone-700 hover:bg-stone-100 active:scale-95 transition-all">
                            {copied === 'name' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                        </button>
                    </div>
                )}
                {guidebook?.wifi_password && (
                    <div className="bg-stone-50 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                            <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Contraseña</p>
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }} className="text-base text-stone-900 break-all">{guidebook.wifi_password}</p>
                        </div>
                        <button onClick={() => copy(guidebook.wifi_password, 'pwd')}
                            className="p-3 rounded-xl bg-white text-stone-700 hover:bg-stone-100 active:scale-95 transition-all">
                            {copied === 'pwd' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                        </button>
                    </div>
                )}
                <p style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic' }} className="text-sm text-stone-500 pt-2 leading-relaxed">
                    Si la señal flaquea en alguna habitación, dínoslo y miramos lo del repetidor.
                </p>
            </div>
        </div>
    );
};

const ArrivalSheet = ({ guidebook, booking }) => (
    <div>
        <SheetHeader kicker="Llegar" title="Cómo encontrarnos" />
        <div className="p-6 space-y-5">
            <div>
                <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.25em] text-stone-500 mb-1">Dirección</p>
                <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.0625rem' }} className="text-stone-900 leading-snug">
                    Calle Baja 1<br />23486 Hinojares (Jaén)
                </p>
                <a href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8" target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--font-ui)', background: 'var(--color-rural-100)', color: 'var(--color-rural-700)' }}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold mt-3 px-4 py-2 rounded-full">
                    Abrir en Maps <ExternalLink size={12} />
                </a>
            </div>
            {guidebook?.checkin_instructions && (
                <div className="pt-4 border-t border-stone-200/60">
                    <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.25em] text-stone-500 mb-2">Al llegar</p>
                    <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-base text-stone-700 leading-relaxed whitespace-pre-wrap">
                        {guidebook.checkin_instructions}
                    </p>
                </div>
            )}
            {guidebook?.parking_info && (
                <div className="pt-4 border-t border-stone-200/60">
                    <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.25em] text-stone-500 mb-2">Aparcamiento</p>
                    <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-base text-stone-700 leading-relaxed whitespace-pre-wrap">
                        {guidebook.parking_info}
                    </p>
                </div>
            )}
        </div>
    </div>
);

const ContactSheet = () => (
    <div>
        <SheetHeader kicker="Estamos aquí" title="Hablamos cuando quieras" />
        <div className="p-6 space-y-3">
            <a href="https://wa.me/34676344675"
                style={{ background: 'var(--color-rural-600)', fontFamily: 'var(--font-ui)' }}
                className="flex items-center justify-between p-5 text-white rounded-2xl active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3">
                    <MessageCircle size={20} />
                    <div className="text-left">
                        <p className="font-semibold">WhatsApp</p>
                        <p className="text-xs opacity-80">Lo respondemos rápido</p>
                    </div>
                </div>
                <ArrowRight size={18} />
            </a>
            <a href="tel:+34676344675"
                style={{ fontFamily: 'var(--font-ui)' }}
                className="flex items-center justify-between p-5 bg-stone-100 text-stone-900 rounded-2xl active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3">
                    <Phone size={20} />
                    <div className="text-left">
                        <p className="font-semibold">Llamar</p>
                        <p className="text-xs text-stone-500">+34 676 34 46 75</p>
                    </div>
                </div>
                <ArrowRight size={18} />
            </a>
            <a href="mailto:apartamentostiojosemaria@gmail.com"
                style={{ fontFamily: 'var(--font-ui)' }}
                className="flex items-center justify-between p-5 bg-stone-100 text-stone-900 rounded-2xl active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3">
                    <Mail size={20} />
                    <div className="text-left">
                        <p className="font-semibold">Correo</p>
                        <p className="text-xs text-stone-500 truncate max-w-[200px]">apartamentostiojosemaria@gmail.com</p>
                    </div>
                </div>
                <ArrowRight size={18} />
            </a>
            <p style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic' }} className="text-xs text-stone-500 text-center pt-3 leading-relaxed">
                Vivimos cerca. Si llegas tarde o tienes algún imprevisto,<br />no dudes en escribir aunque sea de noche.
            </p>
        </div>
    </div>
);

const RulesSheet = ({ guidebook }) => (
    <div>
        <SheetHeader kicker="Normas" title="Cómo cuidamos esta casa" />
        <div className="p-6">
            <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-base text-stone-700 leading-relaxed whitespace-pre-wrap">
                {guidebook?.house_rules || 'Sin normas específicas configuradas todavía.'}
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
            booking_id: booking.id,
            addon_id: addon.id,
            name_snapshot: addon.name,
            unit_price_cents: addon.price_cents,
            quantity: qty,
        });
        setAdding(false);
        if (!error) setAdded(true);
    };

    return (
        <div>
            <SheetHeader kicker="Extras" title={addon.name} />
            <div className="p-6">
                {addon.description && (
                    <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-base leading-relaxed text-stone-700 mb-5">
                        {addon.description}
                    </p>
                )}
                <div className="bg-stone-50 rounded-2xl p-4 mb-5 flex items-center justify-between">
                    <div>
                        <p style={{ fontFamily: 'var(--font-ui)' }} className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Precio</p>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }} className="text-2xl text-stone-900">
                            {fmtCents(addon.price_cents * qty)}
                            <span className="text-sm font-normal text-stone-500 ml-1">{PER_LABEL[addon.per]}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-full p-1">
                        <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-700 font-bold">−</button>
                        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }} className="w-6 text-center">{qty}</span>
                        <button onClick={() => setQty(q => Math.min(addon.max_quantity || 10, q + 1))} className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-700 font-bold">+</button>
                    </div>
                </div>
                {added ? (
                    <div className="text-center py-3">
                        <Check size={28} className="mx-auto mb-2 text-green-600" />
                        <p style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic' }} className="text-stone-700">
                            Anotado. Lo verás cuando llegues.
                        </p>
                    </div>
                ) : (
                    <button onClick={handleAdd} disabled={adding}
                        style={{ background: 'var(--color-terracota)', fontFamily: 'var(--font-ui)' }}
                        className="w-full py-4 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
                        {adding ? <Loader2 size={16} className="animate-spin" /> : <>Añadir a la reserva <ArrowRight size={16} /></>}
                    </button>
                )}
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// ESTADOS AUXILIARES
// ────────────────────────────────────────────────────────────────────────────

const LoadingState = () => (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-papel)' }}>
        <Loader2 size={20} className="animate-spin text-stone-400" />
    </div>
);

const AccessDenied = ({ onLogout }) => (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--color-papel)' }}>
        <div className="max-w-md w-full text-center">
            <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }} className="text-3xl text-stone-900 mb-3">
                Cuenta desactivada
            </h2>
            <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-stone-600 mb-8 leading-relaxed">
                Si crees que es un error, escríbenos por WhatsApp y lo miramos.
            </p>
            <a href="https://wa.me/34676344675"
                style={{ background: 'var(--color-rural-600)', fontFamily: 'var(--font-ui)' }}
                className="inline-block py-3 px-6 text-white rounded-full font-semibold">
                Contactar
            </a>
            <button onClick={onLogout}
                style={{ fontFamily: 'var(--font-ui)' }}
                className="block mx-auto mt-6 text-xs text-stone-500">
                Cerrar sesión
            </button>
        </div>
    </div>
);

const NoBookingState = ({ userEmail }) => (
    <div className="max-w-md mx-auto px-5 py-20 text-center">
        <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }} className="text-2xl text-stone-900 mb-2">
            Aún no vemos ninguna reserva
        </h2>
        <p style={{ fontFamily: 'var(--font-editorial)' }} className="text-stone-600 mb-6 leading-relaxed">
            No encontramos reservas asociadas a <strong className="text-stone-900">{userEmail}</strong>.
            Si reservaste con otro correo, escríbenos y lo vinculamos a mano.
        </p>
        <a href="https://wa.me/34676344675"
            style={{ background: 'var(--color-rural-600)', fontFamily: 'var(--font-ui)' }}
            className="inline-block py-3 px-6 text-white rounded-full font-semibold">
            Contactar por WhatsApp
        </a>
    </div>
);

export default ClientArea;

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    BookOpen, Wifi, Home, Shield, Phone, Car, MapPin, Sparkles, Calendar, Users,
    AlertTriangle, Loader2, Copy, Check,
} from 'lucide-react';

const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

// Guía digital pública por código de reserva.
// URL: /guia/TJM-XXXXXX
// Muestra info personalizada de la reserva + manual del apartamento concreto.
// Carga vía RPC para no exponer datos cruzados de otros huéspedes.

const GuidebookPage = () => {
    const { code } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copiedField, setCopiedField] = useState(null);

    useEffect(() => {
        (async () => {
            if (!code) { setError('Falta el código de reserva.'); setLoading(false); return; }

            const { data: booking, error: bErr } = await supabase
                .from('guest_bookings')
                .select('booking_code, guest_name, check_in, check_out, pax_count, status, apartments(id, name, images)')
                .eq('booking_code', code.toUpperCase())
                .maybeSingle();

            if (bErr || !booking) { setError('No encontramos tu reserva. Comprueba el enlace.'); setLoading(false); return; }
            if (booking.status === 'cancelled') { setError('Esta reserva está cancelada.'); setLoading(false); return; }

            const { data: guidebook } = await supabase.from('guidebooks').select('*').eq('apartment_id', booking.apartments.id).maybeSingle();

            setData({ booking, guidebook: guidebook || {} });
            setLoading(false);
        })();
    }, [code]);

    const copyToClipboard = async (value, field) => {
        await navigator.clipboard.writeText(value);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 1800);
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-rural-50/40">
            <div className="flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin" size={18} /> Cargando tu guía…</div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-rural-50/40 p-6">
            <div className="max-w-md bg-white rounded-3xl border border-gray-100 shadow-lg p-8 text-center">
                <AlertTriangle size={28} className="text-amber-500 mx-auto mb-3" />
                <p className="text-text-primary font-bold mb-2">{error}</p>
                <p className="text-sm text-gray-600 mb-4">Si crees que es un error, escríbenos por WhatsApp a <a href="https://wa.me/34676344675" className="text-rural-700 font-bold">+34 676 34 46 75</a>.</p>
                <Link to="/" className="text-xs text-rural-700 font-bold hover:underline">Volver al inicio</Link>
            </div>
        </div>
    );

    const { booking, guidebook } = data;
    const apt = booking.apartments;
    const firstImage = apt.images?.[0];
    const firstName = booking.guest_name.split(' ')[0];

    return (
        <div className="min-h-screen bg-rural-50/30">
            {/* Cabecera con foto del apartamento */}
            <div className="relative h-56 md:h-72 bg-rural-700 overflow-hidden">
                {firstImage && (
                    <img src={firstImage} alt={apt.name} className="w-full h-full object-cover opacity-80" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                <div className="absolute bottom-0 inset-x-0 p-6 text-white">
                    <p className="text-xs uppercase tracking-widest opacity-90">Apartamentos Rurales Tío José María</p>
                    <h1 className="font-serif text-3xl md:text-4xl font-bold mt-1">Hola {firstName}, bienvenido a {apt.name}</h1>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
                {/* Tarjeta resumen reserva */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-rural-700 mb-2">Tu estancia</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                        <Info icon={Calendar} label="Entrada" value={fmtDate(booking.check_in)} />
                        <Info icon={Calendar} label="Salida" value={fmtDate(booking.check_out)} />
                        <Info icon={Users} label="Personas" value={booking.pax_count} />
                    </div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-3">
                        Código <span className="font-mono text-rural-700">{booking.booking_code}</span>
                    </p>
                </div>

                {guidebook.welcome_message && (
                    <Section icon={Sparkles} title="Bienvenida">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{guidebook.welcome_message}</p>
                    </Section>
                )}

                {(guidebook.wifi_name || guidebook.wifi_password) && (
                    <Section icon={Wifi} title="WiFi">
                        <div className="grid sm:grid-cols-2 gap-3">
                            {guidebook.wifi_name && (
                                <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Red</p>
                                        <p className="font-mono text-text-primary">{guidebook.wifi_name}</p>
                                    </div>
                                    <button onClick={() => copyToClipboard(guidebook.wifi_name, 'wifi_name')} className="p-2 text-rural-700 hover:bg-white rounded-lg">
                                        {copiedField === 'wifi_name' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                    </button>
                                </div>
                            )}
                            {guidebook.wifi_password && (
                                <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Contraseña</p>
                                        <p className="font-mono text-text-primary">{guidebook.wifi_password}</p>
                                    </div>
                                    <button onClick={() => copyToClipboard(guidebook.wifi_password, 'wifi_password')} className="p-2 text-rural-700 hover:bg-white rounded-lg">
                                        {copiedField === 'wifi_password' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                    </button>
                                </div>
                            )}
                        </div>
                    </Section>
                )}

                {guidebook.checkin_instructions && (
                    <Section icon={Home} title="Cómo entrar">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{guidebook.checkin_instructions}</p>
                    </Section>
                )}

                {guidebook.parking_info && (
                    <Section icon={Car} title="Aparcamiento">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{guidebook.parking_info}</p>
                    </Section>
                )}

                {guidebook.appliance_instructions && (
                    <Section icon={Home} title="Cómo usar los aparatos">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{guidebook.appliance_instructions}</p>
                    </Section>
                )}

                {guidebook.house_rules && (
                    <Section icon={Shield} title="Normas de la casa">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{guidebook.house_rules}</p>
                    </Section>
                )}

                {guidebook.nearby_recommendations && (
                    <Section icon={MapPin} title="Qué ver y hacer en la zona">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{guidebook.nearby_recommendations}</p>
                    </Section>
                )}

                {guidebook.emergency_contact && (
                    <Section icon={Phone} title="Contacto y urgencias" highlight>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{guidebook.emergency_contact}</p>
                    </Section>
                )}

                <div className="text-center text-xs text-gray-500 mt-8 py-6">
                    <p>Mari Carmen y Jesús</p>
                    <p className="font-serif italic mt-1">Apartamentos Rurales Tío José María · Hinojares</p>
                </div>
            </div>
        </div>
    );
};

const Section = ({ icon: Icon, title, children, highlight }) => (
    <div className={`rounded-2xl border p-5 ${highlight ? 'bg-rural-50 border-rural-200' : 'bg-white border-gray-100'} shadow-sm`}>
        <h2 className="flex items-center gap-2 font-serif font-bold text-lg text-text-primary mb-3">
            <Icon size={18} className="text-rural-700" /> {title}
        </h2>
        {children}
    </div>
);

const Info = ({ icon: Icon, label, value }) => (
    <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 flex items-center gap-1"><Icon size={10} /> {label}</p>
        <p className="font-bold text-text-primary mt-0.5">{value}</p>
    </div>
);

export default GuidebookPage;

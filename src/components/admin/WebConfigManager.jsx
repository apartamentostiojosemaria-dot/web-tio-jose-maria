import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import {
    Save, RefreshCw, AlertCircle, CheckCircle2,
    Globe, Home, Image, Star, MessageSquare, Mail,
    Wifi, Key, Car, LogOut, ScrollText, Phone,
    MapPin, Calendar, FileText, Newspaper, ChevronDown, ChevronUp
} from 'lucide-react';

const SECTION_META = {
    welcome: {
        label: 'Paquete de Bienvenida',
        icon: Key,
        description: 'Información que ve el huésped al acceder a su área de cliente',
        color: '#556B2F',
    },
    general: {
        label: 'Página Principal',
        icon: Home,
        description: 'Título, subtítulo e introducción del hero',
    },
    hero: {
        label: 'Hero (Cabecera)',
        icon: Image,
        description: 'Imagen, botones y textos de la cabecera principal',
    },
    intro: {
        label: 'Sección Introducción',
        icon: Star,
        description: 'Texto, imagen, puntuación y bullets de la intro',
    },
    entorno: {
        label: 'Sección Entorno',
        icon: MapPin,
        description: 'Descripción del entorno, cards de actividades y CTA',
    },
    reviews: {
        label: 'Reseñas',
        icon: MessageSquare,
        description: 'Puntuación de Booking y enlace a reseñas',
    },
    newsletter: {
        label: 'Newsletter / Guía',
        icon: Newspaper,
        description: 'Sección de captación de email para guía exclusiva',
    },
    contacto: {
        label: 'Datos de Contacto',
        icon: Phone,
        description: 'Teléfono, email, dirección, redes sociales',
        color: '#2563eb',
    },
    footer: {
        label: 'Pie de Página',
        icon: FileText,
        description: 'Nombre empresa, copyright, descripción del footer',
    },
    hinojares_page: {
        label: 'Página Hinojares',
        icon: Globe,
        description: 'Hero de la página del pueblo',
    },
    map_page: {
        label: 'Página Rutas',
        icon: MapPin,
        description: 'Hero de la página de rutas',
    },
    events_page: {
        label: 'Página Eventos',
        icon: Calendar,
        description: 'Hero de la página de eventos',
    },
};

const KEY_LABELS = {
    // Welcome
    wifi_name: 'Nombre de red WiFi',
    wifi_password: 'Contraseña WiFi',
    checkin_instructions: 'Instrucciones de Check-in',
    checkout_instructions: 'Instrucciones de Check-out',
    parking_instructions: 'Instrucciones de Aparcamiento',
    house_rules: 'Normas de la casa',
    emergency_contacts: 'Contactos de emergencia (separados por |)',
    // General
    hero_title: 'Título principal',
    hero_subtitle: 'Subtítulo',
    intro_text: 'Texto de introducción',
    // Hero
    hero_image_url: 'URL imagen de fondo',
    hero_location_text: 'Texto de ubicación',
    hero_cta_primary: 'Botón principal',
    hero_cta_secondary: 'Botón secundario',
    // Intro
    intro_heading: 'Titular',
    intro_image_url: 'URL imagen',
    intro_rating_score: 'Puntuación Booking',
    intro_rating_label: 'Etiqueta puntuación',
    intro_bullet_1: 'Ventaja 1',
    intro_bullet_2: 'Ventaja 2',
    intro_bullet_3: 'Ventaja 3',
    // Entorno
    entorno_label: 'Etiqueta superior',
    entorno_title: 'Título sección',
    entorno_description: 'Descripción',
    entorno_card1_emoji: 'Card 1 — Emoji',
    entorno_card1_title: 'Card 1 — Título',
    entorno_card1_text: 'Card 1 — Texto',
    entorno_card2_emoji: 'Card 2 — Emoji',
    entorno_card2_title: 'Card 2 — Título',
    entorno_card2_text: 'Card 2 — Texto',
    entorno_cta_title: 'CTA — Título',
    entorno_cta_description: 'CTA — Descripción',
    entorno_cta_image: 'CTA — Imagen fondo',
    // Reviews
    reviews_section_title: 'Título sección',
    reviews_booking_score: 'Puntuación',
    reviews_booking_label: 'Etiqueta',
    reviews_booking_url: 'URL reseñas Booking',
    // Newsletter
    newsletter_title: 'Título',
    newsletter_description: 'Descripción',
    newsletter_button_text: 'Texto del botón',
    newsletter_bg_image: 'URL imagen de fondo',
    // Contacto
    contact_phone: 'Teléfono',
    contact_email: 'Email',
    contact_address: 'Dirección',
    contact_whatsapp_number: 'Número WhatsApp',
    contact_instagram_url: 'URL Instagram',
    contact_google_maps_url: 'URL Google Maps',
    contact_google_maps_embed: 'Embed Google Maps',
    contact_registration: 'Nº Registro turístico',
    // Footer
    footer_company_name: 'Nombre empresa',
    footer_description: 'Descripción',
    footer_copyright: 'Copyright',
    // Pages
    hinojares_hero_title: 'Título hero',
    hinojares_hero_subtitle: 'Subtítulo hero',
    hinojares_hero_image: 'URL imagen hero',
    map_hero_title: 'Título hero',
    map_hero_subtitle: 'Subtítulo hero',
    events_hero_title: 'Título hero',
    events_hero_subtitle: 'Subtítulo hero',
};

const SECTION_ORDER = [
    'welcome', 'contacto', 'general', 'hero', 'intro',
    'entorno', 'reviews', 'newsletter', 'footer',
    'hinojares_page', 'map_page', 'events_page',
];

const WebConfigManager = () => {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [openSections, setOpenSections] = useState({ welcome: true, contacto: true });

    useEffect(() => {
        fetchConfigs();
    }, []);

    async function fetchConfigs() {
        setLoading(true);
        const { data } = await supabase.from('web_config').select('*').order('section');
        if (data) setConfigs(data);
        setLoading(false);
    }

    const handleChange = (id, value) => {
        setConfigs(configs.map(c => c.id === id ? { ...c, value } : c));
    };

    const handleSave = async () => {
        setSaving(true);
        const updates = configs.map(c => ({ id: c.id, section: c.section, key: c.key, value: c.value }));
        const { error } = await supabase.from('web_config').upsert(updates);

        if (!error) {
            setMessage({ type: 'success', text: 'Cambios guardados correctamente' });
            setTimeout(() => setMessage(null), 3000);
        } else {
            setMessage({ type: 'error', text: 'Error al guardar los cambios' });
        }
        setSaving(false);
    };

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    if (loading) return <div className="p-10 text-center animate-pulse italic">Cargando configuración...</div>;

    const sections = SECTION_ORDER.filter(s => configs.some(c => c.section === s));

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Configuración de la Web</h3>
                    <p className="text-sm text-gray-500">Edita todos los textos, datos de contacto e información para huéspedes</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-md disabled:opacity-50"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                    {saving ? 'Guardando...' : 'Guardar Todo'}
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-red-50 border border-red-100 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span className="text-sm font-bold">{message.text}</span>
                </div>
            )}

            <div className="space-y-4 pb-10">
                {sections.map(sectionKey => {
                    const meta = SECTION_META[sectionKey] || { label: sectionKey, icon: FileText, description: '' };
                    const Icon = meta.icon;
                    const isOpen = openSections[sectionKey] ?? false;
                    const sectionConfigs = configs.filter(c => c.section === sectionKey);
                    const accentColor = meta.color || COLORS.secondary;

                    return (
                        <div key={sectionKey} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggleSection(sectionKey)}
                                className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accentColor}15` }}>
                                    <Icon size={20} style={{ color: accentColor }} />
                                </div>
                                <div className="flex-grow">
                                    <h4 className="font-bold text-sm" style={{ color: COLORS.text }}>{meta.label}</h4>
                                    <p className="text-xs text-gray-400">{meta.description}</p>
                                </div>
                                <span className="text-[10px] font-bold text-gray-300 mr-2">{sectionConfigs.length} campos</span>
                                {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                            </button>

                            {isOpen && (
                                <div className="border-t border-gray-50 p-5 space-y-4">
                                    {sectionConfigs.map(config => {
                                        const label = KEY_LABELS[config.key] || config.key;
                                        const isLong = (config.value || '').length > 80;
                                        const isUrl = config.key.includes('url') || config.key.includes('image') || config.key.includes('embed');

                                        return (
                                            <div key={config.id}>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                                                    {label}
                                                </label>
                                                {isLong || config.key.includes('instructions') || config.key.includes('rules') || config.key.includes('contacts') || config.key.includes('description') || config.key.includes('text') ? (
                                                    <textarea
                                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rural-200 focus:border-rural-300 outline-none transition-all"
                                                        rows={config.key.includes('contacts') ? 4 : 3}
                                                        value={config.value || ''}
                                                        onChange={(e) => handleChange(config.id, e.target.value)}
                                                    />
                                                ) : (
                                                    <input
                                                        className={`w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rural-200 focus:border-rural-300 outline-none transition-all ${isUrl ? 'font-mono text-xs' : ''}`}
                                                        value={config.value || ''}
                                                        onChange={(e) => handleChange(config.id, e.target.value)}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WebConfigManager;

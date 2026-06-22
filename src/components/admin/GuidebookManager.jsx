import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, Save, Loader2, RefreshCw, ExternalLink, Wifi, Home, Shield, Phone, Car, MapPin, Sparkles } from 'lucide-react';
import { logError, userErrorMessage } from '../../utils/logger';

// Manual digital por apartamento. Lo que rellenas aquí lo ve el huésped en /guia/<código-reserva>.
// Hay un guidebook por apartamento; el seed creó uno para cada apt con valores razonables.

const SECTIONS = [
    { key: 'welcome_message',         label: 'Bienvenida',                    icon: Sparkles, type: 'textarea', rows: 3,  hint: 'Mensaje cálido al abrir la guía. Lo primero que ve el huésped.' },
    { key: 'wifi_name',               label: 'Nombre de red WiFi',            icon: Wifi,     type: 'text',     hint: 'Lo que aparece al elegir red en el móvil.' },
    { key: 'wifi_password',           label: 'Contraseña WiFi',               icon: Wifi,     type: 'text',     hint: 'Para que pueda copiar y pegar.' },
    { key: 'checkin_instructions',    label: 'Cómo entrar y check-in',        icon: Home,     type: 'textarea', rows: 4,  hint: 'Horarios, qué hacer al llegar, dónde aparcar.' },
    { key: 'parking_info',            label: 'Aparcamiento',                  icon: Car,      type: 'textarea', rows: 2,  hint: 'Dónde dejar el coche, si es gratuito, etc.' },
    { key: 'house_rules',             label: 'Normas de la casa',             icon: Shield,   type: 'textarea', rows: 5,  hint: 'Respeto descanso, no fiestas, dónde fumar...' },
    { key: 'appliance_instructions',  label: 'Cómo usar los aparatos',        icon: Home,     type: 'textarea', rows: 5,  hint: 'Chimenea, calefacción, vitrocerámica, lavadora...' },
    { key: 'nearby_recommendations',  label: 'Qué ver y hacer en la zona',    icon: MapPin,   type: 'textarea', rows: 5,  hint: 'Restaurantes, rutas, miradores, lugares con encanto.' },
    { key: 'emergency_contact',       label: 'Contacto urgencias',            icon: Phone,    type: 'textarea', rows: 3,  hint: 'WhatsApp, 112, farmacia de guardia, etc.' },
];

const GuidebookManager = () => {
    const [apartments, setApartments] = useState([]);
    const [selectedAptId, setSelectedAptId] = useState(null);
    const [guidebook, setGuidebook] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const { data: apts } = await supabase.from('apartments').select('id, name, slug').order('name');
        setApartments(apts || []);
        if (apts?.length && !selectedAptId) setSelectedAptId(apts[0].id);
        setLoading(false);
    }, [selectedAptId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!selectedAptId) return;
        (async () => {
            const { data } = await supabase.from('guidebooks').select('*').eq('apartment_id', selectedAptId).maybeSingle();
            setGuidebook(data || { apartment_id: selectedAptId });
        })();
    }, [selectedAptId]);

    const save = async () => {
        setSaving(true);
        const { error } = await supabase.from('guidebooks').upsert({
            ...guidebook,
            apartment_id: selectedAptId,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'apartment_id' });
        if (error) { logError('saveGuidebook', error); alert(userErrorMessage('Error al guardar.')); }
        else alert('Guía actualizada. Los huéspedes con reserva en este apartamento la verán al abrir su enlace.');
        setSaving(false);
    };

    const selectedApt = apartments.find(a => a.id === selectedAptId);

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando…</div>;

    return (
        <div className="max-w-4xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Manual digital del huésped</h1>
                    <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                        Información que el huésped ve en su móvil al abrir el enlace de la guía. WiFi, normas, instrucciones de aparatos, recomendaciones... Una guía por apartamento.
                    </p>
                </div>
                <button onClick={load} className="p-2 text-rural-700 hover:text-primary"><RefreshCw size={14} /></button>
            </header>

            {/* Selector apartamento */}
            <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 mb-5 overflow-x-auto">
                {apartments.map(a => (
                    <button key={a.id} onClick={() => setSelectedAptId(a.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedAptId === a.id ? 'bg-rural-700 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {a.name}
                    </button>
                ))}
            </div>

            <div className="bg-rural-50 border border-rural-100 rounded-2xl p-4 mb-5 text-sm text-rural-900 flex items-start gap-3">
                <BookOpen size={16} className="shrink-0 mt-0.5" />
                <div>
                    <p>El huésped abre su guía en <code className="bg-white px-1.5 py-0.5 rounded font-mono text-xs">tiojosemaria.com/guia/&lt;código-reserva&gt;</code>.</p>
                    <p className="mt-1 text-xs">El enlace se le envía automáticamente en el correo de recordatorio del día antes y en el de bienvenida.</p>
                    {selectedApt && (
                        <a href={`/guia/preview?apt=${selectedApt.id}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-rural-700 hover:underline">
                            <ExternalLink size={11} /> Ver previsualización
                        </a>
                    )}
                </div>
            </div>

            <div className="space-y-5">
                {SECTIONS.map(s => (
                    <div key={s.key} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <label className="block">
                            <span className="flex items-center gap-2 text-sm font-bold text-text-primary mb-1">
                                <s.icon size={14} className="text-rural-700" />
                                {s.label}
                            </span>
                            {s.hint && <p className="text-xs text-gray-500 mb-2">{s.hint}</p>}
                            {s.type === 'textarea' ? (
                                <textarea value={guidebook[s.key] || ''} onChange={e => setGuidebook({ ...guidebook, [s.key]: e.target.value })}
                                    rows={s.rows}
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 text-sm leading-relaxed" />
                            ) : (
                                <input type="text" value={guidebook[s.key] || ''} onChange={e => setGuidebook({ ...guidebook, [s.key]: e.target.value })}
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400" />
                            )}
                        </label>
                    </div>
                ))}
            </div>

            <div className="sticky bottom-4 mt-6">
                <button onClick={save} disabled={saving}
                    className="w-full py-4 bg-rural-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:bg-rural-800 disabled:opacity-50">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Guardar guía de {selectedApt?.name}
                </button>
            </div>
        </div>
    );
};

export default GuidebookManager;

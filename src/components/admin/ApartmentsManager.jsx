import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

import {
    Plus, Edit2, Trash2, Camera, Check, X, Save,
    Home, Layout, List, Upload, Loader2,
    Tv, Wifi, Flame, Wind, Thermometer, UtensilsCrossed,
    Refrigerator, Microwave, Bath, Eraser, Dog, ShieldCheck,
    Bed, Info, RefreshCw, Link as LinkIcon, Copy,
    Star, ArrowLeft, ArrowRight,
    Car, WashingMachine, Mountain, TreePine, Coffee, Baby, Sparkles, Shirt,
} from 'lucide-react';
import { syncApartmentDates } from '../../utils/syncService';
import { logError, userErrorMessage } from '../../utils/logger';
import { validateImageFile } from '../../utils/fileValidation';

// Lista completa de servicios. Si quieres añadir uno nuevo, edita esta lista.
// id se guarda en BD; label/icon son sólo para mostrar.
const AMENITIES_LIST = [
    { id: 'tv',          label: 'TV pantalla plana',         icon: Tv },
    { id: 'wifi',        label: 'WiFi gratis',               icon: Wifi },
    { id: 'heating',     label: 'Calefacción',               icon: Thermometer },
    { id: 'ac',          label: 'Aire acondicionado',        icon: Wind },
    { id: 'fireplace',   label: 'Chimenea',                  icon: Flame },
    { id: 'wood',        label: 'Leña incluida',             icon: TreePine },
    { id: 'kitchen',     label: 'Vitrocerámica y menaje',    icon: UtensilsCrossed },
    { id: 'fridge',      label: 'Frigorífico',               icon: Refrigerator },
    { id: 'microwave',   label: 'Microondas y tostadora',    icon: Microwave },
    { id: 'coffee',      label: 'Cafetera',                  icon: Coffee },
    { id: 'bath',        label: 'Gel y toallas',             icon: Bath },
    { id: 'bedding',     label: 'Sábanas incluidas',         icon: Bed },
    { id: 'hairdryer',   label: 'Secador de pelo',           icon: Eraser },
    { id: 'washer',      label: 'Lavadora',                  icon: WashingMachine },
    { id: 'iron',        label: 'Plancha',                   icon: Shirt },
    { id: 'parking',     label: 'Aparcamiento gratuito',     icon: Car },
    { id: 'balcony',     label: 'Balcón / terraza',          icon: Home },
    { id: 'mountain_view', label: 'Vistas a la sierra',      icon: Mountain },
    { id: 'cleaning',    label: 'Limpieza incluida',         icon: Sparkles },
    { id: 'crib',        label: 'Cuna disponible',           icon: Baby },
    { id: 'no_pets',     label: 'No mascotas',               icon: Dog },
];

const ApartmentsManager = () => {
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingApt, setEditingApt] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => { fetchApartments(); }, []);

    async function fetchApartments() {
        setLoading(true);
        const { data, error } = await supabase.from('apartments').select('*').order('id');
        if (error) {
            logError('fetchApartments', error);
            alert(userErrorMessage('Error al cargar apartamentos.'));
        }
        if (data) setApartments(data);
        setLoading(false);
    }

    const handleSave = async () => {
        setIsSaving(true);
        const { id, ...updateData } = editingApt;

        let error;
        if (id) {
            ({ error } = await supabase.from('apartments').update(updateData).eq('id', id));
        } else {
            ({ error } = await supabase.from('apartments').insert([updateData]));
        }

        if (error) {
            logError('handleSave', error);
            alert(userErrorMessage('Error al guardar el apartamento.'));
        } else {
            setEditingApt(null);
            fetchApartments();
        }
        setIsSaving(false);
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este apartamento?')) {
            const { error } = await supabase.from('apartments').delete().eq('id', id);
            if (!error) fetchApartments();
        }
    };

    // Subida múltiple: el operador selecciona varias fotos a la vez y se suben en serie.
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsUploading(true);
        const newUrls = [];
        try {
            for (const file of files) {
                const validation = validateImageFile(file);
                if (!validation.valid) {
                    alert(`"${file.name}": ${validation.message}`);
                    continue;
                }
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('apartments').upload(fileName, file);
                if (uploadError) {
                    logError('handleFileUpload', uploadError);
                    alert(userErrorMessage(`Error al subir "${file.name}".`));
                    continue;
                }
                const { data: { publicUrl } } = supabase.storage.from('apartments').getPublicUrl(fileName);
                newUrls.push(publicUrl);
            }
            if (newUrls.length > 0) {
                setEditingApt(prev => ({ ...prev, images: [...(prev.images || []), ...newUrls] }));
            }
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const toggleAmenity = (id) => {
        const current = editingApt.amenities || [];
        setEditingApt({
            ...editingApt,
            amenities: current.includes(id) ? current.filter(a => a !== id) : [...current, id],
        });
    };

    const handleSync = async (apt) => {
        if (!apt.airbnb_ical_url && !apt.booking_ical_url) {
            alert('Por favor, añade al menos un enlace de iCal (Airbnb o Booking) primero.');
            return;
        }
        setIsSaving(true);
        try {
            const result = await syncApartmentDates(apt);
            alert(`Sincronización finalizada:\n${result.message}\n\nTotal reservas en base de datos: ${result.count}`);
        } catch (error) {
            logError('handleSync', error);
            alert(userErrorMessage('Error en la sincronización.'));
        } finally {
            setIsSaving(false);
        }
    };

    // Operaciones sobre la galería ----------------------------------------
    const updateImages = (next) => setEditingApt(prev => ({ ...prev, images: next }));

    const removeImage = (idx) => {
        const next = [...(editingApt.images || [])];
        next.splice(idx, 1);
        updateImages(next);
    };

    const makeImagePrimary = (idx) => {
        if (idx === 0) return;
        const next = [...(editingApt.images || [])];
        const [moved] = next.splice(idx, 1);
        next.unshift(moved);
        updateImages(next);
    };

    const moveImage = (idx, direction) => {
        const next = [...(editingApt.images || [])];
        const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= next.length) return;
        [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
        updateImages(next);
    };
    // ---------------------------------------------------------------------

    const getICalUrl = (slug) => {
        if (!slug) return '';
        const { data } = supabase.storage.from('calendars').getPublicUrl(`${slug}.ics`);
        return data.publicUrl;
    };

    const copyToClipboard = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        alert('Copiado al portapapeles');
    };

    if (loading) return <div className="p-10 text-center animate-pulse font-serif italic text-gray-500">Cargando apartamentos...</div>;

    const description = editingApt?.description || '';
    const images = editingApt?.images || [];

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h3 className="text-2xl font-serif font-bold text-text-primary">Apartamentos</h3>
                    <p className="text-sm text-gray-400">Datos, fotos, precios y servicios de cada alojamiento</p>
                </div>
                <button
                    onClick={() => setEditingApt({
                        name: '', slug: '', capacity_people: 2, is_active: true, images: [],
                        price_low: 60, price_high: 90, registration_number: 'A/JA/',
                        bathrooms: 1, amenities: [], description: '',
                    })}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold transition-all hover:scale-105 shadow-lg bg-primary"
                >
                    <Plus size={20} /> Nuevo apartamento
                </button>
            </div>

            {/* ───────────────────────── MODAL ───────────────────────── */}
            {editingApt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-start justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] max-w-5xl w-full shadow-2xl my-8">

                        {/* Header sticky */}
                        <div className="sticky top-0 bg-white/95 backdrop-blur-md p-6 border-b border-gray-100 flex justify-between items-center rounded-t-[2rem] z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-rural-50 text-rural-700"><Home size={24} /></div>
                                <div>
                                    <h4 className="text-2xl font-serif font-bold">
                                        {editingApt.id ? `Editar: ${editingApt.name || 'Apartamento'}` : 'Nuevo apartamento'}
                                    </h4>
                                    <p className="text-xs text-gray-400">Lo que pongas aquí se ve en la web, en las cards y en los emails al huésped.</p>
                                </div>
                            </div>
                            <button onClick={() => setEditingApt(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Cerrar"><X /></button>
                        </div>

                        <div className="p-8 space-y-10 max-h-[78vh] overflow-y-auto">

                            {/* ────────── 1. DESCRIPCIÓN (ancho total) ────────── */}
                            <section>
                                <SectionHeader icon={Info} title="Descripción del apartamento" />
                                <p className="text-sm text-gray-500 mb-3 leading-relaxed">
                                    Este texto aparece en la página del apartamento en la web. Describe qué se ve, qué se siente, qué tiene de especial.
                                    El huésped lo lee antes de reservar — cuanto más concreto y honesto, mejor.
                                </p>
                                <textarea
                                    className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none font-serif text-[15px] leading-relaxed resize-y"
                                    rows={14}
                                    placeholder="Ej: En la primera planta de la casona, ala derecha. Apartamento luminoso para dos, con cama de matrimonio y un balcón de forja que asoma a la Calle Baja y al Valle del Guadiana..."
                                    value={description}
                                    onChange={e => setEditingApt({ ...editingApt, description: e.target.value })}
                                />
                                <div className="flex justify-between mt-2 text-xs text-gray-400">
                                    <span>{description.length} caracteres</span>
                                    <span>Recomendado entre 400 y 1200 caracteres</span>
                                </div>
                            </section>

                            {/* ────────── 2. GALERÍA DE FOTOS (ancho total) ────────── */}
                            <section>
                                <SectionHeader icon={Camera} title={`Galería de fotos (${images.length})`} />
                                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                                    <strong className="text-rural-700">La primera foto es la principal</strong>: es la que aparece en la web, en las cards de búsqueda y en los emails al huésped.
                                    Usa <strong>★</strong> para marcar una como principal o las flechas para reordenar.
                                </p>

                                <input
                                    type="file" ref={fileInputRef} onChange={handleFileUpload}
                                    accept="image/*" multiple className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current.click()}
                                    disabled={isUploading}
                                    className="w-full py-6 border-2 border-dashed border-rural-200 rounded-2xl flex items-center justify-center gap-3 text-rural-700 font-bold hover:bg-rural-50 transition-all mb-5"
                                >
                                    {isUploading ? <><Loader2 className="animate-spin" size={20} /> Subiendo...</> : <><Upload size={20} /> Subir fotos (puedes seleccionar varias a la vez)</>}
                                </button>

                                {images.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                        <Camera size={32} className="text-gray-300 mx-auto mb-2" />
                                        <p className="text-gray-400 font-serif italic">No hay fotos todavía. Sube la primera.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {images.map((img, idx) => (
                                            <div key={`${img}-${idx}`} className={`relative rounded-2xl overflow-hidden bg-gray-100 border-2 transition-all ${idx === 0 ? 'border-rural-500 ring-2 ring-rural-200' : 'border-transparent'}`}>
                                                <div className="aspect-[4/3] overflow-hidden">
                                                    <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                                                </div>

                                                {/* Badge "Principal" en la primera */}
                                                {idx === 0 && (
                                                    <div className="absolute top-2 left-2 px-2.5 py-1 bg-rural-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1 shadow">
                                                        <Star size={10} fill="white" /> Principal
                                                    </div>
                                                )}

                                                {/* Número de orden */}
                                                <div className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                                    {idx + 1}
                                                </div>

                                                {/* Barra de acciones siempre visible */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex justify-between gap-1">
                                                    <div className="flex gap-1">
                                                        {idx > 0 && (
                                                            <button onClick={() => makeImagePrimary(idx)}
                                                                className="p-1.5 bg-white/95 text-rural-700 rounded-lg hover:bg-rural-50 shadow"
                                                                title="Marcar como foto principal">
                                                                <Star size={12} />
                                                            </button>
                                                        )}
                                                        {idx > 0 && (
                                                            <button onClick={() => moveImage(idx, 'left')}
                                                                className="p-1.5 bg-white/95 text-gray-700 rounded-lg hover:bg-gray-50 shadow"
                                                                title="Mover izquierda">
                                                                <ArrowLeft size={12} />
                                                            </button>
                                                        )}
                                                        {idx < images.length - 1 && (
                                                            <button onClick={() => moveImage(idx, 'right')}
                                                                className="p-1.5 bg-white/95 text-gray-700 rounded-lg hover:bg-gray-50 shadow"
                                                                title="Mover derecha">
                                                                <ArrowRight size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <button onClick={() => removeImage(idx)}
                                                        className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow"
                                                        title="Eliminar esta foto">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* ────────── 3. DATOS + CAPACIDAD (2 cols) ────────── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <section>
                                    <SectionHeader icon={Layout} title="Datos principales" />
                                    <div className="space-y-4">
                                        <Field label="Nombre" hint="Ej: Romero, Albahaca, Tomillo...">
                                            <input
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                value={editingApt.name || ''}
                                                onChange={e => setEditingApt({ ...editingApt, name: e.target.value })}
                                            />
                                        </Field>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Dirección web (slug)" hint="Sin espacios, sin acentos">
                                                <input
                                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none font-mono text-sm"
                                                    value={editingApt.slug || ''}
                                                    onChange={e => setEditingApt({ ...editingApt, slug: e.target.value })}
                                                />
                                            </Field>
                                            <Field label="Nº registro" hint="El que da la Junta de Andalucía">
                                                <input
                                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none font-mono text-sm"
                                                    value={editingApt.registration_number || ''}
                                                    onChange={e => setEditingApt({ ...editingApt, registration_number: e.target.value })}
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <SectionHeader icon={ShieldCheck} title="Precios y capacidad" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Precio temporada baja" hint="€ por noche">
                                            <CurrencyInput
                                                value={editingApt.price_low}
                                                onChange={v => setEditingApt({ ...editingApt, price_low: v })}
                                            />
                                        </Field>
                                        <Field label="Precio temporada alta" hint="€ por noche">
                                            <CurrencyInput
                                                value={editingApt.price_high}
                                                onChange={v => setEditingApt({ ...editingApt, price_high: v })}
                                            />
                                        </Field>
                                        <Field label="Plazas" hint="Personas máx.">
                                            <input
                                                type="number" min="1"
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                value={editingApt.capacity_people || ''}
                                                onChange={e => setEditingApt({ ...editingApt, capacity_people: parseInt(e.target.value) || 0 })}
                                            />
                                        </Field>
                                        <Field label="Baños">
                                            <input
                                                type="number" min="0"
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                value={editingApt.bathrooms || ''}
                                                onChange={e => setEditingApt({ ...editingApt, bathrooms: parseInt(e.target.value) || 0 })}
                                            />
                                        </Field>
                                    </div>

                                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 mt-4">
                                        <button
                                            onClick={() => setEditingApt({ ...editingApt, is_active: !editingApt.is_active })}
                                            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${editingApt.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                                            aria-pressed={!!editingApt.is_active}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${editingApt.is_active ? 'left-7' : 'left-1'}`} />
                                        </button>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700">Visible en la web</p>
                                            <p className="text-xs text-gray-400">Si lo desactivas, no aparece en buscador ni en /reservar</p>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* ────────── 4. SERVICIOS INCLUIDOS ────────── */}
                            <section>
                                <SectionHeader icon={List} title="Servicios incluidos" />
                                <p className="text-sm text-gray-500 mb-4">Marca lo que tiene este apartamento. Lo que dejes sin marcar no se ve en la ficha pública.</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {AMENITIES_LIST.map(item => {
                                        const isActive = (editingApt.amenities || []).includes(item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => toggleAmenity(item.id)}
                                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isActive ? 'bg-rural-50 border-rural-300 text-rural-800 ring-1 ring-rural-200' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                                            >
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${isActive ? 'bg-rural-700 text-white' : 'border-2 border-gray-300'}`}>
                                                    {isActive && <Check size={12} />}
                                                </div>
                                                <item.icon size={16} className="shrink-0" />
                                                <span className="text-xs font-bold uppercase tracking-wide leading-tight">{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* ────────── 5. SINCRONIZACIÓN CON AIRBNB / BOOKING ────────── */}
                            <section className="bg-rural-50/50 -mx-2 px-6 py-6 rounded-3xl border border-rural-100">
                                <SectionHeader icon={LinkIcon} title="Sincronizar con Airbnb, Booking y otras webs" />
                                <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                                    Las reservas que entren por Airbnb o Booking bloquean automáticamente las fechas aquí, y al revés.
                                    Tienes que copiar los enlaces .ics de cada plataforma una sola vez.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white p-5 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-rural-700 mb-2">Importar DE Airbnb / Booking</p>
                                        <p className="text-xs text-gray-500 mb-3">Pega aquí los .ics que te dan en sus paneles.</p>
                                        <div className="space-y-3">
                                            <Field label="Enlace Airbnb (.ics)">
                                                <input
                                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono outline-none focus:ring-2 ring-rural-300"
                                                    placeholder="https://www.airbnb.es/calendar/export..."
                                                    value={editingApt.airbnb_ical_url || ''}
                                                    onChange={e => setEditingApt({ ...editingApt, airbnb_ical_url: e.target.value })}
                                                />
                                            </Field>
                                            <Field label="Enlace Booking (.ics)">
                                                <input
                                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono outline-none focus:ring-2 ring-rural-300"
                                                    placeholder="https://ical.booking.com/v1/export..."
                                                    value={editingApt.booking_ical_url || ''}
                                                    onChange={e => setEditingApt({ ...editingApt, booking_ical_url: e.target.value })}
                                                />
                                            </Field>
                                        </div>
                                        <button
                                            onClick={() => handleSync(editingApt)}
                                            disabled={isSaving}
                                            className="w-full mt-4 py-2.5 bg-rural-100 text-rural-800 rounded-xl font-bold text-xs hover:bg-rural-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <RefreshCw size={14} className={isSaving ? 'animate-spin' : ''} />
                                            Sincronizar ahora
                                        </button>
                                    </div>

                                    <div className="bg-white p-5 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">Exportar HACIA fuera</p>
                                        <p className="text-xs text-gray-500 mb-3">Copia este enlace y pégalo en "Importar calendario" de Airbnb/Booking.</p>
                                        <div className="flex gap-2">
                                            <input
                                                readOnly
                                                className="flex-grow p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-mono text-amber-900"
                                                value={editingApt.slug ? getICalUrl(editingApt.slug) : 'Guarda primero el apartamento'}
                                            />
                                            <button
                                                onClick={() => copyToClipboard(getICalUrl(editingApt.slug))}
                                                disabled={!editingApt.slug}
                                                className="p-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all disabled:opacity-50"
                                                aria-label="Copiar enlace"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end bg-gray-50/50 rounded-b-[2rem]">
                            <button onClick={() => setEditingApt(null)} className="px-8 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-100 transition-colors">Cancelar</button>
                            <button
                                onClick={handleSave} disabled={isSaving}
                                className="px-10 py-3 bg-rural-700 text-white font-bold rounded-2xl hover:bg-rural-800 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? <><Loader2 size={18} className="animate-spin" /> Guardando...</> : <><Save size={18} /> Guardar cambios</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lista de apartamentos */}
            <div className="grid gap-6">
                {apartments.map(apt => (
                    <div key={apt.id} className="group bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 hover:shadow-xl transition-all">
                        <div className="w-full md:w-64 h-44 bg-gray-100 rounded-2xl overflow-hidden relative shrink-0">
                            {apt.images?.[0] ? (
                                <img src={apt.images[0]} alt={apt.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300"><Camera size={32} /></div>
                            )}
                        </div>

                        <div className="flex-grow flex flex-col justify-between">
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <h4 className="text-3xl font-serif font-bold text-rural-900">{apt.name}</h4>
                                    <p className="text-xs text-gray-400">/{apt.slug} · {apt.registration_number}</p>
                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{apt.description?.slice(0, 140) || <span className="italic text-gray-300">Sin descripción</span>}{apt.description?.length > 140 && '...'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingApt(apt)} className="p-3 text-rural-600 hover:bg-rural-50 rounded-2xl transition-all" title="Editar"><Edit2 size={20} /></button>
                                    <button onClick={() => handleDelete(apt.id)} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all" title="Eliminar"><Trash2 size={20} /></button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-50 pt-4 mt-3">
                                <div className="flex gap-4">
                                    <KPI label="T. baja" value={`${apt.price_low}€`} />
                                    <KPI label="T. alta" value={`${apt.price_high}€`} />
                                    <KPI label="Plazas" value={apt.capacity_people} />
                                    <KPI label="Fotos" value={apt.images?.length || 0} />
                                </div>
                                <div className="flex items-center gap-2">
                                    {!apt.is_active && <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">Oculto</span>}
                                    <button
                                        onClick={() => handleSync(apt)}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-4 py-2 bg-rural-50 text-rural-700 rounded-xl font-bold text-xs hover:bg-rural-100 transition-all"
                                    >
                                        <RefreshCw size={14} className={isSaving ? 'animate-spin' : ''} /> Sincronizar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─────────────────────── COMPONENTES AUXILIARES ───────────────────────

const SectionHeader = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-rural-50 text-rural-700"><Icon size={16} /></div>
        <h5 className="font-serif font-bold text-lg text-text-primary">{title}</h5>
    </div>
);

const Field = ({ label, hint, children }) => (
    <label className="block">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</span>
        {children}
        {hint && <span className="block text-[11px] text-gray-400 mt-1 italic">{hint}</span>}
    </label>
);

const CurrencyInput = ({ value, onChange }) => (
    <div className="relative">
        <input
            type="number" min="0"
            className="w-full p-4 pr-10 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
            value={value || ''}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
    </div>
);

const KPI = ({ label, value }) => (
    <div className="text-center">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">{label}</p>
        <p className="text-lg font-serif font-bold text-rural-800">{value}</p>
    </div>
);

export default ApartmentsManager;

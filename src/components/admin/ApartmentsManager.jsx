import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import {
    Plus, Edit2, Trash2, Camera, Check, X, Save,
    Home, Users, Eye, EyeOff, Layout, List, Upload, Loader2,
    Tv, Wifi, Flame, Wind, Thermometer, UtensilsCrossed,
    Refrigerator, Microwave, Bath, Eraser, Dog, ShieldCheck,
    Bed, Info, RefreshCw, Calendar as CalendarIcon, Link as LinkIcon, Copy
} from 'lucide-react';
import { syncApartmentDates } from '../../utils/syncService';

const AMENITIES_LIST = [
    { id: 'tv', label: 'TV Pantalla Plana', icon: Tv },
    { id: 'wifi', label: 'WiFi Gratis', icon: Wifi },
    { id: 'heating', label: 'Calefacción', icon: Thermometer },
    { id: 'ac', label: 'Aire Acondicionado', icon: Wind },
    { id: 'fireplace', label: 'Chimenea', icon: Flame },
    { id: 'kitchen', label: 'Vitrocerámica y Menaje', icon: UtensilsCrossed },
    { id: 'fridge', label: 'Frigorífico', icon: Refrigerator },
    { id: 'microwave', label: 'Microondas y Tostadora', icon: Microwave },
    { id: 'bath', label: 'Gel y Toallas', icon: Bath },
    { id: 'hairdryer', label: 'Secador de Pelo', icon: Eraser },
    { id: 'no_pets', label: 'No Mascotas', icon: Dog },
];

const ApartmentsManager = () => {
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingApt, setEditingApt] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newImageUrl, setNewImageUrl] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchApartments();
    }, []);

    async function fetchApartments() {
        setLoading(true);
        const { data, error } = await supabase.from('apartments').select('*').order('id');
        if (error) {
            console.error('Error fetching apartments:', error);
            alert('Error al cargar apartamentos: ' + error.message);
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
            alert('Error al guardar: ' + error.message);
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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('apartments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('apartments')
                .getPublicUrl(filePath);

            const currentImages = editingApt.images || [];
            setEditingApt({
                ...editingApt,
                images: [...currentImages, publicUrl]
            });
        } catch (error) {
            alert('Error al subir la imagen. Asegúrate de haber ejecutado el SQL de Storage: ' + error.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const toggleAmenity = (id) => {
        const currentAmenities = editingApt.amenities || [];
        if (currentAmenities.includes(id)) {
            setEditingApt({
                ...editingApt,
                amenities: currentAmenities.filter(a => a !== id)
            });
        } else {
            setEditingApt({
                ...editingApt,
                amenities: [...currentAmenities, id]
            });
        }
    };

    const handleSync = async (apt) => {
        if (!apt.airbnb_ical_url && !apt.booking_ical_url) {
            alert('Por favor, añade al menos un enlace de iCal (Airbnb o Booking) primero.');
            return;
        }

        setIsSaving(true);
        try {
            const count = await syncApartmentDates(apt);
            alert(`Sincronización completada. ${count} fechas actualizadas y archivo iCal generado.`);
            // No recargamos todo para no perder el estado, pero fetchApartments refrescaría la UI si hace falta
        } catch (error) {
            alert(`Error en la sincronización: ${error.message}`);
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const removeImage = (index) => {
        const currentImages = [...(editingApt.images || [])];
        currentImages.splice(index, 1);
        setEditingApt({
            ...editingApt,
            images: currentImages
        });
    };

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

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Gestión de Apartamentos</h3>
                    <p className="text-sm text-gray-400">Controla precios, servicios y visibilidad de tus alojamientos</p>
                </div>
                <button
                    onClick={() => setEditingApt({
                        name: '',
                        slug: '',
                        capacity_people: 2,
                        is_active: true,
                        images: [],
                        price_low: 60,
                        price_high: 70,
                        registration_number: 'A/JA/00060',
                        bathrooms: 1,
                        amenities: []
                    })}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold transition-all hover:scale-105 shadow-lg"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    <Plus size={20} /> Nuevo Apartamento
                </button>
            </div>

            {/* Modal de Edición Avanzada */}
            {editingApt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] max-w-6xl w-full shadow-2xl my-8">
                        <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 border-b border-gray-100 flex justify-between items-center rounded-t-[2rem] z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-rural-50 text-rural-700">
                                    <Home size={24} />
                                </div>
                                <h4 className="text-2xl font-serif font-bold">{editingApt.id ? 'Editar Ficha Técnica' : 'Nuevo Apartamento'}</h4>
                            </div>
                            <button onClick={() => setEditingApt(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X /></button>
                        </div>

                        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-h-[75vh] overflow-y-auto">
                            {/* Columna 1 */}
                            <div className="space-y-8">
                                <section className="space-y-4">
                                    <h5 className="font-bold flex items-center gap-2 text-rural-700 uppercase tracking-widest text-xs">
                                        <Layout size={16} /> Datos Principales
                                    </h5>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nombre</label>
                                            <input
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none transition-all"
                                                value={editingApt.name || ''}
                                                onChange={e => setEditingApt({ ...editingApt, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Slug (URL)</label>
                                                <input
                                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                    value={editingApt.slug || ''}
                                                    onChange={e => setEditingApt({ ...editingApt, slug: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nº Registro</label>
                                                <input
                                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                    value={editingApt.registration_number || ''}
                                                    onChange={e => setEditingApt({ ...editingApt, registration_number: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <h5 className="font-bold flex items-center gap-2 text-rural-700 uppercase tracking-widest text-xs">
                                        <ShieldCheck size={16} /> Tarifas y Capacidad
                                    </h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Precio T. Baja</label>
                                            <input
                                                type="number"
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                value={editingApt.price_low || ''}
                                                onChange={e => setEditingApt({ ...editingApt, price_low: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Precio T. Alta</label>
                                            <input
                                                type="number"
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                value={editingApt.price_high || ''}
                                                onChange={e => setEditingApt({ ...editingApt, price_high: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Plazas</label>
                                            <input
                                                type="number"
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                value={editingApt.capacity_people || ''}
                                                onChange={e => setEditingApt({ ...editingApt, capacity_people: parseInt(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Baños</label>
                                            <input
                                                type="number"
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                value={editingApt.bathrooms || ''}
                                                onChange={e => setEditingApt({ ...editingApt, bathrooms: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Columna 2: Sincronización */}
                            <div className="space-y-8">
                                <section className="space-y-4">
                                    <h5 className="font-bold flex items-center gap-2 text-rural-700 uppercase tracking-widest text-xs">
                                        <LinkIcon size={16} /> Sincronización Importación (AIRBNB, BOOKING, HOLIDU...)
                                    </h5>
                                    <div className="space-y-4 bg-rural-50 p-6 rounded-3xl border border-rural-100">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-rural-400 mb-1">Airbnb iCal (.ics)</label>
                                            <input
                                                className="w-full p-4 bg-white border border-gray-100 rounded-2xl text-xs"
                                                placeholder="https://www.airbnb.es/calendar/export..."
                                                value={editingApt.airbnb_ical_url || ''}
                                                onChange={e => setEditingApt({ ...editingApt, airbnb_ical_url: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-rural-400 mb-1">Booking iCal (.ics)</label>
                                            <input
                                                className="w-full p-4 bg-white border border-gray-100 rounded-2xl text-xs"
                                                placeholder="https://ical.booking.com/v1/export..."
                                                value={editingApt.booking_ical_url || ''}
                                                onChange={e => setEditingApt({ ...editingApt, booking_ical_url: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <h5 className="font-bold flex items-center gap-2 text-rural-700 uppercase tracking-widest text-xs">
                                        <RefreshCw size={16} /> Sincronización Exportación (HACIA FUERA)
                                    </h5>
                                    <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 space-y-4">
                                        <p className="text-[10px] text-amber-800 font-bold uppercase">Copia este enlace en Airbnb/Booking:</p>
                                        <div className="flex gap-2">
                                            <input
                                                readOnly
                                                className="flex-grow p-3 bg-white border border-amber-200 rounded-xl text-[10px] font-mono"
                                                value={editingApt.slug ? getICalUrl(editingApt.slug) : 'Guarda primero el apartamento'}
                                            />
                                            <button
                                                onClick={() => copyToClipboard(getICalUrl(editingApt.slug))}
                                                className="p-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-amber-600 italic">Pega este enlace en la sección "Importar Calendario" de las otras plataformas.</p>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <h5 className="font-bold flex items-center gap-2 text-rural-700 uppercase tracking-widest text-xs">
                                        <List size={16} /> Servicios Incluidos
                                    </h5>
                                    <div className="grid grid-cols-2 gap-2">
                                        {AMENITIES_LIST.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => toggleAmenity(item.id)}
                                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${(editingApt.amenities || []).includes(item.id) ? 'bg-rural-50 border-rural-200 text-rural-700' : 'bg-white border-gray-100 text-gray-400'}`}
                                            >
                                                <item.icon size={16} />
                                                <span className="text-[10px] font-bold uppercase">{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            {/* Columna 3 */}
                            <div className="space-y-8">
                                <section className="space-y-4">
                                    <h5 className="font-bold flex items-center gap-2 text-rural-700 uppercase tracking-widest text-xs">
                                        <Camera size={16} /> Galería Visual
                                    </h5>
                                    <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-4">
                                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                                        <button
                                            onClick={() => fileInputRef.current.click()}
                                            disabled={isUploading}
                                            className="w-full py-4 border-2 border-dashed border-rural-200 rounded-2xl flex items-center justify-center gap-2 text-rural-600 font-bold hover:bg-rural-100 transition-all"
                                        >
                                            {isUploading ? <Loader2 className="animate-spin" /> : <Upload size={18} />} Subir foto
                                        </button>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(editingApt.images || []).map((img, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                                                    <img src={img} className="w-full h-full object-cover" />
                                                    <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <h5 className="font-bold flex items-center gap-2 text-rural-700 uppercase tracking-widest text-xs">
                                        <Info size={16} /> Descripción
                                    </h5>
                                    <textarea
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                        rows="6"
                                        value={editingApt.description || ''}
                                        onChange={e => setEditingApt({ ...editingApt, description: e.target.value })}
                                    />
                                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <button
                                            onClick={() => setEditingApt({ ...editingApt, is_active: !editingApt.is_active })}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${editingApt.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${editingApt.is_active ? 'left-7' : 'left-1'}`} />
                                        </button>
                                        <span className="text-sm font-bold text-gray-600">Visible en la web</span>
                                    </div>
                                </section>
                            </div>
                        </div>

                        <div className="p-8 border-t border-gray-100 flex gap-3 justify-end bg-gray-50/50 rounded-b-[2rem]">
                            <button onClick={() => setEditingApt(null)} className="px-8 py-3 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-100 transition-colors">Cancelar</button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-10 py-3 bg-rural-700 text-white font-bold rounded-2xl hover:bg-rural-800 transition-all shadow-lg flex items-center gap-2"
                            >
                                {isSaving ? 'Guardando...' : <Save size={20} />} Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-6">
                {apartments.map(apt => (
                    <div key={apt.id} className="group bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 hover:shadow-xl transition-all">
                        <div className="w-full md:w-64 h-44 bg-gray-100 rounded-2xl overflow-hidden relative">
                            <img src={apt.images?.[0] || 'https://via.placeholder.com/400x300'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>

                        <div className="flex-grow flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-3xl font-serif font-bold text-rural-900">{apt.name}</h4>
                                    <p className="text-xs text-gray-400">/{apt.slug} · {apt.registration_number}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingApt(apt)} className="p-3 text-rural-600 hover:bg-rural-50 rounded-2xl transition-all"><Edit2 size={20} /></button>
                                    <button onClick={() => handleDelete(apt.id)} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20} /></button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                                <div className="flex gap-4">
                                    <div className="text-center">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">T. Baja</p>
                                        <p className="text-lg font-serif font-bold text-rural-800">{apt.price_low}€</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">T. Alta</p>
                                        <p className="text-lg font-serif font-bold text-rural-800">{apt.price_high}€</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => handleSync(apt)}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-4 py-2 bg-rural-50 text-rural-700 rounded-xl font-bold text-xs hover:bg-rural-100 transition-all"
                                    >
                                        <RefreshCw size={14} className={isSaving ? 'animate-spin' : ''} />
                                        Sincronizar
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

export default ApartmentsManager;

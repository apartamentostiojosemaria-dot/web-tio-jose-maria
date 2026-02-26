import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import {
    Plus, Edit2, Trash2, Camera, Check, X, Save,
    Home, Users, Eye, EyeOff, Layout, List, Upload, Loader2
} from 'lucide-react';

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

            const { error: uploadError, data } = await supabase.storage
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
            alert('Error al subir la imagen. Asegúrate de haber ejecutado el SQL de Storage en Supabase: ' + error.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const addImage = () => {
        if (!newImageUrl) return;
        const currentImages = editingApt.images || [];
        setEditingApt({
            ...editingApt,
            images: [...currentImages, newImageUrl]
        });
        setNewImageUrl('');
    };

    const removeImage = (index) => {
        const currentImages = [...(editingApt.images || [])];
        currentImages.splice(index, 1);
        setEditingApt({
            ...editingApt,
            images: currentImages
        });
    };

    if (loading) return <div className="p-10 text-center animate-pulse font-serif italic text-gray-500">Cargando la casa...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Gestión de Apartamentos</h3>
                    <p className="text-sm text-gray-400">Controla fotos, textos y visibilidad tus alojamientos</p>
                </div>
                <button
                    onClick={() => setEditingApt({ name: '', slug: '', capacity_people: 2, is_active: true, images: [] })}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold transition-all hover:scale-105 shadow-lg"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    <Plus size={20} /> Nuevo Apartamento
                </button>
            </div>

            {/* Modal de Edición Avanzada */}
            {editingApt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] max-w-4xl w-full shadow-2xl my-8">
                        <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 border-b border-gray-100 flex justify-between items-center rounded-t-[2rem] z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-rural-50 text-rural-700">
                                    <Home size={24} />
                                </div>
                                <h4 className="text-2xl font-serif font-bold">{editingApt.id ? 'Editar Apartamento' : 'Nuevo Apartamento'}</h4>
                            </div>
                            <button onClick={() => setEditingApt(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X /></button>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
                            {/* Columna Izquierda: Información Básica */}
                            <div className="space-y-6">
                                <section className="space-y-4">
                                    <h5 className="font-bold flex items-center gap-2 text-rural-700">
                                        <Layout size={18} /> Información Principal
                                    </h5>
                                    <div className="grid gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nombre del Apartamento</label>
                                            <input
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none transition-all"
                                                value={editingApt.name || ''}
                                                placeholder="Ej: Suite Albahaca"
                                                onChange={e => setEditingApt({ ...editingApt, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL amigable (slug)</label>
                                                <input
                                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                    value={editingApt.slug || ''}
                                                    placeholder="albahaca"
                                                    onChange={e => setEditingApt({ ...editingApt, slug: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Capacidad Máx.</label>
                                                <div className="relative">
                                                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                                    <input
                                                        type="number"
                                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                        value={editingApt.capacity_people || ''}
                                                        onChange={e => setEditingApt({ ...editingApt, capacity_people: parseInt(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Descripción detallada</label>
                                            <textarea
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 ring-rural-300 outline-none"
                                                rows="5"
                                                placeholder="Describe el encanto de este apartamento..."
                                                value={editingApt.description || ''}
                                                onChange={e => setEditingApt({ ...editingApt, description: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <button
                                                type="button"
                                                onClick={() => setEditingApt({ ...editingApt, is_active: !editingApt.is_active })}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${editingApt.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${editingApt.is_active ? 'left-7' : 'left-1'}`} />
                                            </button>
                                            <span className="text-sm font-bold text-gray-600">
                                                {editingApt.is_active ? 'Visible en la web' : 'Oculto temporalmente'}
                                            </span>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Columna Derecha: Galería de Fotos */}
                            <div className="space-y-6">
                                <section className="space-y-4">
                                    <h5 className="font-bold flex items-center gap-2 text-rural-700">
                                        <Camera size={18} /> Galería de Fotos
                                    </h5>

                                    <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-6">
                                        {/* Subida de Archivo Local */}
                                        <div>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileUpload}
                                                accept="image/*"
                                                className="hidden"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current.click()}
                                                disabled={isUploading}
                                                className="w-full py-6 border-2 border-dashed border-rural-200 rounded-3xl flex flex-col items-center justify-center gap-2 hover:bg-rural-100/50 hover:border-rural-300 transition-all group"
                                            >
                                                {isUploading ? (
                                                    <Loader2 className="animate-spin text-rural-600" size={32} />
                                                ) : (
                                                    <Upload className="text-rural-400 group-hover:text-rural-600 transition-colors" size={32} />
                                                )}
                                                <span className="text-xs font-bold text-rural-700">SUBIR DESDE MI PC</span>
                                            </button>
                                        </div>

                                        <div className="relative flex items-center py-2">
                                            <div className="flex-grow border-t border-gray-200"></div>
                                            <span className="flex-shrink mx-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">O pega un enlace</span>
                                            <div className="flex-grow border-t border-gray-200"></div>
                                        </div>

                                        <div className="flex gap-2">
                                            <input
                                                className="flex-grow p-3 bg-white border border-gray-100 rounded-xl text-sm outline-none shadow-sm"
                                                placeholder="https://enlace-de-mi-foto.jpg"
                                                value={newImageUrl}
                                                onChange={e => setNewImageUrl(e.target.value)}
                                                onKeyPress={e => e.key === 'Enter' && addImage()}
                                            />
                                            <button
                                                type="button"
                                                onClick={addImage}
                                                className="p-3 bg-rural-700 text-white rounded-xl hover:bg-rural-800 transition-colors shadow-md"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2">
                                            {(editingApt.images || []).map((img, idx) => (
                                                <div key={idx} className="relative aspect-square group rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                                    <img src={img} className="w-full h-full object-cover" />
                                                    <button
                                                        onClick={() => removeImage(idx)}
                                                        className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                    {idx === 0 && (
                                                        <div className="absolute bottom-0 inset-x-0 bg-rural-700/80 text-[8px] text-white text-center py-1 font-bold uppercase tracking-widest">Portada</div>
                                                    )}
                                                </div>
                                            ))}
                                            {(!editingApt.images || editingApt.images.length === 0) && (
                                                <div className="col-span-3 py-10 text-center text-xs text-gray-400 italic">No hay fotos. Sube una arriba.</div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>

                        <div className="p-8 border-t border-gray-100 flex gap-3 justify-end bg-gray-50/50 rounded-b-[2rem]">
                            <button
                                onClick={() => setEditingApt(null)}
                                className="px-8 py-3 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-10 py-3 bg-rural-700 text-white font-bold rounded-2xl hover:bg-rural-800 transition-all shadow-lg shadow-rural-200 flex items-center gap-2"
                            >
                                {isSaving ? 'Guardando...' : <><Save size={20} /> Guardar Cambios</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-6">
                {apartments.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Home className="opacity-20" size={40} />
                        </div>
                        <h4 className="text-xl font-serif font-bold text-gray-400 mb-2">No hay apartamentos</h4>
                        <p className="text-gray-300">Empieza creando el primero pulsando el botón superior</p>
                    </div>
                ) : (
                    apartments.map(apt => (
                        <div key={apt.id} className="group bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="w-full md:w-64 h-44 bg-gray-100 rounded-2xl overflow-hidden relative shadow-inner">
                                <img
                                    src={apt.images?.[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80'}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                                    <span className="text-white text-[10px] font-bold uppercase tracking-widest bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">
                                        {apt.images?.length || 0} Fotos
                                    </span>
                                </div>
                            </div>

                            <div className="flex-grow flex flex-col justify-between py-1">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-3xl font-serif font-bold" style={{ color: COLORS.text }}>{apt.name}</h4>
                                            <div className="flex items-center gap-2 text-xs font-mono text-gray-400 mt-1">
                                                <span className="bg-gray-100 px-2 rounded-md">/{apt.slug}</span>
                                                <span className="opacity-20">|</span>
                                                <span className="flex items-center gap-1 text-rural-600 font-bold"><Users size={12} /> Máx {apt.capacity_people}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEditingApt(apt)}
                                                className="p-3 text-rural-600 hover:bg-rural-50 rounded-2xl transition-all"
                                                title="Editar"
                                            >
                                                <Edit2 size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(apt.id)}
                                                className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-gray-500 leading-relaxed line-clamp-2 italic">{apt.description || 'Sin descripción detallada.'}</p>
                                </div>

                                <div className="mt-6 flex items-center justify-between border-t border-gray-50 pt-4">
                                    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full ${apt.is_active ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {apt.is_active ? <><Eye size={12} /> Visible</> : <><EyeOff size={12} /> Oculto</>}
                                    </div>
                                    <button
                                        onClick={() => setEditingApt(apt)}
                                        className="text-xs font-bold text-rural-700 hover:underline flex items-center gap-1"
                                    >
                                        Ver detalles avanzados <Layout size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ApartmentsManager;

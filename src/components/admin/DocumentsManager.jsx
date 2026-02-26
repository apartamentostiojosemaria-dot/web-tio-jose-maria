import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { FileText, Download, Trash2, Globe, Lock, Plus, Upload, X, Loader2 } from 'lucide-react';

const DocumentsManager = () => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [newDoc, setNewDoc] = useState({ title: '', category: 'general', visibility: 'publico' });
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchDocs();
    }, []);

    async function fetchDocs() {
        setLoading(true);
        const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
        if (data) setDocs(data);
        setLoading(false);
    }

    const handleUpload = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file || !newDoc.title.trim()) {
            alert('Introduce un título y selecciona un archivo.');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(fileName);

            const { error: insertError } = await supabase.from('documents').insert([{
                title: newDoc.title,
                file_url: publicUrl,
                visibility: newDoc.visibility,
                category: newDoc.category
            }]);

            if (insertError) throw insertError;

            setNewDoc({ title: '', category: 'general', visibility: 'publico' });
            setShowForm(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchDocs();
        } catch (error) {
            alert('Error al subir documento: ' + error.message);
        }
        setUploading(false);
    };

    const togglePrivacy = async (id, currentVisibility) => {
        const newVis = currentVisibility === 'publico' ? 'solo_clientes' : 'publico';
        const { error } = await supabase
            .from('documents')
            .update({ visibility: newVis })
            .eq('id', id);
        if (!error) fetchDocs();
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este documento?')) return;
        await supabase.from('documents').delete().eq('id', id);
        fetchDocs();
    };

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando documentos...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Gestión de Documentos</h3>
                    <p className="text-sm text-gray-500">Sube guías para todos o documentos privados para clientes</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-md"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancelar' : 'Subir Documento'}
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-rural-200 space-y-4">
                    <h4 className="font-bold text-lg">Nuevo Documento</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Título</label>
                            <input
                                type="text"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 ring-rural-300"
                                placeholder="Ej: Guía del huésped"
                                value={newDoc.title}
                                onChange={e => setNewDoc({ ...newDoc, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Categoría</label>
                            <select
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                                value={newDoc.category}
                                onChange={e => setNewDoc({ ...newDoc, category: e.target.value })}
                            >
                                <option value="general">General</option>
                                <option value="guia">Guía</option>
                                <option value="contrato">Contrato</option>
                                <option value="normativa">Normativa</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-4 items-end">
                        <div className="flex-grow">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Archivo</label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm"
                                accept=".pdf,.doc,.docx,.jpg,.png"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Visibilidad</label>
                            <select
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                                value={newDoc.visibility}
                                onChange={e => setNewDoc({ ...newDoc, visibility: e.target.value })}
                            >
                                <option value="publico">Público</option>
                                <option value="solo_clientes">Solo Clientes</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        {uploading ? 'Subiendo...' : 'Subir Documento'}
                    </button>
                </div>
            )}

            <div className="grid gap-4">
                {docs.map(doc => (
                    <div key={doc.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-6">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ color: COLORS.primary, backgroundColor: COLORS.bgWarm }}>
                            <FileText size={24} />
                        </div>
                        <div className="flex-grow">
                            <h4 className="font-bold text-gray-800">{doc.title}</h4>
                            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                                {doc.category || 'General'} • {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => togglePrivacy(doc.id, doc.visibility)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${doc.visibility === 'publico' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                            >
                                {doc.visibility === 'publico' ? <Globe size={14} /> : <Lock size={14} />}
                                {doc.visibility === 'publico' ? 'Público' : 'Solo Clientes'}
                            </button>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-300 hover:text-blue-500"><Download size={18} /></a>
                            <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={18} /></button>
                        </div>
                    </div>
                ))}
                {docs.length === 0 && (
                    <div className="p-20 text-center bg-white border-2 border-dashed rounded-3xl opacity-30 italic font-serif">
                        Todavía no has subido ningún documento.
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentsManager;

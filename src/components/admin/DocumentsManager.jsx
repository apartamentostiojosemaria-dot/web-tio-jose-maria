import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { FileText, Download, Trash2, Globe, Lock, Plus, File } from 'lucide-react';

const DocumentsManager = () => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDocs();
    }, []);

    async function fetchDocs() {
        setLoading(true);
        const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
        if (data) setDocs(data);
        setLoading(false);
    }

    const togglePrivacy = async (id, isPublic) => {
        const { error } = await supabase
            .from('documents')
            .update({ is_public: !isPublic })
            .eq('id', id);
        if (!error) fetchDocs();
    };

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando documentos...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Gestión de Documentos</h3>
                    <p className="text-sm text-gray-500">Sube guías para todos o documentos privados para clientes</p>
                </div>
                <button className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-md" style={{ backgroundColor: COLORS.primary }}>
                    <Plus size={18} /> Subir Documento
                </button>
            </div>

            <div className="grid gap-4">
                {docs.map(doc => (
                    <div key={doc.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-6">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-rural-600 bg-rural-50" style={{ color: COLORS.primary, backgroundColor: COLORS.bgWarm }}>
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
                                onClick={() => togglePrivacy(doc.id, doc.is_public)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${doc.is_public ? 'bg-green-50 border-green-100 text-green-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                            >
                                {doc.is_public ? <Globe size={14} /> : <Lock size={14} />}
                                {doc.is_public ? 'Público' : 'Solo Clientes'}
                            </button>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-300 hover:text-blue-500"><Download size={18} /></a>
                            <button className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={18} /></button>
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

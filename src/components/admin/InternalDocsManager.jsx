import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Upload, Trash2, Download, Search, RefreshCw, FolderOpen } from 'lucide-react';

// Documentos internos: archivos privados de gestión.
// Distinto de 'documents' (que es público para huéspedes).
// Bucket de Supabase Storage 'internal-docs' (lo creamos abajo bajo demanda).

const CATEGORIES = [
    { value: 'contratos',  label: 'Contratos' },
    { value: 'normativa',  label: 'Normativa y legal' },
    { value: 'inventario', label: 'Inventario y mantenimiento' },
    { value: 'proveedores',label: 'Proveedores' },
    { value: 'fotos',      label: 'Fotos y media' },
    { value: 'fiscal',     label: 'Fiscal y contabilidad' },
    { value: 'otros',      label: 'Otros' },
];

const fmtSize = (n) => {
    if (!n) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const InternalDocsManager = () => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({ title: '', description: '', category: 'otros', file: null });
    const [showUpload, setShowUpload] = useState(false);
    const fileInputRef = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('internal_documents')
            .select('*')
            .order('uploaded_at', { ascending: false });
        setDocs(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = docs.filter(d => {
        if (filter !== 'all' && d.category !== filter) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (d.title || '').toLowerCase().includes(q)
            || (d.description || '').toLowerCase().includes(q);
    });

    const upload = async (e) => {
        e.preventDefault();
        if (!uploadForm.file || !uploadForm.title) return;
        setUploading(true);
        try {
            const file = uploadForm.file;
            const ext = file.name.split('.').pop();
            const safeName = uploadForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
            const path = `${uploadForm.category}/${Date.now()}-${safeName}.${ext}`;

            const { error: upErr } = await supabase.storage.from('internal-docs').upload(path, file, {
                cacheControl: '3600',
                upsert: false,
            });
            if (upErr) {
                if (upErr.message?.includes('not found') || upErr.message?.includes('Bucket')) {
                    alert('Falta crear el bucket "internal-docs" en Supabase Storage. Avisa al administrador del sistema.');
                } else {
                    alert('Error subiendo el archivo: ' + upErr.message);
                }
                return;
            }

            const { data: { publicUrl } } = supabase.storage.from('internal-docs').getPublicUrl(path);

            await supabase.from('internal_documents').insert({
                title: uploadForm.title,
                description: uploadForm.description || null,
                file_url: publicUrl,
                file_size: file.size,
                mime_type: file.type,
                category: uploadForm.category,
            });

            setUploadForm({ title: '', description: '', category: 'otros', file: null });
            setShowUpload(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            await load();
        } finally {
            setUploading(false);
        }
    };

    const remove = async (d) => {
        if (!confirm(`¿Borrar "${d.title}"? Esta acción no se puede deshacer.`)) return;
        const path = d.file_url?.split('/internal-docs/')[1];
        if (path) {
            await supabase.storage.from('internal-docs').remove([path]);
        }
        await supabase.from('internal_documents').delete().eq('id', d.id);
        await load();
    };

    return (
        <div className="max-w-6xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Documentos internos</h1>
                    <p className="text-sm text-gray-600 max-w-2xl mt-1">
                        Archivos privados de gestión: contratos con la limpiadora, normativa, fotos del inventario, recibos... Solo los ve quien tiene acceso al panel.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowUpload(true)}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow hover:shadow-md">
                        <Upload size={14} /> Subir archivo
                    </button>
                    <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                        <RefreshCw size={14} /> Actualizar
                    </button>
                </div>
            </header>

            <div className="flex flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </div>
                <select value={filter} onChange={(e) => setFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none cursor-pointer">
                    <option value="all">Todas las categorías</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
            </div>

            {showUpload && (
                <form onSubmit={upload} className="mb-6 bg-rural-50 border border-rural-200 rounded-2xl p-5">
                    <h2 className="font-serif text-lg font-bold mb-3">Subir documento</h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">Título</span>
                            <input type="text" required maxLength={120} value={uploadForm.title}
                                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                                placeholder="ej. Contrato limpiadora 2026"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-primary text-sm" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">Categoría</span>
                            <select value={uploadForm.category} onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-primary text-sm cursor-pointer">
                                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </label>
                    </div>
                    <label className="block mt-3">
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">Descripción (opcional)</span>
                        <textarea value={uploadForm.description}
                            onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                            rows={2}
                            placeholder="Para qué es, fechas, observaciones..."
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-primary text-sm" />
                    </label>
                    <label className="block mt-3">
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">Archivo</span>
                        <input type="file" required ref={fileInputRef}
                            onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                            className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-rural-100 file:text-rural-700 hover:file:bg-rural-200" />
                    </label>
                    <div className="flex gap-2 mt-4">
                        <button type="submit" disabled={uploading || !uploadForm.file || !uploadForm.title}
                            className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow disabled:opacity-50">
                            {uploading ? 'Subiendo...' : 'Subir'}
                        </button>
                        <button type="button" onClick={() => setShowUpload(false)}
                            className="text-sm font-bold text-rural-700 px-4 py-2">Cancelar</button>
                    </div>
                </form>
            )}

            {loading ? <p className="text-gray-500 font-serif italic">Cargando...</p> :
             filtered.length === 0 ? (
                <div className="text-center py-12">
                    <FolderOpen size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-serif italic">No hay documentos guardados todavía.</p>
                    <p className="text-xs text-gray-400 mt-2">Sube el primero con el botón "Subir archivo".</p>
                </div>
             ) :
             (<ul className="space-y-2">
                {filtered.map(d => (
                    <li key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-rural-100 flex items-center justify-center flex-shrink-0">
                            <FileText size={18} className="text-rural-700" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-text-primary truncate">{d.title}</p>
                            {d.description && <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{d.description}</p>}
                            <div className="flex gap-3 mt-1 text-[10px] uppercase tracking-widest font-bold text-gray-400">
                                <span>{CATEGORIES.find(c => c.value === d.category)?.label || d.category}</span>
                                <span>·</span>
                                <span>{new Date(d.uploaded_at).toLocaleDateString('es-ES')}</span>
                                <span>·</span>
                                <span>{fmtSize(d.file_size)}</span>
                            </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                            <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                                className="p-2 rounded-lg text-rural-700 hover:bg-rural-50" title="Descargar">
                                <Download size={16} />
                            </a>
                            <button onClick={() => remove(d)}
                                className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Borrar">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </li>
                ))}
             </ul>)
            }
        </div>
    );
};

export default InternalDocsManager;

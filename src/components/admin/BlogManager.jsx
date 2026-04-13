import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logError, userErrorMessage } from '../../utils/logger';
import { validateImageFile } from '../../utils/fileValidation';
import {
    Plus, Save, X, Trash2, Pencil, Loader2, BookOpen,
    Image, Eye, EyeOff, Clock, Tag, FileText
} from 'lucide-react';

const CATEGORY_OPTIONS = [
    { value: 'guia', label: 'Guia', emoji: '\uD83D\uDDFA\uFE0F' },
    { value: 'pueblo', label: 'Pueblo', emoji: '\uD83C\uDFD8\uFE0F' },
    { value: 'naturaleza', label: 'Naturaleza', emoji: '\uD83C\uDF3F' },
    { value: 'gastronomia', label: 'Gastronomia', emoji: '\uD83C\uDF72' },
    { value: 'practico', label: 'Practico', emoji: '\uD83D\uDCCB' },
];

const EMPTY_POST = {
    title: '', slug: '', excerpt: '', content: '',
    featured_image_url: '', author: 'Tio Jose Maria',
    category: 'guia', tags: [], published: false,
    published_at: new Date().toISOString().split('T')[0],
    seo_title: '', seo_description: '', reading_time_min: 5,
};

function slugify(text) {
    return text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

const BlogManager = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [tagInput, setTagInput] = useState('');

    useEffect(() => { fetchPosts(); }, []);

    async function fetchPosts() {
        setLoading(true);
        const { data, error } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
        if (error) logError('BlogManager.fetch', error);
        if (data) setPosts(data);
        setLoading(false);
    }

    const resetForm = () => { setEditingPost(null); setTagInput(''); };

    const handleSave = async () => {
        if (!editingPost.title || !editingPost.slug) return alert('Titulo y slug son obligatorios.');
        setSaving(true);
        const { id, updated_at, created_at, ...payload } = editingPost;

        // Auto-calculate reading time from content
        const wordCount = (payload.content || '').replace(/<[^>]*>/g, '').split(/\s+/).length;
        payload.reading_time_min = Math.max(1, Math.ceil(wordCount / 200));

        let error;
        if (id) {
            ({ error } = await supabase.from('blog_posts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id));
        } else {
            ({ error } = await supabase.from('blog_posts').insert([payload]));
        }
        if (error) {
            logError('BlogManager.save', error);
            alert(userErrorMessage('Error al guardar el articulo.'));
        } else { resetForm(); fetchPosts(); }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Eliminar este articulo?')) return;
        await supabase.from('blog_posts').delete().eq('id', id);
        if (editingPost?.id === id) resetForm();
        fetchPosts();
    };

    const togglePublished = async (post) => {
        const updates = { published: !post.published };
        if (!post.published && !post.published_at) updates.published_at = new Date().toISOString();
        await supabase.from('blog_posts').update(updates).eq('id', post.id);
        fetchPosts();
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const validation = validateImageFile(file);
        if (!validation.valid) return alert(validation.message);

        setUploading(true);
        const fileName = `blog/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('apartments').upload(fileName, file);
        if (error) {
            logError('BlogManager.upload', error);
            alert('Error al subir la imagen.');
        } else {
            const { data: { publicUrl } } = supabase.storage.from('apartments').getPublicUrl(fileName);
            setEditingPost(prev => ({ ...prev, featured_image_url: publicUrl }));
        }
        setUploading(false);
    };

    const addTag = () => {
        const tag = tagInput.trim().toLowerCase();
        if (tag && !editingPost.tags.includes(tag)) {
            setEditingPost(prev => ({ ...prev, tags: [...prev.tags, tag] }));
        }
        setTagInput('');
    };

    const removeTag = (tag) => {
        setEditingPost(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
    };

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando articulos...</div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-text-primary">Blog y Guias</h1>
                    <p className="text-sm text-gray-400 mt-1">{posts.length} articulos ({posts.filter(p => p.published).length} publicados)</p>
                </div>
                <button
                    onClick={() => setEditingPost({ ...EMPTY_POST })}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all"
                >
                    <Plus size={16} /> Nuevo Articulo
                </button>
            </div>

            {/* Posts list */}
            <div className="space-y-3">
                {posts.map(post => (
                    <div key={post.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 items-center hover:shadow-md transition-shadow">
                        {post.featured_image_url ? (
                            <img src={post.featured_image_url} alt={post.title} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-20 h-20 rounded-xl bg-rural-100 flex items-center justify-center flex-shrink-0">
                                <FileText size={24} className="text-rural-400" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-text-primary truncate">{post.title}</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${post.published ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                    {post.published ? 'Publicado' : 'Borrador'}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 truncate">{post.excerpt || 'Sin extracto'}</p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                                <span className="flex items-center gap-1"><Tag size={10} /> {CATEGORY_OPTIONS.find(c => c.value === post.category)?.label || post.category}</span>
                                <span className="flex items-center gap-1"><Clock size={10} /> {post.reading_time_min} min</span>
                                {post.published_at && <span>{new Date(post.published_at).toLocaleDateString('es-ES')}</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => togglePublished(post)} className="p-2 rounded-lg hover:bg-gray-50 transition-colors" title={post.published ? 'Despublicar' : 'Publicar'}>
                                {post.published ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
                            </button>
                            <button onClick={() => { setEditingPost({ ...post }); setTagInput(''); }} className="p-2 rounded-lg hover:bg-gray-50 transition-colors"><Pencil size={16} className="text-gray-400" /></button>
                            <button onClick={() => handleDelete(post.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16} className="text-red-400" /></button>
                        </div>
                    </div>
                ))}
                {posts.length === 0 && (
                    <div className="text-center py-20 opacity-50">
                        <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="font-serif italic">Aun no hay articulos. Crea el primero.</p>
                    </div>
                )}
            </div>

            {/* Edit modal */}
            {editingPost && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-start justify-center overflow-y-auto p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
                        {/* Header */}
                        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                            <h2 className="font-serif font-bold text-lg text-text-primary">
                                {editingPost.id ? 'Editar Articulo' : 'Nuevo Articulo'}
                            </h2>
                            <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Title */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Titulo *</label>
                                <input
                                    type="text"
                                    value={editingPost.title}
                                    onChange={e => {
                                        const title = e.target.value;
                                        setEditingPost(prev => ({
                                            ...prev,
                                            title,
                                            slug: prev.id ? prev.slug : slugify(title),
                                            seo_title: prev.seo_title || title,
                                        }));
                                    }}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200"
                                    placeholder="10 cosas que hacer en Hinojares"
                                />
                            </div>

                            {/* Slug */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Slug (URL)</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">/blog/</span>
                                    <input
                                        type="text"
                                        value={editingPost.slug}
                                        onChange={e => setEditingPost(prev => ({ ...prev, slug: slugify(e.target.value) }))}
                                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 font-mono"
                                    />
                                </div>
                            </div>

                            {/* Excerpt */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Extracto</label>
                                <textarea
                                    value={editingPost.excerpt}
                                    onChange={e => {
                                        setEditingPost(prev => ({
                                            ...prev,
                                            excerpt: e.target.value,
                                            seo_description: prev.seo_description || e.target.value,
                                        }));
                                    }}
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 resize-none"
                                    placeholder="Breve resumen del articulo (aparece en la tarjeta del listado)"
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Contenido (HTML)</label>
                                <textarea
                                    value={editingPost.content}
                                    onChange={e => setEditingPost(prev => ({ ...prev, content: e.target.value }))}
                                    rows={12}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 resize-y font-mono"
                                    placeholder="<h2>Subtitulo</h2><p>Parrafo...</p>"
                                />
                            </div>

                            {/* Featured image */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Imagen destacada</label>
                                {editingPost.featured_image_url && (
                                    <img src={editingPost.featured_image_url} alt="Preview" className="w-full h-48 object-cover rounded-xl mb-3" />
                                )}
                                <div className="flex gap-2">
                                    <label className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-bold cursor-pointer hover:bg-gray-100 transition-colors">
                                        <Image size={16} /> {uploading ? 'Subiendo...' : 'Subir imagen'}
                                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
                                    </label>
                                    <input
                                        type="text"
                                        value={editingPost.featured_image_url}
                                        onChange={e => setEditingPost(prev => ({ ...prev, featured_image_url: e.target.value }))}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-rural-200"
                                        placeholder="O pega una URL"
                                    />
                                </div>
                            </div>

                            {/* Category + Date row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Categoria</label>
                                    <select
                                        value={editingPost.category}
                                        onChange={e => setEditingPost(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 bg-white"
                                    >
                                        {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Fecha publicacion</label>
                                    <input
                                        type="date"
                                        value={editingPost.published_at?.split('T')[0] || ''}
                                        onChange={e => setEditingPost(prev => ({ ...prev, published_at: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200"
                                    />
                                </div>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Tags</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {editingPost.tags.map(tag => (
                                        <span key={tag} className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
                                            {tag}
                                            <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={12} /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200"
                                        placeholder="Anadir tag y pulsar Enter"
                                    />
                                    <button onClick={addTag} className="px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-bold hover:bg-gray-100">Anadir</button>
                                </div>
                            </div>

                            {/* SEO fields */}
                            <details className="border border-gray-100 rounded-xl p-4">
                                <summary className="text-xs font-bold uppercase tracking-widest text-gray-500 cursor-pointer">SEO (titulo y descripcion para Google)</summary>
                                <div className="mt-4 space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">SEO Title ({(editingPost.seo_title || '').length}/60)</label>
                                        <input
                                            type="text"
                                            value={editingPost.seo_title}
                                            onChange={e => setEditingPost(prev => ({ ...prev, seo_title: e.target.value }))}
                                            maxLength={60}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">SEO Description ({(editingPost.seo_description || '').length}/155)</label>
                                        <textarea
                                            value={editingPost.seo_description}
                                            onChange={e => setEditingPost(prev => ({ ...prev, seo_description: e.target.value }))}
                                            maxLength={155}
                                            rows={2}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 resize-none"
                                        />
                                    </div>
                                </div>
                            </details>
                        </div>

                        {/* Footer */}
                        <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-gray-100 px-6 py-4 flex items-center justify-between">
                            <button onClick={resetForm} className="px-5 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600">Cancelar</button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlogManager;

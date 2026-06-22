import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, BookOpen, FileText, Lightbulb, RefreshCw, Plus, Edit3, X, Save, Trash2 } from 'lucide-react';

// Manager de protocolos: manual interno + ayuda contextual + referencia.
// =======================================================================
// 3 categorías:
//   - help    → ayuda de cada tab del admin (se muestra desde el botón "?")
//   - process → procesos operativos ("qué hago cuando...")
//   - reference → documentación de referencia

const CATEGORY = {
    help:      { label: 'Ayuda del panel', icon: Lightbulb, color: 'rural' },
    process:   { label: 'Procesos del día a día', icon: BookOpen, color: 'primary' },
    reference: { label: 'Referencia y normativa', icon: FileText, color: 'gray' },
};

const ProtocolsManager = () => {
    const [protocols, setProtocols] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState(null);
    const [editing, setEditing] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('protocols')
            .select('*')
            .order('category')
            .order('sort_order')
            .order('title');
        setProtocols(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = protocols.filter(p => {
        if (filter !== 'all' && p.category !== filter) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (p.title || '').toLowerCase().includes(q)
            || (p.summary || '').toLowerCase().includes(q)
            || (p.content || '').toLowerCase().includes(q)
            || (p.keywords || []).some(k => (k || '').toLowerCase().includes(q));
    });

    const grouped = filtered.reduce((acc, p) => {
        (acc[p.category] = acc[p.category] || []).push(p);
        return acc;
    }, {});

    const save = async (p) => {
        const payload = { ...p };
        delete payload.created_at;
        delete payload.updated_at;
        delete payload.updated_by;
        if (payload.id) {
            await supabase.from('protocols').update(payload).eq('id', payload.id);
        } else {
            delete payload.id;
            await supabase.from('protocols').insert(payload);
        }
        setEditing(null);
        await load();
    };

    const remove = async (id) => {
        if (!confirm('¿Borrar este protocolo? Esta acción no se puede deshacer.')) return;
        await supabase.from('protocols').delete().eq('id', id);
        setSelected(null);
        await load();
    };

    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Manual y protocolos</h1>
                    <p className="text-sm text-gray-600 max-w-2xl mt-1">
                        Cómo se hace cada cosa, qué significa cada parte del panel, normativa. Si tienes una duda, busca aquí antes de preguntarle a nadie.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setEditing({ category: 'process', slug: '', title: '', summary: '', content: '', sort_order: 0 })}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow hover:shadow-md">
                        <Plus size={14} /> Añadir protocolo
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
                        placeholder="Busca por palabra clave..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </div>
                <select value={filter} onChange={(e) => setFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none cursor-pointer">
                    <option value="all">Todas las categorías</option>
                    {Object.entries(CATEGORY).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                </select>
            </div>

            {loading ? <p className="text-gray-500 font-serif italic">Cargando manual...</p> :
             filtered.length === 0 ? <p className="text-gray-500 font-serif italic">Sin resultados con esos criterios.</p> :
            <div className="space-y-8">
                {Object.entries(grouped).map(([cat, items]) => {
                    const c = CATEGORY[cat] || CATEGORY.reference;
                    const Icon = c.icon;
                    return (
                        <section key={cat}>
                            <h2 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-3">
                                <Icon size={14} aria-hidden="true" className="text-primary" /> {c.label}
                                <span className="text-xs text-gray-400 font-normal">({items.length})</span>
                            </h2>
                            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {items.map(p => (
                                    <li key={p.id}>
                                        <button onClick={() => setSelected(p)}
                                            className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 h-full">
                                            <p className="font-serif font-bold text-text-primary mb-1">{p.title}</p>
                                            {p.summary && <p className="text-xs text-gray-600 leading-relaxed">{p.summary}</p>}
                                            {p.related_tab && <p className="text-[10px] text-rural-700 font-bold uppercase tracking-widest mt-2">Para la sección: {p.related_tab}</p>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </div>}

            {selected && (
                <ProtocolDetail protocol={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onDelete={() => remove(selected.id)} />
            )}

            {editing && (
                <ProtocolEditor protocol={editing} onSave={save} onCancel={() => setEditing(null)} />
            )}
        </div>
    );
};

// Renderer simplísimo de markdown: solo cabeceras, párrafos, listas, negrita, código inline, citas, enlaces.
const renderMarkdown = (md) => {
    if (!md) return null;
    const lines = md.split('\n');
    const blocks = [];
    let listBuf = null;
    let quoteBuf = null;

    const flushList = () => { if (listBuf) { blocks.push({ t: 'ul', items: listBuf }); listBuf = null; } };
    const flushQuote = () => { if (quoteBuf) { blocks.push({ t: 'quote', text: quoteBuf.join('\n') }); quoteBuf = null; } };

    for (const line of lines) {
        if (line.startsWith('# ')) { flushList(); flushQuote(); blocks.push({ t: 'h1', text: line.slice(2) }); }
        else if (line.startsWith('## ')) { flushList(); flushQuote(); blocks.push({ t: 'h2', text: line.slice(3) }); }
        else if (line.startsWith('### ')) { flushList(); flushQuote(); blocks.push({ t: 'h3', text: line.slice(4) }); }
        else if (/^\d+\.\s/.test(line)) { flushQuote(); if (!listBuf || listBuf.kind !== 'ol') { flushList(); listBuf = { kind: 'ol', items: [] }; } listBuf.items.push(line.replace(/^\d+\.\s/, '')); }
        else if (line.startsWith('- ')) { flushQuote(); if (!listBuf || listBuf.kind !== 'ul') { flushList(); listBuf = { kind: 'ul', items: [] }; } listBuf.items.push(line.slice(2)); }
        else if (line.startsWith('> ')) { flushList(); (quoteBuf = quoteBuf || []).push(line.slice(2)); }
        else if (line.trim() === '') { flushList(); flushQuote(); }
        else { flushList(); flushQuote(); blocks.push({ t: 'p', text: line }); }
    }
    flushList(); flushQuote();

    const inline = (s) => {
        // Bold + code + links + emoji
        const parts = [];
        let rest = s;
        let key = 0;
        const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/;
        let m;
        while ((m = re.exec(rest))) {
            const before = rest.slice(0, m.index);
            if (before) parts.push(before);
            if (m[2] !== undefined) parts.push(<strong key={key++}>{m[2]}</strong>);
            else if (m[3] !== undefined) parts.push(<code key={key++} className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{m[3]}</code>);
            else if (m[4] !== undefined) parts.push(<a key={key++} href={m[5]} target="_blank" rel="noopener noreferrer" className="text-rural-700 underline">{m[4]}</a>);
            rest = rest.slice(m.index + m[0].length);
        }
        if (rest) parts.push(rest);
        return parts;
    };

    return blocks.map((b, i) => {
        if (b.t === 'h1') return <h1 key={i} className="font-serif text-2xl font-bold text-text-primary mt-6 mb-3">{inline(b.text)}</h1>;
        if (b.t === 'h2') return <h2 key={i} className="font-serif text-xl font-bold text-text-primary mt-5 mb-2">{inline(b.text)}</h2>;
        if (b.t === 'h3') return <h3 key={i} className="font-bold text-text-primary mt-4 mb-2">{inline(b.text)}</h3>;
        if (b.t === 'p') return <p key={i} className="text-gray-700 leading-relaxed mb-3">{inline(b.text)}</p>;
        if (b.t === 'ul') return (
            <ListBlock key={i} kind={b.items.kind} items={b.items.items} inline={inline} />
        );
        if (b.t === 'quote') return <blockquote key={i} className="border-l-4 border-rural-300 bg-rural-50 px-4 py-2 my-3 text-gray-700 italic">{inline(b.text)}</blockquote>;
        return null;
    });
};

const ListBlock = ({ kind, items, inline }) => {
    const Tag = kind === 'ol' ? 'ol' : 'ul';
    return (
        <Tag className={`mb-3 pl-6 space-y-1 text-gray-700 ${kind === 'ol' ? 'list-decimal' : 'list-disc'}`}>
            {items.map((it, j) => <li key={j} className="leading-relaxed">{inline(it)}</li>)}
        </Tag>
    );
};

const ProtocolDetail = ({ protocol, onClose, onEdit, onDelete }) => (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-3xl shadow-xl max-w-3xl w-full max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <header className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 flex items-start justify-between gap-4">
                <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-rural-700">{CATEGORY[protocol.category]?.label || protocol.category}</p>
                    <h2 className="font-serif text-2xl font-bold text-text-primary mt-0.5">{protocol.title}</h2>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={onEdit} className="p-2 rounded-lg text-rural-700 hover:bg-rural-50" title="Editar">
                        <Edit3 size={16} />
                    </button>
                    <button onClick={onDelete} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Borrar">
                        <Trash2 size={16} />
                    </button>
                    <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-50" title="Cerrar">
                        <X size={18} />
                    </button>
                </div>
            </header>
            <div className="px-6 py-5">{renderMarkdown(protocol.content)}</div>
        </div>
    </div>
);

const ProtocolEditor = ({ protocol, onSave, onCancel }) => {
    const [form, setForm] = useState(protocol);
    const set = (k, v) => setForm({ ...form, [k]: v });

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
            <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}
                className="bg-white rounded-3xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}>
                <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="font-serif text-xl font-bold text-text-primary">
                        {form.id ? 'Editar protocolo' : 'Nuevo protocolo'}
                    </h2>
                    <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                </header>
                <div className="px-6 py-5 space-y-4">
                    <Field label="Título" required value={form.title || ''} onChange={(v) => set('title', v)} />
                    <Field label="Resumen (1 o 2 líneas)" value={form.summary || ''} onChange={(v) => set('summary', v)} />
                    <div className="grid sm:grid-cols-2 gap-4">
                        <SelectField label="Categoría" value={form.category} onChange={(v) => set('category', v)}
                            options={Object.entries(CATEGORY).map(([k, c]) => ({ value: k, label: c.label }))} />
                        <Field label="Slug (para enlaces)" required value={form.slug || ''}
                            onChange={(v) => set('slug', v.toLowerCase().replace(/[^a-z0-9.-]/g, '-'))} />
                    </div>
                    <Field label="Sección del panel relacionada (opcional)" value={form.related_tab || ''}
                        onChange={(v) => set('related_tab', v || null)}
                        placeholder="ej: reservas, cleaning, travelers..." />
                    <label className="block">
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">Contenido (Markdown)</span>
                        <textarea value={form.content || ''} onChange={(e) => set('content', e.target.value)}
                            rows={18} required
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-primary font-mono text-xs leading-relaxed" />
                        <p className="text-[10px] text-gray-500 mt-1">Soporta # cabeceras, **negrita**, listas con - o números, &gt; citas, [enlaces](https://...)</p>
                    </label>
                </div>
                <footer className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold text-rural-700">Cancelar</button>
                    <button type="submit" className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-primary rounded-xl shadow">
                        <Save size={14} /> Guardar
                    </button>
                </footer>
            </form>
        </div>
    );
};

const Field = ({ label, value, onChange, required, placeholder }) => (
    <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">{label}</span>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-primary text-sm" />
    </label>
);

const SelectField = ({ label, value, onChange, options }) => (
    <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-primary text-sm cursor-pointer">
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    </label>
);

export { renderMarkdown };
export default ProtocolsManager;

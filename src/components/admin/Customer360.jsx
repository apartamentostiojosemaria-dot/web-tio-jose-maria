import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Search, RefreshCw, Star, Mail, Phone, MapPin, Calendar, Euro, Award, X, MessageCircle,
    AlertTriangle, Tag, Plus, Trash2, Save, MessageSquare, Loader2, Globe, FileText, User, Edit2,
} from 'lucide-react';
import { logError, userErrorMessage } from '../../utils/logger';

const fmtEur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateLong = (s) => s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Etiquetas predefinidas (chips sugeridos). El operador puede teclear cualquiera.
const TAG_PRESETS = [
    'VIP', 'Recurrente', 'Familia con niños', 'Pareja', 'Grupo grande',
    'Alergias', 'Sensible al ruido', 'Llega tarde', 'Necesita parking', 'Cliente difícil',
    'Amigos de la familia', 'Vegetariano', 'No mascotas', 'Idiomas: inglés', 'Idiomas: francés',
];

const Customer360 = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('v_customers_360')
            .select('*')
            .order('last_stay', { ascending: false, nullsLast: true })
            .limit(500);
        setCustomers(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Filtros: buscador texto + chip
    const filtered = useMemo(() => {
        return customers.filter(c => {
            // Filtro por tipo
            if (filter === 'vip' && Number(c.total_stays) < 5) return false;
            if (filter === 'recurrent' && Number(c.total_stays) < 2) return false;
            if (filter === 'first' && Number(c.total_stays) !== 1) return false;
            if (filter === 'with_notes' && Number(c.notes_count || 0) === 0) return false;
            if (filter === 'warnings' && Number(c.warnings_count || 0) === 0) return false;

            // Buscador texto
            if (!query.trim()) return true;
            const q = query.toLowerCase();
            return (c.email || '').includes(q)
                || (c.last_name || '').toLowerCase().includes(q)
                || (c.last_phone || '').replaceAll(' ', '').includes(q.replaceAll(' ', ''))
                || (c.favorite_apartment || '').toLowerCase().includes(q)
                || (c.tags || []).some(t => t.toLowerCase().includes(q));
        });
    }, [customers, query, filter]);

    const totals = useMemo(() => filtered.reduce((acc, c) => ({
        customers: acc.customers + 1,
        stays: acc.stays + Number(c.total_stays || 0),
        revenue: acc.revenue + Number(c.lifetime_value || 0),
        recurrent: acc.recurrent + (Number(c.total_stays || 0) > 1 ? 1 : 0),
        warnings: acc.warnings + (Number(c.warnings_count || 0) > 0 ? 1 : 0),
    }), { customers: 0, stays: 0, revenue: 0, recurrent: 0, warnings: 0 }), [filtered]);

    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Fichas de huéspedes</h1>
                    <p className="text-sm text-gray-600 mt-1">Buscador y ficha completa de cada huésped: estancias, anotaciones internas, preferencias y etiquetas.</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                    <RefreshCw size={14} /> Actualizar
                </button>
            </header>

            {/* Resumen */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <SummaryCard label="Huéspedes" value={totals.customers} />
                <SummaryCard label="Estancias totales" value={totals.stays} />
                <SummaryCard label="Ingresado por todos" value={fmtEur(totals.revenue)} />
                <SummaryCard label="Recurrentes" value={`${totals.recurrent}${totals.customers ? ` · ${Math.round(100 * totals.recurrent / totals.customers)}%` : ''}`} />
                <SummaryCard label="Con avisos internos" value={totals.warnings} highlight={totals.warnings > 0} />
            </div>

            {/* Buscador + chips */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="relative flex-1 min-w-[260px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por nombre, email, teléfono, etiqueta o apartamento favorito…"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="Todos" />
                    <FilterChip active={filter === 'vip'} onClick={() => setFilter('vip')} label="VIP (5+)" color="amber" />
                    <FilterChip active={filter === 'recurrent'} onClick={() => setFilter('recurrent')} label="Recurrentes (2+)" />
                    <FilterChip active={filter === 'first'} onClick={() => setFilter('first')} label="Primera vez" color="blue" />
                    <FilterChip active={filter === 'with_notes'} onClick={() => setFilter('with_notes')} label="Con notas" />
                    <FilterChip active={filter === 'warnings'} onClick={() => setFilter('warnings')} label="Con avisos" color="red" />
                </div>
            </div>

            {loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> :
             filtered.length === 0 ? <p className="text-gray-500 font-serif italic">No hay huéspedes con esos filtros.</p> :
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase tracking-widest font-bold text-gray-500">
                        <tr>
                            <th className="text-left px-4 py-3">Huésped</th>
                            <th className="text-left px-4 py-3">Etiquetas</th>
                            <th className="text-left px-4 py-3">Apartamento favorito</th>
                            <th className="text-center px-4 py-3">Estancias</th>
                            <th className="text-right px-4 py-3">Gastado</th>
                            <th className="text-left px-4 py-3">Última visita</th>
                            <th className="text-center px-4 py-3">Avisos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(c => (
                            <tr key={c.email} onClick={() => setSelected(c)}
                                className="border-b border-gray-50 hover:bg-rural-50/40 cursor-pointer transition-colors">
                                <td className="px-4 py-3">
                                    <p className="text-text-primary font-medium">{c.last_name || <span className="text-gray-400 italic">Sin nombre</span>}</p>
                                    <p className="text-[10px] text-gray-500">{c.email}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                        {(c.tags || []).slice(0, 3).map(t => (
                                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-rural-100 text-rural-800 font-medium">{t}</span>
                                        ))}
                                        {(c.tags || []).length > 3 && <span className="text-[10px] text-gray-400">+{c.tags.length - 3}</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-gray-700">{c.favorite_apartment || '—'}</td>
                                <td className="px-4 py-3 text-center tabular-nums">
                                    <span className="font-bold text-text-primary">{c.total_stays}</span>
                                    {c.total_cancelled > 0 && <span className="block text-[10px] text-red-500">({c.total_cancelled} canc)</span>}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-bold">{fmtEur(c.lifetime_value)}</td>
                                <td className="px-4 py-3 text-xs tabular-nums text-gray-700">{fmtDate(c.last_stay)}</td>
                                <td className="px-4 py-3 text-center">
                                    {Number(c.warnings_count || 0) > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                                            <AlertTriangle size={10} /> {c.warnings_count}
                                        </span>
                                    ) : Number(c.notes_count || 0) > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-gray-400 text-[10px]">
                                            <MessageSquare size={10} /> {c.notes_count}
                                        </span>
                                    ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>}

            {selected && <CustomerSheet customer={selected} onClose={() => { setSelected(null); load(); }} />}
        </div>
    );
};

const SummaryCard = ({ label, value, highlight }) => (
    <div className={`rounded-2xl border p-4 shadow-sm ${highlight ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</p>
        <p className={`font-serif font-bold text-2xl mt-1 ${highlight ? 'text-red-700' : 'text-text-primary'}`}>{value}</p>
    </div>
);

const FilterChip = ({ active, onClick, label, color = 'rural' }) => {
    const palettes = {
        rural: active ? 'bg-rural-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
        amber: active ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-amber-50',
        blue:  active ? 'bg-blue-600 text-white'  : 'bg-white text-gray-600 hover:bg-blue-50',
        red:   active ? 'bg-red-600 text-white'   : 'bg-white text-gray-600 hover:bg-red-50',
    };
    return (
        <button onClick={onClick} className={`px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-100 transition-colors ${palettes[color]}`}>
            {label}
        </button>
    );
};

// ─────────────────────────────── FICHA ───────────────────────────────

const CustomerSheet = ({ customer, onClose }) => {
    const [tab, setTab] = useState('notes');
    const [bookings, setBookings] = useState([]);
    const [notes, setNotes] = useState([]);

    // Edición de ficha
    const [editName, setEditName] = useState(customer.last_name || '');
    const [editPhone, setEditPhone] = useState(customer.last_phone || '');
    const [editNationality, setEditNationality] = useState(customer.nationality || '');
    const [editLanguage, setEditLanguage] = useState(customer.preferred_language || 'es');
    const [editPreferences, setEditPreferences] = useState(customer.preferences || '');
    const [editTags, setEditTags] = useState(customer.tags || []);
    const [newTag, setNewTag] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Nueva nota
    const [noteBody, setNoteBody] = useState('');
    const [noteWarning, setNoteWarning] = useState(false);
    const [isPostingNote, setIsPostingNote] = useState(false);

    useEffect(() => {
        loadBookings();
        loadNotes();
    }, [customer.email]);

    const loadBookings = async () => {
        const { data } = await supabase
            .from('guest_bookings')
            .select('booking_code, check_in, check_out, status, total_price, pax_count, notes, apartments(name)')
            .ilike('guest_email', customer.email)
            .order('check_in', { ascending: false });
        setBookings(data || []);
    };

    const loadNotes = async () => {
        const { data } = await supabase
            .from('customer_notes')
            .select('*')
            .eq('customer_email', customer.email)
            .order('created_at', { ascending: false });
        setNotes(data || []);
    };

    const tier = Number(customer.total_stays) >= 5 ? { label: 'VIP', cls: 'bg-amber-100 text-amber-900' }
        : Number(customer.total_stays) >= 2 ? { label: 'Recurrente', cls: 'bg-rural-100 text-rural-700' }
        : Number(customer.total_stays) === 1 ? { label: 'Primera vez', cls: 'bg-blue-100 text-blue-900' }
        : { label: 'Sin estancias', cls: 'bg-gray-100 text-gray-600' };

    const phoneClean = (editPhone || '').replace(/[^\d+]/g, '');
    const whatsAppNum = phoneClean.startsWith('+') ? phoneClean.slice(1) : phoneClean;

    const addTag = (tag) => {
        const t = (tag || '').trim();
        if (!t || editTags.includes(t)) return;
        setEditTags([...editTags, t]);
        setNewTag('');
    };
    const removeTag = (tag) => setEditTags(editTags.filter(x => x !== tag));

    const handleSavePersonal = async () => {
        setIsSaving(true);
        const { error } = await supabase.from('customers').upsert({
            email: customer.email,
            canonical_name: editName.trim() || null,
            phone: editPhone.trim() || null,
            nationality: editNationality.trim() || null,
            preferred_language: editLanguage || 'es',
            preferences: editPreferences.trim() || null,
            tags: editTags,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });
        if (error) {
            logError('CustomerSheet.savePersonal', error);
            alert(userErrorMessage('Error al guardar.'));
        } else {
            alert('Ficha actualizada.');
        }
        setIsSaving(false);
    };

    const handlePostNote = async () => {
        if (!noteBody.trim()) return;
        setIsPostingNote(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('customer_notes').insert({
            customer_email: customer.email,
            author: user?.email || 'admin',
            body: noteBody.trim(),
            is_warning: noteWarning,
        });
        if (error) {
            logError('CustomerSheet.postNote', error);
            alert(userErrorMessage('Error al guardar la nota.'));
        } else {
            setNoteBody('');
            setNoteWarning(false);
            loadNotes();
        }
        setIsPostingNote(false);
    };

    const handleDeleteNote = async (id) => {
        if (!window.confirm('¿Borrar esta nota?')) return;
        await supabase.from('customer_notes').delete().eq('id', id);
        loadNotes();
    };

    const warningsActivos = notes.filter(n => n.is_warning);

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-stretch justify-end" onClick={onClose}>
            <div className="bg-white shadow-xl w-full max-w-2xl h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <header className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${tier.cls}`}>{tier.label}</span>
                                {warningsActivos.length > 0 && (
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 inline-flex items-center gap-1">
                                        <AlertTriangle size={10} /> {warningsActivos.length} aviso{warningsActivos.length > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                            <h2 className="font-serif text-2xl font-bold text-text-primary truncate">{customer.last_name || customer.email}</h2>
                            <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0" aria-label="Cerrar"><X size={22} /></button>
                    </div>

                    {/* Acciones rápidas */}
                    <div className="flex flex-wrap gap-2">
                        <ActionBtn href={`mailto:${customer.email}`} icon={Mail} label="Email" />
                        {phoneClean && <ActionBtn href={`tel:${phoneClean}`} icon={Phone} label="Llamar" />}
                        {whatsAppNum && <ActionBtn href={`https://wa.me/${whatsAppNum}`} icon={MessageCircle} label="WhatsApp" external />}
                    </div>
                </header>

                {/* Avisos destacados arriba si los hay */}
                {warningsActivos.length > 0 && (
                    <div className="mx-6 mt-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-red-700 mb-2 flex items-center gap-1">
                            <AlertTriangle size={12} /> Avisos importantes
                        </p>
                        <ul className="space-y-1.5">
                            {warningsActivos.map(n => (
                                <li key={n.id} className="text-sm text-red-900">• {n.body}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* KPIs */}
                <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-gray-50">
                    <Metric icon={Calendar} label="Estancias" value={customer.total_stays || 0} />
                    <Metric icon={MessageCircle} label="Noches" value={customer.total_nights || 0} />
                    <Metric icon={Euro} label="Gastado" value={fmtEur(customer.lifetime_value)} />
                    <Metric icon={Award} label="Valoración" value={customer.avg_rating ? `${customer.avg_rating} ★` : '—'} />
                </div>

                {customer.favorite_apartment && (
                    <div className="px-6 pt-4 text-sm text-gray-700 flex items-center gap-2">
                        <MapPin size={14} className="text-primary" />
                        Apartamento favorito: <strong>{customer.favorite_apartment}</strong>
                    </div>
                )}

                {/* Tags chips (en cabecera de tab) */}
                <div className="px-6 pt-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                        <Tag size={11} /> Etiquetas
                    </p>
                    <div className="flex flex-wrap gap-1.5 items-center">
                        {editTags.length === 0 && <span className="text-xs text-gray-400 italic">Sin etiquetas</span>}
                        {editTags.map(t => (
                            <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-rural-100 text-rural-800 font-medium inline-flex items-center gap-1.5">
                                {t}
                                <button onClick={() => removeTag(t)} className="text-rural-600 hover:text-red-500" aria-label={`Quitar ${t}`}>
                                    <X size={10} />
                                </button>
                            </span>
                        ))}
                        <div className="inline-flex items-center gap-1">
                            <input
                                type="text" value={newTag} onChange={e => setNewTag(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(newTag); } }}
                                placeholder="añadir etiqueta…"
                                className="text-xs px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full w-32 outline-none focus:border-rural-400"
                            />
                            {newTag && (
                                <button onClick={() => addTag(newTag)} className="p-1 text-rural-700 hover:bg-rural-50 rounded">
                                    <Plus size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {TAG_PRESETS.filter(t => !editTags.includes(t)).slice(0, 8).map(t => (
                            <button key={t} onClick={() => addTag(t)}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-rural-100 hover:text-rural-800">
                                + {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <nav className="flex border-b border-gray-100 mt-4 px-6 sticky top-[88px] bg-white">
                    <TabBtn active={tab === 'notes'} onClick={() => setTab('notes')} label={`Notas (${notes.length})`} icon={MessageSquare} />
                    <TabBtn active={tab === 'bookings'} onClick={() => setTab('bookings')} label={`Reservas (${bookings.length})`} icon={Calendar} />
                    <TabBtn active={tab === 'data'} onClick={() => setTab('data')} label="Datos personales" icon={User} />
                </nav>

                {tab === 'notes' && (
                    <section className="p-6">
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-5">
                            <textarea
                                value={noteBody} onChange={e => setNoteBody(e.target.value)}
                                rows={3}
                                placeholder="Apunta lo que sea importante recordar de este huésped: preferencias, lo que dijo en una llamada, alergias, cosas para la próxima reserva…"
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-rural-400 text-sm resize-y"
                            />
                            <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
                                <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                                    <input type="checkbox" checked={noteWarning} onChange={e => setNoteWarning(e.target.checked)}
                                        className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                                    <span className={noteWarning ? 'text-red-700 font-bold' : 'text-gray-600'}>
                                        ⚠ Aviso importante (destaca en rojo arriba)
                                    </span>
                                </label>
                                <button onClick={handlePostNote} disabled={!noteBody.trim() || isPostingNote}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-rural-700 text-white rounded-xl font-bold text-sm hover:bg-rural-800 disabled:opacity-50">
                                    {isPostingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Añadir nota
                                </button>
                            </div>
                        </div>

                        {notes.length === 0 ? (
                            <p className="text-center py-8 text-sm text-gray-400 italic">Todavía no hay notas. Escribe la primera arriba.</p>
                        ) : (
                            <ul className="space-y-3">
                                {notes.map(n => (
                                    <li key={n.id} className={`p-4 rounded-2xl border ${n.is_warning ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                {n.is_warning && (
                                                    <p className="text-[10px] uppercase tracking-widest font-bold text-red-700 mb-1 flex items-center gap-1">
                                                        <AlertTriangle size={10} /> Aviso
                                                    </p>
                                                )}
                                                <p className="text-sm text-text-primary whitespace-pre-wrap">{n.body}</p>
                                                <p className="text-[10px] text-gray-400 mt-2">
                                                    {n.author || 'admin'} · {fmtDateLong(n.created_at)}
                                                </p>
                                            </div>
                                            <button onClick={() => handleDeleteNote(n.id)}
                                                className="text-gray-300 hover:text-red-500 p-1" aria-label="Borrar nota">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}

                {tab === 'bookings' && (
                    <section className="p-6">
                        {bookings.length === 0 ? (
                            <p className="text-center py-8 text-sm text-gray-400 italic">No tiene reservas registradas todavía.</p>
                        ) : (
                            <ul className="space-y-2">
                                {bookings.map(b => (
                                    <li key={b.booking_code} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                        <div className="min-w-0">
                                            <p className="font-mono font-bold text-primary text-xs">{b.booking_code}</p>
                                            <p className="text-sm text-text-primary truncate">{b.apartments?.name || '—'} · {b.pax_count} pax</p>
                                            <p className="text-xs text-gray-500 tabular-nums">{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</p>
                                            {b.notes && <p className="text-[11px] text-gray-500 italic mt-1 line-clamp-2">"{b.notes}"</p>}
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="font-bold text-text-primary">{fmtEur(b.total_price)}</p>
                                            <BookingStatusBadge status={b.status} />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}

                {tab === 'data' && (
                    <section className="p-6 space-y-4">
                        <Field label="Nombre completo">
                            <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400" />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Teléfono">
                                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                                    placeholder="+34 666 12 34 56"
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400" />
                            </Field>
                            <Field label="Nacionalidad">
                                <input type="text" value={editNationality} onChange={e => setEditNationality(e.target.value)}
                                    placeholder="Española"
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400" />
                            </Field>
                        </div>
                        <Field label="Idioma preferido">
                            <select value={editLanguage} onChange={e => setEditLanguage(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 cursor-pointer">
                                <option value="es">Español</option>
                                <option value="en">Inglés</option>
                                <option value="fr">Francés</option>
                                <option value="de">Alemán</option>
                                <option value="it">Italiano</option>
                                <option value="pt">Portugués</option>
                            </select>
                        </Field>
                        <Field label="Preferencias y notas permanentes" hint="Ej: alergia a frutos secos, prefiere planta baja, viene siempre con su perro...">
                            <textarea value={editPreferences} onChange={e => setEditPreferences(e.target.value)}
                                rows={4}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 text-sm" />
                        </Field>
                        <button onClick={handleSavePersonal} disabled={isSaving}
                            className="w-full py-3 bg-rural-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-rural-800 disabled:opacity-50">
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar datos personales y etiquetas
                        </button>
                    </section>
                )}
            </div>
        </div>
    );
};

const ActionBtn = ({ href, icon: Icon, label, external }) => (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rural-50 text-rural-800 rounded-xl text-xs font-bold hover:bg-rural-100 transition-colors">
        <Icon size={12} /> {label}
    </a>
);

const TabBtn = ({ active, onClick, label, icon: Icon }) => (
    <button onClick={onClick}
        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors inline-flex items-center gap-2 ${active ? 'border-rural-700 text-rural-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
        {Icon && <Icon size={14} />} {label}
    </button>
);

const Field = ({ label, hint, children }) => (
    <label className="block">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">{label}</span>
        {children}
        {hint && <span className="block text-[11px] text-gray-400 mt-1 italic">{hint}</span>}
    </label>
);

const Metric = ({ icon: Icon, label, value }) => (
    <div className="text-center">
        <Icon size={16} className="text-rural-700 mx-auto mb-1" aria-hidden="true" />
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</p>
        <p className="font-serif font-bold text-text-primary text-lg mt-1">{value}</p>
    </div>
);

const BookingStatusBadge = ({ status }) => {
    const map = {
        confirmed: { label: 'Confirmada', cls: 'bg-green-100 text-green-800' },
        completed: { label: 'Completada', cls: 'bg-blue-100 text-blue-800' },
        cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
        pending:   { label: 'Sin confirmar', cls: 'bg-amber-100 text-amber-800' },
        hold:      { label: 'Pagando...', cls: 'bg-gray-100 text-gray-600' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
};

export default Customer360;

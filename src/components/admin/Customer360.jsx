import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Search, RefreshCw, Star, Mail, Phone, MapPin, Calendar, Euro, Award, X, MessageCircle,
    AlertTriangle, Tag, Plus, Trash2, Save, MessageSquare, Loader2, User, Send, Download, BookOpen, Inbox,
    Shield, Check, ShieldCheck, ShieldX,
} from 'lucide-react';
import { logError, userErrorMessage } from '../../utils/logger';

const fmtEur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateLong = (s) => s ? new Date(s).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const TAG_PRESETS = [
    'VIP', 'Recurrente', 'Familia con niños', 'Pareja', 'Grupo grande',
    'Alergias', 'Sensible al ruido', 'Llega tarde', 'Necesita parking', 'Cliente difícil',
    'Amigos de la familia', 'Vegetariano', 'No mascotas', 'Idiomas: inglés', 'Idiomas: francés',
];

// Etiquetas humanas para cada flag de email enviado
const EMAIL_FLAGS = [
    { key: 'confirmation_email_sent_at', label: 'Confirmación de reserva' },
    { key: 'reminder_7d_email_sent_at',  label: 'Recordatorio 7 días antes' },
    { key: 'reminder_24h_email_sent_at', label: 'Recordatorio 24h antes' },
    { key: 'arrival_email_sent_at',      label: 'Bienvenida (día de entrada)' },
    { key: 'departure_email_sent_at',    label: 'Despedida (día de salida)' },
    { key: 'review_request_email_sent_at', label: 'Petición de reseña' },
    { key: 'reactivation_email_sent_at', label: 'Reactivación (+30 días)' },
];

const Customer360 = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [activeTag, setActiveTag] = useState(null);
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

    // Conjunto de tags únicos en la base actual (para el selector)
    const allTags = useMemo(() => {
        const s = new Set();
        for (const c of customers) for (const t of (c.tags || [])) s.add(t);
        return Array.from(s).sort();
    }, [customers]);

    const filtered = useMemo(() => {
        return customers.filter(c => {
            if (filter === 'vip' && Number(c.total_stays) < 5) return false;
            if (filter === 'recurrent' && Number(c.total_stays) < 2) return false;
            if (filter === 'first' && Number(c.total_stays) !== 1) return false;
            if (filter === 'with_notes' && Number(c.notes_count || 0) === 0) return false;
            if (filter === 'warnings' && Number(c.warnings_count || 0) === 0) return false;
            if (activeTag && !(c.tags || []).includes(activeTag)) return false;
            if (!query.trim()) return true;
            const q = query.toLowerCase();
            return (c.email || '').includes(q)
                || (c.last_name || '').toLowerCase().includes(q)
                || (c.last_phone || '').replaceAll(' ', '').includes(q.replaceAll(' ', ''))
                || (c.favorite_apartment || '').toLowerCase().includes(q)
                || (c.tags || []).some(t => t.toLowerCase().includes(q));
        });
    }, [customers, query, filter, activeTag]);

    const totals = useMemo(() => filtered.reduce((acc, c) => ({
        customers: acc.customers + 1,
        stays: acc.stays + Number(c.total_stays || 0),
        revenue: acc.revenue + Number(c.lifetime_value || 0),
        recurrent: acc.recurrent + (Number(c.total_stays || 0) > 1 ? 1 : 0),
        warnings: acc.warnings + (Number(c.warnings_count || 0) > 0 ? 1 : 0),
    }), { customers: 0, stays: 0, revenue: 0, recurrent: 0, warnings: 0 }), [filtered]);

    const downloadCSV = () => {
        const headers = ['Nombre', 'Email', 'Teléfono', 'Etiquetas', 'Apartamento favorito', 'Estancias', 'Noches', 'Gastado', 'Primera visita', 'Última visita', 'Avisos'];
        const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = filtered.map(c => [
            c.last_name || '', c.email || '', c.last_phone || '',
            (c.tags || []).join(' · '),
            c.favorite_apartment || '',
            c.total_stays || 0, c.total_nights || 0,
            (Number(c.lifetime_value || 0)).toFixed(2),
            c.first_stay || '', c.last_stay || '',
            c.warnings_count || 0,
        ].map(csvEscape).join(','));
        const csv = '﻿' + [headers.map(csvEscape).join(','), ...rows].join('\n');  // BOM para Excel ES
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `huespedes_tjm_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Fichas de huéspedes</h1>
                    <p className="text-sm text-gray-600 mt-1">Buscador y ficha completa de cada huésped: estancias, anotaciones internas, etiquetas y comunicaciones.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={downloadCSV}
                        className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary bg-white px-3 py-2 rounded-xl border border-gray-200"
                        title="Descargar la lista filtrada como CSV (Excel)">
                        <Download size={14} /> CSV ({filtered.length})
                    </button>
                    <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                        <RefreshCw size={14} /> Actualizar
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <SummaryCard label="Huéspedes" value={totals.customers} />
                <SummaryCard label="Estancias" value={totals.stays} />
                <SummaryCard label="Ingresado" value={fmtEur(totals.revenue)} />
                <SummaryCard label="Recurrentes" value={`${totals.recurrent}${totals.customers ? ` · ${Math.round(100 * totals.recurrent / totals.customers)}%` : ''}`} />
                <SummaryCard label="Con avisos" value={totals.warnings} highlight={totals.warnings > 0} />
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="relative flex-1 min-w-[260px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por nombre, email, teléfono, etiqueta o apartamento…"
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

            {/* Filtro por tag concreto */}
            {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5 items-center">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mr-1">Etiqueta:</span>
                    {allTags.map(t => (
                        <button key={t} onClick={() => setActiveTag(activeTag === t ? null : t)}
                            className={`text-[11px] px-2.5 py-1 rounded-full font-medium border transition-colors ${activeTag === t ? 'bg-rural-700 text-white border-rural-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-rural-50'}`}>
                            {t}
                        </button>
                    ))}
                    {activeTag && (
                        <button onClick={() => setActiveTag(null)} className="text-[11px] px-2 py-1 text-red-500 hover:underline">
                            Quitar filtro de etiqueta
                        </button>
                    )}
                </div>
            )}

            {loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> :
             filtered.length === 0 ? <p className="text-gray-500 font-serif italic">No hay huéspedes con esos filtros.</p> :
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase tracking-widest font-bold text-gray-500">
                        <tr>
                            <th className="text-left px-4 py-3">Huésped</th>
                            <th className="text-left px-4 py-3">Etiquetas</th>
                            <th className="text-left px-4 py-3">Apto. favorito</th>
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
    const [showNewBooking, setShowNewBooking] = useState(false);

    const [editName, setEditName] = useState(customer.last_name || '');
    const [editPhone, setEditPhone] = useState(customer.last_phone || '');
    const [editNationality, setEditNationality] = useState(customer.nationality || '');
    const [editLanguage, setEditLanguage] = useState(customer.preferred_language || 'es');
    const [editPreferences, setEditPreferences] = useState(customer.preferences || '');
    const [editTags, setEditTags] = useState(customer.tags || []);
    const [newTag, setNewTag] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [noteBody, setNoteBody] = useState('');
    const [noteWarning, setNoteWarning] = useState(false);
    const [isPostingNote, setIsPostingNote] = useState(false);

    useEffect(() => { loadBookings(); loadNotes(); }, [customer.email]);

    const loadBookings = async () => {
        const { data } = await supabase
            .from('guest_bookings')
            .select('booking_code, check_in, check_out, status, total_price, pax_count, notes, source, apartments(name), confirmation_email_sent_at, reminder_7d_email_sent_at, reminder_24h_email_sent_at, arrival_email_sent_at, departure_email_sent_at, review_request_email_sent_at, reactivation_email_sent_at')
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
        if (error) { logError('savePersonal', error); alert(userErrorMessage('Error al guardar.')); }
        else alert('Ficha actualizada.');
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
        if (error) { logError('postNote', error); alert(userErrorMessage('Error.')); }
        else { setNoteBody(''); setNoteWarning(false); loadNotes(); }
        setIsPostingNote(false);
    };

    const handleDeleteNote = async (id) => {
        if (!window.confirm('¿Borrar esta nota?')) return;
        await supabase.from('customer_notes').delete().eq('id', id);
        loadNotes();
    };

    const warningsActivos = notes.filter(n => n.is_warning);

    // Construir timeline de emails enviados a este cliente (cronología agregada)
    const emailEvents = useMemo(() => {
        const events = [];
        for (const b of bookings) {
            for (const f of EMAIL_FLAGS) {
                if (b[f.key]) {
                    events.push({ when: b[f.key], label: f.label, booking_code: b.booking_code });
                }
            }
        }
        return events.sort((a, b) => new Date(b.when) - new Date(a.when));
    }, [bookings]);

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-stretch justify-end" onClick={onClose}>
            <div className="bg-white shadow-xl w-full max-w-2xl h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <header className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
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

                    <div className="flex flex-wrap gap-2">
                        <ActionBtn href={`mailto:${customer.email}`} icon={Mail} label="Email" />
                        {phoneClean && <ActionBtn href={`tel:${phoneClean}`} icon={Phone} label="Llamar" />}
                        {whatsAppNum && <ActionBtn href={`https://wa.me/${whatsAppNum}`} icon={MessageCircle} label="WhatsApp" external />}
                        <button onClick={() => setShowNewBooking(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rural-700 text-white rounded-xl text-xs font-bold hover:bg-rural-800 transition-colors ml-auto">
                            <Plus size={12} /> Nueva reserva
                        </button>
                    </div>
                </header>

                {warningsActivos.length > 0 && (
                    <div className="mx-6 mt-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-red-700 mb-2 flex items-center gap-1">
                            <AlertTriangle size={12} /> Avisos importantes
                        </p>
                        <ul className="space-y-1.5">
                            {warningsActivos.map(n => <li key={n.id} className="text-sm text-red-900">• {n.body}</li>)}
                        </ul>
                    </div>
                )}

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

                <div className="px-6 pt-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2 flex items-center gap-1.5"><Tag size={11} /> Etiquetas</p>
                    <div className="flex flex-wrap gap-1.5 items-center">
                        {editTags.length === 0 && <span className="text-xs text-gray-400 italic">Sin etiquetas</span>}
                        {editTags.map(t => (
                            <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-rural-100 text-rural-800 font-medium inline-flex items-center gap-1.5">
                                {t}
                                <button onClick={() => removeTag(t)} className="text-rural-600 hover:text-red-500"><X size={10} /></button>
                            </span>
                        ))}
                        <div className="inline-flex items-center gap-1">
                            <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(newTag); } }}
                                placeholder="añadir etiqueta…"
                                className="text-xs px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full w-32 outline-none focus:border-rural-400" />
                            {newTag && <button onClick={() => addTag(newTag)} className="p-1 text-rural-700 hover:bg-rural-50 rounded"><Plus size={12} /></button>}
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

                <nav className="flex border-b border-gray-100 mt-4 px-6 sticky top-[124px] bg-white overflow-x-auto">
                    <TabBtn active={tab === 'notes'} onClick={() => setTab('notes')} label={`Notas (${notes.length})`} icon={MessageSquare} />
                    <TabBtn active={tab === 'bookings'} onClick={() => setTab('bookings')} label={`Reservas (${bookings.length})`} icon={BookOpen} />
                    <TabBtn active={tab === 'emails'} onClick={() => setTab('emails')} label={`Emails (${emailEvents.length})`} icon={Send} />
                    <TabBtn active={tab === 'data'} onClick={() => setTab('data')} label="Datos" icon={User} />
                    <TabBtn active={tab === 'privacy'} onClick={() => setTab('privacy')} label="Privacidad" icon={Shield} />
                </nav>

                {tab === 'notes' && (
                    <section className="p-6">
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-5">
                            <textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} rows={3}
                                placeholder="Apunta lo que sea importante recordar de este huésped: preferencias, lo que dijo en una llamada, alergias, cosas para la próxima reserva…"
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-rural-400 text-sm resize-y" />
                            <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
                                <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                                    <input type="checkbox" checked={noteWarning} onChange={e => setNoteWarning(e.target.checked)} className="w-4 h-4 rounded text-red-600" />
                                    <span className={noteWarning ? 'text-red-700 font-bold' : 'text-gray-600'}>⚠ Aviso importante</span>
                                </label>
                                <button onClick={handlePostNote} disabled={!noteBody.trim() || isPostingNote}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-rural-700 text-white rounded-xl font-bold text-sm hover:bg-rural-800 disabled:opacity-50">
                                    {isPostingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Añadir nota
                                </button>
                            </div>
                        </div>

                        {notes.length === 0 ? <p className="text-center py-8 text-sm text-gray-400 italic">Sin notas todavía.</p> : (
                            <ul className="space-y-3">
                                {notes.map(n => (
                                    <li key={n.id} className={`p-4 rounded-2xl border ${n.is_warning ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                {n.is_warning && <p className="text-[10px] uppercase tracking-widest font-bold text-red-700 mb-1 flex items-center gap-1"><AlertTriangle size={10} /> Aviso</p>}
                                                <p className="text-sm text-text-primary whitespace-pre-wrap">{n.body}</p>
                                                <p className="text-[10px] text-gray-400 mt-2">{n.author || 'admin'} · {fmtDateLong(n.created_at)}</p>
                                            </div>
                                            <button onClick={() => handleDeleteNote(n.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}

                {tab === 'bookings' && (
                    <section className="p-6">
                        {bookings.length === 0 ? <p className="text-center py-8 text-sm text-gray-400 italic">No tiene reservas registradas.</p> : (
                            <ul className="space-y-2">
                                {bookings.map(b => (
                                    <li key={b.booking_code} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                        <div className="min-w-0">
                                            <p className="font-mono font-bold text-primary text-xs">{b.booking_code}</p>
                                            <p className="text-sm text-text-primary truncate">{b.apartments?.name || '—'} · {b.pax_count} pax {b.source && <span className="text-[10px] text-gray-400 uppercase ml-1">({b.source})</span>}</p>
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

                {tab === 'emails' && (
                    <section className="p-6">
                        {emailEvents.length === 0 ? (
                            <div className="text-center py-12">
                                <Inbox size={28} className="text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-400 italic">No le hemos mandado ningún email todavía.</p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {emailEvents.map((e, i) => (
                                    <li key={`${e.booking_code}-${e.label}-${i}`} className="p-3 bg-gray-50 rounded-xl flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-rural-100 text-rural-700 flex items-center justify-center shrink-0">
                                            <Send size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-text-primary">{e.label}</p>
                                            <p className="text-[11px] text-gray-500">{fmtDateLong(e.when)} · reserva <span className="font-mono">{e.booking_code}</span></p>
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
                                <option value="es">Español</option><option value="en">Inglés</option>
                                <option value="fr">Francés</option><option value="de">Alemán</option>
                                <option value="it">Italiano</option><option value="pt">Portugués</option>
                            </select>
                        </Field>
                        <Field label="Preferencias permanentes" hint="Ej: alergia a frutos secos, prefiere planta baja, viene siempre con su perro...">
                            <textarea value={editPreferences} onChange={e => setEditPreferences(e.target.value)} rows={4}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 text-sm" />
                        </Field>
                        <button onClick={handleSavePersonal} disabled={isSaving}
                            className="w-full py-3 bg-rural-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-rural-800 disabled:opacity-50">
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar datos y etiquetas
                        </button>
                    </section>
                )}

                {tab === 'privacy' && <PrivacyTab customer={customer} />}

                {showNewBooking && <NewBookingModal customer={customer} editName={editName} editPhone={editPhone}
                    onClose={() => setShowNewBooking(false)} onSuccess={() => { setShowNewBooking(false); loadBookings(); }} />}
            </div>
        </div>
    );
};

// ─────────────── Tab Privacidad y consentimientos ───────────────

const PrivacyTab = ({ customer }) => {
    const [profile, setProfile] = useState(null);
    const [log, setLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const load = async () => {
        setLoading(true);
        const [profileRes, logRes] = await Promise.all([
            supabase.from('customers').select('marketing_consent, marketing_consent_at, marketing_consent_source, marketing_consent_revoked_at, review_optout, unsubscribe_token').eq('email', customer.email).maybeSingle(),
            supabase.from('consent_log').select('*').eq('customer_email', customer.email).order('created_at', { ascending: false }).limit(50),
        ]);
        setProfile(profileRes.data);
        setLog(logRes.data || []);
        setLoading(false);
    };

    useEffect(() => { load(); }, [customer.email]);

    const setMarketing = async (granted) => {
        setUpdating(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.rpc('record_marketing_consent', {
            p_email: customer.email,
            p_granted: granted,
            p_source: `admin_panel:${user?.email || 'admin'}`,
            p_legal_version: '1.0',
        });
        if (error) { logError('setMarketing', error); alert(userErrorMessage('Error al guardar.')); }
        else load();
        setUpdating(false);
    };

    const setReviewOptout = async (optout) => {
        setUpdating(true);
        await supabase.from('customers').update({ review_optout: optout, updated_at: new Date().toISOString() }).eq('email', customer.email);
        await supabase.from('consent_log').insert({
            customer_email: customer.email,
            purpose: 'review_request',
            granted: !optout,
            source: 'admin_panel',
            legal_version: '1.0',
        });
        load();
        setUpdating(false);
    };

    if (loading) return <div className="p-6 text-center text-gray-400 italic">Cargando…</div>;

    return (
        <section className="p-6 space-y-5">
            {/* Aviso explicativo */}
            <div className="p-4 bg-rural-50 border border-rural-100 rounded-2xl text-sm text-rural-900">
                <p className="font-bold mb-2 flex items-center gap-2"><Shield size={14} /> Sobre los emails que le mandamos</p>
                <ul className="space-y-1 text-xs leading-relaxed">
                    <li>· <strong>Confirmación + recordatorios + bienvenida + despedida</strong>: se mandan siempre. Son parte de gestionar la reserva (base legal: ejecución del contrato).</li>
                    <li>· <strong>Pedir reseña</strong>: se manda salvo que se haya opuesto (base legal: interés legítimo).</li>
                    <li>· <strong>Reactivación / promociones</strong>: solo si dio consentimiento expreso al reservar o aquí mismo.</li>
                </ul>
            </div>

            {/* Estado consent marketing */}
            <div className={`p-5 rounded-2xl border ${profile?.marketing_consent ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Promociones por email</p>
                        <p className="font-bold text-text-primary flex items-center gap-2">
                            {profile?.marketing_consent ? <><ShieldCheck size={16} className="text-green-600" /> Consentimiento dado</> : <><ShieldX size={16} className="text-gray-400" /> Sin consentimiento</>}
                        </p>
                        {profile?.marketing_consent && profile?.marketing_consent_at && (
                            <p className="text-xs text-gray-600 mt-1">
                                Desde {new Date(profile.marketing_consent_at).toLocaleDateString('es-ES')}
                                {profile.marketing_consent_source && <span> · vía {profile.marketing_consent_source.replace('admin_panel:', 'panel: ')}</span>}
                            </p>
                        )}
                        {!profile?.marketing_consent && profile?.marketing_consent_revoked_at && (
                            <p className="text-xs text-red-700 mt-1">Revocado el {new Date(profile.marketing_consent_revoked_at).toLocaleDateString('es-ES')}</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {profile?.marketing_consent ? (
                            <button onClick={() => setMarketing(false)} disabled={updating}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-red-50 hover:text-red-700">
                                <ShieldX size={12} /> Revocar
                            </button>
                        ) : (
                            <button onClick={() => setMarketing(true)} disabled={updating}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700">
                                <ShieldCheck size={12} /> Registrar consentimiento
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Estado opt-out reseñas */}
            <div className="p-5 rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Petición de reseña tras estancia</p>
                        <p className="font-bold text-text-primary">
                            {profile?.review_optout ? 'No quiere que le pidamos reseñas' : 'Se le pide reseña (lo normal)'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">Si el huésped pide que no se le moleste con reseñas, márcalo aquí.</p>
                    </div>
                    <button onClick={() => setReviewOptout(!profile?.review_optout)} disabled={updating}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50">
                        {profile?.review_optout ? <><Check size={12} /> Reactivar peticiones</> : <><X size={12} /> Excluir de reseñas</>}
                    </button>
                </div>
            </div>

            {/* Historial de cambios */}
            <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3">Historial de consentimientos (auditoría RGPD)</p>
                {log.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Sin cambios registrados todavía.</p>
                ) : (
                    <ul className="space-y-1.5">
                        {log.map(l => (
                            <li key={l.id} className="bg-gray-50 rounded-xl p-3 text-xs flex items-start gap-2">
                                {l.granted ? <ShieldCheck size={12} className="text-green-600 mt-0.5 shrink-0" /> : <ShieldX size={12} className="text-red-500 mt-0.5 shrink-0" />}
                                <div className="flex-1">
                                    <p className="font-medium">
                                        <span className={l.granted ? 'text-green-800' : 'text-red-700'}>{l.granted ? 'Consentimiento dado' : 'Consentimiento retirado'}</span>
                                        <span className="text-gray-500"> · {l.purpose === 'marketing' ? 'promociones' : l.purpose === 'review_request' ? 'reseñas' : l.purpose}</span>
                                    </p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                        {new Date(l.created_at).toLocaleString('es-ES')}
                                        {l.source && <span> · {l.source}</span>}
                                        {l.legal_version && <span> · política v{l.legal_version}</span>}
                                    </p>
                                    {l.note && <p className="text-[11px] text-gray-600 mt-1 italic">{l.note}</p>}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
};

// ───────────────── Modal nueva reserva manual ─────────────────

const NewBookingModal = ({ customer, editName, editPhone, onClose, onSuccess }) => {
    const [apts, setApts] = useState([]);
    const [aptId, setAptId] = useState(null);
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [pax, setPax] = useState(2);
    const [totalPrice, setTotalPrice] = useState('');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('apartments').select('id, name').eq('is_active', true).order('name');
            setApts(data || []);
            if (data?.length) setAptId(data[0].id);
        })();
    }, []);

    const nights = checkIn && checkOut ? Math.max(0, (new Date(checkOut) - new Date(checkIn)) / 86400000) : 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!aptId || !checkIn || !checkOut || nights <= 0) {
            alert('Faltan datos: apartamento, fecha entrada y fecha salida (salida debe ser posterior a entrada).');
            return;
        }
        setIsSaving(true);
        const code = `TJM-${Array.from({length: 6}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 32))).join('')}`;
        const { error } = await supabase.from('guest_bookings').insert({
            apartment_id: aptId,
            guest_name: (editName || customer.last_name || customer.email).trim(),
            guest_email: customer.email,
            guest_phone: editPhone || customer.last_phone || null,
            pax_count: Number(pax) || 2,
            check_in: checkIn,
            check_out: checkOut,
            nights,
            total_price: Number(totalPrice) || 0,
            status: 'confirmed',
            source: 'manual',
            booking_code: code,
            notes: notes.trim() || null,
            payment_status: 'paid_offline',
        });
        if (error) {
            logError('NewBookingModal.submit', error);
            alert(userErrorMessage(`Error al crear la reserva: ${error.message}`));
            setIsSaving(false);
            return;
        }
        alert(`Reserva ${code} creada.`);
        onSuccess();
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <header className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-serif text-xl font-bold">Nueva reserva manual</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                </header>
                <div className="p-5 space-y-4">
                    <div className="bg-rural-50 border border-rural-100 rounded-xl p-3 text-sm">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-rural-700 mb-1">Para</p>
                        <p className="font-bold text-text-primary">{editName || customer.last_name || '—'}</p>
                        <p className="text-xs text-gray-600">{customer.email}{editPhone || customer.last_phone ? ` · ${editPhone || customer.last_phone}` : ''}</p>
                    </div>

                    <Field label="Apartamento">
                        <select value={aptId || ''} onChange={e => setAptId(Number(e.target.value))}
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 cursor-pointer">
                            {apts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Entrada">
                            <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400" />
                        </Field>
                        <Field label="Salida">
                            <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400" />
                        </Field>
                    </div>
                    {nights > 0 && <p className="text-xs text-gray-500">{nights} {nights === 1 ? 'noche' : 'noches'}</p>}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Personas">
                            <input type="number" min="1" value={pax} onChange={e => setPax(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400" />
                        </Field>
                        <Field label="Total cobrado (€)">
                            <input type="number" min="0" step="0.01" value={totalPrice} onChange={e => setTotalPrice(e.target.value)}
                                placeholder="0"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400" />
                        </Field>
                    </div>
                    <Field label="Notas (opcional)" hint="Lo que sea importante recordar para esta estancia concreta">
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                            placeholder="Ej: llega tarde, paga en efectivo al llegar..."
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 text-sm" />
                    </Field>
                </div>
                <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-50 rounded-xl">Cancelar</button>
                    <button type="submit" disabled={isSaving}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-rural-700 text-white font-bold rounded-xl hover:bg-rural-800 disabled:opacity-50">
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Crear reserva
                    </button>
                </div>
            </form>
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
        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap ${active ? 'border-rural-700 text-rural-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
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

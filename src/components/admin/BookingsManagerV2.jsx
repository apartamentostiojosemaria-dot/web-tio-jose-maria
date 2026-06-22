import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Search, Filter, Mail, FileCheck, KeyRound, ChevronDown, ChevronUp,
    Clock, CheckCircle, XCircle, CalendarCheck, AlertTriangle, RefreshCw
} from 'lucide-react';

// BookingsManagerV2 — adaptado al motor propio Sprint 5+
// Campos: booking_code, payment_status, expires_at, email flags, accesos
// Acciones admin: emitir factura, reenviar email, provisionar código

const STATUS = {
    hold:      { label: 'Hold',      cls: 'bg-blue-50 text-blue-700 border-blue-200',     icon: Clock },
    pending:   { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: Clock },
    confirmed: { label: 'Confirmada',cls: 'bg-green-50 text-green-700 border-green-200',   icon: CheckCircle },
    cancelled: { label: 'Cancelada', cls: 'bg-red-50 text-red-700 border-red-200',         icon: XCircle },
    completed: { label: 'Completada',cls: 'bg-gray-100 text-gray-700 border-gray-200',     icon: CalendarCheck },
    expired:   { label: 'Expirada',  cls: 'bg-gray-100 text-gray-500 border-gray-200',     icon: XCircle },
};

const fmtEur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);

const BookingsManagerV2 = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('confirmed');
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState(null);
    const [busy, setBusy] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        let q = supabase
            .from('guest_bookings')
            .select(`id, booking_code, guest_name, guest_email, guest_phone, pax_count,
                     check_in, check_out, total_price, status, payment_status,
                     expires_at, payment_intent_id, apartment_id,
                     confirmation_email_sent_at, reminder_7d_email_sent_at,
                     reminder_24h_email_sent_at, arrival_email_sent_at,
                     departure_email_sent_at, review_request_email_sent_at,
                     apartments(name, slug)`)
            .order('check_in', { ascending: false })
            .limit(200);
        if (status !== 'all') q = q.eq('status', status);
        const { data } = await q;
        setBookings(data || []);
        setLoading(false);
    }, [status]);

    useEffect(() => { load(); }, [load]);

    const filtered = bookings.filter(b => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (b.booking_code || '').toLowerCase().includes(q)
            || (b.guest_name || '').toLowerCase().includes(q)
            || (b.guest_email || '').toLowerCase().includes(q);
    });

    const callEdge = async (path, body, label) => {
        setBusy(label);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const t = await res.text();
                alert(`Error: ${t.slice(0, 200)}`);
            } else {
                await load();
            }
        } catch (e) {
            alert('Error de red: ' + (e.message || e));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Reservas</h1>
                    <p className="text-sm text-gray-500">Motor de reservas propio · {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                    <RefreshCw size={14} /> Recargar
                </button>
            </header>

            <div className="flex flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por código, nombre o email…"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </div>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none cursor-pointer">
                    <option value="all">Todos los estados</option>
                    {Object.keys(STATUS).map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
                </select>
            </div>

            {loading ? (
                <p className="text-gray-500 font-serif italic">Cargando reservas…</p>
            ) : filtered.length === 0 ? (
                <p className="text-gray-500 font-serif italic">Sin reservas en este filtro.</p>
            ) : (
                <ul className="space-y-3">
                    {filtered.map(b => (
                        <BookingRow key={b.id} b={b}
                            expanded={expanded === b.id}
                            onToggle={() => setExpanded(expanded === b.id ? null : b.id)}
                            busy={busy}
                            onAction={callEdge} />
                    ))}
                </ul>
            )}
        </div>
    );
};

const BookingRow = ({ b, expanded, onToggle, busy, onAction }) => {
    const st = STATUS[b.status] || STATUS.pending;
    const Icon = st.icon;
    const isHoldExpiring = b.status === 'hold' && b.expires_at && new Date(b.expires_at) - new Date() < 5 * 60 * 1000;

    return (
        <li className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button type="button" onClick={onToggle}
                className="w-full grid grid-cols-12 gap-3 items-center text-left p-4 hover:bg-gray-50">
                <span className={`col-span-12 sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${st.cls}`}>
                    <Icon size={12} aria-hidden="true" /> {st.label}
                </span>
                <span className="col-span-6 sm:col-span-2 font-mono font-bold text-primary text-sm">{b.booking_code || `#${b.id}`}</span>
                <span className="col-span-6 sm:col-span-2 text-text-primary text-sm font-medium">{b.apartments?.name}</span>
                <span className="col-span-6 sm:col-span-2 text-gray-700 text-sm">{b.guest_name}</span>
                <span className="col-span-3 sm:col-span-2 text-gray-700 text-xs tabular-nums">{b.check_in} → {b.check_out}</span>
                <span className="col-span-3 sm:col-span-1 text-text-primary text-sm font-bold text-right tabular-nums">{fmtEur(b.total_price)}</span>
                <span className="col-span-12 sm:col-span-1 text-right">
                    {expanded ? <ChevronUp size={16} className="inline text-gray-400" /> : <ChevronDown size={16} className="inline text-gray-400" />}
                </span>
            </button>
            {isHoldExpiring && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle size={12} /> Hold expira en menos de 5 minutos
                </div>
            )}
            {expanded && <BookingDetail b={b} busy={busy} onAction={onAction} />}
        </li>
    );
};

const BookingDetail = ({ b, busy, onAction }) => {
    const emails = [
        { key: 'confirmation', label: 'Confirmación', sent: !!b.confirmation_email_sent_at },
        { key: 'reminder_7d', label: 'Recordatorio 7d', sent: !!b.reminder_7d_email_sent_at },
        { key: 'reminder_24h', label: 'Recordatorio 24h', sent: !!b.reminder_24h_email_sent_at },
        { key: 'arrival', label: 'Bienvenida', sent: !!b.arrival_email_sent_at },
        { key: 'departure', label: 'Despedida', sent: !!b.departure_email_sent_at },
        { key: 'review_request', label: 'Reseña', sent: !!b.review_request_email_sent_at },
    ];

    return (
        <div className="px-4 pb-4 pt-2 border-t border-gray-50 grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Huésped</p>
                <p className="text-text-primary font-medium">{b.guest_name}</p>
                <p className="text-gray-600 text-xs"><a href={`mailto:${b.guest_email}`} className="hover:underline">{b.guest_email}</a></p>
                {b.guest_phone && <p className="text-gray-600 text-xs"><a href={`tel:${b.guest_phone}`} className="hover:underline">{b.guest_phone}</a></p>}
                <p className="text-gray-600 text-xs mt-1">{b.pax_count} {b.pax_count === 1 ? 'persona' : 'personas'}</p>
            </div>
            <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Pago</p>
                <p className="text-text-primary text-xs">Estado: <strong>{b.payment_status || 'pending'}</strong></p>
                {b.payment_intent_id && <p className="text-gray-500 text-[10px] font-mono break-all mt-1">{b.payment_intent_id}</p>}
                {b.expires_at && b.status === 'hold' && (
                    <p className="text-amber-700 text-xs mt-1">Hold hasta {new Date(b.expires_at).toLocaleTimeString('es-ES')}</p>
                )}
            </div>
            <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Emails enviados</p>
                <ul className="space-y-1 text-xs">
                    {emails.map(e => (
                        <li key={e.key} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${e.sent ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            <span className={e.sent ? 'text-text-primary' : 'text-gray-400'}>{e.label}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 pt-3 border-t border-gray-50 flex flex-wrap gap-2">
                <ActionButton
                    icon={Mail} label="Reenviar confirmación"
                    onClick={() => onAction('send-booking-email', { bookingCode: b.booking_code, template: 'confirmation' }, `email-${b.id}`)}
                    busy={busy === `email-${b.id}`}
                    disabled={!b.booking_code} />
                <ActionButton
                    icon={Mail} label="Recordatorio 24h"
                    onClick={() => onAction('send-booking-email', { bookingCode: b.booking_code, template: 'reminder_24h' }, `email24-${b.id}`)}
                    busy={busy === `email24-${b.id}`}
                    disabled={!b.booking_code} />
                <ActionButton
                    icon={FileCheck} label="Emitir factura"
                    onClick={() => onAction('issue-invoice', { bookingCode: b.booking_code }, `invoice-${b.id}`)}
                    busy={busy === `invoice-${b.id}`}
                    disabled={!b.booking_code || b.status !== 'confirmed'} />
                {/* Botón "Provisionar código cerradura" oculto: TJM check-in personal.
                    Si en futuro se instala cerradura electrónica, descomentar:
                    <ActionButton icon={KeyRound} label="Provisionar código cerradura" ... /> */}
            </div>
        </div>
    );
};

const ActionButton = ({ icon: Icon, label, onClick, busy, disabled }) => (
    <button type="button" onClick={onClick} disabled={busy || disabled}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white text-rural-700 hover:bg-rural-50 disabled:opacity-40 disabled:cursor-not-allowed">
        <Icon size={14} aria-hidden="true" />
        {busy ? 'Enviando…' : label}
    </button>
);

export default BookingsManagerV2;

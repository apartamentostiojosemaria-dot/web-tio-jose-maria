import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Search, Mail, FileCheck, ChevronDown, ChevronUp,
    Clock, CheckCircle, XCircle, CalendarCheck, AlertTriangle, RefreshCw,
    LogIn, LogOut, Euro, User as UserIcon,
} from 'lucide-react';

const STATUS = {
    hold:      { label: 'Pagando…',      cls: 'bg-blue-50 text-blue-700 border-blue-200',   icon: Clock },
    pending:   { label: 'Sin confirmar', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
    confirmed: { label: 'Confirmada',    cls: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
    cancelled: { label: 'Cancelada',     cls: 'bg-red-50 text-red-700 border-red-200',       icon: XCircle },
    completed: { label: 'Finalizada',    cls: 'bg-gray-100 text-gray-700 border-gray-200',   icon: CalendarCheck },
    expired:   { label: 'Caducada',      cls: 'bg-gray-100 text-gray-500 border-gray-200',   icon: XCircle },
};

const fmtEur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—';
const ymd = (d) => d.toISOString().slice(0, 10);

const BookingsManagerV2 = () => {
    const [bookings, setBookings] = useState([]);
    const [warningEmails, setWarningEmails] = useState(new Set());  // emails con warnings_count > 0
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('upcoming');  // upcoming | today_in | today_out | week | confirmed | all_active
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState(null);
    const [busy, setBusy] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const today = ymd(new Date());
        const in30 = ymd(new Date(Date.now() + 30 * 86400000));

        // Cargamos un superset amplio (todas no canceladas/caducadas que tocan próximos 30 días o pasado reciente)
        const { data } = await supabase
            .from('guest_bookings')
            .select(`id, booking_code, guest_name, guest_email, guest_phone, pax_count,
                     check_in, check_out, total_price, status, payment_status, source,
                     expires_at, payment_intent_id, apartment_id,
                     confirmation_email_sent_at, reminder_7d_email_sent_at,
                     reminder_24h_email_sent_at, arrival_email_sent_at,
                     departure_email_sent_at, review_request_email_sent_at,
                     apartments(name, slug)`)
            .order('check_in', { ascending: true })
            .limit(500);
        setBookings(data || []);

        // Cargar emails con warnings de v_customers_360
        const { data: customers } = await supabase
            .from('v_customers_360')
            .select('email, warnings_count')
            .gt('warnings_count', 0);
        setWarningEmails(new Set((customers || []).map(c => c.email)));

        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // ───────── KPIs ─────────
    const today = ymd(new Date());
    const in7 = ymd(new Date(Date.now() + 7 * 86400000));
    const in30 = ymd(new Date(Date.now() + 30 * 86400000));

    const kpis = useMemo(() => {
        const active = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
        const todayIn = active.filter(b => b.check_in === today).length;
        const todayOut = active.filter(b => b.check_out === today).length;
        const upcoming7 = active.filter(b => b.check_in >= today && b.check_in <= in7);
        const revenue30 = active.filter(b => b.check_in >= today && b.check_in <= in30)
            .reduce((s, b) => s + Number(b.total_price || 0), 0);
        return { todayIn, todayOut, upcoming7Count: upcoming7.length, revenue30 };
    }, [bookings, today, in7, in30]);

    // ───────── Filtros ─────────
    const filtered = useMemo(() => {
        return bookings.filter(b => {
            // Filtro principal
            switch (filter) {
                case 'today_in':
                    if (!(b.check_in === today && (b.status === 'confirmed' || b.status === 'completed'))) return false;
                    break;
                case 'today_out':
                    if (!(b.check_out === today && (b.status === 'confirmed' || b.status === 'completed'))) return false;
                    break;
                case 'week':
                    if (!(b.check_in >= today && b.check_in <= in7 && b.status === 'confirmed')) return false;
                    break;
                case 'upcoming':
                    if (!(b.check_in >= today && b.status === 'confirmed')) return false;
                    break;
                case 'confirmed':
                    if (b.status !== 'confirmed') return false;
                    break;
                case 'completed':
                    if (b.status !== 'completed') return false;
                    break;
                case 'cancelled':
                    if (b.status !== 'cancelled') return false;
                    break;
                case 'pending':
                    if (b.status !== 'pending' && b.status !== 'hold') return false;
                    break;
                // 'all' no filtra
            }

            // Buscador texto
            if (!query.trim()) return true;
            const q = query.toLowerCase();
            return (b.booking_code || '').toLowerCase().includes(q)
                || (b.guest_name || '').toLowerCase().includes(q)
                || (b.guest_email || '').toLowerCase().includes(q)
                || (b.guest_phone || '').replaceAll(' ', '').includes(q.replaceAll(' ', ''));
        });
    }, [bookings, filter, query, today, in7]);

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
                    <p className="text-sm text-gray-600 mt-1">Todas las reservas con quién, cuándo y cuánto paga. Click en una para ver detalles y reenviar emails o emitir factura.</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                    <RefreshCw size={14} /> Actualizar
                </button>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <Kpi icon={LogIn} label="Llegan hoy" value={kpis.todayIn} highlight={kpis.todayIn > 0} />
                <Kpi icon={LogOut} label="Salen hoy" value={kpis.todayOut} highlight={kpis.todayOut > 0} />
                <Kpi icon={CalendarCheck} label="Próximos 7 días" value={kpis.upcoming7Count} />
                <Kpi icon={Euro} label="Ingresos próx. 30 días" value={fmtEur(kpis.revenue30)} />
            </div>

            {/* Buscador + chips */}
            <div className="flex flex-wrap gap-3 mb-3">
                <div className="relative flex-1 min-w-[260px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por código TJM-XXX, nombre, email o teléfono…"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-5">
                <Chip active={filter === 'upcoming'} onClick={() => setFilter('upcoming')}>Próximas</Chip>
                <Chip active={filter === 'today_in'} onClick={() => setFilter('today_in')} color="amber">Llegan hoy ({kpis.todayIn})</Chip>
                <Chip active={filter === 'today_out'} onClick={() => setFilter('today_out')} color="amber">Salen hoy ({kpis.todayOut})</Chip>
                <Chip active={filter === 'week'} onClick={() => setFilter('week')}>Esta semana</Chip>
                <Chip active={filter === 'confirmed'} onClick={() => setFilter('confirmed')}>Todas confirmadas</Chip>
                <Chip active={filter === 'pending'} onClick={() => setFilter('pending')} color="blue">Sin confirmar</Chip>
                <Chip active={filter === 'completed'} onClick={() => setFilter('completed')}>Finalizadas</Chip>
                <Chip active={filter === 'cancelled'} onClick={() => setFilter('cancelled')} color="red">Canceladas</Chip>
                <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Todas</Chip>
            </div>

            <p className="text-xs text-gray-500 mb-3">{filtered.length} reserva{filtered.length !== 1 ? 's' : ''}</p>

            {loading ? (
                <p className="text-gray-500 font-serif italic">Cargando…</p>
            ) : filtered.length === 0 ? (
                <p className="text-gray-500 font-serif italic">Sin reservas en este filtro.</p>
            ) : (
                <ul className="space-y-3">
                    {filtered.map(b => (
                        <BookingRow key={b.id} b={b}
                            hasWarnings={b.guest_email && warningEmails.has(b.guest_email.toLowerCase().trim())}
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

const BookingRow = ({ b, hasWarnings, expanded, onToggle, busy, onAction }) => {
    const st = STATUS[b.status] || STATUS.pending;
    const Icon = st.icon;
    const isHoldExpiring = b.status === 'hold' && b.expires_at && new Date(b.expires_at) - new Date() < 5 * 60 * 1000;

    return (
        <li className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${hasWarnings ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'}`}>
            <button type="button" onClick={onToggle}
                className="w-full grid grid-cols-12 gap-3 items-center text-left p-4 hover:bg-gray-50">
                <span className={`col-span-12 sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border w-fit ${st.cls}`}>
                    <Icon size={12} /> {st.label}
                </span>
                <div className="col-span-6 sm:col-span-2 flex items-center gap-2">
                    <span className="font-mono font-bold text-primary text-sm">{b.booking_code || `#${b.id}`}</span>
                    {hasWarnings && (
                        <span className="inline-flex items-center" title="Este huésped tiene avisos importantes en su ficha">
                            <AlertTriangle size={12} className="text-red-500" />
                        </span>
                    )}
                </div>
                <span className="col-span-6 sm:col-span-2 text-text-primary text-sm font-medium truncate">{b.apartments?.name}</span>
                <span className="col-span-6 sm:col-span-2 text-gray-700 text-sm truncate">{b.guest_name}</span>
                <span className="col-span-3 sm:col-span-2 text-gray-700 text-xs tabular-nums">{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</span>
                <span className="col-span-3 sm:col-span-1 text-text-primary text-sm font-bold text-right tabular-nums">{fmtEur(b.total_price)}</span>
                <span className="col-span-12 sm:col-span-1 text-right">
                    {expanded ? <ChevronUp size={16} className="inline text-gray-400" /> : <ChevronDown size={16} className="inline text-gray-400" />}
                </span>
            </button>
            {isHoldExpiring && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle size={12} /> El hold caduca en menos de 5 minutos
                </div>
            )}
            {hasWarnings && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-800 flex items-center gap-2">
                    <AlertTriangle size={12} /> Este cliente tiene avisos en su ficha. Abre <strong>Ficha de huéspedes</strong> y busca por <span className="font-mono">{b.guest_email}</span>
                </div>
            )}
            {expanded && <BookingDetail b={b} busy={busy} onAction={onAction} />}
        </li>
    );
};

const BookingDetail = ({ b, busy, onAction }) => {
    const emails = [
        { key: 'confirmation', label: 'Confirmación', sent: !!b.confirmation_email_sent_at, ts: b.confirmation_email_sent_at },
        { key: 'reminder_7d', label: 'Recordatorio 7 días', sent: !!b.reminder_7d_email_sent_at, ts: b.reminder_7d_email_sent_at },
        { key: 'reminder_24h', label: 'Recordatorio 24h', sent: !!b.reminder_24h_email_sent_at, ts: b.reminder_24h_email_sent_at },
        { key: 'arrival', label: 'Bienvenida', sent: !!b.arrival_email_sent_at, ts: b.arrival_email_sent_at },
        { key: 'departure', label: 'Despedida', sent: !!b.departure_email_sent_at, ts: b.departure_email_sent_at },
        { key: 'review_request', label: 'Pedir reseña', sent: !!b.review_request_email_sent_at, ts: b.review_request_email_sent_at },
    ];

    return (
        <div className="px-4 pb-4 pt-2 border-t border-gray-50 grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2 flex items-center gap-1"><UserIcon size={11} /> Datos del huésped</p>
                <p className="text-text-primary font-medium">{b.guest_name}</p>
                <p className="text-gray-600 text-xs"><a href={`mailto:${b.guest_email}`} className="hover:underline">{b.guest_email}</a></p>
                {b.guest_phone && (
                    <p className="text-gray-600 text-xs">
                        <a href={`tel:${b.guest_phone}`} className="hover:underline">{b.guest_phone}</a>
                        <a href={`https://wa.me/${b.guest_phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-rural-700 hover:underline">WhatsApp</a>
                    </p>
                )}
                <p className="text-gray-600 text-xs mt-1">{b.pax_count} {b.pax_count === 1 ? 'persona' : 'personas'}</p>
                {b.source && <p className="text-[10px] uppercase text-gray-400 font-bold mt-2">Origen: {b.source}</p>}
            </div>
            <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Pago</p>
                <p className="text-text-primary text-xs">
                    {b.payment_status === 'paid' ? '✓ Pagado' :
                     b.payment_status === 'paid_offline' ? '✓ Pagado en efectivo / transferencia' :
                     b.payment_status === 'partial' ? 'Pagada la señal' :
                     b.payment_status === 'refunded' ? 'Reembolsado' :
                     b.payment_status === 'failed' ? 'Pago fallido' :
                     'Pendiente de pago'}
                </p>
                {b.expires_at && b.status === 'hold' && (
                    <p className="text-amber-700 text-xs mt-1">Se libera a las {new Date(b.expires_at).toLocaleTimeString('es-ES')} si no paga</p>
                )}
            </div>
            <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Emails enviados</p>
                <ul className="space-y-1 text-xs">
                    {emails.map(e => (
                        <li key={e.key} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${e.sent ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            <span className={e.sent ? 'text-text-primary' : 'text-gray-400'}>{e.label}</span>
                            {e.ts && <span className="text-[10px] text-gray-400">· {new Date(e.ts).toLocaleDateString('es-ES')}</span>}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 pt-3 border-t border-gray-50 flex flex-wrap gap-2">
                <ActionButton
                    icon={Mail} label="Reenviar confirmación"
                    onClick={() => onAction('send-booking-email', { bookingCode: b.booking_code, template: 'confirmation', force: true }, `email-${b.id}`)}
                    busy={busy === `email-${b.id}`} disabled={!b.booking_code} />
                <ActionButton
                    icon={Mail} label="Mandar recordatorio 24h"
                    onClick={() => onAction('send-booking-email', { bookingCode: b.booking_code, template: 'reminder_24h', force: true }, `email24-${b.id}`)}
                    busy={busy === `email24-${b.id}`} disabled={!b.booking_code} />
                <ActionButton
                    icon={FileCheck} label="Emitir factura"
                    onClick={() => onAction('issue-invoice', { bookingCode: b.booking_code }, `invoice-${b.id}`)}
                    busy={busy === `invoice-${b.id}`} disabled={!b.booking_code || b.status !== 'confirmed'} />
            </div>
        </div>
    );
};

const ActionButton = ({ icon: Icon, label, onClick, busy, disabled }) => (
    <button type="button" onClick={onClick} disabled={busy || disabled}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white text-rural-700 hover:bg-rural-50 disabled:opacity-40 disabled:cursor-not-allowed">
        <Icon size={14} />
        {busy ? 'Procesando…' : label}
    </button>
);

const Kpi = ({ icon: Icon, label, value, highlight }) => (
    <div className={`rounded-2xl border p-4 shadow-sm ${highlight ? 'bg-rural-50 border-rural-200' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-1">
            {Icon && <Icon size={12} className={highlight ? 'text-rural-700' : 'text-gray-400'} />}
            <p className={`text-[10px] uppercase tracking-widest font-bold ${highlight ? 'text-rural-700' : 'text-gray-500'}`}>{label}</p>
        </div>
        <p className={`font-serif font-bold text-2xl ${highlight ? 'text-rural-900' : 'text-text-primary'}`}>{value}</p>
    </div>
);

const Chip = ({ active, onClick, children, color = 'rural' }) => {
    const palettes = {
        rural: active ? 'bg-rural-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
        amber: active ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-amber-50',
        blue:  active ? 'bg-blue-600 text-white'  : 'bg-white text-gray-600 hover:bg-blue-50',
        red:   active ? 'bg-red-600 text-white'   : 'bg-white text-gray-600 hover:bg-red-50',
    };
    return (
        <button onClick={onClick} className={`px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-100 transition-colors ${palettes[color]}`}>
            {children}
        </button>
    );
};

export default BookingsManagerV2;

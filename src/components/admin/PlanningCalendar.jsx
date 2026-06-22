import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    ChevronLeft, ChevronRight, RefreshCw, Calendar as CalendarIcon,
    X, Mail, FileCheck, ExternalLink
} from 'lucide-react';

// Vista calendario tipo planning multi-apartamento.
// ===================================================
// CSS Grid puro (sin librería externa). Filas = apartamentos,
// columnas = días del mes navegable. Reservas y blocked_dates se posicionan
// como barras con grid-column-start/grid-column-end por fecha.
// Colores:
//   confirmed = verde primario   hold = ámbar
//   pending/completed = gris    cancelled = rojo
//   blocked_dates Airbnb = azul  Booking = rosa  manual = gris-oscuro
// Click en reserva = modal de detalle con acciones rápidas.

const STATUS_COLORS = {
    confirmed: 'bg-primary text-white',
    hold:      'bg-amber-500 text-white',
    pending:   'bg-amber-400 text-white',
    completed: 'bg-rural-500 text-white',
    cancelled: 'bg-red-500 text-white opacity-60',
};

const SOURCE_COLORS = {
    airbnb:  'bg-pink-500 text-white',
    booking: 'bg-blue-500 text-white',
    manual:  'bg-gray-500 text-white',
    other:   'bg-gray-400 text-white',
};

const dayName = (d) => ['D','L','M','X','J','V','S'][d];
const monthName = (m) => ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m];

const PlanningCalendar = () => {
    const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
    const [apartments, setApartments] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBooking, setSelectedBooking] = useState(null);

    const { firstDay, lastDay, daysInMonth, dayArray } = useMemo(() => {
        const y = cursor.getFullYear();
        const m = cursor.getMonth();
        const first = new Date(y, m, 1);
        const last = new Date(y, m + 1, 0);
        const count = last.getDate();
        return {
            firstDay: first.toISOString().slice(0, 10),
            lastDay: last.toISOString().slice(0, 10),
            daysInMonth: count,
            dayArray: Array.from({ length: count }, (_, i) => {
                const d = new Date(y, m, i + 1);
                return { num: i + 1, dow: d.getDay(), iso: d.toISOString().slice(0, 10) };
            }),
        };
    }, [cursor]);

    const load = useCallback(async () => {
        setLoading(true);
        const [a, b, bl] = await Promise.all([
            supabase.from('apartments').select('id, name, slug, capacity_people').eq('is_active', true).order('name'),
            supabase.from('guest_bookings')
                .select('id, booking_code, guest_name, guest_email, check_in, check_out, status, apartment_id, total_price, pax_count')
                .lte('check_in', lastDay).gte('check_out', firstDay)
                .in('status', ['hold','pending','confirmed','completed','cancelled']),
            supabase.from('blocked_dates')
                .select('id, apartment_id, start_date, end_date, source')
                .lte('start_date', lastDay).gte('end_date', firstDay),
        ]);
        setApartments(a.data || []);
        setBookings(b.data || []);
        setBlocks(bl.data || []);
        setLoading(false);
    }, [firstDay, lastDay]);

    useEffect(() => { load(); }, [load]);

    const nav = (delta) => {
        const d = new Date(cursor);
        d.setMonth(d.getMonth() + delta);
        setCursor(d);
    };
    const goToday = () => { const d = new Date(); d.setDate(1); setCursor(d); };

    const todayIso = new Date().toISOString().slice(0, 10);

    return (
        <div className="max-w-[1600px]">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Planning</h1>
                    <p className="text-sm text-gray-500">Vista mensual de todos los apartamentos · Reservas + iCal externos</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => nav(-1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50" aria-label="Mes anterior">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={goToday} className="px-3 py-2 text-sm font-bold rounded-xl border border-gray-200 hover:bg-gray-50">Hoy</button>
                    <h2 className="font-serif text-lg font-bold text-text-primary min-w-[200px] text-center">
                        {monthName(cursor.getMonth())} {cursor.getFullYear()}
                    </h2>
                    <button onClick={() => nav(1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50" aria-label="Mes siguiente">
                        <ChevronRight size={16} />
                    </button>
                    <button onClick={load} className="ml-2 p-2 rounded-xl text-rural-700 hover:bg-rural-50" aria-label="Recargar">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </header>

            {/* Leyenda compacta */}
            <div className="flex flex-wrap gap-3 mb-4 text-xs">
                <Legend color="bg-primary" label="Confirmada" />
                <Legend color="bg-amber-500" label="Hold/Pendiente" />
                <Legend color="bg-blue-500" label="Booking iCal" />
                <Legend color="bg-pink-500" label="Airbnb iCal" />
                <Legend color="bg-gray-500" label="Bloqueo manual" />
            </div>

            {loading ? (
                <p className="text-gray-500 font-serif italic">Cargando planning…</p>
            ) : apartments.length === 0 ? (
                <p className="text-gray-500 font-serif italic">No hay apartamentos activos.</p>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                    {/* Cabecera con días */}
                    <div className="min-w-[900px]">
                        <div className="grid sticky top-0 bg-gray-50 border-b border-gray-100 z-10"
                            style={{ gridTemplateColumns: `150px repeat(${daysInMonth}, minmax(28px, 1fr))` }}>
                            <div className="px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-gray-500 border-r border-gray-100">Apto</div>
                            {dayArray.map(d => (
                                <div key={d.num} className={`text-center py-2 text-[10px] font-bold ${
                                    d.iso === todayIso ? 'bg-rural-100 text-primary' :
                                    (d.dow === 0 || d.dow === 6) ? 'text-rural-700' : 'text-gray-500'
                                }`}>
                                    <div>{dayName(d.dow)}</div>
                                    <div className="text-xs">{d.num}</div>
                                </div>
                            ))}
                        </div>

                        {/* Filas por apartamento */}
                        {apartments.map(apt => (
                            <AptRow key={apt.id} apt={apt} dayArray={dayArray} daysInMonth={daysInMonth}
                                bookings={bookings.filter(b => b.apartment_id === apt.id)}
                                blocks={blocks.filter(b => b.apartment_id === apt.id)}
                                todayIso={todayIso}
                                onSelect={setSelectedBooking} />
                        ))}
                    </div>
                </div>
            )}

            {selectedBooking && (
                <BookingModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} onReload={load} />
            )}
        </div>
    );
};

const Legend = ({ color, label }) => (
    <span className="inline-flex items-center gap-1.5">
        <span className={`w-3 h-3 rounded ${color}`}></span>
        <span className="text-gray-600">{label}</span>
    </span>
);

const AptRow = ({ apt, dayArray, daysInMonth, bookings, blocks, todayIso, onSelect }) => {
    return (
        <div className="grid border-b border-gray-50 relative min-h-[60px]"
            style={{ gridTemplateColumns: `150px repeat(${daysInMonth}, minmax(28px, 1fr))` }}>
            {/* Nombre apartamento */}
            <div className="px-3 py-3 flex items-center border-r border-gray-100 bg-gray-50/50">
                <div>
                    <p className="font-bold text-text-primary text-sm">{apt.name}</p>
                    <p className="text-[10px] text-gray-500">{apt.capacity_people} plazas</p>
                </div>
            </div>

            {/* Fondo días (para hover/today) */}
            {dayArray.map(d => (
                <div key={d.num} className={`border-r border-gray-50 ${
                    d.iso === todayIso ? 'bg-rural-50/30' :
                    (d.dow === 0 || d.dow === 6) ? 'bg-gray-50/40' : ''
                }`} />
            ))}

            {/* Reservas absolutas dentro de la fila */}
            <div className="absolute inset-0 grid pointer-events-none"
                style={{ gridTemplateColumns: `150px repeat(${daysInMonth}, minmax(28px, 1fr))` }}>
                <div></div>
                {bookings.map(b => (
                    <BookingBar key={b.id} b={b} dayArray={dayArray} onSelect={onSelect} />
                ))}
                {blocks.map(bl => (
                    <BlockBar key={bl.id} bl={bl} dayArray={dayArray} />
                ))}
            </div>
        </div>
    );
};

// Calcula columna-inicio y columna-fin dentro del mes visible. Recorta si la
// reserva empieza antes o termina después del mes.
function spanInMonth(startIso, endIso, dayArray) {
    if (!dayArray.length) return null;
    const firstIso = dayArray[0].iso;
    const lastIso = dayArray[dayArray.length - 1].iso;
    if (endIso <= firstIso || startIso > lastIso) return null;
    const startNum = startIso < firstIso ? 1 : (new Date(startIso).getDate());
    // En DB end_date de blocked_dates es inclusive; check_out de bookings es exclusive.
    // El caller debe ajustar antes de llamarme.
    const endNum = endIso > lastIso ? dayArray.length : (new Date(endIso).getDate());
    return { startCol: startNum + 1, endCol: endNum + 1 }; // +1 porque la col 1 es la columna apto
}

const BookingBar = ({ b, dayArray, onSelect }) => {
    // check_out es exclusivo en nuestro modelo (la noche del check_out ya no ocupa)
    const endExclusive = b.check_out;
    const span = spanInMonth(b.check_in, endExclusive, dayArray);
    if (!span) return null;
    const cls = STATUS_COLORS[b.status] || STATUS_COLORS.pending;
    return (
        <button type="button" onClick={() => onSelect(b)}
            className={`pointer-events-auto m-0.5 px-2 py-1 rounded-md text-[10px] font-bold truncate cursor-pointer hover:opacity-90 ${cls}`}
            style={{ gridColumnStart: span.startCol, gridColumnEnd: span.endCol }}
            title={`${b.booking_code} — ${b.guest_name} (${b.check_in} → ${b.check_out})`}>
            {b.guest_name?.split(' ')[0]} · {b.booking_code}
        </button>
    );
};

const BlockBar = ({ bl, dayArray }) => {
    // blocked_dates.end_date es inclusivo → sumamos 1 día para alinear con la cuadrícula
    const endExclusive = new Date(new Date(bl.end_date).getTime() + 86400000).toISOString().slice(0, 10);
    const span = spanInMonth(bl.start_date, endExclusive, dayArray);
    if (!span) return null;
    const source = bl.source || 'manual';
    const cls = SOURCE_COLORS[source] || SOURCE_COLORS.other;
    return (
        <div className={`pointer-events-none m-0.5 px-2 py-1 rounded-md text-[10px] font-bold truncate opacity-80 ${cls}`}
            style={{ gridColumnStart: span.startCol, gridColumnEnd: span.endCol }}
            title={`${source}: ${bl.start_date} → ${bl.end_date}`}>
            {source}
        </div>
    );
};

const BookingModal = ({ booking, onClose, onReload }) => {
    const [busy, setBusy] = useState(null);

    const call = async (path, body, label) => {
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
            if (!res.ok) alert('Error: ' + await res.text());
            else { onReload(); }
        } finally { setBusy(null); }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Reserva</p>
                        <h3 className="font-mono text-primary font-bold text-lg">{booking.booking_code}</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                        <X size={20} />
                    </button>
                </div>
                <dl className="grid grid-cols-2 gap-y-2 text-sm mb-5">
                    <dt className="text-gray-500">Estado</dt><dd className="text-right font-bold capitalize">{booking.status}</dd>
                    <dt className="text-gray-500">Huésped</dt><dd className="text-right">{booking.guest_name}</dd>
                    <dt className="text-gray-500">Email</dt><dd className="text-right text-xs"><a href={`mailto:${booking.guest_email}`} className="underline">{booking.guest_email}</a></dd>
                    <dt className="text-gray-500">Personas</dt><dd className="text-right">{booking.pax_count}</dd>
                    <dt className="text-gray-500">Entrada</dt><dd className="text-right tabular-nums">{booking.check_in}</dd>
                    <dt className="text-gray-500">Salida</dt><dd className="text-right tabular-nums">{booking.check_out}</dd>
                    <dt className="text-gray-500">Total</dt><dd className="text-right font-bold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(booking.total_price)}</dd>
                </dl>
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                    <button onClick={() => call('send-booking-email', { bookingCode: booking.booking_code, template: 'confirmation' }, 'email')}
                        disabled={busy === 'email'} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 bg-white text-rural-700 hover:bg-rural-50 disabled:opacity-50">
                        <Mail size={14} /> {busy === 'email' ? '…' : 'Reenviar email'}
                    </button>
                    <button onClick={() => call('issue-invoice', { bookingCode: booking.booking_code }, 'invoice')}
                        disabled={busy === 'invoice' || booking.status !== 'confirmed'}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 bg-white text-rural-700 hover:bg-rural-50 disabled:opacity-40">
                        <FileCheck size={14} /> {busy === 'invoice' ? '…' : 'Emitir factura'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlanningCalendar;

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Search, RefreshCw, Star, Mail, Phone, MapPin, Calendar, Euro, Award, X, MessageCircle
} from 'lucide-react';

const fmtEur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);

const Customer360 = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
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

    const filtered = customers.filter(c => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return c.email.includes(q)
            || (c.last_name || '').toLowerCase().includes(q)
            || (c.favorite_apartment || '').toLowerCase().includes(q);
    });

    const totals = filtered.reduce((acc, c) => ({
        customers: acc.customers + 1,
        stays: acc.stays + Number(c.total_stays || 0),
        revenue: acc.revenue + Number(c.lifetime_value || 0),
        recurrent: acc.recurrent + (Number(c.total_stays || 0) > 1 ? 1 : 0),
    }), { customers: 0, stays: 0, revenue: 0, recurrent: 0 });

    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Fichas de huéspedes</h1>
                    <p className="text-sm text-gray-600">Cada huésped con su historial de estancias y cuánto ha gastado en total</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                    <RefreshCw size={14} /> Actualizar
                </button>
            </header>

            {/* Tarjetas resumen */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <SummaryCard label="Huéspedes distintos" value={totals.customers} />
                <SummaryCard label="Estancias totales" value={totals.stays} />
                <SummaryCard label="Ingresado por todos" value={fmtEur(totals.revenue)} />
                <SummaryCard label="Que han vuelto más de una vez" value={`${totals.recurrent} (${totals.customers > 0 ? Math.round(100 * totals.recurrent / totals.customers) : 0}%)`} />
            </div>

            <div className="relative mb-6">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por email, nombre o apartamento…"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </div>

            {loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> :
             filtered.length === 0 ? <p className="text-gray-500 font-serif italic">Aún no hay huéspedes.</p> :
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-widest font-bold text-gray-500">
                        <tr>
                            <th className="text-left px-4 py-3">Huésped</th>
                            <th className="text-left px-4 py-3">Apartamento favorito</th>
                            <th className="text-center px-4 py-3">Estancias</th>
                            <th className="text-center px-4 py-3">Noches</th>
                            <th className="text-right px-4 py-3">Ha gastado en total</th>
                            <th className="text-left px-4 py-3">Última visita</th>
                            <th className="text-center px-4 py-3">Valoración</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(c => (
                            <tr key={c.email} onClick={() => setSelected(c)}
                                className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                                <td className="px-4 py-3">
                                    <p className="text-text-primary font-medium">{c.last_name || c.email}</p>
                                    <p className="text-[10px] text-gray-500">{c.email}</p>
                                </td>
                                <td className="px-4 py-3 text-gray-700">{c.favorite_apartment || '—'}</td>
                                <td className="px-4 py-3 text-center tabular-nums">
                                    <span className="font-bold text-text-primary">{c.total_stays}</span>
                                    {c.total_cancelled > 0 && <span className="block text-[10px] text-red-500">({c.total_cancelled} canc)</span>}
                                </td>
                                <td className="px-4 py-3 text-center tabular-nums text-gray-700">{c.total_nights}</td>
                                <td className="px-4 py-3 text-right tabular-nums font-bold">{fmtEur(c.lifetime_value)}</td>
                                <td className="px-4 py-3 text-xs tabular-nums text-gray-700">{c.last_stay || '—'}</td>
                                <td className="px-4 py-3 text-center">
                                    {c.avg_rating ? (
                                        <span className="inline-flex items-center gap-1 text-xs">
                                            <Star size={12} className="text-amber-500 fill-amber-500" /> {c.avg_rating}
                                        </span>
                                    ) : <span className="text-gray-400 text-xs">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>}

            {selected && <CustomerSheet customer={selected} onClose={() => setSelected(null)} />}
        </div>
    );
};

const SummaryCard = ({ label, value }) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</p>
        <p className="font-serif font-bold text-text-primary text-2xl mt-1">{value}</p>
    </div>
);

const CustomerSheet = ({ customer, onClose }) => {
    const [bookings, setBookings] = useState([]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from('guest_bookings')
                .select('booking_code, check_in, check_out, status, total_price, pax_count, notes, apartments(name)')
                .ilike('guest_email', customer.email)
                .order('check_in', { ascending: false });
            setBookings(data || []);
        })();
    }, [customer.email]);

    const tier = customer.total_stays >= 5 ? { label: 'VIP', cls: 'bg-amber-100 text-amber-900' }
        : customer.total_stays >= 2 ? { label: 'Recurrente', cls: 'bg-rural-100 text-rural-700' }
        : { label: 'Primera vez', cls: 'bg-blue-100 text-blue-900' };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <header className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${tier.cls}`}>{tier.label}</span>
                            <h2 className="font-serif text-2xl font-bold text-text-primary mt-2">{customer.last_name}</h2>
                            <p className="text-sm text-gray-600 mt-1 flex items-center gap-3">
                                <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1 hover:text-primary"><Mail size={12} /> {customer.email}</a>
                                {customer.last_phone && <a href={`tel:${customer.last_phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone size={12} /> {customer.last_phone}</a>}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                    </div>
                </header>

                <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-gray-50">
                    <Metric icon={Calendar} label="Estancias" value={customer.total_stays} />
                    <Metric icon={MessageCircle} label="Noches" value={customer.total_nights} />
                    <Metric icon={Euro} label="Ha gastado" value={fmtEur(customer.lifetime_value)} />
                    <Metric icon={Award} label="Valoración" value={customer.avg_rating ? `${customer.avg_rating} ★` : '—'} />
                </div>

                {customer.favorite_apartment && (
                    <div className="px-6 pt-4 text-sm text-gray-600">
                        <MapPin size={12} className="inline mr-1 text-primary" />
                        Apartamento favorito: <strong className="text-text-primary">{customer.favorite_apartment}</strong>
                    </div>
                )}

                {customer.last_note && (
                    <div className="mx-6 my-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-900">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-amber-700 mb-1">Última nota interna</p>
                        {customer.last_note}
                    </div>
                )}

                <section className="p-6 pt-2">
                    <h3 className="font-serif text-lg font-bold text-text-primary mb-3">Historial de reservas</h3>
                    <ul className="space-y-2">
                        {bookings.map(b => (
                            <li key={b.booking_code} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <div>
                                    <p className="font-mono font-bold text-primary text-xs">{b.booking_code}</p>
                                    <p className="text-sm text-text-primary">{b.apartments?.name} · {b.pax_count} pax</p>
                                    <p className="text-xs text-gray-500 tabular-nums">{b.check_in} → {b.check_out}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-text-primary">{fmtEur(b.total_price)}</p>
                                    <p className="text-[10px] uppercase font-bold text-gray-500">{b.status}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
};

const Metric = ({ icon: Icon, label, value }) => (
    <div className="text-center">
        <Icon size={16} className="text-rural-700 mx-auto mb-1" aria-hidden="true" />
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</p>
        <p className="font-serif font-bold text-text-primary text-lg mt-1">{value}</p>
    </div>
);

export default Customer360;

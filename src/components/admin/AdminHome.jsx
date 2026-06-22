import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, TrendingUp, Calendar, Sparkles, Bot, MessageSquare, FileCheck, Shield, KeyRound, Brush, Clock, Euro, BedDouble, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';

// ============================================================
// AdminHome — cockpit cross-modular del CRM
// ============================================================
// Pulls de:
//   - v_admin_kpis            (1 fila con todos los contadores)
//   - v_admin_upcoming        (próximas llegadas/salidas 14 días)
//   - v_admin_revenue_monthly (12 meses de ingresos)
// ============================================================

const formatEur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const formatPct = (n) => n != null ? `${Number(n).toFixed(0)}%` : '—';

const AdminHome = ({ onNavigate }) => {
    const [kpis, setKpis] = useState(null);
    const [upcoming, setUpcoming] = useState([]);
    const [revenue, setRevenue] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [k, u, r] = await Promise.all([
                supabase.from('v_admin_kpis').select('*').maybeSingle(),
                supabase.from('v_admin_upcoming').select('*').order('event_date', { ascending: true }).limit(20),
                supabase.from('v_admin_revenue_monthly').select('*').limit(12),
            ]);
            if (cancelled) return;
            setKpis(k.data || {});
            setUpcoming(u.data || []);
            setRevenue((r.data || []).slice().reverse()); // orden cronológico
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    if (loading) return <p className="text-gray-500 font-serif italic">Cargando dashboard…</p>;

    const k = kpis || {};
    const alerts = buildAlerts(k);

    return (
        <div className="space-y-8 max-w-7xl">
            <header>
                <h1 className="font-serif text-3xl font-bold text-text-primary">Cockpit Tío José María</h1>
                <p className="text-gray-500 text-sm">Estado del alojamiento ahora mismo</p>
            </header>

            {/* Alertas operativas — solo si hay */}
            {alerts.length > 0 && (
                <section aria-labelledby="alerts-h">
                    <h2 id="alerts-h" className="sr-only">Alertas operativas</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {alerts.map((a, i) => <AlertCard key={i} {...a} onClick={() => onNavigate?.(a.tab)} />)}
                    </div>
                </section>
            )}

            {/* KPIs principales */}
            <section aria-labelledby="kpi-h">
                <h2 id="kpi-h" className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-3">Resumen</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon={BedDouble} label="Ocupación 30 días" value={formatPct(k.ocupacion_30d_pct)} accent="primary" />
                    <KpiCard icon={Euro} label="Ingresos últimos 30 días" value={formatEur(k.ingresos_30d)} accent="primary" />
                    <KpiCard icon={TrendingUp} label="Ingresos próximos 30 días" value={formatEur(k.ingresos_proximos_30d)} accent="primary" />
                    <KpiCard icon={Calendar} label="Reservas activas" value={k.reservas_activas || 0} accent="primary" />
                </div>
            </section>

            {/* Hoy y semana */}
            <section aria-labelledby="today-h">
                <h2 id="today-h" className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-3">Hoy y próximos días</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon={ArrowDownRight} label="Llegadas hoy" value={k.checkins_hoy || 0} accent="rural" />
                    <KpiCard icon={ArrowUpRight} label="Salidas hoy" value={k.checkouts_hoy || 0} accent="rural" />
                    <KpiCard icon={Calendar} label="Llegadas próximos 7 días" value={k.llegadas_7d || 0} accent="rural" />
                    <KpiCard icon={Brush} label="Limpiezas pendientes" value={k.limpiezas_pendientes || 0} accent="rural" />
                </div>
            </section>

            {/* Próximas llegadas/salidas */}
            {upcoming.length > 0 && (
                <section aria-labelledby="upcoming-h">
                    <h2 id="upcoming-h" className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-3">Próximos 14 días</h2>
                    <UpcomingTable rows={upcoming} />
                </section>
            )}

            {/* Gráfica ingresos */}
            {revenue.length > 0 && (
                <section aria-labelledby="rev-h">
                    <h2 id="rev-h" className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-3">Ingresos mensuales (últimos 12 meses)</h2>
                    <RevenueChart data={revenue} />
                </section>
            )}

            {/* Bot IA */}
            <section aria-labelledby="bot-h">
                <h2 id="bot-h" className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-3">Asistente virtual</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <KpiCard icon={Bot} label="Sesiones últimas 24h" value={k.bot_sesiones_24h || 0} accent="rural" />
                    <KpiCard icon={MessageSquare} label="Errores últimos 7d" value={k.bot_errores_7d || 0}
                        accent={(k.bot_errores_7d || 0) > 0 ? 'warning' : 'rural'} />
                    <KpiCard icon={Sparkles} label="Bot RAG + Bedrock UE" value="activo" accent="primary" small />
                </div>
            </section>
        </div>
    );
};

// ============================================================
const buildAlerts = (k) => {
    const a = [];
    if ((k.ses_pendientes || 0) > 0)
        a.push({ kind: 'urgent', icon: Shield, title: `${k.ses_pendientes} parte(s) SES sin enviar al MIR`, desc: 'Check-in pasado, registro pendiente. RD 933/2021 exige 24h.', tab: 'travelers' });
    if ((k.ses_errores || 0) > 0)
        a.push({ kind: 'urgent', icon: Shield, title: `${k.ses_errores} envío(s) SES con error`, desc: 'Revisa el detalle y reintenta.', tab: 'travelers' });
    if ((k.precheckin_pendiente_24h || 0) > 0)
        a.push({ kind: 'warning', icon: Clock, title: `${k.precheckin_pendiente_24h} reserva(s) sin precheckin para mañana`, desc: 'El huésped llega en <24h y no ha rellenado.', tab: 'reservas' });
    if ((k.holds_expirando || 0) > 0)
        a.push({ kind: 'info', icon: Clock, title: `${k.holds_expirando} hold(s) expirando en 30min`, desc: 'Reservas en proceso de pago — vigila si se quedan a medias.', tab: 'reservas' });
    if ((k.facturas_verifactu_pendientes || 0) > 0)
        a.push({ kind: 'warning', icon: FileCheck, title: `${k.facturas_verifactu_pendientes} factura(s) sin envío Verifactu`, desc: 'En stub o con error. Activa AEAT cuando puedas.', tab: 'invoices' });
    return a;
};

// ============================================================
const AlertCard = ({ kind, icon: Icon, title, desc, onClick }) => {
    const styles = {
        urgent:  'bg-red-50 border-red-200 text-red-900',
        warning: 'bg-amber-50 border-amber-200 text-amber-900',
        info:    'bg-blue-50 border-blue-200 text-blue-900',
    };
    return (
        <button type="button" onClick={onClick}
            className={`text-left rounded-2xl border p-4 flex gap-3 items-start hover:shadow-md transition-shadow ${styles[kind]}`}>
            <span className="mt-0.5"><Icon size={18} aria-hidden="true" /></span>
            <span className="flex-1">
                <span className="font-bold text-sm block">{title}</span>
                <span className="text-xs opacity-80 block mt-0.5">{desc}</span>
            </span>
        </button>
    );
};

const KpiCard = ({ icon: Icon, label, value, accent = 'primary', small = false }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            accent === 'primary' ? 'bg-primary/10 text-primary' :
            accent === 'warning' ? 'bg-amber-50 text-amber-700' :
            'bg-rural-100 text-rural-700'
        }`}>
            <Icon size={18} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</p>
            <p className={`font-serif font-bold text-text-primary truncate ${small ? 'text-lg' : 'text-2xl'} mt-1`}>{value}</p>
        </div>
    </div>
);

const UpcomingTable = ({ rows }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-widest font-bold text-gray-500">
                <tr>
                    <th className="text-left px-4 py-3">Fecha</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Reserva</th>
                    <th className="text-left px-4 py-3">Huésped</th>
                    <th className="text-left px-4 py-3">Apartamento</th>
                    <th className="text-center px-4 py-3">Pax</th>
                    <th className="text-center px-4 py-3">Estado</th>
                </tr>
            </thead>
            <tbody>
                {rows.map(r => (
                    <tr key={`${r.id}-${r.event_type}`} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-text-primary font-medium tabular-nums">{r.event_date}</td>
                        <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold ${
                                r.event_type === 'llegada' ? 'bg-rural-100 text-rural-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                                {r.event_type === 'llegada' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                                {r.event_type}
                            </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-primary">{r.booking_code}</td>
                        <td className="px-4 py-3 text-text-primary">{r.guest_name}</td>
                        <td className="px-4 py-3 text-gray-700">{r.apartment_name}</td>
                        <td className="px-4 py-3 text-center text-gray-700 tabular-nums">{r.pax_count}</td>
                        <td className="px-4 py-3 text-center">
                            <UpcomingFlags r={r} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const UpcomingFlags = ({ r }) => (
    <span className="inline-flex items-center gap-1.5">
        <FlagDot ok={r.confirmation_sent} label="Email confirmación" />
        <FlagDot ok={r.precheckin_done} label="Precheckin" warning={!r.precheckin_done && r.event_type === 'llegada'} />
        <FlagDot ok={r.has_access_code} label="Código cerradura" />
    </span>
);

const FlagDot = ({ ok, warning, label }) => (
    <span title={`${label}: ${ok ? 'OK' : (warning ? 'falta' : 'pendiente')}`}
        className={`inline-block w-2.5 h-2.5 rounded-full ${
            ok ? 'bg-green-500' : warning ? 'bg-amber-500' : 'bg-gray-300'
        }`} aria-label={`${label} ${ok ? 'OK' : 'pendiente'}`} />
);

// ============================================================
// Gráfica de barras SVG (sin recharts en este componente para mantenerlo ligero)
const RevenueChart = ({ data }) => {
    const max = Math.max(...data.map(d => Number(d.revenue) || 0), 1);
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-end gap-2 h-48" role="img" aria-label="Ingresos mensuales últimos 12 meses">
                {data.map((d) => {
                    const h = Math.max(2, (Number(d.revenue) / max) * 100);
                    return (
                        <div key={d.month} className="flex-1 flex flex-col items-center gap-2 group">
                            <div className="w-full bg-rural-100 rounded-t-lg relative" style={{ height: `${h}%` }}>
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white px-2 py-0.5 rounded shadow border border-gray-100">
                                    {formatEur(d.revenue)}
                                </div>
                                <div className="absolute inset-0 bg-primary rounded-t-lg opacity-90" />
                            </div>
                            <span className="text-[10px] text-gray-500 tabular-nums">{d.month.slice(5)}</span>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 flex justify-between text-[10px] text-gray-400">
                <span>{data[0]?.month}</span>
                <span>{data[data.length - 1]?.month}</span>
            </div>
        </div>
    );
};

export default AdminHome;

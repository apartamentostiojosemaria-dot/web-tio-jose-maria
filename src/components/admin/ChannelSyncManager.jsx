import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Link2, Calendar, Send, Copy } from 'lucide-react';

const ChannelSyncManager = () => {
    const [apartments, setApartments] = useState([]);
    const [blocks, setBlocks] = useState({});
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const load = useCallback(async () => {
        setLoading(true);
        const { data: apts } = await supabase
            .from('apartments')
            .select('id, slug, name, airbnb_ical_url, booking_ical_url, is_active')
            .eq('is_active', true)
            .order('name');
        setApartments(apts || []);

        // Conteo de blocks por apartamento y source
        const { data: b } = await supabase
            .from('blocked_dates')
            .select('apartment_id, source')
            .gte('end_date', new Date().toISOString().slice(0, 10));
        const grouped = {};
        for (const row of (b || [])) {
            const k = `${row.apartment_id}-${row.source || 'manual'}`;
            grouped[k] = (grouped[k] || 0) + 1;
        }
        setBlocks(grouped);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const runSync = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${supabaseUrl}/functions/v1/sync-ical-imports`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({}),
            });
            if (res.ok) setSyncResult(await res.json());
            else setSyncResult({ error: await res.text() });
            await load();
        } finally { setSyncing(false); }
    };

    const updateIcal = async (id, field, value) => {
        await supabase.from('apartments').update({ [field]: value || null }).eq('id', id);
        await load();
    };

    const copyExportUrl = (slug) => {
        const url = `https://tiojosemaria.com/ical/${slug}.ics`;
        navigator.clipboard.writeText(url);
        alert('Enlace copiado. Ahora pégalo en Airbnb (Calendario → "Vincular otro calendario" → "Conéctate a una web externa") o en Booking Extranet → Sincronización iCal.');
    };

    return (
        <div className="max-w-6xl">
            <header className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Sincronizar con Airbnb y Booking</h1>
                    <p className="text-sm text-gray-600 max-w-2xl mt-1">
                        Aquí conectas Airbnb, Booking y otros canales. Las reservas que entren por allí bloquean automáticamente las fechas en tu web, y al revés.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={runSync} disabled={syncing}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow hover:shadow-md disabled:opacity-50">
                        <Send size={14} /> {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
                    </button>
                    <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                        <RefreshCw size={14} /> Actualizar
                    </button>
                </div>
            </header>

            {syncResult && <SyncResultPanel result={syncResult} />}

            {loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> :
            <ul className="space-y-4">
                {apartments.map(a => (
                    <li key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-serif text-lg font-bold text-text-primary">{a.name}</h3>
                            <span className="text-xs text-gray-500 font-mono">/{a.slug}</span>
                        </div>

                        <div className="space-y-3">
                            <UrlField label="Enlace del calendario de Airbnb" icon={Calendar}
                                value={a.airbnb_ical_url || ''} onChange={(v) => updateIcal(a.id, 'airbnb_ical_url', v)}
                                count={blocks[`${a.id}-airbnb`] || 0} sourceLabel="Airbnb" />
                            <UrlField label="Enlace del calendario de Booking" icon={Calendar}
                                value={a.booking_ical_url || ''} onChange={(v) => updateIcal(a.id, 'booking_ical_url', v)}
                                count={blocks[`${a.id}-booking`] || 0} sourceLabel="Booking" />
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between flex-wrap gap-2">
                            <div className="text-xs text-gray-600">
                                <Link2 size={12} className="inline mr-1" />
                                Tu enlace para meter en Airbnb, Booking, Vrbo:
                            </div>
                            <button onClick={() => copyExportUrl(a.slug)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-rural-700 hover:text-primary px-3 py-1.5 rounded-lg hover:bg-rural-50">
                                <Copy size={12} /> Copiar enlace
                            </button>
                        </div>
                    </li>
                ))}
            </ul>}
        </div>
    );
};

// Panel visual del resultado del sync (en vez de JSON crudo).
const SyncResultPanel = ({ result }) => {
    if (result.error) {
        return (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
                <p className="font-bold">Error durante la sincronización</p>
                <p className="font-mono text-xs mt-1">{result.error}</p>
            </div>
        );
    }
    const rows = result.results || [];
    const totalInserted = rows.reduce((acc, r) => acc + (r.airbnb?.inserted || 0) + (r.booking?.inserted || 0), 0);
    const totalRemoved = rows.reduce((acc, r) => acc + (r.airbnb?.removed || 0) + (r.booking?.removed || 0), 0);
    const syncedAt = result.syncedAt ? new Date(result.syncedAt).toLocaleString('es-ES') : null;

    return (
        <div className="mb-6 rounded-2xl bg-rural-50 border border-rural-100 p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <p className="font-bold text-text-primary">
                    Sincronización completada
                    {syncedAt && <span className="ml-2 text-xs text-gray-500 font-normal">· {syncedAt}</span>}
                </p>
                <p className="text-sm text-gray-700">
                    <span className="font-bold text-rural-700">+{totalInserted}</span> bloque{totalInserted !== 1 ? 's' : ''} importado{totalInserted !== 1 ? 's' : ''}
                    {' · '}
                    <span className="font-bold text-gray-500">−{totalRemoved}</span> retirado{totalRemoved !== 1 ? 's' : ''}
                </p>
            </div>

            {rows.length === 0 ? (
                <p className="text-sm text-gray-600">Sin apartamentos configurados con URLs iCal todavía.</p>
            ) : (
                <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-widest font-bold text-gray-500">
                        <tr>
                            <th className="text-left py-2">Apartamento</th>
                            <th className="text-center py-2">Airbnb</th>
                            <th className="text-center py-2">Booking</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.apartment} className="border-t border-rural-100">
                                <td className="py-2 font-medium text-text-primary capitalize">{r.apartment}</td>
                                <td className="py-2 text-center"><SourceBadge data={r.airbnb} /></td>
                                <td className="py-2 text-center"><SourceBadge data={r.booking} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

const SourceBadge = ({ data }) => {
    if (!data) return <span className="text-xs text-gray-400">—</span>;
    if (data.fetched === false) return <span className="text-xs text-amber-700">no se pudo descargar</span>;
    return (
        <span className="text-xs text-gray-700">
            <span className="font-bold text-rural-700">+{data.inserted ?? 0}</span>
            {' / '}
            <span className="font-bold text-gray-500">−{data.removed ?? 0}</span>
            <span className="block text-[10px] text-gray-400">{data.parsed ?? 0} en feed</span>
        </span>
    );
};

const UrlField = ({ label, icon: Icon, value, onChange, count, sourceLabel }) => {
    const [local, setLocal] = useState(value);
    useEffect(() => { setLocal(value); }, [value]);
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1">
                    <Icon size={12} aria-hidden="true" /> {label}
                </span>
                {count > 0 && (
                    <span className="text-[10px] font-bold text-rural-700 bg-rural-50 px-2 py-0.5 rounded-full">
                        {count} bloque{count !== 1 ? 's' : ''} sincronizado{count !== 1 ? 's' : ''}
                    </span>
                )}
            </div>
            <div className="flex gap-2">
                <input type="url" value={local} onChange={(e) => setLocal(e.target.value)}
                    placeholder={`https://...${sourceLabel.toLowerCase()}.../calendar.ics`}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono outline-none focus:border-primary" />
                {local !== value && (
                    <button type="button" onClick={() => onChange(local)}
                        className="text-xs font-bold text-white bg-primary px-3 py-2 rounded-lg">Guardar</button>
                )}
            </div>
        </div>
    );
};

export default ChannelSyncManager;

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, RefreshCw, Shield, Download, Send } from 'lucide-react';

const STATUS_CLS = {
    null:                   'bg-gray-100 text-gray-600 border-gray-200',
    pending:                'bg-amber-50 text-amber-700 border-amber-200',
    stub_no_credentials:    'bg-blue-50 text-blue-700 border-blue-200',
    ok:                     'bg-green-50 text-green-700 border-green-200',
    error:                  'bg-red-50 text-red-700 border-red-200',
    retry:                  'bg-amber-50 text-amber-700 border-amber-200',
};

const TravelersManager = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('traveler_records')
            .select(`id, nombre, apellido_primero, tipo_documento, numero_documento,
                     nacionalidad, is_titular, submitted_at, mir_reference, mir_response_status,
                     created_at, booking_id,
                     guest_bookings(booking_code, check_in, check_out, status, apartments(name))`)
            .order('created_at', { ascending: false })
            .limit(200);
        setRows(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = rows.filter(r => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return `${r.nombre} ${r.apellido_primero}`.toLowerCase().includes(q)
            || (r.numero_documento || '').toLowerCase().includes(q)
            || (r.guest_bookings?.booking_code || '').toLowerCase().includes(q);
    });

    const forceSubmit = async () => {
        setBusy(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-ses-hospedajes`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({}),
            });
            if (!res.ok) alert('Error: ' + await res.text());
            else {
                const r = await res.json();
                alert(`Enviados: ${r.sent} · Errores: ${r.errors} · Stub: ${r.stubbed || 0}`);
            }
            await load();
        } finally { setBusy(false); }
    };

    const downloadXml = async (row) => {
        const { data } = await supabase.from('traveler_records').select('mir_response_payload').eq('id', row.id).single();
        const xml = data?.mir_response_payload?.xml;
        if (!xml) { alert('XML no generado aún. Solo se genera al enviar (check_in pasado).'); return; }
        const blob = new Blob([xml], { type: 'application/xml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ses-${row.guest_bookings?.booking_code || row.id}.xml`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Parte de viajeros</h1>
                    <p className="text-sm text-gray-600 max-w-2xl mt-1">
                        Los datos que la Policía (Ministerio del Interior) nos pide de cada huésped. Se envían automáticamente cuando entran. · {filtered.length} {filtered.length === 1 ? 'huésped' : 'huéspedes'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={forceSubmit} disabled={busy}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow hover:shadow-md disabled:opacity-50">
                        <Send size={14} /> {busy ? 'Enviando…' : 'Enviar a la Policía ahora'}
                    </button>
                    <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                        <RefreshCw size={14} /> Actualizar
                    </button>
                </div>
            </header>

            <div className="relative flex-1 min-w-[200px] mb-6">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nombre, DNI o reserva…"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </div>

            {loading ? (
                <p className="text-gray-500 font-serif italic">Cargando…</p>
            ) : filtered.length === 0 ? (
                <p className="text-gray-500 font-serif italic">Aún no hay viajeros registrados. Se rellenan vía /precheckin desde 7 días antes del check-in.</p>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-widest font-bold text-gray-500">
                            <tr>
                                <th className="text-left px-4 py-3">Reserva</th>
                                <th className="text-left px-4 py-3">Huésped</th>
                                <th className="text-left px-4 py-3">Documento</th>
                                <th className="text-left px-4 py-3">Apartamento</th>
                                <th className="text-left px-4 py-3">Fechas estancia</th>
                                <th className="text-center px-4 py-3">¿Enviado a la Policía?</th>
                                <th className="text-right px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => (
                                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono text-xs text-primary font-bold">{r.guest_bookings?.booking_code}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-text-primary font-medium">{r.nombre} {r.apellido_primero}</span>
                                        {r.is_titular && <span className="ml-2 text-[10px] uppercase font-bold text-primary">Titular</span>}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-700">
                                        <span className="font-mono">{r.numero_documento}</span>
                                        <span className="block text-gray-500 text-[10px]">{r.tipo_documento} · {r.nacionalidad}</span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{r.guest_bookings?.apartments?.name}</td>
                                    <td className="px-4 py-3 text-xs tabular-nums text-gray-700">{r.guest_bookings?.check_in} → {r.guest_bookings?.check_out}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${STATUS_CLS[r.mir_response_status] || STATUS_CLS.null}`}>
                                            {r.submitted_at ? r.mir_response_status : 'pendiente'}
                                        </span>
                                        {r.mir_reference && <span className="block font-mono text-[9px] text-gray-500 mt-0.5">{r.mir_reference}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => downloadXml(r)} title="Descargar XML"
                                            className="inline-flex items-center gap-1 text-xs text-rural-700 hover:text-primary px-2 py-1 rounded hover:bg-rural-50">
                                            <Download size={12} /> XML
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default TravelersManager;

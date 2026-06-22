import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, RefreshCw, FileCheck, ExternalLink, Download } from 'lucide-react';

const STATUS_CLS = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    stub:    'bg-blue-50 text-blue-700 border-blue-200',
    sent:    'bg-green-50 text-green-700 border-green-200',
    error:   'bg-red-50 text-red-700 border-red-200',
    retry:   'bg-amber-50 text-amber-700 border-amber-200',
};

const fmtEur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(n) || 0);

const InvoicesManager = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('invoices')
            .select(`id, serie, numero, fecha_emision, tipo,
                     receptor_nif, receptor_nombre, receptor_email,
                     concepto, base_imponible, tipo_iva, cuota_iva, total,
                     verifactu_status, verifactu_sent_at, verifactu_hash,
                     booking_id, guest_bookings(booking_code, guest_name)`)
            .order('fecha_emision', { ascending: false })
            .order('numero', { ascending: false })
            .limit(200);
        setInvoices(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = invoices.filter(i => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return `${i.serie}-${i.numero}`.toLowerCase().includes(q)
            || (i.receptor_nombre || '').toLowerCase().includes(q)
            || (i.receptor_nif || '').toLowerCase().includes(q)
            || (i.guest_bookings?.booking_code || '').toLowerCase().includes(q);
    });

    const resendVerifactu = async (invoiceId) => {
        setBusy(invoiceId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-verifactu`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ invoiceId }),
            });
            if (!res.ok) alert('Error reenviando Verifactu: ' + await res.text());
            await load();
        } finally { setBusy(null); }
    };

    const downloadXml = async (invoice) => {
        const { data } = await supabase.from('invoices').select('verifactu_response').eq('id', invoice.id).single();
        const xml = data?.verifactu_response?.xml;
        if (!xml) { alert('No hay XML almacenado todavía.'); return; }
        const blob = new Blob([xml], { type: 'application/xml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `verifactu-${invoice.serie}-${invoice.numero}.xml`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Facturas</h1>
                    <p className="text-sm text-gray-500">Correlativas + Verifactu hash chain · {filtered.length} factura{filtered.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                    <RefreshCw size={14} /> Recargar
                </button>
            </header>

            <div className="relative flex-1 min-w-[200px] mb-6">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por serie-número, NIF o huésped…"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </div>

            {loading ? (
                <p className="text-gray-500 font-serif italic">Cargando facturas…</p>
            ) : filtered.length === 0 ? (
                <p className="text-gray-500 font-serif italic">Aún no hay facturas. Se emiten automáticamente al confirmar el pago de una reserva.</p>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-widest font-bold text-gray-500">
                            <tr>
                                <th className="text-left px-4 py-3">Nº</th>
                                <th className="text-left px-4 py-3">Fecha</th>
                                <th className="text-left px-4 py-3">Reserva</th>
                                <th className="text-left px-4 py-3">Receptor</th>
                                <th className="text-right px-4 py-3">Base</th>
                                <th className="text-right px-4 py-3">IVA</th>
                                <th className="text-right px-4 py-3">Total</th>
                                <th className="text-center px-4 py-3">Verifactu</th>
                                <th className="text-right px-4 py-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(i => (
                                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono text-primary text-xs font-bold">{i.serie}-{i.numero}</td>
                                    <td className="px-4 py-3 tabular-nums text-gray-700">{i.fecha_emision}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{i.guest_bookings?.booking_code}</td>
                                    <td className="px-4 py-3 text-text-primary">
                                        {i.receptor_nombre || <span className="italic text-gray-400">Anónimo</span>}
                                        {i.receptor_nif && <span className="block text-[10px] text-gray-500 font-mono">{i.receptor_nif}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">{fmtEur(i.base_imponible)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{i.tipo_iva}% · {fmtEur(i.cuota_iva)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums font-bold">{fmtEur(i.total)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${STATUS_CLS[i.verifactu_status] || STATUS_CLS.pending}`}>
                                            {i.verifactu_status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        <button onClick={() => downloadXml(i)} title="Descargar XML"
                                            className="inline-flex items-center gap-1 text-xs text-rural-700 hover:text-primary px-2 py-1 rounded hover:bg-rural-50">
                                            <Download size={12} aria-hidden="true" /> XML
                                        </button>
                                        {(i.verifactu_status === 'error' || i.verifactu_status === 'retry') && (
                                            <button onClick={() => resendVerifactu(i.id)} disabled={busy === i.id}
                                                className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 px-2 py-1 rounded hover:bg-amber-50 ml-1">
                                                <FileCheck size={12} /> {busy === i.id ? '…' : 'Reintentar'}
                                            </button>
                                        )}
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

export default InvoicesManager;

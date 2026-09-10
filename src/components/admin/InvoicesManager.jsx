import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Search, RefreshCw, Download, FileText, Mail, Undo2,
    Plus, X, FileSpreadsheet, AlertTriangle, CheckCircle2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Facturas — panel completo (Jesús). La pantalla de la madre es otra: ella sólo
// ve "Hacer factura" y "Mandarla" en la ficha de la reserva, y llama a la misma
// edge function `issue-invoice` (acciones `issue` y `send`).
//
// Series y numeración: se guardan como serie='A2026' + numero=1,2,3… y se
// muestran como A-2026-0001. La única fuente de esa regla es
// `supabase/functions/issue-invoice/config.ts`; aquí sólo se formatea.
// ---------------------------------------------------------------------------

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/issue-invoice`;

const fmtEur = (n) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(n) || 0);

const fmtFecha = (iso) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
};

/** 'A2026' + 1 → 'A-2026-0001' (espejo de config.ts en la edge function) */
const numeroFactura = (serie, numero) => {
    const m = /^([A-Z]+)(\d{4})$/.exec(serie || '');
    const n = String(numero ?? '').padStart(4, '0');
    return m ? `${m[1]}-${m[2]}-${n}` : `${serie}-${n}`;
};

const METODO_LABEL = {
    transferencia: 'Transferencia',
    bizum: 'Bizum',
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    stripe: 'Tarjeta (web)',
    booking: 'Lo paga Booking',
    ota: 'Lo paga el portal',
    tpv: 'TPV',
};

const mesActual = () => new Date().toISOString().slice(0, 7);

async function llamarFuncion(payload) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
    });
    let body = null;
    try { body = await res.json(); } catch { /* respuesta sin JSON */ }
    if (!res.ok) {
        throw new Error(body?.detalle || body?.error || `Error ${res.status}`);
    }
    return body;
}

const InvoicesManager = () => {
    const [invoices, setInvoices] = useState([]);
    const [pagosPorReserva, setPagosPorReserva] = useState({});
    const [sinFacturar, setSinFacturar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [mes, setMes] = useState(mesActual());
    const [busy, setBusy] = useState(null);
    const [aviso, setAviso] = useState(null);          // { tipo: 'ok'|'error', texto }
    const [modalEmitir, setModalEmitir] = useState(false);
    const [modalRectificar, setModalRectificar] = useState(null); // factura
    const [motivo, setMotivo] = useState('');
    const [importeAbono, setImporteAbono] = useState('');

    // -----------------------------------------------------------------------
    const load = useCallback(async () => {
        setLoading(true);

        const { data: facturas } = await supabase
            .from('invoices')
            .select(`id, serie, numero, fecha_emision, tipo,
                     receptor_nif, receptor_nombre, receptor_email,
                     concepto, base_imponible, tipo_iva, cuota_iva, total,
                     rectifica_invoice_id, motivo_rectificacion,
                     pdf_url, email_sent_at, verifactu_status,
                     booking_id, guest_bookings(booking_code, guest_name, total_price, check_in)`)
            .order('fecha_emision', { ascending: false })
            .order('numero', { ascending: false })
            .limit(500);

        const filas = facturas || [];
        setInvoices(filas);

        // Cobros de las reservas facturadas (para el estado y el CSV)
        const ids = [...new Set(filas.map((f) => f.booking_id).filter(Boolean))];
        if (ids.length) {
            const { data: pagos } = await supabase
                .from('booking_payments')
                .select('booking_id, amount, method, paid_on')
                .in('booking_id', ids);
            const agrupado = {};
            for (const p of pagos || []) {
                const g = agrupado[p.booking_id] || (agrupado[p.booking_id] = { cobrado: 0, metodos: new Set(), ultimo: null });
                g.cobrado += Number(p.amount) || 0;
                if (p.method) g.metodos.add(String(p.method).toLowerCase());
                if (!g.ultimo || p.paid_on > g.ultimo) g.ultimo = p.paid_on;
            }
            setPagosPorReserva(agrupado);
        } else {
            setPagosPorReserva({});
        }

        // Reservas facturables que todavía no tienen factura
        const { data: reservas } = await supabase
            .from('guest_bookings')
            .select('id, booking_code, guest_name, guest_email, check_in, check_out, total_price, status, apartments(name)')
            .in('status', ['confirmed', 'completed'])
            .order('check_in', { ascending: false })
            .limit(200);
        const conFactura = new Set(filas.filter((f) => f.tipo !== 'rectificativa').map((f) => f.booking_id));
        setSinFacturar((reservas || []).filter((r) => !conFactura.has(r.id)));

        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!aviso) return undefined;
        const t = setTimeout(() => setAviso(null), 6000);
        return () => clearTimeout(t);
    }, [aviso]);

    // -----------------------------------------------------------------------
    const cobroDe = useCallback((factura) => {
        if (factura.tipo === 'rectificativa') return null;
        const total = Number(factura.total) || 0;
        const g = pagosPorReserva[factura.booking_id];
        const cobrado = g ? Math.round(g.cobrado * 100) / 100 : 0;
        const pendiente = Math.round((total - cobrado) * 100) / 100;
        const metodos = g ? [...g.metodos].map((m) => METODO_LABEL[m] || m) : [];
        return {
            cobrado,
            pendiente,
            pagada: pendiente <= 0,
            formaPago: metodos.length ? metodos.join(' + ') : '—',
            fechaCobro: g?.ultimo || null,
        };
    }, [pagosPorReserva]);

    const filtradas = useMemo(() => invoices.filter((i) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return numeroFactura(i.serie, i.numero).toLowerCase().includes(q)
            || (i.receptor_nombre || '').toLowerCase().includes(q)
            || (i.receptor_nif || '').toLowerCase().includes(q)
            || (i.guest_bookings?.booking_code || '').toLowerCase().includes(q);
    }), [invoices, query]);

    const delMes = useMemo(
        () => invoices.filter((i) => String(i.fecha_emision).slice(0, 7) === mes),
        [invoices, mes],
    );

    const totalesMes = useMemo(() => delMes.reduce((acc, i) => ({
        base: acc.base + Number(i.base_imponible || 0),
        iva: acc.iva + Number(i.cuota_iva || 0),
        total: acc.total + Number(i.total || 0),
    }), { base: 0, iva: 0, total: 0 }), [delMes]);

    // ------------------------------------------------------------- acciones
    const descargarPdf = async (factura) => {
        setBusy(factura.id);
        try {
            const r = await llamarFuncion({ action: 'pdf_url', invoiceId: factura.id });
            window.open(r.url, '_blank', 'noopener');
        } catch (e) {
            setAviso({ tipo: 'error', texto: `No se pudo abrir el PDF: ${e.message}` });
        } finally { setBusy(null); }
    };

    const reenviarEmail = async (factura) => {
        const destino = factura.receptor_email || factura.guest_bookings?.guest_name;
        if (!window.confirm(`¿Volver a mandar la factura ${numeroFactura(factura.serie, factura.numero)} a ${factura.receptor_email || 'el huésped'}?`)) return;
        if (!destino) return;
        setBusy(factura.id);
        try {
            const r = await llamarFuncion({ action: 'send', invoiceId: factura.id, force: true });
            setAviso(r?.email?.sent
                ? { tipo: 'ok', texto: `Factura enviada a ${factura.receptor_email}.` }
                : { tipo: 'error', texto: `No se envió: ${r?.email?.error || r?.email?.skipped || 'motivo desconocido'}` });
            await load();
        } catch (e) {
            setAviso({ tipo: 'error', texto: `No se pudo enviar: ${e.message}` });
        } finally { setBusy(null); }
    };

    const emitir = async (reserva, mandar) => {
        setBusy(reserva.id);
        try {
            const r = await llamarFuncion({
                action: mandar ? 'issue_and_send' : 'issue',
                bookingId: reserva.id,
            });
            setAviso({
                tipo: 'ok',
                texto: `Factura ${r.invoice.numero} ${r.created ? 'emitida' : 'ya existía'}`
                    + (mandar ? (r.email?.sent ? ' y enviada por email.' : ` (el email no salió: ${r.email?.error || r.email?.skipped}).`) : '.'),
            });
            setModalEmitir(false);
            await load();
        } catch (e) {
            setAviso({ tipo: 'error', texto: `No se pudo emitir: ${e.message}` });
        } finally { setBusy(null); }
    };

    const rectificar = async () => {
        const factura = modalRectificar;
        if (!factura || motivo.trim().length < 3) return;
        setBusy(factura.id);
        try {
            const r = await llamarFuncion({
                action: 'rectify',
                invoiceId: factura.id,
                motivo: motivo.trim(),
                ...(importeAbono ? { importe: Number(String(importeAbono).replace(',', '.')) } : {}),
            });
            setAviso({ tipo: 'ok', texto: `Rectificativa ${r.invoice.numero} emitida por ${fmtEur(r.invoice.total)}.` });
            setModalRectificar(null); setMotivo(''); setImporteAbono('');
            await load();
        } catch (e) {
            setAviso({ tipo: 'error', texto: `No se pudo rectificar: ${e.message}` });
        } finally { setBusy(null); }
    };

    // --------------------------------------------------------------- export
    const exportarCsv = () => {
        const cab = [
            'Fecha', 'Serie-número', 'Tipo', 'Cliente', 'NIF',
            'Base imponible', 'Tipo IVA', 'Cuota IVA', 'Total',
            'Cobrado', 'Forma de pago', 'Reserva',
        ];
        const num = (n) => String(Number(n || 0).toFixed(2)).replace('.', ',');   // Excel ES
        const txt = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;

        const filas = delMes.map((i) => {
            const c = cobroDe(i);
            return [
                fmtFecha(i.fecha_emision),
                numeroFactura(i.serie, i.numero),
                i.tipo === 'rectificativa' ? 'Rectificativa' : (i.tipo === 'simplificada' ? 'Simplificada' : 'Completa'),
                txt(i.receptor_nombre || ''),
                txt(i.receptor_nif || ''),
                num(i.base_imponible),
                `${Number(i.tipo_iva)}%`,
                num(i.cuota_iva),
                num(i.total),
                c ? num(c.cobrado) : '',
                txt(c ? c.formaPago : ''),
                txt(i.guest_bookings?.booking_code || ''),
            ].join(';');
        });

        const totales = [
            '', '', '', txt('TOTALES DEL MES'), '',
            num(totalesMes.base), '', num(totalesMes.iva), num(totalesMes.total), '', '', '',
        ].join(';');

        const csv = '﻿' + [cab.join(';'), ...filas, '', totales].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `facturas-tio-jose-maria-${mes}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    // ----------------------------------------------------------------- render
    return (
        <div className="max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Facturas</h1>
                    <p className="text-sm text-gray-600">
                        Serie A, numeración correlativa por año · {invoices.length} {invoices.length === 1 ? 'factura' : 'facturas'}
                        {sinFacturar.length > 0 && (
                            <> · <span className="text-amber-700 font-bold">{sinFacturar.length} {sinFacturar.length === 1 ? 'reserva sin facturar' : 'reservas sin facturar'}</span></>
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setModalEmitir(true)}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary hover:bg-rural-700 px-4 py-2 rounded-xl">
                        <Plus size={15} aria-hidden="true" /> Hacer factura
                    </button>
                    <button onClick={load}
                        className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary px-3 py-2">
                        <RefreshCw size={14} aria-hidden="true" /> Actualizar
                    </button>
                </div>
            </header>

            {aviso && (
                <div className={`mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                    aviso.tipo === 'ok'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {aviso.tipo === 'ok'
                        ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                        : <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
                    <span>{aviso.texto}</span>
                    <button onClick={() => setAviso(null)} className="ml-auto opacity-60 hover:opacity-100" aria-label="Cerrar aviso">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Cierre del mes para la gestoría */}
            <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <label htmlFor="mes-gestoria" className="text-xs uppercase tracking-widest font-bold text-gray-500">Mes</label>
                    <input id="mes-gestoria" type="month" value={mes} onChange={(e) => setMes(e.target.value)}
                        className="px-3 py-2 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </div>
                <div className="text-sm text-gray-700">
                    <span className="font-bold">{delMes.length}</span> {delMes.length === 1 ? 'factura' : 'facturas'} ·
                    {' '}Base <span className="tabular-nums font-bold">{fmtEur(totalesMes.base)}</span> ·
                    {' '}IVA <span className="tabular-nums font-bold">{fmtEur(totalesMes.iva)}</span> ·
                    {' '}Total <span className="tabular-nums font-bold text-primary">{fmtEur(totalesMes.total)}</span>
                </div>
                <button onClick={exportarCsv} disabled={delMes.length === 0}
                    className="ml-auto inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary border border-gray-100 rounded-xl px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    <FileSpreadsheet size={15} aria-hidden="true" /> Exportar para la gestoría (CSV)
                </button>
            </div>

            <div className="relative mb-6">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por número de factura, NIF, huésped o código de reserva…"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </div>

            {loading ? (
                <p className="text-gray-500 font-serif italic">Cargando facturas…</p>
            ) : filtradas.length === 0 ? (
                <p className="text-gray-500 font-serif italic">
                    {invoices.length === 0
                        ? 'Aún no hay facturas. Se emiten solas al cobrarse una reserva por la web, o a mano con «Hacer factura».'
                        : 'Ninguna factura coincide con la búsqueda.'}
                </p>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-widest font-bold text-gray-500">
                            <tr>
                                <th className="text-left px-4 py-3">Nº factura</th>
                                <th className="text-left px-4 py-3">Fecha</th>
                                <th className="text-left px-4 py-3">Reserva</th>
                                <th className="text-left px-4 py-3">A nombre de</th>
                                <th className="text-right px-4 py-3">Base</th>
                                <th className="text-right px-4 py-3">IVA</th>
                                <th className="text-right px-4 py-3">Total</th>
                                <th className="text-left px-4 py-3">Cobro</th>
                                <th className="text-left px-4 py-3">Email</th>
                                <th className="text-right px-4 py-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtradas.map((i) => {
                                const c = cobroDe(i);
                                const esRect = i.tipo === 'rectificativa';
                                return (
                                    <tr key={i.id} className={`border-b border-gray-50 hover:bg-gray-50 ${esRect ? 'bg-rose-50/40' : ''}`}>
                                        <td className="px-4 py-3 font-mono text-xs font-bold whitespace-nowrap">
                                            <span className={esRect ? 'text-rose-700' : 'text-primary'}>
                                                {numeroFactura(i.serie, i.numero)}
                                            </span>
                                            {esRect && <span className="block text-[10px] font-sans font-normal text-rose-600">Rectificativa</span>}
                                            {i.tipo === 'simplificada' && <span className="block text-[10px] font-sans font-normal text-gray-400">Simplificada</span>}
                                        </td>
                                        <td className="px-4 py-3 tabular-nums text-gray-700 whitespace-nowrap">{fmtFecha(i.fecha_emision)}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{i.guest_bookings?.booking_code || '—'}</td>
                                        <td className="px-4 py-3 text-text-primary">
                                            {i.receptor_nombre || <span className="italic text-gray-400">Sin nombre</span>}
                                            {i.receptor_nif && <span className="block text-[10px] text-gray-500 font-mono">{i.receptor_nif}</span>}
                                            {esRect && i.motivo_rectificacion && (
                                                <span className="block text-[10px] text-rose-600 italic max-w-[220px]">{i.motivo_rectificacion}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">{fmtEur(i.base_imponible)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-gray-600 whitespace-nowrap">
                                            {Number(i.tipo_iva)} % · {fmtEur(i.cuota_iva)}
                                        </td>
                                        <td className={`px-4 py-3 text-right tabular-nums font-bold ${esRect ? 'text-rose-700' : ''}`}>{fmtEur(i.total)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {!c ? <span className="text-gray-400">—</span> : (
                                                <>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                                                        c.pagada
                                                            ? 'bg-green-50 text-green-700 border-green-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                        {c.pagada ? 'Pagada' : 'Pendiente de cobro'}
                                                    </span>
                                                    <span className="block text-[10px] text-gray-500 mt-1">
                                                        {c.pagada ? c.formaPago : `Faltan ${fmtEur(c.pendiente)}`}
                                                    </span>
                                                </>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                                            {i.email_sent_at
                                                ? <span className="text-green-700">Enviada {fmtFecha(i.email_sent_at)}</span>
                                                : <span className="text-gray-400">Sin enviar</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <button onClick={() => descargarPdf(i)} disabled={busy === i.id} title="Ver o descargar el PDF"
                                                className="inline-flex items-center gap-1 text-xs text-rural-700 hover:text-primary px-2 py-1 rounded hover:bg-rural-50 disabled:opacity-40">
                                                <Download size={12} aria-hidden="true" /> PDF
                                            </button>
                                            <button onClick={() => reenviarEmail(i)} disabled={busy === i.id || !i.receptor_email}
                                                title={i.receptor_email ? `Mandársela otra vez a ${i.receptor_email}` : 'Esta factura no tiene email de destino'}
                                                className="inline-flex items-center gap-1 text-xs text-rural-700 hover:text-primary px-2 py-1 rounded hover:bg-rural-50 ml-1 disabled:opacity-40">
                                                <Mail size={12} aria-hidden="true" /> {i.email_sent_at ? 'Reenviar' : 'Mandar'}
                                            </button>
                                            {!esRect && !invoices.some((r) => r.rectifica_invoice_id === i.id) && (
                                                <button onClick={() => { setModalRectificar(i); setMotivo(''); setImporteAbono(''); }}
                                                    disabled={busy === i.id} title="Emitir una factura rectificativa (abono)"
                                                    className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900 px-2 py-1 rounded hover:bg-rose-50 ml-1 disabled:opacity-40">
                                                    <Undo2 size={12} aria-hidden="true" /> Rectificar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="mt-4 text-xs text-gray-400">
                Verifactu (AEAT) todavía no está activo: cada factura guarda ya su huella encadenada, lista para enviarse
                cuando haya certificado fiscal y toque por calendario.
            </p>

            {/* ---------------------------------------------- Modal: hacer factura */}
            {modalEmitir && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
                    role="dialog" aria-modal="true" aria-labelledby="titulo-emitir">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mt-12">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 id="titulo-emitir" className="font-serif text-xl font-bold text-text-primary">Hacer una factura</h2>
                            <button onClick={() => setModalEmitir(false)} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6">
                            {sinFacturar.length === 0 ? (
                                <p className="text-gray-500 font-serif italic">Todas las reservas confirmadas tienen ya su factura.</p>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Reservas confirmadas que aún no tienen factura. El NIF y la dirección salen solos del
                                        precheckin del huésped si lo rellenó.
                                    </p>
                                    <div className="max-h-[50vh] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                                        {sinFacturar.map((r) => (
                                            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50">
                                                <div className="min-w-[220px] flex-1">
                                                    <p className="font-bold text-text-primary text-sm">{r.guest_name || 'Sin nombre'}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {r.apartments?.name} · {fmtFecha(r.check_in)} → {fmtFecha(r.check_out)} ·
                                                        {' '}<span className="font-mono">{r.booking_code || `#${r.id}`}</span>
                                                    </p>
                                                </div>
                                                <span className="tabular-nums font-bold text-sm">{fmtEur(r.total_price)}</span>
                                                <button onClick={() => emitir(r, false)} disabled={busy === r.id}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-rural-700 hover:text-primary border border-gray-100 rounded-lg px-3 py-1.5 disabled:opacity-40">
                                                    <FileText size={12} aria-hidden="true" /> Solo hacerla
                                                </button>
                                                <button onClick={() => emitir(r, true)} disabled={busy === r.id || !r.guest_email}
                                                    title={r.guest_email ? `Hacerla y mandarla a ${r.guest_email}` : 'Esta reserva no tiene email'}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-white bg-primary hover:bg-rural-700 rounded-lg px-3 py-1.5 disabled:opacity-40">
                                                    <Mail size={12} aria-hidden="true" /> Hacerla y mandarla
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ------------------------------------------ Modal: rectificativa */}
            {modalRectificar && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
                    role="dialog" aria-modal="true" aria-labelledby="titulo-rectificar">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mt-16">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 id="titulo-rectificar" className="font-serif text-xl font-bold text-text-primary">
                                Rectificar {numeroFactura(modalRectificar.serie, modalRectificar.numero)}
                            </h2>
                            <button onClick={() => setModalRectificar(null)} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                Se emite una factura de abono en la serie R (R-{new Date().getFullYear()}-…) que corrige a
                                ésta. La factura original no se toca ni se borra: así lo exige la normativa.
                            </p>
                            <div>
                                <label htmlFor="motivo-rect" className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-1">
                                    Motivo (obligatorio)
                                </label>
                                <textarea id="motivo-rect" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
                                    placeholder="Cancelación de la reserva, error en el importe, datos fiscales incorrectos…"
                                    className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                            </div>
                            <div>
                                <label htmlFor="importe-rect" className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-1">
                                    Importe a abonar
                                </label>
                                <input id="importe-rect" type="text" inputMode="decimal" value={importeAbono}
                                    onChange={(e) => setImporteAbono(e.target.value)}
                                    placeholder={`Vacío = la factura entera (${fmtEur(modalRectificar.total)})`}
                                    className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                                <p className="text-xs text-gray-400 mt-1">Déjalo vacío para anular la factura completa.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                            <button onClick={() => setModalRectificar(null)}
                                className="text-sm font-bold text-gray-500 hover:text-gray-800 px-4 py-2">Cancelar</button>
                            <button onClick={rectificar} disabled={motivo.trim().length < 3 || busy === modalRectificar.id}
                                className="inline-flex items-center gap-2 text-sm font-bold text-white bg-rose-700 hover:bg-rose-800 px-4 py-2 rounded-xl disabled:opacity-40">
                                <Undo2 size={14} aria-hidden="true" /> Emitir rectificativa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoicesManager;

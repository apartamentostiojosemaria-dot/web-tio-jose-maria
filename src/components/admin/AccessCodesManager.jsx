import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, KeyRound, Trash2 } from 'lucide-react';

const STATUS_CLS = {
    pending_provision: 'bg-amber-50 text-amber-700 border-amber-200',
    active:            'bg-green-50 text-green-700 border-green-200',
    expired:           'bg-gray-100 text-gray-500 border-gray-200',
    revoked:           'bg-red-50 text-red-700 border-red-200',
    error:             'bg-red-50 text-red-700 border-red-200',
};

const AccessCodesManager = () => {
    const [codes, setCodes] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('access_codes')
            .select(`id, code, lock_provider, lock_device_id, valid_from, valid_until,
                     status, provider_ref, sent_to_guest_at, created_at,
                     booking_id, apartments(name),
                     guest_bookings(booking_code, guest_name, check_in, check_out)`)
            .order('valid_from', { ascending: false })
            .limit(100);
        setCodes(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const revoke = async (id) => {
        if (!confirm('¿Revocar este código? El huésped no podrá usarlo.')) return;
        await supabase.from('access_codes').update({ status: 'revoked' }).eq('id', id);
        await load();
    };

    return (
        <div className="max-w-6xl">
            <header className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-text-primary">Códigos de cerradura</h1>
                    <p className="text-sm text-gray-600">Sin uso actualmente: el check-in en Tío José María es en persona · {codes.length} {codes.length === 1 ? 'código' : 'códigos'}</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-rural-700 hover:text-primary">
                    <RefreshCw size={14} /> Recargar
                </button>
            </header>

            {loading ? <p className="text-gray-500 font-serif italic">Cargando…</p> :
             codes.length === 0 ? <p className="text-gray-500 font-serif italic">Aún no hay códigos. Se generan al provisionar una reserva.</p> :
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-widest font-bold text-gray-500">
                        <tr>
                            <th className="text-left px-4 py-3">Reserva</th>
                            <th className="text-left px-4 py-3">Apartamento</th>
                            <th className="text-left px-4 py-3">Huésped</th>
                            <th className="text-left px-4 py-3">Validez</th>
                            <th className="text-left px-4 py-3">Cerradura</th>
                            <th className="text-center px-4 py-3">Código</th>
                            <th className="text-center px-4 py-3">Estado</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {codes.map(c => (
                            <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs text-primary font-bold">{c.guest_bookings?.booking_code}</td>
                                <td className="px-4 py-3 text-text-primary">{c.apartments?.name}</td>
                                <td className="px-4 py-3 text-gray-700">{c.guest_bookings?.guest_name}</td>
                                <td className="px-4 py-3 text-xs tabular-nums text-gray-700">
                                    {new Date(c.valid_from).toLocaleDateString('es-ES')} → {new Date(c.valid_until).toLocaleDateString('es-ES')}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600">
                                    <span className="font-bold">{c.lock_provider}</span>
                                    {c.lock_device_id && <span className="block font-mono text-[10px] text-gray-500">{c.lock_device_id}</span>}
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-base font-bold tracking-widest text-primary">
                                    {c.status === 'revoked' ? '——' : c.code}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${STATUS_CLS[c.status] || STATUS_CLS.error}`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {c.status === 'active' && (
                                        <button onClick={() => revoke(c.id)} className="text-red-500 hover:text-red-700 p-1" title="Revocar">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>}
        </div>
    );
};

export default AccessCodesManager;

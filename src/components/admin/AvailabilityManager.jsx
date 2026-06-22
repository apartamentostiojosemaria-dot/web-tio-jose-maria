import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

import { regenerateICalExport } from '../../utils/syncService';
import { logError, userErrorMessage } from '../../utils/logger';
import {
    ChevronLeft, ChevronRight,
    Lock, Trash2, AlertCircle, Loader2, X, Home,
} from 'lucide-react';

// ────────────── Utilidades de fecha (string YYYY-MM-DD, sin timezones) ──────────────
const ymd = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};
const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS_ES = ['L','M','X','J','V','S','D'];
const firstWeekdayMon0 = (year, month) => ((new Date(year, month, 1).getDay()) + 6) % 7;
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const formatHuman = (s) => fromYmd(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

// Motivos sugeridos. El operador puede teclear cualquier cosa.
const COMMON_REASONS = ['Vacaciones familiares', 'Mantenimiento', 'Uso propio', 'Avería', 'Limpieza profunda', 'Sin disponibilidad de gestores'];

const AvailabilityManager = () => {
    const [apartments, setApartments] = useState([]);
    const [selectedApt, setSelectedApt] = useState(null);
    const [blockedDates, setBlockedDates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
    const [selStart, setSelStart] = useState(null);   // YYYY-MM-DD
    const [selEnd, setSelEnd] = useState(null);       // YYYY-MM-DD
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => { fetchApartments(); }, []);

    useEffect(() => {
        if (selectedApt) {
            setBlockedDates([]);
            setSelStart(null); setSelEnd(null); setReason('');
            fetchBlockedDates(selectedApt.id);
        }
    }, [selectedApt?.id]);

    async function fetchApartments() {
        const { data } = await supabase.from('apartments').select('*').order('name');
        if (data) {
            setApartments(data);
            if (data.length > 0) setSelectedApt(data[0]);
        }
    }

    async function fetchBlockedDates(aptId) {
        setLoading(true);
        const { data } = await supabase.from('blocked_dates').select('*').eq('apartment_id', aptId);
        if (data) setBlockedDates(data);
        setLoading(false);
    }

    // ────── Mapa día → bloqueo (para colorear el calendario) ──────
    const dayBlockMap = (() => {
        const map = new Map();
        for (const b of blockedDates) {
            let cur = fromYmd(b.start_date);
            const stop = fromYmd(b.end_date);
            while (cur <= stop) {
                map.set(ymd(cur), b);
                cur.setDate(cur.getDate() + 1);
            }
        }
        return map;
    })();

    const handleDateClick = (dayNum) => {
        const dateKey = ymd(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNum));

        // Si la fecha está bloqueada por Airbnb/Booking, no permitir seleccionar
        const existing = dayBlockMap.get(dateKey);
        if (existing && existing.source !== 'manual') {
            alert(`Estas fechas vienen importadas de ${existing.source}. No se pueden seleccionar aquí; gestiónalas desde su plataforma.`);
            return;
        }

        if (!selStart || (selStart && selEnd)) {
            // Primer clic o reinicio
            setSelStart(dateKey);
            setSelEnd(null);
        } else if (dateKey < selStart) {
            setSelStart(dateKey);
            setSelEnd(null);
        } else {
            setSelEnd(dateKey);
        }
    };

    const isInSelection = (dateKey) => {
        if (!selStart) return false;
        if (selStart && !selEnd) return dateKey === selStart;
        return dateKey >= selStart && dateKey <= (selEnd || selStart);
    };

    const handleBlock = async () => {
        if (!selStart || !selEnd) return;
        setIsSaving(true);
        const { error } = await supabase.from('blocked_dates').insert([{
            apartment_id: selectedApt.id,
            start_date: selStart,
            end_date: selEnd,
            source: 'manual',
            reason: reason.trim() || null,
        }]);

        if (error) {
            logError('handleBlock', error);
            alert(userErrorMessage('Error al bloquear las fechas.'));
        } else {
            setSelStart(null); setSelEnd(null); setReason('');
            fetchBlockedDates(selectedApt.id);
            await regenerateICalExport(selectedApt);
        }
        setIsSaving(false);
    };

    const handleDeleteBlock = async (id) => {
        if (!window.confirm('¿Quieres quitar este bloqueo?')) return;
        const { error } = await supabase.from('blocked_dates').delete().eq('id', id);
        if (!error) {
            fetchBlockedDates(selectedApt.id);
            await regenerateICalExport(selectedApt);
        }
    };

    const resetSelection = () => { setSelStart(null); setSelEnd(null); setReason(''); };

    const totalDays = daysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const offset = firstWeekdayMon0(currentMonth.getFullYear(), currentMonth.getMonth());

    const manualBlocks = blockedDates.filter(b => b.source === 'manual')
        .sort((a, b) => a.start_date.localeCompare(b.start_date));
    const importedBlocks = blockedDates.filter(b => b.source !== 'manual')
        .sort((a, b) => a.start_date.localeCompare(b.start_date));

    return (
        <div className="space-y-6">
            {/* Cabecera */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-2xl font-serif font-bold text-text-primary">Bloquear fechas</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Marca como no disponibles los días que no quieres que se puedan reservar (vacaciones, mantenimiento, uso propio).
                        Estos bloqueos se envían también a Airbnb y Booking para que tampoco las ofrezcan ahí.
                    </p>
                </div>
                <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 overflow-x-auto max-w-full shrink-0">
                    {apartments.map(apt => (
                        <button
                            key={apt.id}
                            onClick={() => setSelectedApt(apt)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedApt?.id === apt.id ? 'bg-rural-700 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            {apt.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Instrucciones */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 flex gap-3 items-start">
                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-amber-900 leading-relaxed">
                    <p><strong>Cómo bloquear:</strong> haz clic en el primer día → luego en el último día del bloqueo. Aparecerá un recuadro abajo para confirmar y apuntar el motivo.</p>
                    <p className="text-xs text-amber-700 mt-1">Las fechas en rojo vienen de Airbnb o Booking — esas se gestionan desde sus plataformas, no se pueden seleccionar aquí.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendario */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                                className="p-2 hover:bg-gray-100 rounded-full" aria-label="Mes anterior"><ChevronLeft /></button>
                            <h4 className="text-2xl font-serif font-bold text-rural-900">
                                {MONTHS_ES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                            </h4>
                            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                                className="p-2 hover:bg-gray-100 rounded-full" aria-label="Mes siguiente"><ChevronRight /></button>
                        </div>

                        <div className="grid grid-cols-7 gap-2 text-center mb-3">
                            {WEEKDAYS_ES.map(d => <span key={d} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d}</span>)}
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: offset }, (_, i) => <div key={`e-${i}`} />)}
                            {Array.from({ length: totalDays }, (_, i) => {
                                const dayNum = i + 1;
                                const dateKey = ymd(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNum));
                                const block = dayBlockMap.get(dateKey);
                                const selected = isInSelection(dateKey);
                                const isToday = dateKey === ymd(new Date());

                                let cls;
                                if (block?.source === 'manual') {
                                    cls = 'bg-amber-200 text-amber-900 ring-1 ring-amber-300';
                                } else if (block) {
                                    cls = 'bg-red-100 text-red-700 line-through cursor-not-allowed';
                                } else if (selected) {
                                    cls = 'bg-rural-700 text-white shadow-md scale-105';
                                } else {
                                    cls = 'bg-gray-50 hover:bg-rural-100 text-gray-700';
                                }

                                return (
                                    <button
                                        key={dayNum}
                                        onClick={() => handleDateClick(dayNum)}
                                        className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all text-sm font-bold relative ${cls} ${isToday ? 'ring-2 ring-rural-700' : ''}`}
                                        title={block ? (block.source === 'manual' ? `Bloqueo manual${block.reason ? `: ${block.reason}` : ''}` : `Reserva de ${block.source}`) : 'Disponible'}
                                    >
                                        {dayNum}
                                        {block && (
                                            <span className="absolute bottom-1 text-[8px] uppercase font-bold opacity-70">
                                                {block.source === 'manual' ? '●' : block.source}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-6 flex flex-wrap gap-4 text-xs">
                            <Legend color="bg-gray-50 border border-gray-200" label="Disponible" />
                            <Legend color="bg-amber-200 border border-amber-300" label="Bloqueado por ti" />
                            <Legend color="bg-red-100" label="Reservado en Airbnb/Booking" />
                            <Legend color="bg-rural-700" label="Seleccionado ahora" inverted />
                        </div>
                    </div>
                </div>

                {/* Lateral: confirmación + lista */}
                <div className="space-y-4">
                    {selStart && (
                        <div className="bg-rural-900 p-6 rounded-[2rem] text-white shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <h5 className="font-serif font-bold text-xl">Bloquear estas fechas</h5>
                                <button onClick={resetSelection} className="text-white/60 hover:text-white" aria-label="Cancelar">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="space-y-2 mb-5 text-sm">
                                <Row label="Apartamento" value={selectedApt?.name} icon={<Home size={14} />} />
                                <Row label="Desde" value={formatHuman(selStart)} />
                                <Row label="Hasta" value={selEnd ? formatHuman(selEnd) : <span className="opacity-50 italic">elige día final en el calendario</span>} />
                            </div>

                            {selEnd && (
                                <>
                                    <label className="block mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1.5 block">Motivo (opcional)</span>
                                        <input
                                            type="text"
                                            value={reason}
                                            onChange={e => setReason(e.target.value)}
                                            placeholder="Ej: vacaciones familiares"
                                            className="w-full p-3 bg-white/10 border border-white/20 rounded-xl outline-none text-sm placeholder-white/40 focus:border-white/50"
                                        />
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {COMMON_REASONS.map(r => (
                                                <button key={r} type="button" onClick={() => setReason(r)}
                                                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80">
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                    </label>
                                    <button
                                        onClick={handleBlock}
                                        disabled={isSaving}
                                        className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-amber-900 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
                                        Bloquear fechas
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Lista de bloqueos del operador */}
                    <div className="bg-white p-5 rounded-[2rem] border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                            <h5 className="font-bold text-xs uppercase tracking-widest text-gray-500">Tus bloqueos</h5>
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">{manualBlocks.length}</span>
                        </div>
                        {manualBlocks.length === 0 ? (
                            <p className="text-center py-6 text-xs text-gray-400 italic">No has bloqueado fechas todavía.</p>
                        ) : (
                            <div className="space-y-2">
                                {manualBlocks.map(b => (
                                    <div key={b.id} className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-amber-900">{formatHuman(b.start_date)} → {formatHuman(b.end_date)}</p>
                                            {b.reason && <p className="text-[11px] text-amber-700 mt-0.5 truncate">{b.reason}</p>}
                                        </div>
                                        <button onClick={() => handleDeleteBlock(b.id)}
                                            className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-lg shrink-0"
                                            title="Quitar bloqueo">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Lista de fechas importadas (solo informativa) */}
                    {importedBlocks.length > 0 && (
                        <div className="bg-white p-5 rounded-[2rem] border border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                                <h5 className="font-bold text-xs uppercase tracking-widest text-gray-500">Importado de Airbnb / Booking</h5>
                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{importedBlocks.length}</span>
                            </div>
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                                {importedBlocks.slice(0, 15).map(b => (
                                    <div key={b.id} className="p-3 rounded-xl bg-red-50 border border-red-100">
                                        <p className="text-xs font-bold text-red-800">{formatHuman(b.start_date)} → {formatHuman(b.end_date)}</p>
                                        <p className="text-[10px] uppercase font-bold text-red-500">{b.source}</p>
                                    </div>
                                ))}
                                {importedBlocks.length > 15 && <p className="text-[11px] text-gray-400 italic text-center pt-2">+ {importedBlocks.length - 15} más</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Legend = ({ color, label, inverted }) => (
    <span className="flex items-center gap-1.5">
        <span className={`w-4 h-4 rounded ${color}`} />
        <span className={inverted ? 'text-gray-600' : 'text-gray-600'}>{label}</span>
    </span>
);

const Row = ({ label, value, icon }) => (
    <div className="flex justify-between items-center gap-2">
        <span className="opacity-60 flex items-center gap-1.5">{icon}{label}</span>
        <span className="font-bold text-right">{value}</span>
    </div>
);

export default AvailabilityManager;

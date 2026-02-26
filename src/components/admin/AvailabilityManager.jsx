import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { regenerateICalExport } from '../../utils/syncService';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight,
    Lock, Unlock, Info, RefreshCw, AlertCircle, Trash2, Check
} from 'lucide-react';

const AvailabilityManager = () => {
    const [apartments, setApartments] = useState([]);
    const [selectedApt, setSelectedApt] = useState(null);
    const [blockedDates, setBlockedDates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selection, setSelection] = useState({ start: null, end: null });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchApartments();
    }, []);

    useEffect(() => {
        if (selectedApt) {
            fetchBlockedDates(selectedApt.id);
        }
    }, [selectedApt]);

    async function fetchApartments() {
        const { data } = await supabase.from('apartments').select('*').order('name');
        if (data) {
            setApartments(data);
            if (data.length > 0) setSelectedApt(data[0]);
        }
    }

    async function fetchBlockedDates(aptId) {
        setLoading(true);
        const { data } = await supabase
            .from('blocked_dates')
            .select('*')
            .eq('apartment_id', aptId);
        if (data) setBlockedDates(data);
        setLoading(false);
    }

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay };
    };

    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    const isDateBlocked = (day) => {
        const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        checkDate.setHours(0, 0, 0, 0);

        return blockedDates.find(range => {
            const start = new Date(range.start_date);
            const end = new Date(range.end_date);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return checkDate >= start && checkDate <= end;
        });
    };

    const handleDateClick = (day) => {
        const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        clickedDate.setHours(0, 0, 0, 0);

        if (!selection.start || (selection.start && selection.end)) {
            setSelection({ start: clickedDate, end: null });
        } else if (clickedDate < selection.start) {
            setSelection({ start: clickedDate, end: null });
        } else {
            setSelection({ ...selection, end: clickedDate });
        }
    };

    const handleBlockDates = async () => {
        if (!selection.start || !selection.end) return;

        setIsSaving(true);
        const { error } = await supabase.from('blocked_dates').insert([{
            apartment_id: selectedApt.id,
            start_date: formatDate(selection.start),
            end_date: formatDate(selection.end),
            source: 'manual'
        }]);

        if (error) {
            alert('Error al bloquear fechas: ' + error.message);
        } else {
            setSelection({ start: null, end: null });
            fetchBlockedDates(selectedApt.id);
            // Auto-regenerar el archivo .ics para que Airbnb/Booking se enteren
            await regenerateICalExport(selectedApt);
        }
        setIsSaving(false);
    };

    const handleDeleteBlock = async (id) => {
        if (!window.confirm('¿Quieres eliminar este bloqueo manual?')) return;

        const { error } = await supabase.from('blocked_dates').delete().eq('id', id);
        if (!error) {
            fetchBlockedDates(selectedApt.id);
            // Auto-regenerar el archivo .ics para que Airbnb/Booking se enteren
            await regenerateICalExport(selectedApt);
        }
    };

    const { days, firstDay } = getDaysInMonth(currentMonth);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Gestor de Disponibilidad</h3>
                    <p className="text-sm text-gray-400">Controla manualmente las fechas ocupadas y sincronizadas</p>
                </div>
                <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 overflow-x-auto max-w-full">
                    {apartments.map(apt => (
                        <button
                            key={apt.id}
                            onClick={() => setSelectedApt(apt)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedApt?.id === apt.id
                                ? 'bg-rural-700 text-white shadow-md'
                                : 'text-gray-400 hover:bg-gray-100'
                                }`}
                        >
                            {apt.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Calendario Interactivo */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-8">
                            <h4 className="text-xl font-serif font-bold text-rural-800">
                                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                            </h4>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
                                <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight /></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-2 text-center mb-4">
                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <span key={d} className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{d}</span>)}
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                            {Array.from({ length: days }).map((_, i) => {
                                const day = i + 1;
                                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                                const blocked = isDateBlocked(day);
                                const isSelected = selection.start && selection.end && date >= selection.start && date <= selection.end;
                                const isStart = selection.start && date.getTime() === selection.start.getTime();
                                const isEnd = selection.end && date.getTime() === selection.end.getTime();

                                return (
                                    <button
                                        key={day}
                                        onClick={() => handleDateClick(day)}
                                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all relative ${blocked
                                            ? blocked.source === 'manual' ? 'bg-rural-100 text-rural-700 underline' : 'bg-red-50 text-red-400 line-through'
                                            : isSelected ? 'bg-rural-600 text-white' : isStart ? 'bg-rural-700 text-white' : 'bg-gray-50 hover:bg-rural-50 text-gray-600'
                                            }`}
                                    >
                                        <span className="text-sm font-bold">{day}</span>
                                        {blocked && <span className="text-[8px] uppercase absolute bottom-2 font-bold opacity-60">{blocked.source}</span>}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex flex-wrap gap-6 justify-center">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <div className="w-3 h-3 bg-gray-50 border border-gray-100 rounded-sm" /> Disponible
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-rural-600 uppercase tracking-widest">
                                <div className="w-3 h-3 bg-rural-100 rounded-sm" /> Reserva Manual
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-red-300 uppercase tracking-widest">
                                <div className="w-3 h-3 bg-red-50 rounded-sm" /> Airbnb / Booking
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4">
                        <AlertCircle className="text-amber-600 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-amber-900">Modo de Selección</p>
                            <p className="text-xs text-amber-700">Haz clic en la fecha de llegada y luego en la fecha de salida para bloquear un periodo. Los bloqueos manuales se guardarán permanentemente hasta que los borres.</p>
                        </div>
                    </div>
                </div>

                {/* Lateral: Acciones y Lista de Bloqueos */}
                <div className="space-y-6">
                    {selection.start && (
                        <div className="bg-rural-900 p-6 rounded-[2rem] text-white shadow-xl animate-in fade-in slide-in-from-right-4">
                            <h5 className="font-serif font-bold text-xl mb-4">Nueva Reserva Manual</h5>
                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="opacity-60">Desde:</span>
                                    <span className="font-bold">{formatDate(selection.start)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="opacity-60">Hasta:</span>
                                    <span className="font-bold">{selection.end ? formatDate(selection.end) : 'Selecciona fecha final...'}</span>
                                </div>
                            </div>
                            {selection.end && (
                                <button
                                    onClick={handleBlockDates}
                                    disabled={isSaving}
                                    className="w-full py-4 bg-white text-rural-900 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-rural-50 transition-all"
                                >
                                    {isSaving ? <RefreshCw className="animate-spin" /> : <Lock size={18} />} Bloquear Fechas
                                </button>
                            )}
                            <button onClick={() => setSelection({ start: null, end: null })} className="w-full mt-2 text-xs opacity-50 hover:opacity-100 underline py-2">Cancelar selección</button>
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-4 max-h-[60vh] overflow-y-auto">
                        <h5 className="font-bold text-xs uppercase tracking-widest text-gray-400 flex items-center justify-between">
                            Listado de Bloqueos
                            <span className="bg-gray-100 px-2 py-0.5 rounded-full text-[10px]">{blockedDates.length}</span>
                        </h5>
                        <div className="space-y-3">
                            {blockedDates.filter(b => b.source === 'manual').length === 0 && (
                                <p className="text-center py-8 text-xs text-gray-300 italic">No hay bloqueos manuales activos</p>
                            )}
                            {blockedDates.sort((a, b) => new Date(b.start_date) - new Date(a.start_date)).map(block => (
                                <div key={block.id} className={`p-4 rounded-2xl border flex items-center justify-between ${block.source === 'manual' ? 'border-rural-100 bg-rural-50/50' : 'border-red-50 bg-red-50/20'}`}>
                                    <div>
                                        <p className="text-xs font-bold text-gray-700">{block.start_date} al {block.end_date}</p>
                                        <p className="text-[10px] uppercase font-bold opacity-40">{block.source}</p>
                                    </div>
                                    {block.source === 'manual' && (
                                        <button onClick={() => handleDeleteBlock(block.id)} className="p-2 text-red-300 hover:bg-red-50 rounded-xl transition-all">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AvailabilityManager;

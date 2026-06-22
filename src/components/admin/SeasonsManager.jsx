import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

import { Calendar, Plus, Trash2, Loader2, Save, X, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { logError, userErrorMessage } from '../../utils/logger';

// ────────────── Utilidades de fecha (sin librería) ──────────────
// Todo se trabaja con strings "YYYY-MM-DD" para evitar el lío de timezones
// que tiene Date() con horario local vs UTC.

const ymd = (year, month, day) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
};
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
// Lunes=0, Domingo=6 (formato europeo)
const firstWeekdayMon0 = (year, month) => {
    const sundayBased = new Date(year, month, 1).getDay(); // 0=Dom, 1=Lun...
    return (sundayBased + 6) % 7;
};
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS_ES = ['L','M','X','J','V','S','D'];

const SeasonsManager = () => {
    const [seasons, setSeasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ name: '', start_date: '', end_date: '' });
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

    useEffect(() => { fetchSeasons(); }, []);

    async function fetchSeasons() {
        setLoading(true);
        const { data, error } = await supabase.from('high_seasons').select('*').order('start_date');
        if (error) {
            logError('fetchSeasons', error);
            alert(userErrorMessage('Error al cargar temporadas.'));
        }
        if (data) setSeasons(data);
        setLoading(false);
    }

    const resetForm = () => {
        setFormData({ name: '', start_date: '', end_date: '' });
        setShowForm(false);
        setEditingId(null);
    };

    const startEdit = (season) => {
        setEditingId(season.id);
        setFormData({ name: season.name, start_date: season.start_date, end_date: season.end_date });
        setShowForm(true);
        // Saltar el calendario al año de esta temporada
        setCalendarYear(parseInt(season.start_date.slice(0, 4), 10));
    };

    const startNew = () => {
        resetForm();
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.start_date || !formData.end_date) {
            alert('Por favor, rellena todos los campos.');
            return;
        }
        if (formData.start_date > formData.end_date) {
            alert('La fecha de inicio no puede ser posterior a la de fin.');
            return;
        }

        setSaving(true);
        const op = editingId
            ? supabase.from('high_seasons').update(formData).eq('id', editingId)
            : supabase.from('high_seasons').insert([formData]);
        const { error } = await op;
        if (error) {
            logError('SeasonsManager.handleSave', error);
            alert(userErrorMessage('Error al guardar la temporada.'));
        } else {
            resetForm();
            fetchSeasons();
        }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta temporada alta?')) return;
        await supabase.from('high_seasons').delete().eq('id', id);
        if (editingId === id) resetForm();
        fetchSeasons();
    };

    // ────── Mapa { 'YYYY-MM-DD': season } para colorear el calendario ──────
    // Calcula sólo cuando cambian las temporadas, no en cada render.
    const dayToSeason = useMemo(() => {
        const map = new Map();
        for (const s of seasons) {
            // start/end vienen como 'YYYY-MM-DD'. Iterar día a día.
            const [sy, sm, sd] = s.start_date.split('-').map(Number);
            const [ey, em, ed] = s.end_date.split('-').map(Number);
            let cur = new Date(sy, sm - 1, sd);
            const stop = new Date(ey, em - 1, ed);
            while (cur <= stop) {
                map.set(ymd(cur.getFullYear(), cur.getMonth(), cur.getDate()), s);
                cur.setDate(cur.getDate() + 1);
            }
        }
        return map;
    }, [seasons]);

    const todayKey = ymd(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando temporadas...</div>;

    return (
        <div className="space-y-8 max-w-7xl">
            {/* Cabecera */}
            <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                    <h3 className="text-2xl font-serif font-bold text-text-primary">Temporada alta y baja</h3>
                    <p className="text-sm text-gray-500 max-w-2xl mt-1">
                        Define los rangos de fechas donde el precio sube. El resto del año es temporada baja por defecto.
                        Mira el calendario para ver cómo queda el año completo de un vistazo.
                    </p>
                </div>
                <button
                    onClick={() => showForm ? resetForm() : startNew()}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-md bg-primary"
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancelar' : 'Nueva temporada'}
                </button>
            </div>

            {/* Formulario alta/edición */}
            {showForm && (
                <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-rural-200 space-y-4">
                    <h4 className="font-bold text-lg">{editingId ? 'Editar temporada' : 'Nueva temporada alta'}</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                        <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Nombre</span>
                            <input
                                type="text" placeholder="Ej: Semana Santa"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 ring-rural-300"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Fecha inicio</span>
                            <input
                                type="date"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 ring-rural-300"
                                value={formData.start_date}
                                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Fecha fin</span>
                            <input
                                type="date"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 ring-rural-300"
                                value={formData.end_date}
                                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                            />
                        </label>
                    </div>
                    <button
                        onClick={handleSave} disabled={saving}
                        className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all bg-primary disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar temporada'}
                    </button>
                </div>
            )}

            {/* ────────── CALENDARIO ANUAL ────────── */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setCalendarYear(y => y - 1)}
                            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500" aria-label="Año anterior">
                            <ChevronLeft size={18} />
                        </button>
                        <h4 className="text-2xl font-serif font-bold text-rural-900">{calendarYear}</h4>
                        <button onClick={() => setCalendarYear(y => y + 1)}
                            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500" aria-label="Año siguiente">
                            <ChevronRight size={18} />
                        </button>
                        <button onClick={() => setCalendarYear(new Date().getFullYear())}
                            className="text-xs font-bold text-rural-700 hover:underline ml-2">
                            Volver a hoy
                        </button>
                    </div>
                    <Legend />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {Array.from({ length: 12 }, (_, m) => (
                        <MonthGrid
                            key={m}
                            year={calendarYear}
                            month={m}
                            dayToSeason={dayToSeason}
                            todayKey={todayKey}
                        />
                    ))}
                </div>
            </div>

            {/* Lista de temporadas (CRUD compacto) */}
            <div>
                <h4 className="font-serif font-bold text-lg text-text-primary mb-3">Temporadas definidas ({seasons.length})</h4>
                {seasons.length === 0 ? (
                    <div className="p-20 text-center bg-white border-2 border-dashed rounded-3xl opacity-40 italic font-serif">
                        Todavía no has marcado ninguna temporada alta. Añade Semana Santa, agosto y los puentes principales para empezar.
                    </div>
                ) : (
                    <div className="grid gap-2">
                        {seasons.map(season => {
                            const start = new Date(season.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                            const end = new Date(season.end_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                            const isEditing = editingId === season.id;
                            return (
                                <div key={season.id}
                                    className={`bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-4 transition-all ${isEditing ? 'border-rural-300 ring-2 ring-rural-100' : 'border-gray-100'}`}>
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                        <Calendar size={18} />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <h5 className="font-bold text-gray-800 truncate">{season.name}</h5>
                                        <p className="text-xs text-gray-500">{start} — {end}</p>
                                    </div>
                                    <button onClick={() => isEditing ? resetForm() : startEdit(season)}
                                        className={`p-2 rounded-lg transition-colors ${isEditing ? 'text-rural-600 bg-rural-50' : 'text-gray-300 hover:text-rural-600 hover:bg-rural-50'}`}
                                        title="Editar">
                                        <Pencil size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(season.id)}
                                        className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"
                                        title="Eliminar">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────── Mes individual ───────────────────────

const MonthGrid = ({ year, month, dayToSeason, todayKey }) => {
    const total = daysInMonth(year, month);
    const offset = firstWeekdayMon0(year, month);
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);

    return (
        <div className="bg-gray-50/60 rounded-2xl p-3 border border-gray-100">
            <p className="font-serif font-bold text-sm text-rural-900 mb-2 capitalize text-center">
                {MONTHS_ES[month]}
            </p>
            <div className="grid grid-cols-7 gap-px mb-1">
                {WEEKDAYS_ES.map((w, i) => (
                    <div key={i} className="text-[9px] font-bold text-gray-400 text-center">{w}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                    if (d === null) return <div key={i} />;
                    const key = ymd(year, month, d);
                    const season = dayToSeason.get(key);
                    const isToday = key === todayKey;
                    return (
                        <div key={i}
                            title={season ? `${d} ${MONTHS_ES[month].toLowerCase()} ${year} — Temporada alta: ${season.name}` : `${d} ${MONTHS_ES[month].toLowerCase()} ${year} — Temporada baja`}
                            className={`text-[11px] text-center py-1 rounded-md font-medium transition-colors ${
                                season ? 'bg-amber-200 text-amber-900' : 'bg-rural-50 text-rural-700'
                            } ${isToday ? 'ring-2 ring-rural-700 font-bold' : ''}`}
                        >
                            {d}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const Legend = () => (
    <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-md bg-rural-50 border border-rural-100" />
            <span className="text-gray-600">Temporada baja</span>
        </span>
        <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-md bg-amber-200 border border-amber-300" />
            <span className="text-gray-600">Temporada alta</span>
        </span>
        <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-md bg-rural-50 border border-rural-100 ring-2 ring-rural-700" />
            <span className="text-gray-600">Hoy</span>
        </span>
    </div>
);

export default SeasonsManager;

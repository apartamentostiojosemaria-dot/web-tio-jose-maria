import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { logError, userErrorMessage } from '../../utils/logger';
import {
    Plus, Save, X, Trash2, Pencil, Loader2, Calendar,
    Eye, EyeOff, RefreshCw, Upload, Clock, GripVertical, Building2,
} from 'lucide-react';

const SEASON_OPTIONS = [
    { value: 'primavera',   label: 'Primavera',    emoji: '🌸' },
    { value: 'verano',      label: 'Verano',       emoji: '☀️' },
    { value: 'otoño',       label: 'Otoño',        emoji: '🍂' },
    { value: 'invierno',    label: 'Invierno',     emoji: '❄️' },
    { value: 'todo_el_año', label: 'Todo el año',  emoji: '📅' },
];
const CATEGORY_OPTIONS = [
    { value: 'fiestas',     label: 'Fiestas y romerías' },
    { value: 'gastronomía', label: 'Gastronomía' },
    { value: 'cultura',     label: 'Cultura' },
    { value: 'naturaleza',  label: 'Naturaleza' },
    { value: 'deportes',    label: 'Deportes' },
];

const EMPTY_EVENT = {
    title: '', description: '', event_date: '', end_date: '',
    season: 'verano', category: 'fiestas', location: '', organizer: '',
    image_url: '', is_recurring: false, active: true,
    program: [],
};

const EventsManager = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [uploadingPoster, setUploadingPoster] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => { fetchEvents(); }, []);

    async function fetchEvents() {
        setLoading(true);
        const { data, error } = await supabase.from('local_events').select('*').order('event_date', { ascending: true });
        if (error) logError('EventsManager.fetch', error);
        if (data) setEvents(data);
        setLoading(false);
    }

    const resetForm = () => setEditingEvent(null);

    const handleSave = async () => {
        if (!editingEvent.title) return alert('El título es obligatorio.');
        setSaving(true);
        const { id, updated_at, ...payload } = editingEvent;
        // Normalizar campos vacíos a null para BD
        const clean = {
            ...payload,
            event_date: payload.event_date || null,
            end_date: payload.end_date || null,
            location: payload.location || null,
            organizer: payload.organizer || null,
            image_url: payload.image_url || null,
            description: payload.description || null,
            program: Array.isArray(payload.program) ? payload.program.filter(p => p.time || p.description) : [],
        };
        let error;
        if (id) {
            ({ error } = await supabase.from('local_events').update({ ...clean, updated_at: new Date().toISOString() }).eq('id', id));
        } else {
            ({ error } = await supabase.from('local_events').insert([clean]));
        }
        if (error) {
            logError('EventsManager.save', error);
            alert(userErrorMessage('Error al guardar el evento.'));
        } else { resetForm(); fetchEvents(); }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este evento?')) return;
        await supabase.from('local_events').delete().eq('id', id);
        if (editingEvent?.id === id) resetForm();
        fetchEvents();
    };

    const toggleActive = async (event) => {
        await supabase.from('local_events').update({ active: !event.active }).eq('id', event.id);
        fetchEvents();
    };

    const handleUploadPoster = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 6 * 1024 * 1024) { alert('La imagen pesa demasiado (máx. 6 MB).'); return; }
        setUploadingPoster(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const { error: upErr } = await supabase.storage.from('event-posters').upload(path, file, { cacheControl: '3600' });
            if (upErr) throw upErr;
            const { data: { publicUrl } } = supabase.storage.from('event-posters').getPublicUrl(path);
            setEditingEvent(prev => ({ ...prev, image_url: publicUrl }));
        } catch (err) {
            logError('uploadPoster', err);
            alert(userErrorMessage('Error al subir el cartel.'));
        } finally {
            setUploadingPoster(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Programa horario: editor con añadir/quitar líneas
    const updateProgramItem = (idx, field, value) => {
        const next = [...(editingEvent.program || [])];
        next[idx] = { ...next[idx], [field]: value };
        setEditingEvent({ ...editingEvent, program: next });
    };
    const addProgramItem = () => {
        setEditingEvent({ ...editingEvent, program: [...(editingEvent.program || []), { time: '', description: '' }] });
    };
    const removeProgramItem = (idx) => {
        const next = [...(editingEvent.program || [])];
        next.splice(idx, 1);
        setEditingEvent({ ...editingEvent, program: next });
    };
    const moveProgramItem = (idx, dir) => {
        const next = [...(editingEvent.program || [])];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return;
        [next[idx], next[target]] = [next[target], next[idx]];
        setEditingEvent({ ...editingEvent, program: next });
    };

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando eventos...</div>;

    return (
        <div className="space-y-6 max-w-5xl">
            <header className="flex justify-between items-end flex-wrap gap-4">
                <div>
                    <h3 className="text-2xl font-serif font-bold text-text-primary">Eventos y fiestas</h3>
                    <p className="text-sm text-gray-500">Romerías, fiestas patronales, ferias y actividades de Hinojares y la comarca. {events.length} eventos · {events.filter(e => e.active).length} visibles.</p>
                </div>
                <button onClick={() => setEditingEvent({ ...EMPTY_EVENT })}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold shadow-md bg-primary hover:scale-105 transition-all">
                    <Plus size={16} /> Nuevo evento
                </button>
            </header>

            {editingEvent && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-start justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl my-8">
                        <div className="sticky top-0 bg-white/95 backdrop-blur-md p-6 border-b border-gray-100 flex justify-between items-center rounded-t-3xl z-10">
                            <div>
                                <h4 className="text-xl font-serif font-bold">{editingEvent.id ? 'Editar evento' : 'Nuevo evento'}</h4>
                                <p className="text-xs text-gray-500 mt-0.5">Lo que pongas aquí lo verán los huéspedes con reserva en esas fechas.</p>
                            </div>
                            <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
                        </div>

                        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

                            {/* ───── 1. CARTEL ───── */}
                            <section>
                                <h5 className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">1 · Cartel del evento</h5>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadPoster} className="hidden" />
                                {editingEvent.image_url ? (
                                    <div className="relative bg-gray-100 rounded-2xl overflow-hidden">
                                        <img src={editingEvent.image_url} alt="Cartel" className="w-full max-h-96 object-contain" />
                                        <div className="absolute top-3 right-3 flex gap-2">
                                            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPoster}
                                                className="px-3 py-1.5 bg-white/95 text-gray-800 text-xs font-bold rounded-lg shadow inline-flex items-center gap-1.5">
                                                {uploadingPoster ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Cambiar
                                            </button>
                                            <button onClick={() => setEditingEvent({ ...editingEvent, image_url: '' })}
                                                className="p-1.5 bg-red-500 text-white rounded-lg shadow">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPoster}
                                        className="w-full py-8 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-rural-300 hover:bg-rural-50/30 transition-all">
                                        {uploadingPoster ? <><Loader2 size={20} className="animate-spin" /> <span className="text-sm font-bold">Subiendo...</span></> :
                                            <><Upload size={20} /> <span className="text-sm font-bold">Subir cartel del evento</span>
                                                <span className="text-xs text-gray-400">JPG o PNG · máx. 6 MB</span></>}
                                    </button>
                                )}
                            </section>

                            {/* ───── 2. INFO BÁSICA ───── */}
                            <section>
                                <h5 className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">2 · Datos del evento</h5>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Título *</label>
                                        <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400"
                                            value={editingEvent.title} onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                                            placeholder="Romería y Fiestas de San Juan 2026" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Descripción breve</label>
                                        <textarea className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 text-sm" rows={2}
                                            value={editingEvent.description || ''} onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
                                            placeholder="Romería y fiestas patronales en la aldea de Cuenca, pedanía de Hinojares." />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Fecha</label>
                                            <input type="date" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400"
                                                value={editingEvent.event_date || ''} onChange={e => setEditingEvent({ ...editingEvent, event_date: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Hasta (si varios días)</label>
                                            <input type="date" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400"
                                                value={editingEvent.end_date || ''} onChange={e => setEditingEvent({ ...editingEvent, end_date: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Lugar</label>
                                            <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 text-sm"
                                                value={editingEvent.location || ''} onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value })}
                                                placeholder="Aldea de Cuenca, Hinojares" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Organiza</label>
                                            <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 text-sm"
                                                value={editingEvent.organizer || ''} onChange={e => setEditingEvent({ ...editingEvent, organizer: e.target.value })}
                                                placeholder="Ayuntamiento de Hinojares" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Categoría</label>
                                            <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 cursor-pointer"
                                                value={editingEvent.category || ''} onChange={e => setEditingEvent({ ...editingEvent, category: e.target.value })}>
                                                {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Temporada</label>
                                            <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-rural-400 cursor-pointer"
                                                value={editingEvent.season || ''} onChange={e => setEditingEvent({ ...editingEvent, season: e.target.value })}>
                                                {SEASON_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* ───── 3. PROGRAMA HORARIO ───── */}
                            <section>
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-[10px] uppercase tracking-widest font-bold text-gray-500">3 · Programa horario</h5>
                                    <button onClick={addProgramItem}
                                        className="text-xs font-bold text-rural-700 hover:underline inline-flex items-center gap-1">
                                        <Plus size={12} /> Añadir línea
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">Hora + qué pasa. Se mostrará tal cual al huésped.</p>
                                {(editingEvent.program || []).length === 0 ? (
                                    <p className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                        Sin programa. Pulsa "Añadir línea" para crear el horario.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {(editingEvent.program || []).map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-2 bg-gray-50 rounded-xl p-2">
                                                <div className="flex flex-col gap-0.5 mt-2">
                                                    <button onClick={() => moveProgramItem(idx, -1)} disabled={idx === 0}
                                                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30">▲</button>
                                                    <button onClick={() => moveProgramItem(idx, 1)} disabled={idx === editingEvent.program.length - 1}
                                                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30">▼</button>
                                                </div>
                                                <input type="text" placeholder="09:00"
                                                    value={item.time || ''} onChange={e => updateProgramItem(idx, 'time', e.target.value)}
                                                    className="w-20 p-2 bg-white border border-gray-200 rounded-lg outline-none text-sm font-bold text-rural-700 tabular-nums focus:border-rural-400" />
                                                <input type="text" placeholder="Qué pasa a esa hora..."
                                                    value={item.description || ''} onChange={e => updateProgramItem(idx, 'description', e.target.value)}
                                                    className="flex-1 p-2 bg-white border border-gray-200 rounded-lg outline-none text-sm focus:border-rural-400" />
                                                <button onClick={() => removeProgramItem(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* ───── 4. VISIBILIDAD ───── */}
                            <section>
                                <h5 className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">4 · Visibilidad</h5>
                                <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-xl">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={editingEvent.active !== false}
                                            onChange={e => setEditingEvent({ ...editingEvent, active: e.target.checked })}
                                            className="w-4 h-4 rounded text-rural-700" />
                                        <span className="text-sm text-gray-700">Visible en la web</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={editingEvent.is_recurring || false}
                                            onChange={e => setEditingEvent({ ...editingEvent, is_recurring: e.target.checked })}
                                            className="w-4 h-4 rounded text-rural-700" />
                                        <span className="text-sm text-gray-700">Se repite cada año</span>
                                    </label>
                                </div>
                            </section>
                        </div>

                        <div className="p-5 border-t border-gray-100 flex gap-2 justify-end bg-gray-50/50 rounded-b-3xl">
                            <button onClick={resetForm} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50">Cancelar</button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-6 py-2.5 text-white font-bold rounded-xl shadow-lg inline-flex items-center gap-2 bg-primary disabled:opacity-50">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {editingEvent.id ? 'Actualizar' : 'Crear evento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lista de eventos */}
            <div className="grid gap-3">
                {events.map(event => {
                    const season = SEASON_OPTIONS.find(s => s.value === event.season);
                    const dateStr = event.event_date ? new Date(event.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—';
                    const endStr = event.end_date && event.end_date !== event.event_date ? ` → ${new Date(event.end_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : '';
                    return (
                        <div key={event.id} className={`bg-white p-4 rounded-2xl border shadow-sm flex items-start gap-4 transition-all ${!event.active ? 'opacity-50' : 'border-gray-100'}`}>
                            {event.image_url ? (
                                <img src={event.image_url} alt={event.title} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-20 h-20 rounded-xl bg-rural-50 flex items-center justify-center flex-shrink-0">
                                    <Calendar size={28} className="text-rural-700" />
                                </div>
                            )}
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h5 className="font-bold text-gray-900 truncate">{event.title}</h5>
                                    <span className="text-xs">{season?.emoji}</span>
                                    {event.is_recurring && <RefreshCw size={11} className="text-gray-400" title="Se repite cada año" />}
                                    {!event.active && <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><EyeOff size={10} /> Oculto</span>}
                                </div>
                                <p className="text-xs text-gray-500 tabular-nums">{dateStr}{endStr}{event.location ? ` · ${event.location}` : ''}</p>
                                {event.organizer && <p className="text-[11px] text-gray-500 mt-0.5 inline-flex items-center gap-1"><Building2 size={10} /> {event.organizer}</p>}
                                {Array.isArray(event.program) && event.program.length > 0 && (
                                    <p className="text-[10px] text-gray-400 mt-1 inline-flex items-center gap-1"><Clock size={10} /> Programa con {event.program.length} {event.program.length === 1 ? 'línea' : 'líneas'}</p>
                                )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => toggleActive(event)} className="p-2 text-gray-400 hover:text-rural-600" title={event.active ? 'Ocultar' : 'Mostrar'}>
                                    {event.active ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                                <button onClick={() => setEditingEvent(event)} className="p-2 text-gray-400 hover:text-rural-600" title="Editar">
                                    <Pencil size={16} />
                                </button>
                                <button onClick={() => handleDelete(event.id)} className="p-2 text-gray-400 hover:text-red-500" title="Eliminar">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
                {events.length === 0 && (
                    <div className="p-16 text-center bg-white border-2 border-dashed rounded-3xl text-gray-400 italic font-serif">
                        No hay eventos. Crea el primero pulsando "Nuevo evento".
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventsManager;

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { logError, userErrorMessage } from '../../utils/logger';
import {
    Plus, Save, X, Trash2, Pencil, Loader2, Calendar,
    MapPin, Image, Eye, EyeOff, RefreshCw
} from 'lucide-react';

const SEASON_OPTIONS = [
    { value: 'primavera', label: 'Primavera', emoji: '🌸' },
    { value: 'verano', label: 'Verano', emoji: '☀️' },
    { value: 'otoño', label: 'Otoño', emoji: '🍂' },
    { value: 'invierno', label: 'Invierno', emoji: '❄️' },
    { value: 'todo_el_año', label: 'Todo el año', emoji: '📅' },
];

const CATEGORY_OPTIONS = [
    { value: 'naturaleza', label: 'Naturaleza' },
    { value: 'gastronomía', label: 'Gastronomía' },
    { value: 'cultura', label: 'Cultura' },
    { value: 'fiestas', label: 'Fiestas' },
    { value: 'deportes', label: 'Deportes' },
];

const EMPTY_EVENT = {
    title: '', description: '', event_date: '', end_date: '',
    season: 'primavera', category: 'cultura', location: '',
    image_url: '', is_recurring: false, active: true,
};

const EventsManager = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);

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

        let error;
        if (id) {
            ({ error } = await supabase.from('local_events').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id));
        } else {
            ({ error } = await supabase.from('local_events').insert([payload]));
        }
        if (error) {
            logError('EventsManager.save', error);
            alert(userErrorMessage('Error al guardar.'));
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

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando eventos...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Eventos y Experiencias</h3>
                    <p className="text-sm text-gray-500">{events.length} eventos · {events.filter(e => e.active).length} visibles</p>
                </div>
                <button onClick={() => setEditingEvent({ ...EMPTY_EVENT })} className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-md" style={{ backgroundColor: COLORS.primary }}>
                    <Plus size={18} /> Nuevo Evento
                </button>
            </div>

            {editingEvent && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] max-w-3xl w-full shadow-2xl my-8">
                        <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 border-b border-gray-100 flex justify-between items-center rounded-t-[2rem] z-10">
                            <h4 className="text-xl font-serif font-bold">{editingEvent.id ? 'Editar Evento' : 'Nuevo Evento'}</h4>
                            <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
                        </div>
                        <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Título *</label>
                                <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none" value={editingEvent.title} onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Descripción</label>
                                <textarea className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none resize-none" rows={3} value={editingEvent.description || ''} onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Fecha inicio</label>
                                    <input type="date" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editingEvent.event_date || ''} onChange={e => setEditingEvent({ ...editingEvent, event_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Fecha fin</label>
                                    <input type="date" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editingEvent.end_date || ''} onChange={e => setEditingEvent({ ...editingEvent, end_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Temporada</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editingEvent.season || ''} onChange={e => setEditingEvent({ ...editingEvent, season: e.target.value })}>
                                        {SEASON_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Categoría</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editingEvent.category || ''} onChange={e => setEditingEvent({ ...editingEvent, category: e.target.value })}>
                                        {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Ubicación</label>
                                    <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editingEvent.location || ''} onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value })} placeholder="Ej: Hinojares, Cazorla..." />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">URL Imagen</label>
                                    <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs" value={editingEvent.image_url || ''} onChange={e => setEditingEvent({ ...editingEvent, image_url: e.target.value })} placeholder="https://..." />
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editingEvent.is_recurring || false} onChange={e => setEditingEvent({ ...editingEvent, is_recurring: e.target.checked })} className="w-4 h-4 rounded" />
                                    <span className="text-sm font-bold text-gray-600">Se repite cada año</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editingEvent.active !== false} onChange={e => setEditingEvent({ ...editingEvent, active: e.target.checked })} className="w-4 h-4 rounded" />
                                    <span className="text-sm font-bold text-gray-600">Visible en la web</span>
                                </label>
                            </div>
                            {editingEvent.image_url && (
                                <img src={editingEvent.image_url} alt="Preview" className="w-full h-40 object-cover rounded-2xl" />
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end bg-gray-50/50 rounded-b-[2rem]">
                            <button onClick={resetForm} className="px-6 py-3 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl">Cancelar</button>
                            <button onClick={handleSave} disabled={saving} className="px-8 py-3 text-white font-bold rounded-2xl shadow-lg flex items-center gap-2" style={{ backgroundColor: COLORS.primary }}>
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                {editingEvent.id ? 'Actualizar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-3">
                {events.map(event => {
                    const season = SEASON_OPTIONS.find(s => s.value === event.season);
                    return (
                        <div key={event.id} className={`bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 transition-all ${!event.active ? 'opacity-50' : 'border-gray-100'}`}>
                            {event.image_url ? (
                                <img src={event.image_url} alt={event.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-16 h-16 rounded-xl bg-rural-50 flex items-center justify-center flex-shrink-0">
                                    <Calendar size={24} style={{ color: COLORS.primary }} />
                                </div>
                            )}
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-bold text-gray-800 truncate">{event.title}</h5>
                                    <span className="text-xs">{season?.emoji}</span>
                                    {event.is_recurring && <RefreshCw size={12} className="text-gray-400" />}
                                    {!event.active && <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><EyeOff size={10} /> Oculto</span>}
                                </div>
                                <p className="text-xs text-gray-400">
                                    {event.event_date ? new Date(event.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
                                    {event.end_date ? ` → ${new Date(event.end_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
                                    {event.location ? ` · ${event.location}` : ''}
                                    {` · ${event.category}`}
                                </p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => toggleActive(event)} className="p-2 text-gray-300 hover:text-rural-500 transition-colors" title={event.active ? 'Ocultar' : 'Mostrar'}>
                                    {event.active ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                                <button onClick={() => setEditingEvent(event)} className="p-2 text-gray-300 hover:text-rural-500 transition-colors" title="Editar">
                                    <Pencil size={18} />
                                </button>
                                <button onClick={() => handleDelete(event.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Eliminar">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    );
                })}
                {events.length === 0 && (
                    <div className="p-20 text-center bg-white border-2 border-dashed rounded-3xl opacity-30 italic font-serif">No hay eventos.</div>
                )}
            </div>
        </div>
    );
};

export default EventsManager;

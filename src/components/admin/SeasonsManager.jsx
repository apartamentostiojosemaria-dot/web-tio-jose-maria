import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { Calendar, Plus, Trash2, Loader2, Save, X } from 'lucide-react';

const SeasonsManager = () => {
    const [seasons, setSeasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [newSeason, setNewSeason] = useState({ name: '', start_date: '', end_date: '' });

    useEffect(() => {
        fetchSeasons();
    }, []);

    async function fetchSeasons() {
        setLoading(true);
        const { data } = await supabase.from('high_seasons').select('*').order('start_date', { ascending: true });
        if (data) setSeasons(data);
        setLoading(false);
    }

    const handleAdd = async () => {
        if (!newSeason.name || !newSeason.start_date || !newSeason.end_date) {
            alert('Por favor, rellena todos los campos.');
            return;
        }

        setSaving(true);
        const { error } = await supabase.from('high_seasons').insert([newSeason]);
        if (error) {
            alert('Error al guardar: ' + error.message);
        } else {
            setNewSeason({ name: '', start_date: '', end_date: '' });
            setShowForm(false);
            fetchSeasons();
        }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta temporada alta?')) return;
        await supabase.from('high_seasons').delete().eq('id', id);
        fetchSeasons();
    };

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando temporadas...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Temporadas Altas</h3>
                    <p className="text-sm text-gray-500">Define los rangos de fechas con precios especiales y resáltalos en el calendario.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-md"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancelar' : 'Nueva Temporada'}
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-rural-200 space-y-4">
                    <h4 className="font-bold text-lg">Definir Temporada</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nombre (Ej: Semana Santa)</label>
                            <input
                                type="text"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                                value={newSeason.name}
                                onChange={e => setNewSeason({ ...newSeason, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Fecha Inicio</label>
                            <input
                                type="date"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                                value={newSeason.start_date}
                                onChange={e => setNewSeason({ ...newSeason, start_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Fecha Fin</label>
                            <input
                                type="date"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                                value={newSeason.end_date}
                                onChange={e => setNewSeason({ ...newSeason, end_date: e.target.value })}
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={saving}
                        className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {saving ? 'Guardando...' : 'Guardar Temporada'}
                    </button>
                </div>
            )}

            <div className="grid gap-4">
                {seasons.map(season => {
                    const start = new Date(season.start_date).toLocaleDateString();
                    const end = new Date(season.end_date).toLocaleDateString();
                    return (
                        <div key={season.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-6">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ color: COLORS.accent, backgroundColor: COLORS.primary }}>
                                <Calendar size={24} />
                            </div>
                            <div className="flex-grow">
                                <h4 className="font-bold text-gray-800">{season.name}</h4>
                                <p className="text-sm text-gray-500">
                                    {start} — {end}
                                </p>
                            </div>
                            <button onClick={() => handleDelete(season.id)} className="p-2 text-gray-300 hover:text-red-500">
                                <Trash2 size={20} />
                            </button>
                        </div>
                    );
                })}
                {seasons.length === 0 && (
                    <div className="p-20 text-center bg-white border-2 border-dashed rounded-3xl opacity-30 italic font-serif">
                        No hay temporadas altas definidas.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SeasonsManager;

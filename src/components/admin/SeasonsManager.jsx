import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { Calendar, Plus, Trash2, Loader2, Save, X, Pencil } from 'lucide-react';
import { logError, userErrorMessage } from '../../utils/logger';

const SeasonsManager = () => {
    const [seasons, setSeasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ name: '', start_date: '', end_date: '' });

    useEffect(() => {
        fetchSeasons();
    }, []);

    async function fetchSeasons() {
        setLoading(true);
        const { data } = await supabase.from('high_seasons').select('*').order('start_date', { ascending: true });
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
        setFormData({
            name: season.name,
            start_date: season.start_date,
            end_date: season.end_date,
        });
        setShowForm(true);
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

        setSaving(true);

        if (editingId) {
            const { error } = await supabase
                .from('high_seasons')
                .update(formData)
                .eq('id', editingId);
            if (error) {
                logError('SeasonsManager.handleUpdate', error);
                alert(userErrorMessage('Error al actualizar la temporada.'));
            } else {
                resetForm();
                fetchSeasons();
            }
        } else {
            const { error } = await supabase.from('high_seasons').insert([formData]);
            if (error) {
                logError('SeasonsManager.handleAdd', error);
                alert(userErrorMessage('Error al guardar la temporada.'));
            } else {
                resetForm();
                fetchSeasons();
            }
        }

        setSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta temporada alta?')) return;
        await supabase.from('high_seasons').delete().eq('id', id);
        if (editingId === id) resetForm();
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
                    onClick={() => showForm ? resetForm() : startNew()}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-md"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancelar' : 'Nueva Temporada'}
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-rural-200 space-y-4">
                    <h4 className="font-bold text-lg">
                        {editingId ? 'Editar Temporada' : 'Definir Temporada'}
                    </h4>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nombre (Ej: Semana Santa)</label>
                            <input
                                type="text"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Fecha Inicio</label>
                            <input
                                type="date"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                                value={formData.start_date}
                                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Fecha Fin</label>
                            <input
                                type="date"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                                value={formData.end_date}
                                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                        style={{ backgroundColor: COLORS.primary }}
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {saving ? 'Guardando...' : editingId ? 'Actualizar Temporada' : 'Guardar Temporada'}
                    </button>
                </div>
            )}

            <div className="grid gap-4">
                {seasons.map(season => {
                    const start = new Date(season.start_date).toLocaleDateString();
                    const end = new Date(season.end_date).toLocaleDateString();
                    const isEditing = editingId === season.id;
                    return (
                        <div
                            key={season.id}
                            className={`bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-6 transition-all ${isEditing ? 'border-rural-300 ring-2 ring-rural-100' : 'border-gray-100'}`}
                        >
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ color: COLORS.accent, backgroundColor: COLORS.primary }}>
                                <Calendar size={24} />
                            </div>
                            <div className="flex-grow">
                                <h4 className="font-bold text-gray-800">{season.name}</h4>
                                <p className="text-sm text-gray-500">
                                    {start} — {end}
                                </p>
                            </div>
                            <button
                                onClick={() => isEditing ? resetForm() : startEdit(season)}
                                className={`p-2 transition-colors ${isEditing ? 'text-rural-600' : 'text-gray-300 hover:text-rural-500'}`}
                                title="Editar temporada"
                            >
                                <Pencil size={20} />
                            </button>
                            <button onClick={() => handleDelete(season.id)} className="p-2 text-gray-300 hover:text-red-500" title="Eliminar temporada">
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

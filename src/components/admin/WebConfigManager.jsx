import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { Save, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

const WebConfigManager = () => {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchConfigs();
    }, []);

    async function fetchConfigs() {
        setLoading(true);
        const { data } = await supabase.from('web_config').select('*').order('section');
        if (data) setConfigs(data);
        setLoading(false);
    }

    const handleChange = (id, value) => {
        setConfigs(configs.map(c => c.id === id ? { ...c, value } : c));
    };

    const handleSave = async () => {
        setSaving(true);
        const updates = configs.map(c => ({ id: c.id, section: c.section, key: c.key, value: c.value }));
        const { error } = await supabase.from('web_config').upsert(updates);

        if (!error) {
            setMessage({ type: 'success', text: 'Cambios guardados correctamente' });
            setTimeout(() => setMessage(null), 3000);
        } else {
            setMessage({ type: 'error', text: 'Error al guardar los cambios' });
        }
        setSaving(false);
    };

    if (loading) return <div className="p-10 text-center animate-pulse italic">Cargando textos...</div>;

    const sections = [...new Set(configs.map(c => c.section))];

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Configuración de Textos</h3>
                    <p className="text-sm text-gray-500">Cambia los copys de la web sin romper el SEO</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-md disabled:opacity-50"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                    {saving ? 'Guardando...' : 'Guardar Todo'}
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-red-50 border border-red-100 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span className="text-sm font-bold uppercase tracking-wider">{message.text}</span>
                </div>
            )}

            <div className="space-y-12 pb-10">
                {sections.map(section => (
                    <section key={section} className="space-y-6">
                        <h4 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 border-b pb-2">{section}</h4>
                        <div className="grid gap-6">
                            {configs.filter(c => c.section === section).map(config => (
                                <div key={config.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-widest">{config.key}</label>
                                    <textarea
                                        className="w-full bg-gray-50 border-none rounded-xl p-4 text-sm focus:ring-2 transition-all"
                                        style={{ '--tw-ring-color': COLORS.primary }}
                                        rows={config.value.length > 100 ? 5 : 2}
                                        value={config.value}
                                        onChange={(e) => handleChange(config.id, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default WebConfigManager;

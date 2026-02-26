import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { Users, Search, Calendar, Save, Mail, User } from 'lucide-react';

const GuestUserManager = () => {
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUserId, setEditingUserId] = useState(null);
    const [formData, setFormData] = useState({ check_in: '', check_out: '' });

    useEffect(() => {
        fetchGuests();
    }, []);

    const fetchGuests = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'cliente')
            .order('updated_at', { ascending: false });

        if (data) setGuests(data);
        setLoading(false);
    };

    const handleEdit = (guest) => {
        setEditingUserId(guest.id);
        setFormData({
            check_in: guest.check_in || '',
            check_out: guest.check_out || ''
        });
    };

    const handleSave = async (userId) => {
        const { error } = await supabase
            .from('profiles')
            .update({
                check_in: formData.check_in || null,
                check_out: formData.check_out || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            alert('Error al actualizar: ' + error.message);
        } else {
            setEditingUserId(null);
            fetchGuests();
        }
    };

    const filteredGuests = guests.filter(g =>
        (g.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (g.id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header>
                <h2 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Gestión de Huéspedes</h2>
                <p className="text-gray-500 text-sm">Asigna las fechas de estancia para personalizar su experiencia y el tiempo.</p>
            </header>

            {/* Buscador */}
            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar por nombre o ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all"
                />
            </div>

            {loading ? (
                <div className="p-12 text-center animate-pulse text-rural-400 font-serif italic">Cargando lista de huéspedes...</div>
            ) : (
                <div className="grid gap-4">
                    {filteredGuests.map((guest) => (
                        <div key={guest.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm group hover:border-rural-200 transition-all">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-rural-50 flex items-center justify-center text-rural-600" style={{ backgroundColor: COLORS.bgWarm, color: COLORS.primary }}>
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-rural-900">{guest.full_name || 'Sin nombre'}</h4>
                                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">{guest.id.slice(0, 8)}...</p>
                                    </div>
                                </div>

                                <div className="flex-grow max-w-xl">
                                    {editingUserId === guest.id ? (
                                        <div className="flex flex-wrap items-center gap-4 animate-in slide-in-from-right-4 duration-300">
                                            <div className="flex-1 min-w-[150px]">
                                                <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Entrada</label>
                                                <input
                                                    type="date"
                                                    value={formData.check_in}
                                                    onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-xl border border-gray-100 text-sm font-bold focus:ring-2 focus:ring-rural-200"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-[150px]">
                                                <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Salida</label>
                                                <input
                                                    type="date"
                                                    value={formData.check_out}
                                                    onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-xl border border-gray-100 text-sm font-bold focus:ring-2 focus:ring-rural-200"
                                                />
                                            </div>
                                            <div className="flex gap-2 pt-4">
                                                <button
                                                    onClick={() => handleSave(guest.id)}
                                                    className="p-3 bg-rural-600 text-white rounded-xl hover:scale-105 transition-all shadow-md"
                                                    style={{ backgroundColor: COLORS.primary }}
                                                >
                                                    <Save size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingUserId(null)}
                                                    className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-8 py-2">
                                            <div>
                                                <span className="block text-[9px] font-bold uppercase tracking-widest text-gray-400">Estancia</span>
                                                {guest.check_in ? (
                                                    <p className="text-sm font-bold text-rural-800">
                                                        {new Date(guest.check_in).toLocaleDateString()} - {new Date(guest.check_out).toLocaleDateString()}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-gray-300 italic">Fechas no asignadas</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleEdit(guest)}
                                                className="px-4 py-2 rounded-xl border border-gray-100 text-xs font-bold text-gray-500 hover:border-rural-200 hover:text-rural-700 transition-all"
                                            >
                                                Asignar Fechas
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredGuests.length === 0 && (
                        <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-gray-100 text-gray-400 italic font-serif">
                            No se encontraron huéspedes con ese criterio.
                        </div>
                    )}
                </div>
            )}

            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
                <Calendar className="text-amber-600 flex-shrink-0" size={20} />
                <div className="text-xs text-amber-900 leading-relaxed">
                    <p className="font-bold mb-1">Nota importante:</p>
                    <p>Las fechas que asignes aquí servirán para que el cliente vea la previsión del tiempo específica de su estancia en su área personal. Si no las asignas, verá la previsión de los próximos 3 días.</p>
                </div>
            </div>
        </div>
    );
};

export default GuestUserManager;

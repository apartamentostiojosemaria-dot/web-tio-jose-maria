import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { useGuestBookings } from '../../hooks/useDatabase';
import {
    Users, Search, Calendar, Save, Mail, User,
    FileText, Heart, History, Plus, ChevronRight, X,
    CheckCircle2, AlertCircle, Clock, Shield, Lock, Unlock,
    ShieldAlert, Settings2
} from 'lucide-react';

const GuestUserManager = () => {
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGuest, setSelectedGuest] = useState(null);
    const [isCreatingGuest, setIsCreatingGuest] = useState(false);

    useEffect(() => {
        fetchGuests();
    }, []);

    const fetchGuests = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'cliente')
            .order('updated_at', { ascending: false });

        if (data) setGuests(data);
        setLoading(false);
    };

    const filteredGuests = guests.filter(g =>
        (g.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (g.id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {!selectedGuest ? (
                <>
                    <header>
                        <h2 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Control de Huéspedes y CRM</h2>
                        <p className="text-gray-500 text-sm">Gestiona la ficha de cliente, sus preferencias, historial y reglas de acceso.</p>
                    </header>

                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-8">
                        <div className="relative flex-grow max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-rural-200 outline-none transition-all shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => setIsCreatingGuest(true)}
                            className="flex items-center gap-2 px-8 py-3 bg-rural-600 text-white rounded-2xl font-bold shadow-lg hover:scale-105 transition-all"
                            style={{ backgroundColor: COLORS.primary }}
                        >
                            <Plus size={20} /> Nuevo Huésped
                        </button>
                    </div>

                    <InvitationTool />

                    {isCreatingGuest && <CreateGuestModal onClose={() => setIsCreatingGuest(false)} />}

                    {loading ? (
                        <div className="p-12 text-center animate-pulse text-rural-400 font-serif italic">Cargando lista de huéspedes...</div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredGuests.map((guest) => (
                                <div key={guest.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm group hover:border-rural-200 transition-all relative overflow-hidden">
                                    {!guest.is_active && (
                                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                                    )}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${guest.is_active ? 'bg-rural-50 text-rural-600' : 'bg-red-50 text-red-600'}`} style={guest.is_active ? { backgroundColor: COLORS.bgWarm, color: COLORS.primary } : {}}>
                                                <User size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-rural-900">{guest.full_name || 'Sin nombre'}</h4>
                                                    {!guest.is_active && <span className="text-[8px] px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-bold uppercase tracking-tighter">Baneado</span>}
                                                </div>
                                                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">{guest.id.slice(0, 8)}...</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-6">
                                            <div className="text-right">
                                                <span className="block text-[9px] font-bold uppercase tracking-widest text-gray-400">Estado de Acceso</span>
                                                <div className="flex items-center gap-2 justify-end">
                                                    <span className={`text-[10px] font-bold ${guest.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                                        {guest.is_active ? (guest.access_mode === 'always' ? 'Acceso Permanente' : 'Acceso Restringido') : 'Acceso Denegado'}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedGuest(guest)}
                                                className="px-6 py-2.5 rounded-xl font-bold bg-gray-50 text-gray-500 hover:bg-rural-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.primary}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                            >
                                                Ver Ficha de Cliente <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <GuestDetailView guest={selectedGuest} onBack={() => { setSelectedGuest(null); fetchGuests(); }} />
            )}
        </div>
    );
};

const GuestDetailView = ({ guest, onBack }) => {
    const { bookings, loading: loadingHistory } = useGuestBookings(guest.id);
    const [notes, setNotes] = useState(guest.notes || '');
    const [preferences, setPreferences] = useState(guest.preferences || '');
    const [phone, setPhone] = useState(guest.phone || '');
    const [address, setAddress] = useState(guest.address || '');
    const [paxCount, setPaxCount] = useState(guest.pax_count || 1);
    const [isActive, setIsActive] = useState(guest.is_active !== false);
    const [accessMode, setAccessMode] = useState(guest.access_mode || 'always');

    const [saving, setSaving] = useState(false);
    const [isAddingBooking, setIsAddingBooking] = useState(false);
    const [newBooking, setNewBooking] = useState({ apartment_name: '', check_in: '', check_out: '', status: 'completed' });

    const handleUpdateProfile = async (overrides = {}) => {
        setSaving(true);
        const updateData = {
            notes,
            preferences,
            phone,
            address,
            pax_count: parseInt(paxCount),
            is_active: isActive,
            access_mode: accessMode,
            updated_at: new Date().toISOString(),
            ...overrides
        };

        const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', guest.id);

        if (error) alert('Error al guardar: ' + error.message);
        setSaving(false);
    };

    const handleAddBooking = async () => {
        if (!newBooking.check_in || !newBooking.check_out) return alert('Fechas obligatorias');

        const { error } = await supabase
            .from('guest_bookings')
            .insert([{ ...newBooking, profile_id: guest.id }]);

        if (error) {
            alert('Error al añadir estancia: ' + error.message);
        } else {
            setIsAddingBooking(false);
            setNewBooking({ apartment_name: '', check_in: '', check_out: '', status: 'completed' });

            // Si es la reserva más futura, actualizar las fechas de "estancia actual" del perfil automáticamente
            const isLatest = !guest.check_in || new Date(newBooking.check_in) >= new Date(guest.check_in);
            if (isLatest) {
                await supabase.from('profiles').update({
                    check_in: newBooking.check_in,
                    check_out: newBooking.check_out
                }).eq('id', guest.id);
            }
        }
    };

    const handleDeleteBooking = async (id) => {
        if (confirm('¿Eliminar registro de esta estancia?')) {
            await supabase.from('guest_bookings').delete().eq('id', id);
        }
    };

    return (
        <div className="animate-in slide-in-from-right-4 duration-500">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-rural-700 font-bold text-sm transition-colors">
                    <X size={18} /> Volver a la lista
                </button>

                <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-xl flex items-center gap-2 border font-bold text-xs ${isActive ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        {isActive ? <Unlock size={14} /> : <Lock size={14} />}
                        {isActive ? 'ACCESO PERMITIDO' : 'ACCESO BLOQUEADO'}
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Panel Izquierdo: Info y Seguridad */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm text-center">
                        <div className="w-24 h-24 rounded-[32px] bg-rural-50 flex items-center justify-center text-rural-600 mx-auto mb-6 shadow-inner" style={{ backgroundColor: COLORS.bgWarm, color: COLORS.primary }}>
                            <User size={48} />
                        </div>
                        <h3 className="text-2xl font-serif font-bold mb-2" style={{ color: COLORS.text }}>{guest.full_name || 'Huésped'}</h3>
                        <p className="text-xs text-gray-400 mb-6">{guest.id}</p>

                        <div className="flex items-center gap-3 text-sm text-gray-600 justify-center mb-6">
                            <Mail size={16} className="text-gray-400" />
                            {guest.email || guest.id}
                        </div>

                        <div className="space-y-4 text-left border-t border-gray-50 pt-6">
                            <div>
                                <label className="block text-[8px] font-bold text-gray-400 uppercase mb-1 ml-1">Teléfono</label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Ej: 600 000 000"
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-rural-100 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[8px] font-bold text-gray-400 uppercase mb-1 ml-1">Dirección</label>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Calle, Ciudad, Provincia"
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-rural-100 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[8px] font-bold text-gray-400 uppercase mb-1 ml-1">Viajeros (Pax)</label>
                                <input
                                    type="number"
                                    value={paxCount}
                                    onChange={(e) => setPaxCount(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rural-100 outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-8 grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 rounded-[24px] border border-gray-100">
                                <span className="block text-[8px] font-bold text-gray-400 uppercase mb-1">Registro</span>
                                <span className={`font-bold text-[10px] ${guest.is_profile_completed ? 'text-green-600' : 'text-amber-600'}`}>
                                    {guest.is_profile_completed ? 'Listo' : 'Pdte'}
                                </span>
                            </div>
                            <button
                                onClick={() => handleUpdateProfile()}
                                className="p-4 bg-rural-600 text-white rounded-[24px] font-bold text-xs shadow-md hover:scale-105 transition-all"
                                style={{ backgroundColor: COLORS.primary }}
                            >
                                Guardar
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
                        <h5 className="flex items-center gap-2 font-bold text-rural-900 uppercase tracking-widest text-[10px]">
                            <Shield size={16} style={{ color: COLORS.primary }} /> Acceso de Usuario
                        </h5>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-2">MODO DE ACCESO</label>
                                <select
                                    value={accessMode}
                                    onChange={(e) => setAccessMode(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-gray-100 text-sm font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-rural-100"
                                >
                                    <option value="always">Siempre permitido</option>
                                    <option value="stay_only">Solo durante la estancia</option>
                                    <option value="stay_plus_7">Estancia + 7 días extra</option>
                                </select>
                            </div>

                            <button
                                onClick={() => { const next = !isActive; setIsActive(next); handleUpdateProfile({ is_active: next }); }}
                                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md ${isActive ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-500 hover:text-white' : 'bg-green-600 text-white shadow-green-100 hover:scale-105'
                                    }`}
                                style={!isActive ? { backgroundColor: COLORS.primary } : {}}
                            >
                                {isActive ? <Lock size={18} /> : <Unlock size={18} />}
                                {isActive ? 'Bloquear Acceso' : 'Restaurar Acceso'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-100/50">
                        <h5 className="flex items-center gap-2 font-bold text-amber-900 text-sm mb-4">
                            <Heart size={16} /> Preferencias
                        </h5>
                        <textarea
                            value={preferences}
                            onChange={(e) => setPreferences(e.target.value)}
                            placeholder="Preferencias del cliente..."
                            className="w-full bg-white/50 p-4 rounded-2xl border border-amber-200/50 text-sm h-32 resize-none outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                        />
                        <button
                            onClick={() => handleUpdateProfile()}
                            className="w-full mt-4 py-3 bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md transition-all hover:scale-105"
                        >
                            Guardar Preferencias
                        </button>
                    </div>
                </div>

                {/* Panel Central y Derecho */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                        <h5 className="flex items-center gap-2 font-bold text-rural-900 mb-6 uppercase tracking-widest text-[10px]">
                            <FileText size={16} style={{ color: COLORS.primary }} /> Notas Internas
                        </h5>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas privadas solo para administración..."
                            className="w-full p-6 bg-gray-50 rounded-3xl border border-gray-100 text-sm h-32 resize-none outline-none focus:bg-white focus:ring-2 focus:ring-rural-100 transition-all shadow-inner leading-relaxed"
                        />
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={() => handleUpdateProfile()}
                                className="flex items-center gap-2 px-8 py-3 bg-rural-600 text-white rounded-2xl font-bold shadow-lg shadow-rural-100 hover:scale-105 transition-all text-sm"
                                style={{ backgroundColor: COLORS.primary }}
                            >
                                <Save size={18} /> Guardar Notas
                            </button>
                        </div>
                    </div>

                    {/* Documentos Privados */}
                    <PrivateDocsSection guestId={guest.id} />

                    {/* Historial de Reservas */}
                    <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <h5 className="flex items-center gap-2 font-bold text-rural-900 uppercase tracking-widest text-[10px]">
                                <History size={16} /> Historial de Estancias
                            </h5>
                            <button
                                onClick={() => setIsAddingBooking(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rural-100 text-rural-600 hover:bg-rural-50 font-bold text-xs transition-all"
                                style={{ color: COLORS.primary }}
                            >
                                <Plus size={14} /> Nueva Estancia
                            </button>
                        </div>

                        {isAddingBooking && (
                            <div className="mb-8 p-6 bg-rural-50 rounded-3xl border border-rural-100 animate-in zoom-in-95 duration-200">
                                <div className="grid md:grid-cols-2 gap-4 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Apartamento"
                                        value={newBooking.apartment_name}
                                        onChange={(e) => setNewBooking({ ...newBooking, apartment_name: e.target.value })}
                                        className="px-4 py-2 rounded-xl border border-white text-sm"
                                    />
                                    <div className="flex gap-2">
                                        <input type="date" value={newBooking.check_in} onChange={(e) => setNewBooking({ ...newBooking, check_in: e.target.value })} className="flex-1 px-4 py-2 rounded-xl border border-white text-sm" />
                                        <input type="date" value={newBooking.check_out} onChange={(e) => setNewBooking({ ...newBooking, check_out: e.target.value })} className="flex-1 px-4 py-2 rounded-xl border border-white text-sm" />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setIsAddingBooking(false)} className="px-5 py-2 text-gray-400 text-sm font-bold">Cancelar</button>
                                    <button onClick={handleAddBooking} className="px-6 py-2 bg-rural-600 text-white rounded-xl text-sm font-bold shadow-md" style={{ backgroundColor: COLORS.primary }}>Guardar</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {bookings.map((booking) => (
                                <div key={booking.id} className="flex items-center justify-between p-5 rounded-2xl border border-gray-50 hover:bg-gray-50/50 transition-colors group">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${booking.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {booking.status === 'completed' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-rural-900 text-sm">{booking.apartment_name || 'Apartamento Rural'}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteBooking(booking.id)} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={16} /></button>
                                </div>
                            ))}
                            {!loadingHistory && bookings.length === 0 && (
                                <p className="text-center py-10 text-gray-300 italic text-sm">No hay registros de estancias.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-blue-50 p-8 rounded-[40px] border border-blue-100 flex gap-4 items-start">
                        <Settings2 className="text-blue-600 mt-1" size={24} />
                        <div>
                            <h6 className="font-bold text-blue-900 mb-2">Consejo Pro: Registro</h6>
                            <p className="text-sm text-blue-800 leading-relaxed">
                                El cliente debe registrarse con su email para ver sus documentos privados.
                            </p>
                            <div className="mt-3 bg-white/50 p-3 rounded-xl text-[10px] font-mono text-blue-900">
                                Link: {window.location.origin}/clientes
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InvitationTool = () => {
    const registrationUrl = `${window.location.origin}/clientes`;
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(registrationUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-white p-8 rounded-[40px] border border-rural-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 mb-8 group hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rural-50 flex items-center justify-center text-rural-600 shadow-inner" style={{ backgroundColor: COLORS.bgWarm, color: COLORS.primary }}>
                    <Plus size={24} />
                </div>
                <div>
                    <h3 className="font-serif text-xl font-bold" style={{ color: COLORS.text }}>Invitación a Huéspedes</h3>
                    <p className="text-sm text-gray-400">Envía este enlace a tus clientes para que se registren fácilmente.</p>
                </div>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex-grow md:flex-grow-0 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 text-xs font-mono text-gray-500 overflow-hidden truncate max-w-[200px]">
                    {registrationUrl}
                </div>
                <button
                    onClick={handleCopy}
                    className="px-6 py-3 bg-rural-600 text-white rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-all flex items-center gap-2 whitespace-nowrap"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    {copied ? <CheckCircle2 size={18} /> : <Save size={18} />}
                    {copied ? 'Copiado' : 'Copiar Enlace'}
                </button>
            </div>
        </div>
    );
};

const CreateGuestModal = ({ onClose }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [step, setStep] = useState(1); // 1: form, 2: success/invite link

    const registrationUrl = `${window.location.origin}/cliente/login`;

    const handleInvite = () => {
        setStep(2);
    };

    const copyToWhatsApp = () => {
        const text = `Hola ${name}, te envío el enlace para que te registres en nuestra área de clientes de Tío José María: ${registrationUrl}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] p-10 max-w-lg w-full shadow-2xl border border-rural-100 relative overflow-hidden">
                <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-800 transition-colors">
                    <X size={24} />
                </button>

                {step === 1 ? (
                    <div className="space-y-6">
                        <div className="w-16 h-16 rounded-2xl bg-rural-50 flex items-center justify-center text-rural-600 mb-2" style={{ backgroundColor: COLORS.bgWarm, color: COLORS.primary }}>
                            <Plus size={32} />
                        </div>
                        <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Alta de Nuevo Huésped</h3>
                        <p className="text-sm text-gray-500">Introduce el nombre y el correo del cliente para preparar su acceso.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-2">Nombre Completo</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej: Juan Pérez"
                                    className="w-full px-6 py-4 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-rural-100 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-2">Correo Electrónico</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="juan@ejemplo.com"
                                    className="w-full px-6 py-4 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-rural-100 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleInvite}
                            disabled={!name || !email}
                            className="w-full py-5 bg-rural-600 text-white rounded-[24px] font-bold shadow-xl shadow-rural-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                            style={{ backgroundColor: COLORS.primary }}
                        >
                            Generar Acceso para {name.split(' ')[0]}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8 py-4">
                        <div className="w-20 h-20 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                            <CheckCircle2 size={40} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-serif font-bold mb-2" style={{ color: COLORS.text }}>¡Invitación Lista!</h3>
                            <p className="text-sm text-gray-500">Envía este mensaje personalizado a <strong>{name}</strong> para que pueda acceder:</p>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 italic text-sm text-gray-600 leading-relaxed shadow-inner">
                            "Hola {name}, te envío el enlace para que te registres en nuestra área de clientes de Tío José María: {registrationUrl}"
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={copyToWhatsApp}
                                className="flex flex-col items-center gap-3 p-6 rounded-3xl border border-green-100 bg-green-50/50 hover:bg-green-50 transition-all font-bold text-green-700 text-xs"
                            >
                                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md">
                                    <Mail size={18} />
                                </div>
                                Enviar WhatsApp
                            </button>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`Hola ${name}, te envío el enlace para que te registres en nuestra área de clientes de Tío José María: ${registrationUrl}`);
                                    alert('Mensaje copiado al portapapeles');
                                }}
                                className="flex flex-col items-center gap-3 p-6 rounded-3xl border border-gray-100 hover:bg-gray-50 transition-all font-bold text-gray-600 text-xs"
                            >
                                <div className="w-10 h-10 rounded-full bg-gray-600 text-white flex items-center justify-center shadow-md">
                                    <Save size={18} />
                                </div>
                                Copiar Texto
                            </button>
                        </div>

                        <button onClick={onClose} className="w-full py-4 text-xs font-bold text-gray-400 hover:text-gray-800 transition-colors">
                            Cerrar y volver a la lista
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const PrivateDocsSection = ({ guestId }) => {
    const [docs, setDocs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [title, setTitle] = useState('');
    const fileInputRef = React.useRef(null);

    useEffect(() => {
        fetchDocs();
    }, [guestId]);

    const fetchDocs = async () => {
        const { data } = await supabase
            .from('documents')
            .select('*')
            .eq('profile_id', guestId);
        if (data) setDocs(data);
    };

    const handleUpload = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file || !title) return alert('Ponle un título y selecciona un archivo (PDF, Imagen...)');

        setUploading(true);
        try {
            const fileName = `${Date.now()}_factura_${guestId.slice(0, 5)}_${file.name.replace(/\s/g, '_')}`;
            const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);

            const { error } = await supabase.from('documents').insert([{
                title,
                file_url: publicUrl,
                visibility: 'privado',
                category: 'factura',
                profile_id: guestId
            }]);

            if (error) throw error;
            setTitle('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchDocs();
        } catch (e) {
            alert('Error: ' + e.message);
        }
        setUploading(false);
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Borrar este documento?')) return;
        await supabase.from('documents').delete().eq('id', id);
        fetchDocs();
    };

    return (
        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
            <h5 className="flex items-center gap-2 font-bold text-rural-900 mb-6 uppercase tracking-widest text-[10px]">
                <Lock size={16} style={{ color: COLORS.primary }} /> Documentos Privados del Huésped
            </h5>

            <div className="flex flex-col md:flex-row gap-4 mb-8 p-6 bg-rural-50 rounded-3xl border border-rural-100">
                <div className="flex-grow">
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Ej: Factura Estancia Agosto 2025"
                        className="w-full p-3 rounded-xl border border-white text-sm mb-3"
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="w-full text-[10px] text-gray-400"
                        accept=".pdf,.jpg,.jpeg,.png"
                    />
                </div>
                <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-6 py-2 bg-rural-600 text-white rounded-xl font-bold text-xs shadow-md transition-all hover:scale-105"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    {uploading ? 'Subiendo...' : 'Subir Documento'}
                </button>
            </div>

            <div className="space-y-3">
                {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:bg-gray-50/50 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-rural-600 shadow-sm">
                                <FileText size={16} />
                            </div>
                            <div>
                                <p className="font-bold text-rural-900 text-xs">{doc.title}</p>
                                <p className="text-[8px] text-gray-400 uppercase font-mono">{new Date(doc.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-300 hover:text-blue-500"><Download size={14} /></a>
                            <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={14} /></button>
                        </div>
                    </div>
                ))}
                {docs.length === 0 && (
                    <p className="text-center py-6 text-gray-300 italic text-xs">No hay documentos privados cargados todavía.</p>
                )}
            </div>
        </div>
    );
};

export default GuestUserManager;

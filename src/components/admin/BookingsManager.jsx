import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { useAllBookings } from '../../hooks/useDatabase';
import { logError, userErrorMessage } from '../../utils/logger';
import {
    Clock, CheckCircle, XCircle, CalendarCheck, CalendarX,
    Phone, Mail, Users, MapPin, MessageCircle, Loader2,
    Filter, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';

const STATUS_CONFIG = {
    pending: { label: 'Pendiente', color: 'amber', icon: Clock, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    confirmed: { label: 'Confirmada', color: 'green', icon: CheckCircle, bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    cancelled: { label: 'Rechazada', color: 'red', icon: XCircle, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    completed: { label: 'Completada', color: 'gray', icon: CalendarCheck, bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
};

const BookingsManager = () => {
    const { bookings, loading } = useAllBookings();
    const [filter, setFilter] = useState('all');
    const [expandedId, setExpandedId] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(null);
    const [showInviteModal, setShowInviteModal] = useState(null); // booking object after confirm

    const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);
    const pendingCount = bookings.filter(b => b.status === 'pending').length;

    const updateStatus = async (id, newStatus, extras = {}) => {
        setActionLoading(id);
        const { error } = await supabase
            .from('guest_bookings')
            .update({ status: newStatus, updated_at: new Date().toISOString(), ...extras })
            .eq('id', id);

        if (error) {
            logError('BookingsManager.updateStatus', error);
            alert(userErrorMessage('Error al actualizar la reserva.'));
        } else {
            const booking = bookings.find(b => b.id === id);

            if (newStatus === 'confirmed') {
                // Actualizar source de las fechas bloqueadas de pending a confirmed
                if (booking?.apartment_id) {
                    await supabase.from('blocked_dates')
                        .update({ source: 'booking' })
                        .eq('apartment_id', booking.apartment_id)
                        .eq('start_date', booking.check_in)
                        .eq('end_date', booking.check_out)
                        .eq('source', 'booking_pending');
                }

                // Auto-crear perfil de huésped si no existe
                try {
                    const guestEmail = booking.guest_email?.toLowerCase().trim();
                    const { data: existingProfile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('email', guestEmail)
                        .single();

                    if (!existingProfile) {
                        const userId = self.crypto.randomUUID();
                        await supabase.from('profiles').insert({
                            id: userId,
                            full_name: booking.guest_name,
                            email: guestEmail,
                            phone: booking.guest_phone || null,
                            pax_count: booking.pax_count || 2,
                            check_in: booking.check_in,
                            check_out: booking.check_out,
                            role: 'cliente',
                            is_active: true,
                            access_mode: 'always',
                            is_profile_completed: false,
                            updated_at: new Date().toISOString(),
                        });
                    } else {
                        // Actualizar fechas de estancia en perfil existente
                        await supabase.from('profiles')
                            .update({ check_in: booking.check_in, check_out: booking.check_out, updated_at: new Date().toISOString() })
                            .eq('id', existingProfile.id);
                    }
                } catch (e) {
                    logError('BookingsManager.autoCreateProfile', e);
                }

                // Notificar al cliente por email
                try {
                    await supabase.functions.invoke('booking-status-update', {
                        body: { booking_id: id, status: 'confirmed' },
                    });
                } catch (e) {
                    logError('BookingsManager.notifyConfirm', e);
                }

                // Mostrar modal de invitación para enviar por WhatsApp
                setShowInviteModal(booking);
            }

            if (newStatus === 'cancelled') {
                // Liberar las fechas bloqueadas
                if (booking?.apartment_id) {
                    await supabase.from('blocked_dates')
                        .delete()
                        .eq('apartment_id', booking.apartment_id)
                        .eq('start_date', booking.check_in)
                        .eq('end_date', booking.check_out)
                        .in('source', ['booking_pending', 'booking']);
                }

                try {
                    await supabase.functions.invoke('booking-status-update', {
                        body: { booking_id: id, status: 'cancelled', reason: rejectReason },
                    });
                } catch (e) {
                    logError('BookingsManager.notifyCancel', e);
                }
                setShowRejectModal(null);
                setRejectReason('');
            }
        }
        setActionLoading(null);
    };

    const handleReject = (id) => {
        setShowRejectModal(id);
        setRejectReason('');
    };

    const confirmReject = () => {
        if (showRejectModal) {
            updateStatus(showRejectModal, 'cancelled', { notes: rejectReason ? `Motivo rechazo: ${rejectReason}` : undefined });
        }
    };

    const formatDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatDateTime = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const getWhatsAppUrl = (booking) => {
        const msg = `Hola ${booking.guest_name}, sobre tu reserva en ${booking.apartments?.name || 'nuestro apartamento'} del ${formatDate(booking.check_in)} al ${formatDate(booking.check_out)}.`;
        const phone = booking.guest_phone?.replace(/\D/g, '') || '34676344675';
        return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    };

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando reservas...</div>;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Reservas</h3>
                    <p className="text-sm text-gray-500">
                        {pendingCount > 0 ? `${pendingCount} reserva${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de aprobación` : 'Todas las reservas al día'}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'all', label: 'Todas', count: bookings.length },
                    { key: 'pending', label: 'Pendientes', count: bookings.filter(b => b.status === 'pending').length },
                    { key: 'confirmed', label: 'Confirmadas', count: bookings.filter(b => b.status === 'confirmed').length },
                    { key: 'cancelled', label: 'Rechazadas', count: bookings.filter(b => b.status === 'cancelled').length },
                    { key: 'completed', label: 'Completadas', count: bookings.filter(b => b.status === 'completed').length },
                ].map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === f.key ? 'text-white shadow-md' : 'bg-white border border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                        style={filter === f.key ? { backgroundColor: COLORS.primary } : {}}
                    >
                        {f.label} {f.count > 0 && <span className="ml-1 opacity-70">({f.count})</span>}
                    </button>
                ))}
            </div>

            {/* Booking list */}
            <div className="space-y-4">
                {filtered.length === 0 && (
                    <div className="p-20 text-center bg-white border-2 border-dashed rounded-3xl opacity-30 italic font-serif">
                        No hay reservas {filter !== 'all' ? `con estado "${STATUS_CONFIG[filter]?.label}"` : ''}.
                    </div>
                )}

                {filtered.map(booking => {
                    const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                    const StatusIcon = status.icon;
                    const isExpanded = expandedId === booking.id;
                    const isPending = booking.status === 'pending';
                    const isConfirmed = booking.status === 'confirmed';

                    return (
                        <div
                            key={booking.id}
                            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isPending ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-100'}`}
                        >
                            {/* Main row */}
                            <div
                                className="p-5 flex items-center gap-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                                onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status.bg}`}>
                                    <StatusIcon size={20} className={status.text} />
                                </div>

                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-gray-800 truncate">{booking.guest_name}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                                            {status.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        {booking.apartments?.name || 'Apartamento'} · {formatDate(booking.check_in)} → {formatDate(booking.check_out)} · {booking.nights || '—'} noches
                                    </p>
                                </div>

                                <div className="hidden md:block text-right">
                                    {booking.total_price ? (
                                        <p className="font-bold text-lg" style={{ color: COLORS.text }}>{booking.total_price}€</p>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">Sin precio</p>
                                    )}
                                    <p className="text-[10px] text-gray-400">{formatDateTime(booking.created_at)}</p>
                                </div>

                                <div className="text-gray-300">
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </div>

                            {/* Expanded details */}
                            {isExpanded && (
                                <div className="border-t border-gray-100 p-5 space-y-4 bg-gray-50/30">
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div className="space-y-3">
                                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Datos del cliente</h5>
                                            <div className="space-y-2 text-sm">
                                                <p className="flex items-center gap-2 text-gray-600">
                                                    <Mail size={14} className="text-gray-400" /> {booking.guest_email}
                                                </p>
                                                {booking.guest_phone && (
                                                    <p className="flex items-center gap-2 text-gray-600">
                                                        <Phone size={14} className="text-gray-400" /> {booking.guest_phone}
                                                    </p>
                                                )}
                                                <p className="flex items-center gap-2 text-gray-600">
                                                    <Users size={14} className="text-gray-400" /> {booking.pax_count} huésped{booking.pax_count > 1 ? 'es' : ''}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Desglose precio</h5>
                                            {booking.price_breakdown?.hasPrices !== false && booking.price_breakdown ? (
                                                <div className="space-y-1 text-sm">
                                                    {booking.price_breakdown.lowNights > 0 && (
                                                        <p className="text-gray-600">{booking.price_breakdown.lowNights} noches × {booking.price_breakdown.priceLow}€ (baja)</p>
                                                    )}
                                                    {booking.price_breakdown.highNights > 0 && (
                                                        <p className="text-amber-600">{booking.price_breakdown.highNights} noches × {booking.price_breakdown.priceHigh}€ (alta)</p>
                                                    )}
                                                    <p className="font-bold pt-1 border-t border-gray-200" style={{ color: COLORS.text }}>Total: {booking.total_price}€</p>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-400 italic">Precio a confirmar</p>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Notas</h5>
                                            <p className="text-sm text-gray-600 italic">
                                                {booking.notes || 'Sin notas'}
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                Fuente: {booking.source || 'web'} · Solicitud: {formatDateTime(booking.created_at)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                                        <a
                                            href={getWhatsAppUrl(booking)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-bold hover:bg-green-100 transition-all"
                                        >
                                            <MessageCircle size={16} /> WhatsApp
                                        </a>
                                        <a
                                            href={`mailto:${booking.guest_email}`}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all"
                                        >
                                            <Mail size={16} /> Email
                                        </a>

                                        {isPending && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'confirmed'); }}
                                                    disabled={actionLoading === booking.id}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all ml-auto disabled:opacity-50"
                                                >
                                                    {actionLoading === booking.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                                    Confirmar
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleReject(booking.id); }}
                                                    disabled={actionLoading === booking.id}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all disabled:opacity-50"
                                                >
                                                    <XCircle size={16} /> Rechazar
                                                </button>
                                            </>
                                        )}

                                        {isConfirmed && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'completed'); }}
                                                disabled={actionLoading === booking.id}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all ml-auto disabled:opacity-50"
                                            >
                                                {actionLoading === booking.id ? <Loader2 size={16} className="animate-spin" /> : <CalendarCheck size={16} />}
                                                Marcar Completada
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Reject modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                                <XCircle size={20} className="text-red-500" />
                            </div>
                            <h4 className="font-serif font-bold text-lg" style={{ color: COLORS.text }}>Rechazar reserva</h4>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Motivo (opcional)</label>
                            <textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                rows={3}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none resize-none"
                                placeholder="Ej: No hay disponibilidad en esas fechas..."
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmReject}
                                disabled={actionLoading === showRejectModal}
                                className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                                {actionLoading === showRejectModal ? 'Rechazando...' : 'Confirmar rechazo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite modal — shown after confirming a booking */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
                        <div className="text-center">
                            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                                <CheckCircle size={28} className="text-green-500" />
                            </div>
                            <h4 className="font-serif font-bold text-xl" style={{ color: COLORS.text }}>Reserva confirmada</h4>
                            <p className="text-sm text-gray-500 mt-1">
                                Perfil de <strong>{showInviteModal.guest_name}</strong> creado. Enviale la invitacion para que acceda a su area de cliente.
                            </p>
                        </div>

                        <div className="bg-rural-50 p-4 rounded-xl border border-rural-100 text-sm text-gray-600 italic leading-relaxed">
                            "Hola {showInviteModal.guest_name?.split(' ')[0]}, tu reserva en {showInviteModal.apartments?.name || 'Tio Jose Maria'} esta confirmada ({formatDate(showInviteModal.check_in)} → {formatDate(showInviteModal.check_out)}). Para acceder a tu guia, WiFi, rutas y servicios, entra aqui con tu email: {window.location.origin}/clientes"
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <a
                                href={`https://api.whatsapp.com/send?phone=${showInviteModal.guest_phone?.replace(/\D/g, '') || ''}&text=${encodeURIComponent(`Hola ${showInviteModal.guest_name?.split(' ')[0]}, tu reserva en ${showInviteModal.apartments?.name || 'Tío José María'} está confirmada (${formatDate(showInviteModal.check_in)} → ${formatDate(showInviteModal.check_out)}). Para acceder a tu guía, WiFi, rutas y servicios, entra aquí con tu email: ${window.location.origin}/clientes`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all"
                            >
                                <MessageCircle size={16} /> WhatsApp
                            </a>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`Hola ${showInviteModal.guest_name?.split(' ')[0]}, tu reserva en ${showInviteModal.apartments?.name || 'Tío José María'} está confirmada (${formatDate(showInviteModal.check_in)} → ${formatDate(showInviteModal.check_out)}). Para acceder a tu guía, WiFi, rutas y servicios, entra aquí con tu email: ${window.location.origin}/clientes`);
                                    alert('Mensaje copiado');
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                            >
                                <Mail size={16} /> Copiar texto
                            </button>
                        </div>

                        <button
                            onClick={() => setShowInviteModal(null)}
                            className="w-full py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingsManager;

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../App';
import { logError, userErrorMessage } from '../../utils/logger';
import { CheckCircle, XCircle, Clock, Star, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';

const STATUS_CONFIG = {
    pending: { label: 'Pendiente', icon: Clock, bg: 'bg-amber-50', text: 'text-amber-700' },
    approved: { label: 'Aprobada', icon: CheckCircle, bg: 'bg-green-50', text: 'text-green-700' },
    rejected: { label: 'Rechazada', icon: XCircle, bg: 'bg-red-50', text: 'text-red-700' },
};

const ReviewsManager = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchReviews();
    }, []);

    async function fetchReviews() {
        setLoading(true);
        const { data, error } = await supabase
            .from('reviews')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) logError('ReviewsManager.fetch', error);
        if (data) setReviews(data);
        setLoading(false);
    }

    const updateReview = async (id, updates) => {
        setActionLoading(id);
        const { error } = await supabase.from('reviews').update(updates).eq('id', id);
        if (error) {
            logError('ReviewsManager.update', error);
            alert(userErrorMessage('Error al actualizar la reseña.'));
        } else {
            fetchReviews();
        }
        setActionLoading(null);
    };

    const handleApprove = (id) => updateReview(id, { status: 'approved', active: true });
    const handleReject = (id) => updateReview(id, { status: 'rejected', active: false });
    const handleToggleVisible = (review) => updateReview(review.id, { active: !review.active });

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta reseña permanentemente?')) return;
        const { error } = await supabase.from('reviews').delete().eq('id', id);
        if (!error) fetchReviews();
    };

    const filtered = filter === 'all' ? reviews : reviews.filter(r => r.status === filter);
    const pendingCount = reviews.filter(r => r.status === 'pending').length;

    if (loading) return <div className="p-10 text-center italic opacity-50">Cargando reseñas...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-bold" style={{ color: COLORS.text }}>Reseñas</h3>
                    <p className="text-sm text-gray-500">
                        {pendingCount > 0 ? `${pendingCount} reseña${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de aprobación` : `${reviews.length} reseñas en total`}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'all', label: 'Todas', count: reviews.length },
                    { key: 'pending', label: 'Pendientes', count: reviews.filter(r => r.status === 'pending').length },
                    { key: 'approved', label: 'Aprobadas', count: reviews.filter(r => r.status === 'approved').length },
                    { key: 'rejected', label: 'Rechazadas', count: reviews.filter(r => r.status === 'rejected').length },
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

            <div className="space-y-4">
                {filtered.length === 0 && (
                    <div className="p-20 text-center bg-white border-2 border-dashed rounded-3xl opacity-30 italic font-serif">
                        No hay reseñas {filter !== 'all' ? `con estado "${STATUS_CONFIG[filter]?.label}"` : ''}.
                    </div>
                )}

                {filtered.map(review => {
                    const status = STATUS_CONFIG[review.status] || STATUS_CONFIG.pending;
                    const StatusIcon = status.icon;
                    const isPending = review.status === 'pending';

                    return (
                        <div
                            key={review.id}
                            className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${isPending ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-100'}`}
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 pt-1">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status.bg}`}>
                                        <StatusIcon size={20} className={status.text} />
                                    </div>
                                </div>

                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="font-bold text-gray-800">{review.author}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                                            {status.label}
                                        </span>
                                        <span className="text-xs text-gray-400">{review.source}</span>
                                        {!review.active && review.status === 'approved' && (
                                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><EyeOff size={10} /> Oculta</span>
                                        )}
                                    </div>

                                    <div className="flex gap-0.5 mb-2">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} size={14} className={i < (review.rating || 5) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                                        ))}
                                    </div>

                                    <p className="text-sm text-gray-600 italic leading-relaxed">"{review.content}"</p>

                                    <p className="text-[10px] text-gray-400 mt-2">
                                        {new Date(review.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>

                                <div className="flex-shrink-0 flex gap-1">
                                    {isPending && (
                                        <>
                                            <button
                                                onClick={() => handleApprove(review.id)}
                                                disabled={actionLoading === review.id}
                                                className="p-2 text-green-500 hover:bg-green-50 rounded-xl transition-all"
                                                title="Aprobar"
                                            >
                                                {actionLoading === review.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                            </button>
                                            <button
                                                onClick={() => handleReject(review.id)}
                                                disabled={actionLoading === review.id}
                                                className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                                                title="Rechazar"
                                            >
                                                <XCircle size={18} />
                                            </button>
                                        </>
                                    )}
                                    {!isPending && (
                                        <button
                                            onClick={() => handleToggleVisible(review)}
                                            className="p-2 text-gray-400 hover:bg-gray-50 rounded-xl transition-all"
                                            title={review.active ? 'Ocultar de la web' : 'Mostrar en la web'}
                                        >
                                            {review.active ? <Eye size={18} /> : <EyeOff size={18} />}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(review.id)}
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ReviewsManager;

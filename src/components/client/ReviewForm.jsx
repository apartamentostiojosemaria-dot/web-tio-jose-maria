import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logError } from '../../utils/logger';

const ReviewForm = ({ profile }) => {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [text, setText] = useState('');
    const [status, setStatus] = useState('idle'); // idle | sending | success | error

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) return;

        setStatus('sending');

        const { error } = await supabase.from('reviews').insert({
            name: profile?.full_name || 'Huésped',
            text,
            score: String(rating * 2),
            active: false,
            status: 'pending',
            profile_id: profile?.id
        });

        if (error) {
            logError('ReviewForm.submit', error);
            setStatus('error');
        } else {
            setStatus('success');
        }
    };

    return (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
            <h3 className="font-serif text-lg font-bold mb-1 text-text-primary">
                Deja tu opinión
            </h3>
            <p className="text-sm text-gray-400 mb-6">Tu reseña nos ayuda a mejorar y a que otros viajeros nos conozcan.</p>

            <AnimatePresence mode="wait">
                {status === 'success' ? (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-8"
                    >
                        <p className="text-3xl mb-3">🎉</p>
                        <p className="font-bold text-lg text-text-primary">¡Gracias por tu opinión!</p>
                        <p className="text-sm text-gray-400 mt-1">La publicaremos una vez revisada.</p>
                    </motion.div>
                ) : (
                    <motion.form key="form" onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tu valoración</p>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        className="p-1 transition-transform hover:scale-110"
                                    >
                                        <Star
                                            size={28}
                                            fill={(hoverRating || rating) >= star ? '#f59e0b' : 'none'}
                                            stroke={(hoverRating || rating) >= star ? '#f59e0b' : '#d1d5db'}
                                            strokeWidth={1.5}
                                        />
                                    </button>
                                ))}
                            </div>
                            {rating === 0 && status === 'error' && (
                                <p className="text-xs text-red-400 mt-1">Selecciona una valoración</p>
                            )}
                        </div>

                        <div>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Cuéntanos tu experiencia en Tío José María..."
                                required
                                rows={4}
                                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-rural-200 focus:border-rural-400 resize-none text-sm transition-all"
                            />
                        </div>

                        {status === 'error' && (
                            <p className="text-xs text-red-400">Ha ocurrido un error. Inténtalo de nuevo.</p>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'sending' || rating === 0}
                            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-all hover:shadow-lg disabled:opacity-40 disabled:hover:shadow-none bg-primary"
                        >
                            <Send size={16} />
                            {status === 'sending' ? 'Enviando...' : 'Enviar opinión'}
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReviewForm;

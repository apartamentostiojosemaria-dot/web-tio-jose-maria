import React from 'react';

/**
 * Prueba social compacta para colocar junto al CTA de reserva (justo debajo
 * del BookingWidget). Objetivo: acercar la valoración de Booking + una cita
 * real al punto de decisión, sin competir en tamaño con el widget.
 */
const SocialProofCard = ({
    score = '9,5/10',
    reviewsLabel = '+45 opiniones',
    quote,
    author,
    source = 'Booking.com',
    href = 'https://www.booking.com/hotel/es/casa-rural-tio-jose-maria.es.html#tab-reviews',
}) => (
    <div className="mt-4 bg-rural-50 border border-rural-100 rounded-2xl p-4 flex flex-col gap-3">
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 group"
        >
            <div className="flex items-center gap-2.5">
                <div role="img" aria-label="Valoración: 5 estrellas" className="flex gap-0.5 text-yellow-400 text-sm leading-none">
                    {[...Array(5)].map((_, star) => <span key={star} aria-hidden="true">&#9733;</span>)}
                </div>
                <span className="font-serif font-bold text-rural-800 text-sm">{score} en Booking</span>
            </div>
            <span className="text-xs font-bold text-primary underline decoration-rural-300 underline-offset-2 group-hover:text-rural-800 transition-colors whitespace-nowrap">
                {reviewsLabel}
            </span>
        </a>
        {quote && (
            <p className="text-sm italic text-gray-600 leading-relaxed border-t border-rural-100 pt-3">
                &ldquo;{quote}&rdquo;
                <span className="block not-italic text-[11px] font-bold text-gray-500 mt-1.5 uppercase tracking-wide">
                    — {author}, {source}
                </span>
            </p>
        )}
    </div>
);

export default SocialProofCard;

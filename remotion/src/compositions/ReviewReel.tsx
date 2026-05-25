import {
    AbsoluteFill,
    Img,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import { loadFont } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadLato } from '@remotion/google-fonts/Lato';

const { fontFamily: serif } = loadFont();
const { fontFamily: sans } = loadLato();

export const reviewReelSchema = z.object({
    rating: z.number().min(1).max(5),
    author: z.string(),
    comment: z.string(),
    apartmentName: z.string(),
    apartmentImage: z.string().url(),
});

type Props = z.infer<typeof reviewReelSchema>;

const Stars: React.FC<{ count: number; delay: number }> = ({ count, delay }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    return (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {Array.from({ length: 5 }).map((_, i) => {
                const s = spring({
                    frame: frame - delay - i * 4,
                    fps,
                    config: { damping: 12, stiffness: 200 },
                });
                return (
                    <span
                        key={i}
                        style={{
                            fontSize: 72,
                            color: i < count ? '#F5C518' : 'rgba(255,255,255,0.2)',
                            transform: `scale(${s})`,
                            display: 'inline-block',
                            lineHeight: 1,
                        }}
                    >
                        ★
                    </span>
                );
            })}
        </div>
    );
};

/**
 * Reel vertical 1080x1920 para Instagram/TikTok cuando llega review 5★.
 * Estructura: hero foto del apto con Ken Burns → tarjeta con review → CTA.
 */
export const ReviewReel: React.FC<Props> = ({
    rating,
    author,
    comment,
    apartmentName,
    apartmentImage,
}) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    // Foto fondo: paneo lento + zoom
    const bgScale = interpolate(frame, [0, durationInFrames], [1.05, 1.18]);
    const bgY = interpolate(frame, [0, durationInFrames], [0, -40]);

    // Tarjeta entra deslizándose desde abajo
    const cardSpring = spring({ frame: frame - fps * 0.5, fps, config: { damping: 14 } });
    const cardY = interpolate(cardSpring, [0, 1], [200, 0]);
    const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);

    // CTA aparece al final
    const ctaIn = spring({ frame: frame - fps * 9, fps, config: { damping: 16 } });
    const ctaY = interpolate(ctaIn, [0, 1], [60, 0]);
    const ctaOpacity = interpolate(ctaIn, [0, 1], [0, 1]);

    return (
        <AbsoluteFill style={{ backgroundColor: '#1a3a2e' }}>
            <Img
                src={apartmentImage}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: `scale(${bgScale}) translateY(${bgY}px)`,
                }}
            />
            <AbsoluteFill
                style={{
                    background:
                        'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 35%, rgba(0,0,0,0.85) 100%)',
                }}
            />

            {/* Logo/header arriba */}
            <div
                style={{
                    position: 'absolute',
                    top: 80,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                }}
            >
                <div
                    style={{
                        fontFamily: sans,
                        color: 'rgba(255,255,255,0.9)',
                        fontSize: 28,
                        letterSpacing: 6,
                        textTransform: 'uppercase',
                        fontWeight: 700,
                    }}
                >
                    Tío José María
                </div>
                <div
                    style={{
                        fontFamily: sans,
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: 22,
                        letterSpacing: 4,
                        marginTop: 8,
                    }}
                >
                    Hinojares · Cazorla
                </div>
            </div>

            {/* Tarjeta review */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 360,
                    left: 60,
                    right: 60,
                    padding: '70px 50px',
                    background: 'rgba(255,255,255,0.97)',
                    borderRadius: 36,
                    opacity: cardOpacity,
                    transform: `translateY(${cardY}px)`,
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                }}
            >
                <div style={{ marginBottom: 40 }}>
                    <Stars count={rating} delay={fps * 0.8} />
                </div>
                <div
                    style={{
                        fontFamily: serif,
                        fontSize: 52,
                        lineHeight: 1.3,
                        color: '#1a3a2e',
                        fontWeight: 700,
                        marginBottom: 36,
                        textAlign: 'center',
                    }}
                >
                    “{comment}”
                </div>
                <div
                    style={{
                        fontFamily: sans,
                        fontSize: 30,
                        color: '#666',
                        textAlign: 'center',
                        letterSpacing: 1,
                    }}
                >
                    — {author} · Apto. {apartmentName}
                </div>
            </div>

            {/* CTA inferior */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 140,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    opacity: ctaOpacity,
                    transform: `translateY(${ctaY}px)`,
                }}
            >
                <div
                    style={{
                        display: 'inline-block',
                        background: '#c97a3c',
                        color: 'white',
                        padding: '24px 60px',
                        borderRadius: 999,
                        fontFamily: sans,
                        fontSize: 36,
                        fontWeight: 700,
                        letterSpacing: 1,
                    }}
                >
                    tiojosemaria.com
                </div>
            </div>
        </AbsoluteFill>
    );
};

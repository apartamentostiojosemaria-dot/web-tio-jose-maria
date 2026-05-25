import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { z } from 'zod';

export const kenBurnsHeroSchema = z.object({
    images: z.array(z.string().url()).min(2).max(8),
});

type Props = z.infer<typeof kenBurnsHeroSchema>;

/**
 * Loop horizontal 1920x1080 con efecto Ken Burns (paneo + zoom) y
 * fades cruzados entre fotos. Pensado para reemplazar el <img> del
 * hero de la home como fondo en bucle silencioso.
 */
export const KenBurnsHero: React.FC<Props> = ({ images }) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    const slideFrames = durationInFrames / images.length;
    const fadeFrames = fps * 1.2; // 1.2s de fade entre slides

    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {images.map((src, i) => {
                const start = i * slideFrames;
                const end = start + slideFrames;

                // Opacidad con fade-in al inicio y fade-out al final del slide
                const opacity = interpolate(
                    frame,
                    [start, start + fadeFrames, end - fadeFrames, end],
                    [0, 1, 1, 0],
                    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                );

                // Si todos los slides están a 0, no renderizar
                if (opacity <= 0) return null;

                // Ken Burns: zoom 1.0 → 1.12 + ligero paneo lateral
                const progress = interpolate(frame, [start, end], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                });

                const scale = interpolate(progress, [0, 1], [1.0, 1.12]);
                // Alterna dirección de paneo: pares hacia derecha, impares hacia izquierda
                const direction = i % 2 === 0 ? 1 : -1;
                const translateX = direction * interpolate(progress, [0, 1], [0, 30]);
                const translateY = interpolate(progress, [0, 1], [0, -15]);

                return (
                    <AbsoluteFill key={src} style={{ opacity }}>
                        <Img
                            src={src}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
                                transformOrigin: 'center center',
                            }}
                        />
                        {/* Overlay degradado para mantener legibilidad del texto del hero */}
                        <AbsoluteFill
                            style={{
                                background:
                                    'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)',
                            }}
                        />
                    </AbsoluteFill>
                );
            })}
        </AbsoluteFill>
    );
};

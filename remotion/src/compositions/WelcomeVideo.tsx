import {
    AbsoluteFill,
    Img,
    interpolate,
    Sequence,
    spring,
    useCurrentFrame,
    useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import { loadFont } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadLato } from '@remotion/google-fonts/Lato';

const { fontFamily: serif } = loadFont();
const { fontFamily: sans } = loadLato();

export const welcomeVideoSchema = z.object({
    guestName: z.string(),
    apartmentName: z.string(),
    checkIn: z.string(), // YYYY-MM-DD
    checkOut: z.string(),
    apartmentImages: z.array(z.string().url()).min(1).max(5),
});

type Props = z.infer<typeof welcomeVideoSchema>;

function formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

const Scene: React.FC<{ children: React.ReactNode; bg: string }> = ({ children, bg }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const s = spring({ frame: frame - fps * 0.2, fps, config: { damping: 14 } });
    const y = interpolate(s, [0, 1], [30, 0]);
    const opacity = interpolate(s, [0, 1], [0, 1]);

    return (
        <AbsoluteFill style={{ backgroundColor: bg }}>
            <div style={{ opacity, transform: `translateY(${y}px)`, width: '100%', height: '100%' }}>
                {children}
            </div>
        </AbsoluteFill>
    );
};

/**
 * Vídeo personalizado 10-15s tras confirmar reserva.
 * Escenas: 1) Hola {nombre} 2) Tu apto + fechas 3) Te esperamos en Hinojares
 */
export const WelcomeVideo: React.FC<Props> = ({
    guestName,
    apartmentName,
    checkIn,
    checkOut,
    apartmentImages,
}) => {
    const { fps } = useVideoConfig();
    const heroImg = apartmentImages[0];

    return (
        <AbsoluteFill style={{ backgroundColor: '#1a3a2e' }}>
            {/* Escena 1: Hola personalizado (0-3.5s) */}
            <Sequence from={0} durationInFrames={fps * 3.5}>
                <Scene bg="#1a3a2e">
                    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 80 }}>
                        <div
                            style={{
                                fontFamily: sans,
                                fontSize: 28,
                                color: '#c4a168',
                                letterSpacing: 6,
                                textTransform: 'uppercase',
                                marginBottom: 40,
                                fontWeight: 700,
                            }}
                        >
                            Tío José María
                        </div>
                        <div
                            style={{
                                fontFamily: serif,
                                fontSize: 96,
                                color: 'white',
                                fontWeight: 700,
                                textAlign: 'center',
                                lineHeight: 1.1,
                            }}
                        >
                            Hola
                            <br />
                            {guestName}
                        </div>
                    </AbsoluteFill>
                </Scene>
            </Sequence>

            {/* Escena 2: Foto del apto + fechas (3.5-9s) */}
            <Sequence from={fps * 3.5} durationInFrames={fps * 5.5}>
                <AbsoluteFill>
                    <Img
                        src={heroImg}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.2))' }} />
                    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 200 }}>
                        <div
                            style={{
                                fontFamily: sans,
                                fontSize: 26,
                                color: 'rgba(255,255,255,0.8)',
                                letterSpacing: 5,
                                textTransform: 'uppercase',
                                marginBottom: 24,
                            }}
                        >
                            Tu apartamento
                        </div>
                        <div
                            style={{
                                fontFamily: serif,
                                fontSize: 110,
                                color: 'white',
                                fontWeight: 700,
                                marginBottom: 50,
                            }}
                        >
                            {apartmentName}
                        </div>
                        <div
                            style={{
                                fontFamily: sans,
                                fontSize: 38,
                                color: '#c4a168',
                                fontWeight: 700,
                                background: 'rgba(0,0,0,0.4)',
                                padding: '18px 40px',
                                borderRadius: 999,
                                backdropFilter: 'blur(8px)',
                            }}
                        >
                            Del {formatDate(checkIn)} al {formatDate(checkOut)}
                        </div>
                    </AbsoluteFill>
                </AbsoluteFill>
            </Sequence>

            {/* Escena 3: Te esperamos (9-13s) */}
            <Sequence from={fps * 9} durationInFrames={fps * 4}>
                <Scene bg="#1a3a2e">
                    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 80 }}>
                        <div
                            style={{
                                fontFamily: serif,
                                fontSize: 84,
                                color: 'white',
                                fontWeight: 700,
                                textAlign: 'center',
                                lineHeight: 1.2,
                                marginBottom: 50,
                            }}
                        >
                            Te esperamos
                            <br />
                            <span style={{ color: '#c4a168' }}>en Hinojares</span>
                        </div>
                        <div
                            style={{
                                fontFamily: sans,
                                fontSize: 30,
                                color: 'rgba(255,255,255,0.7)',
                                textAlign: 'center',
                                letterSpacing: 2,
                            }}
                        >
                            Sierra de Cazorla · Jaén
                        </div>
                    </AbsoluteFill>
                </Scene>
            </Sequence>
        </AbsoluteFill>
    );
};

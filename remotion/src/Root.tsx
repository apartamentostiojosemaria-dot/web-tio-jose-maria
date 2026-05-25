import { Composition } from 'remotion';
import { KenBurnsHero, kenBurnsHeroSchema } from './compositions/KenBurnsHero';
import { ReviewReel, reviewReelSchema } from './compositions/ReviewReel';
import { WelcomeVideo, welcomeVideoSchema } from './compositions/WelcomeVideo';

// Fotos por defecto del bucket público de Supabase
const WP = 'https://nmtukksbzbnuzqsksdmw.supabase.co/storage/v1/object/public/apartments/website/general';

export const Root: React.FC = () => {
    return (
        <>
            {/* Hero horizontal para fondo de la home (web desktop + tablet) */}
            <Composition
                id="KenBurnsHero"
                component={KenBurnsHero}
                durationInFrames={30 * 18} // 18s loop
                fps={30}
                width={1920}
                height={1080}
                schema={kenBurnsHeroSchema}
                defaultProps={{
                    images: [
                        `${WP}/slide1.jpg`,
                        `${WP}/slide2.jpg`,
                        `${WP}/slide3.jpg`,
                        `${WP}/slide-1.jpg`,
                    ],
                }}
            />

            {/* Reel vertical para Instagram/TikTok cuando llega review 5★ */}
            <Composition
                id="ReviewReel"
                component={ReviewReel}
                durationInFrames={30 * 12} // 12s
                fps={30}
                width={1080}
                height={1920}
                schema={reviewReelSchema}
                defaultProps={{
                    rating: 5,
                    author: 'María',
                    comment: 'Una experiencia inolvidable. La casa es preciosa, con un encanto especial. Volveremos seguro.',
                    apartmentName: 'Tomillo',
                    apartmentImage: `${WP}/slide1.jpg`,
                }}
            />

            {/* Vídeo welcome personalizado tras confirmar reserva */}
            <Composition
                id="WelcomeVideo"
                component={WelcomeVideo}
                durationInFrames={30 * 13} // 13s
                fps={30}
                width={1080}
                height={1920}
                schema={welcomeVideoSchema}
                defaultProps={{
                    guestName: 'Juan',
                    apartmentName: 'Tomillo',
                    checkIn: '2026-06-12',
                    checkOut: '2026-06-15',
                    apartmentImages: [
                        `${WP}/slide1.jpg`,
                        `${WP}/slide2.jpg`,
                        `${WP}/slide3.jpg`,
                    ],
                }}
            />
        </>
    );
};

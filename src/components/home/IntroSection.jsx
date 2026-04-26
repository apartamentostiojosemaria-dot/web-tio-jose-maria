import FadeInUp from '../shared/FadeInUp';
import { WP } from '../../constants/urls';

const DEFAULT_INTRO_TEXT = `Bienvenidos a Tío José María. Ubicados en el sur del Parque Natural de Cazorla, nuestros 4 apartamentos combinan la arquitectura tradicional andaluza con el confort moderno.\n\nMuros de piedra, techos de vigas de madera y el calor de la chimenea te esperan. Ideal para parejas que buscan intimidad o familias que desean reconectar con la naturaleza.`;
const DEFAULT_HEADING = 'Más que una casa rural, es historia viva.';
const DEFAULT_BULLETS = [
    'Ubicación privilegiada en Hinojares',
    'Chimenea de leña en todos los apartamentos',
    'WiFi gratuito y ambiente familiar',
];

// Renderiza el heading partiendo en la primera coma para conservar el estilo
// (segunda mitad en color primario y cursiva). Si no hay coma, lo muestra entero.
function renderStyledHeading(heading) {
    const idx = heading.indexOf(',');
    if (idx < 0) return heading;
    const head = heading.slice(0, idx + 1);
    const tail = heading.slice(idx + 1).trim();
    return (
        <>
            {head} <br className="hidden md:block" />
            <span className="text-primary italic">{tail}</span>
        </>
    );
}

const IntroSection = ({ config = {}, text }) => {
    const heading = config.intro_heading || DEFAULT_HEADING;
    const introText = config.intro_text || text || DEFAULT_INTRO_TEXT;
    const imageUrl = config.intro_image_url || `${WP}/slide5.jpg`;
    const ratingScore = config.intro_rating_score || '9.5';
    const ratingLabel = config.intro_rating_label || 'Excepcional en Booking';
    const bullets = [
        config.intro_bullet_1,
        config.intro_bullet_2,
        config.intro_bullet_3,
    ].filter(Boolean);
    const bulletList = bullets.length > 0 ? bullets : DEFAULT_BULLETS;

    return (
        <section className="py-24 px-6 bg-white">
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
                <FadeInUp>
                    <div className="relative">
                        <img
                            src={imageUrl}
                            alt="Interior rústico de los apartamentos Tío José María"
                            className="rounded-2xl shadow-2xl w-full h-[300px] md:h-[500px] object-cover"
                        />
                        <div className="absolute -bottom-6 -right-6 p-6 rounded-xl shadow-lg hidden md:block bg-surface-warm">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-serif text-4xl font-bold text-primary">{ratingScore}</span>
                                <span className="text-xl opacity-50">/10</span>
                            </div>
                            <p className="text-sm uppercase tracking-wider font-bold text-secondary">{ratingLabel}</p>
                        </div>
                    </div>
                </FadeInUp>
                <FadeInUp delay={0.2}>
                    <div>
                        <h2 className="font-serif text-3xl md:text-5xl mb-6 text-text-primary">
                            {renderStyledHeading(heading)}
                        </h2>
                        <p className="text-lg mb-8 leading-relaxed whitespace-pre-line text-secondary">
                            {introText}
                        </p>
                        <ul className="space-y-3">
                            {bulletList.map((item) => (
                                <li key={item} className="flex items-center gap-3 text-base text-text-primary">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-xs">&#10003;</span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </FadeInUp>
            </div>
        </section>
    );
};

export default IntroSection;

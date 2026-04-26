import WeatherWidget from '../WeatherWidget';
import { WP, WHATSAPP_URL } from '../../constants/urls';

const DEFAULT_HERO_IMAGE = `${WP}/slide1.jpg`;
const DEFAULT_LOCATION = 'Hinojares, Jaén';
const DEFAULT_CTA_PRIMARY = 'Ver Apartamentos';
const DEFAULT_CTA_SECONDARY = 'Consultar Dudas';

const HeroSection = ({ title, subtitle, config = {} }) => {
    const heroImage = config.hero_image_url || DEFAULT_HERO_IMAGE;
    const location = config.hero_location_text || DEFAULT_LOCATION;
    const ctaPrimary = config.hero_cta_primary || DEFAULT_CTA_PRIMARY;
    const ctaSecondary = config.hero_cta_secondary || DEFAULT_CTA_SECONDARY;

    return (
        <header className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-0">
                <img
                    src={heroImage}
                    alt="Vista panorámica de Casa Rural Tío José María en Hinojares"
                    fetchpriority="high"
                    decoding="async"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/25 to-black/55" />
            </div>

            <div className="relative z-10 text-center px-6 max-w-5xl pt-20 hero-fade-in">
                <div className="flex justify-center mb-6">
                    <WeatherWidget isMinimal />
                </div>
                <p className="text-white/70 uppercase tracking-[0.3em] text-sm mb-5 font-sans">{location}</p>
                <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-white font-bold mb-6 leading-tight">
                    {title}
                    <br className="hidden lg:block" />
                    <span className="text-accent">en la Sierra de Cazorla</span>
                </h1>
                <p className="text-white/80 text-lg md:text-xl mb-10 max-w-2xl mx-auto font-light leading-relaxed">
                    {subtitle}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <a
                        href="#apartamentos"
                        className="px-10 py-4 rounded-full text-lg font-bold shadow-2xl text-white bg-primary transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                    >
                        {ctaPrimary}
                    </a>
                    <a
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-10 py-4 rounded-full text-lg font-bold bg-white/10 backdrop-blur-md border border-white/30 text-white hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.29-1.24l-.296-.18-3.119.82.836-3.04-.196-.312A7.978 7.978 0 014 12a8 8 0 1116 0 8 8 0 01-8 8z" /></svg>
                        {ctaSecondary}
                    </a>
                </div>
            </div>
        </header>
    );
};

export default HeroSection;

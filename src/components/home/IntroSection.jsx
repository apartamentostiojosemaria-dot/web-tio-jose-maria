import FadeInUp from '../shared/FadeInUp';
import { COLORS } from '../../constants/colors';
import { WP } from '../../constants/urls';

const IntroSection = ({ text }) => (
    <section className="py-24 px-6" style={{ backgroundColor: 'white' }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <FadeInUp>
                <div className="relative">
                    <img
                        src={`${WP}/slide5.jpg`}
                        alt="Interior rústico de los apartamentos Tío José María"
                        className="rounded-2xl shadow-2xl w-full h-[300px] md:h-[500px] object-cover"
                    />
                    <div className="absolute -bottom-6 -right-6 p-6 rounded-xl shadow-lg hidden md:block" style={{ backgroundColor: COLORS.bgWarm }}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-serif text-4xl font-bold" style={{ color: COLORS.primary }}>9.5</span>
                            <span className="text-xl opacity-50">/10</span>
                        </div>
                        <p className="text-sm uppercase tracking-wider font-bold" style={{ color: COLORS.secondary }}>Excepcional en Booking</p>
                    </div>
                </div>
            </FadeInUp>
            <FadeInUp delay={0.2}>
                <div>
                    <h2 className="font-serif text-3xl md:text-5xl mb-6" style={{ color: COLORS.text }}>
                        Más que una casa rural, <br className="hidden md:block" /><span style={{ color: COLORS.primary }} className="italic">es historia viva.</span>
                    </h2>
                    <p className="text-lg mb-8 leading-relaxed whitespace-pre-line" style={{ color: COLORS.secondary }}>
                        {text || `Bienvenidos a Tío José María. Ubicados en el sur del Parque Natural de Cazorla, nuestros 4 apartamentos combinan la arquitectura tradicional andaluza con el confort moderno.\n\nMuros de piedra, techos de vigas de madera y el calor de la chimenea te esperan. Ideal para parejas que buscan intimidad o familias que desean reconectar con la naturaleza.`}
                    </p>
                    <ul className="space-y-3">
                        {['Ubicación privilegiada en Hinojares', 'Chimenea de leña en todos los apartamentos', 'WiFi gratuito y ambiente familiar'].map((item) => (
                            <li key={item} className="flex items-center gap-3 text-base" style={{ color: COLORS.text }}>
                                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: COLORS.primary }}>✓</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </FadeInUp>
        </div>
    </section>
);

export default IntroSection;

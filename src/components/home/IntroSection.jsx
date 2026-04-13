import FadeInUp from '../shared/FadeInUp';
import { WP } from '../../constants/urls';

const IntroSection = ({ text }) => (
    <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <FadeInUp>
                <div className="relative">
                    <img
                        src={`${WP}/slide5.jpg`}
                        alt="Interior rustico de los apartamentos Tio Jose Maria"
                        className="rounded-2xl shadow-2xl w-full h-[300px] md:h-[500px] object-cover"
                    />
                    <div className="absolute -bottom-6 -right-6 p-6 rounded-xl shadow-lg hidden md:block bg-surface-warm">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-serif text-4xl font-bold text-primary">9.5</span>
                            <span className="text-xl opacity-50">/10</span>
                        </div>
                        <p className="text-sm uppercase tracking-wider font-bold text-secondary">Excepcional en Booking</p>
                    </div>
                </div>
            </FadeInUp>
            <FadeInUp delay={0.2}>
                <div>
                    <h2 className="font-serif text-3xl md:text-5xl mb-6 text-text-primary">
                        Mas que una casa rural, <br className="hidden md:block" /><span className="text-primary italic">es historia viva.</span>
                    </h2>
                    <p className="text-lg mb-8 leading-relaxed whitespace-pre-line text-secondary">
                        {text || `Bienvenidos a Tio Jose Maria. Ubicados en el sur del Parque Natural de Cazorla, nuestros 4 apartamentos combinan la arquitectura tradicional andaluza con el confort moderno.\n\nMuros de piedra, techos de vigas de madera y el calor de la chimenea te esperan. Ideal para parejas que buscan intimidad o familias que desean reconectar con la naturaleza.`}
                    </p>
                    <ul className="space-y-3">
                        {['Ubicacion privilegiada en Hinojares', 'Chimenea de lena en todos los apartamentos', 'WiFi gratuito y ambiente familiar'].map((item) => (
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

export default IntroSection;

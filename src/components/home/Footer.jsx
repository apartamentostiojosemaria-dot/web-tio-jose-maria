import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Instagram } from 'lucide-react';
import { COLORS } from '../../constants/colors';

const Footer = () => (
    <footer id="contacto" className="py-16 md:py-20 px-6 text-white" style={{ backgroundColor: '#111827' }}>
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10 md:gap-16 mb-14">
            <div>
                <h3 className="font-serif text-2xl font-bold mb-6">Tío José María</h3>
                <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-6">
                    Vivienda turística de Alojamiento Rural registrada en la Junta de Andalucía (VTAR/JA/00044). Tu casa en Hinojares.
                </p>
                <div className="flex gap-3">
                    <a href="https://www.instagram.com/tiojosemaria_hinojares/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300" style={{ backgroundColor: '#1f2937' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.primary} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}>
                        <Instagram size={16} />
                    </a>
                </div>
            </div>
            <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-8" style={{ color: COLORS.accent }}>Contacto</h4>
                <ul className="space-y-4 text-sm text-white/60">
                    <li className="flex items-start gap-3">
                        <MapPin size={16} className="flex-shrink-0 mt-0.5" style={{ color: COLORS.primary }} />
                        <a
                            href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-white transition-colors leading-relaxed"
                        >
                            Calle Baja 1,<br />23486 Hinojares, Jaén
                        </a>
                    </li>
                    <li className="flex items-center gap-3">
                        <Phone size={16} className="flex-shrink-0" style={{ color: COLORS.primary }} />
                        <a href="tel:+34676344675" className="hover:text-white transition-colors">676 34 46 75</a>
                    </li>
                    <li className="flex items-center gap-3">
                        <Mail size={16} className="flex-shrink-0" style={{ color: COLORS.primary }} />
                        <a href="mailto:info@tiojosemaria.com" className="hover:text-white transition-colors">info@tiojosemaria.com</a>
                    </li>
                </ul>
            </div>
            <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-8" style={{ color: COLORS.accent }}>¿Dónde estamos?</h4>
                <a
                    href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden h-48 relative group cursor-pointer"
                    style={{ backgroundColor: '#1f2937' }}
                >
                    <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80" alt="Ubicación en mapa de Hinojares" className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-300" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-white text-gray-900 px-5 py-2.5 rounded-full text-sm font-bold shadow-lg">Ver en Google Maps</span>
                    </div>
                </a>
            </div>
        </div>
        <div className="border-t border-white/10 pt-8 text-center text-white/40 text-sm flex flex-col md:flex-row justify-center items-center gap-4">
            <span>© 2025 Apartamentos Tío José María.</span>
            <div className="flex gap-4">
                <Link to="/privacidad" className="hover:text-white transition-colors">Privacidad</Link>
                <span className="opacity-20">|</span>
                <Link to="/admin" className="hover:text-white transition-colors">Acceso Administración</Link>
                <span className="opacity-20">|</span>
                <Link to="/clientes" className="hover:text-white transition-colors">Área Clientes</Link>
            </div>
        </div>
    </footer>
);

export default Footer;

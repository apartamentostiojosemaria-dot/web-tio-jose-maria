import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Instagram, FileText } from 'lucide-react';
import ConsentMap from '../shared/ConsentMap';

const Footer = () => (
    <footer id="contacto" className="py-16 md:py-20 px-6 text-white bg-footer">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10 md:gap-16 mb-14">
            <div>
                <h3 className="font-serif text-2xl font-bold mb-6">Tío José María</h3>
                <p className="text-white/80 text-sm leading-relaxed max-w-xs mb-6">
                    Vivienda turística de Alojamiento Rural registrada en la Junta de Andalucía (VTAR/JA/00044). Tu casa en Hinojares.
                </p>
                <div className="flex gap-3">
                    <a
                        href="https://www.instagram.com/tiojosemaria_hinojares/"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Síguenos en Instagram"
                        className="w-10 h-10 rounded-full bg-footer-muted hover:bg-primary flex items-center justify-center transition-colors duration-300"
                    >
                        <Instagram size={16} aria-hidden="true" />
                    </a>
                </div>
                <p className="mt-6 inline-block text-[10px] uppercase tracking-widest font-bold text-white/70 border border-white/20 px-3 py-1.5 rounded-full">
                    Registro Turismo Andalucía · VTAR/JA/00044
                </p>
            </div>
            <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-8 text-accent">Contacto</h4>
                <ul className="space-y-4 text-sm text-white/80">
                    <li className="flex items-start gap-3">
                        <MapPin size={16} aria-hidden="true" className="flex-shrink-0 mt-0.5 text-primary" />
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
                        <Phone size={16} aria-hidden="true" className="flex-shrink-0 text-primary" />
                        <a href="tel:+34676344675" className="hover:text-white transition-colors">676 34 46 75</a>
                    </li>
                    <li className="flex items-center gap-3">
                        <Mail size={16} aria-hidden="true" className="flex-shrink-0 text-primary" />
                        <a href="mailto:apartamentostiojosemaria@gmail.com" className="hover:text-white transition-colors">apartamentostiojosemaria@gmail.com</a>
                    </li>
                </ul>
            </div>
            <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-8 text-accent">¿Dónde estamos?</h4>
                <div className="rounded-xl overflow-hidden h-48 relative group">
                    <ConsentMap
                        title="Ubicación Apartamentos Tío José María"
                        src="https://maps.google.com/maps?q=Apartamentos+Rurales+Tio+Jose+Maria+Hinojares&z=14&output=embed"
                        className="opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                    />
                    <a
                        href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-3 right-3 bg-white text-gray-900 px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 hover:shadow-xl transition-shadow"
                    >
                        <MapPin size={12} aria-hidden="true" className="text-primary" /> Abrir en Maps
                    </a>
                </div>
            </div>
        </div>
        <div className="border-t border-white/10 pt-8 text-center text-white/75 text-sm flex flex-col gap-4">
            <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
                <Link to="/aviso-legal" className="hover:text-white transition-colors">Aviso legal</Link>
                <span className="opacity-20" aria-hidden="true">|</span>
                <Link to="/privacidad" className="hover:text-white transition-colors">Privacidad</Link>
                <span className="opacity-20" aria-hidden="true">|</span>
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('tjm:cookie-consent-reopen'))}
                    className="hover:text-white transition-colors cursor-pointer"
                >
                    Gestionar cookies
                </button>
                <span className="opacity-20" aria-hidden="true">|</span>
                <a
                    href="https://www.juntadeandalucia.es/organismos/turismoculturayeducacion/areas/turismo/calidad/hojas-reclamaciones.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors inline-flex items-center gap-1.5"
                >
                    <FileText size={12} aria-hidden="true" /> Hojas de reclamaciones
                </a>
                <span className="opacity-20" aria-hidden="true">|</span>
                <Link to="/clientes" className="hover:text-white transition-colors">Área clientes</Link>
                <span className="opacity-20" aria-hidden="true">|</span>
                <Link to="/admin" className="hover:text-white transition-colors">Acceso administración</Link>
            </div>
            <span>&copy; {new Date().getFullYear()} Apartamentos Rurales Tío José María — Hinojares, Jaén.</span>
        </div>
    </footer>
);

export default Footer;

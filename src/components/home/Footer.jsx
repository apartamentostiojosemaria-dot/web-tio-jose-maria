import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Instagram } from 'lucide-react';

const Footer = () => (
    <footer id="contacto" className="py-16 md:py-20 px-6 text-white bg-footer">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10 md:gap-16 mb-14">
            <div>
                <h3 className="font-serif text-2xl font-bold mb-6">Tio Jose Maria</h3>
                <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-6">
                    Vivienda turistica de Alojamiento Rural registrada en la Junta de Andalucia (VTAR/JA/00044). Tu casa en Hinojares.
                </p>
                <div className="flex gap-3">
                    <a href="https://www.instagram.com/tiojosemaria_hinojares/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-footer-muted hover:bg-primary flex items-center justify-center transition-colors duration-300">
                        <Instagram size={16} />
                    </a>
                </div>
            </div>
            <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-8 text-accent">Contacto</h4>
                <ul className="space-y-4 text-sm text-white/60">
                    <li className="flex items-start gap-3">
                        <MapPin size={16} className="flex-shrink-0 mt-0.5 text-primary" />
                        <a
                            href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-white transition-colors leading-relaxed"
                        >
                            Calle Baja 1,<br />23486 Hinojares, Jaen
                        </a>
                    </li>
                    <li className="flex items-center gap-3">
                        <Phone size={16} className="flex-shrink-0 text-primary" />
                        <a href="tel:+34676344675" className="hover:text-white transition-colors">676 34 46 75</a>
                    </li>
                    <li className="flex items-center gap-3">
                        <Mail size={16} className="flex-shrink-0 text-primary" />
                        <a href="mailto:info@tiojosemaria.com" className="hover:text-white transition-colors">info@tiojosemaria.com</a>
                    </li>
                </ul>
            </div>
            <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-8 text-accent">Donde estamos?</h4>
                <div className="rounded-xl overflow-hidden h-48 relative group">
                    <iframe
                        title="Ubicacion Apartamentos Tio Jose Maria"
                        src="https://maps.google.com/maps?q=Apartamentos+Rurales+Tio+Jose+Maria+Hinojares&z=14&output=embed"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                    />
                    <a
                        href="https://maps.app.goo.gl/EPzh8j2HivLfqUeN8"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-3 right-3 bg-white text-gray-900 px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 hover:shadow-xl transition-shadow"
                    >
                        <MapPin size={12} className="text-primary" /> Abrir en Maps
                    </a>
                </div>
            </div>
        </div>
        <div className="border-t border-white/10 pt-8 text-center text-white/40 text-sm flex flex-col md:flex-row justify-center items-center gap-4">
            <span>&copy; {new Date().getFullYear()} Apartamentos Tio Jose Maria.</span>
            <div className="flex gap-4">
                <Link to="/privacidad" className="hover:text-white transition-colors">Privacidad</Link>
                <span className="opacity-20">|</span>
                <Link to="/admin" className="hover:text-white transition-colors">Acceso Administracion</Link>
                <span className="opacity-20">|</span>
                <Link to="/clientes" className="hover:text-white transition-colors">Area Clientes</Link>
            </div>
        </div>
    </footer>
);

export default Footer;

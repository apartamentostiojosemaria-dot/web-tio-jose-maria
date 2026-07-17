import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, X } from 'lucide-react';

const STORAGE_KEY = 'tjm_cookie_consent_v2';
const CONSENT_EVENT = 'tjm:cookie-consent';
// Si cambia la política de privacidad, sube esta versión y se vuelve a mostrar
// el aviso a quien aceptó la versión anterior.
const CONSENT_VERSION = '2026-07-17';

// La web solo usa cookies técnicas (sesión, preferencias, __cf_bm del CDN de
// imágenes). No hay scripts de analítica ni de marketing, así que no existen
// categorías opcionales que activar/desactivar aquí. Los mapas de Google Maps
// se gestionan aparte, por componente, con su propio opt-in (ConsentMap).
export const getConsent = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.version !== CONSENT_VERSION) return null; // forzar re-consentimiento si cambió la política
        return parsed;
    } catch {
        return null;
    }
};

const saveConsent = (consent) => {
    const payload = { ...consent, timestamp: new Date().toISOString(), version: CONSENT_VERSION };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: payload }));
    return payload;
};

const CookieConsent = () => {
    const [visible, setVisible] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        const existing = getConsent();
        if (!existing) {
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    // AEPD: retirar el consentimiento debe ser tan fácil como darlo. Cualquier
    // sitio (footer, política de privacidad…) puede reabrir el aviso disparando
    // el evento `tjm:cookie-consent-reopen`.
    useEffect(() => {
        const reopen = () => {
            setShowSettings(true);
            setVisible(true);
        };
        window.addEventListener('tjm:cookie-consent-reopen', reopen);
        return () => window.removeEventListener('tjm:cookie-consent-reopen', reopen);
    }, []);

    const acknowledge = () => {
        saveConsent({ necessary: true });
        setShowSettings(false);
        setVisible(false);
    };

    const resetMapsConsent = () => {
        localStorage.removeItem('tjm_maps_ok');
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25 }}
                    className="fixed bottom-0 inset-x-0 z-[60] p-4 md:p-6"
                    role="dialog"
                    aria-modal="false"
                    aria-labelledby="cookie-title"
                    aria-describedby="cookie-desc"
                >
                    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 md:p-6">
                        {!showSettings ? (
                            <>
                                <h2 id="cookie-title" className="font-serif text-lg md:text-xl font-bold text-text-primary mb-2">
                                    Tu privacidad importa
                                </h2>
                                <p id="cookie-desc" className="text-sm text-gray-700 leading-relaxed mb-4">
                                    Esta web solo usa cookies técnicas necesarias para funcionar (sesión, preferencias,
                                    seguridad). No usamos cookies de analítica ni de marketing. Los mapas de Google Maps
                                    incrustados en algunas páginas son opcionales: solo se cargan si tú lo decides.{' '}
                                    <Link to="/privacidad" className="underline text-rural-700 font-medium">
                                        Política de privacidad
                                    </Link>{' '}
                                    ·{' '}
                                    <Link to="/aviso-legal" className="underline text-rural-700 font-medium">
                                        Aviso legal
                                    </Link>
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch">
                                    <button
                                        type="button"
                                        onClick={() => setShowSettings(true)}
                                        className="px-5 py-2.5 bg-white border-2 border-rural-700 text-rural-700 rounded-full text-sm font-bold hover:bg-rural-50 transition-colors flex items-center justify-center gap-2 flex-1"
                                    >
                                        <Settings2 size={16} aria-hidden="true" /> Más detalles
                                    </button>
                                    <button
                                        type="button"
                                        onClick={acknowledge}
                                        className="px-5 py-2.5 bg-rural-700 border-2 border-rural-700 text-white rounded-full text-sm font-bold hover:bg-rural-800 transition-colors flex-1"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-start justify-between mb-4">
                                    <h2 className="font-serif text-lg md:text-xl font-bold text-text-primary">
                                        Cookies de este sitio
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => setShowSettings(false)}
                                        className="text-gray-400 hover:text-gray-700"
                                        aria-label="Cerrar configuración"
                                    >
                                        <X size={20} aria-hidden="true" />
                                    </button>
                                </div>
                                <div className="space-y-3 mb-5">
                                    <CookieRow
                                        label="Necesarias"
                                        desc="Imprescindibles para el funcionamiento del sitio (sesión, preferencias técnicas, seguridad, la cookie __cf_bm anti-bot del CDN de imágenes). No se pueden desactivar."
                                        checked={true}
                                        disabled={true}
                                        onChange={() => {}}
                                    />
                                    <div className="p-3 rounded-xl border bg-white border-gray-200">
                                        <p className="text-sm font-bold text-text-primary mb-1">Mapas de Google (opcional, por mapa)</p>
                                        <p className="text-xs text-gray-600 leading-relaxed mb-2">
                                            No forman parte de este aviso general: cada mapa incrustado te pregunta antes
                                            de cargarse, porque en ese momento Google recibe datos de tu navegación.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={resetMapsConsent}
                                            className="text-xs font-bold text-rural-700 underline hover:text-rural-800"
                                        >
                                            Olvidar mi decisión sobre los mapas
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        No usamos cookies de analítica ni de marketing. Más detalle en la{' '}
                                        <Link to="/privacidad" className="underline text-rural-700">política de privacidad</Link>.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={acknowledge}
                                    className="w-full px-5 py-2.5 bg-rural-700 text-white rounded-full text-sm font-bold hover:bg-rural-800 transition-colors"
                                >
                                    Entendido
                                </button>
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const CookieRow = ({ label, desc, checked, disabled, onChange }) => (
    <label className={`flex items-start gap-3 p-3 rounded-xl border ${disabled ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:border-rural-300 cursor-pointer'}`}>
        <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="mt-1 h-5 w-5 accent-rural-700 cursor-pointer disabled:cursor-not-allowed"
        />
        <span className="flex-1">
            <span className="block text-sm font-bold text-text-primary">{label}</span>
            <span className="block text-xs text-gray-600 leading-relaxed mt-0.5">{desc}</span>
        </span>
    </label>
);

export default CookieConsent;

import { useState, useEffect, useRef } from 'react';
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
    // Taps are ignored while it is still fading in: it used to slide up 1.5 s
    // after load, right under the finger that was about to tap something else.
    const [listo, setListo] = useState(false);
    const barra = useRef(null);

    useEffect(() => {
        // The prerender (Puppeteer) must not bake the notice into the static
        // HTML: whoever already accepted would see it flash before React loads.
        if (typeof navigator !== 'undefined' && navigator.webdriver) return;
        // No delay: it is there from the first moment, not later under the finger.
        if (!getConsent()) setVisible(true);
    }, []);

    // The page gets room at the bottom for the bar, so it never covers the
    // last button (the «Reservar y pagar» of /reservar, for example).
    useEffect(() => {
        if (!visible || !barra.current) return undefined;
        const antes = document.body.style.paddingBottom;
        const medir = () => { document.body.style.paddingBottom = `${barra.current?.offsetHeight || 0}px`; };
        medir();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
        ro?.observe(barra.current);
        return () => { ro?.disconnect(); document.body.style.paddingBottom = antes; };
    }, [visible, showSettings]);

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
                    ref={barra}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onAnimationStart={() => setListo(false)}
                    onAnimationComplete={() => setListo(true)}
                    className={`fixed bottom-0 inset-x-0 z-[60] bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${listo ? '' : 'pointer-events-none'}`}
                    role="dialog"
                    aria-modal="false"
                    aria-labelledby="cookie-title"
                    aria-describedby="cookie-desc"
                >
                    <div className="max-w-5xl mx-auto">
                        {!showSettings ? (
                            // Thin bar: about 130 px high on a 375 px phone (well under a quarter of the screen).
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <p id="cookie-desc" className="flex-1 text-[13px] leading-snug text-gray-700">
                                    <span id="cookie-title" className="font-bold text-text-primary">Cookies: </span>
                                    solo usamos las técnicas, necesarias para que la web funcione. Nada de analítica
                                    ni publicidad.{' '}
                                    <button type="button" onClick={() => setShowSettings(true)}
                                        className="inline-flex items-center gap-1 underline text-rural-700 font-medium min-h-[32px]">
                                        <Settings2 size={13} aria-hidden="true" /> Más detalles
                                    </button>{' '}
                                    ·{' '}
                                    <Link to="/privacidad" className="underline text-rural-700 font-medium">Privacidad</Link>
                                </p>
                                <button
                                    type="button"
                                    onClick={acknowledge}
                                    className="shrink-0 min-h-[44px] px-6 bg-rural-700 border-2 border-rural-700 text-white rounded-full text-sm font-bold hover:bg-rural-800 transition-colors"
                                >
                                    Entendido
                                </button>
                            </div>
                        ) : (
                            <div className="max-h-[70vh] overflow-y-auto py-1">
                                <div className="flex items-start justify-between mb-3">
                                    <h2 id="cookie-title" className="font-serif text-lg font-bold text-text-primary">
                                        Cookies de este sitio
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => setShowSettings(false)}
                                        className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center text-gray-400 hover:text-gray-700"
                                        aria-label="Cerrar configuración"
                                    >
                                        <X size={20} aria-hidden="true" />
                                    </button>
                                </div>
                                <p id="cookie-desc" className="text-sm text-gray-700 leading-relaxed mb-3">
                                    Esta web solo usa cookies técnicas necesarias para funcionar (sesión, preferencias,
                                    seguridad). No usamos cookies de analítica ni de marketing. Los mapas de Google Maps
                                    incrustados en algunas páginas son opcionales: solo se cargan si tú lo decides.{' '}
                                    <Link to="/aviso-legal" className="underline text-rural-700 font-medium">Aviso legal</Link>
                                </p>
                                <div className="space-y-3 mb-4">
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
                                            className="text-xs font-bold text-rural-700 underline hover:text-rural-800 min-h-[32px]"
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
                                    className="w-full min-h-[44px] px-5 bg-rural-700 text-white rounded-full text-sm font-bold hover:bg-rural-800 transition-colors"
                                >
                                    Entendido
                                </button>
                            </div>
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

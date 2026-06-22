import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, X } from 'lucide-react';

const STORAGE_KEY = 'tjm_cookie_consent_v2';
const CONSENT_EVENT = 'tjm:cookie-consent';
// Si cambia la política de privacidad, sube esta versión y se vuelve a mostrar
// el aviso a quien aceptó la versión anterior.
const CONSENT_VERSION = '2026-06-21';

const DEFAULT_CONSENT = {
    necessary: true,   // siempre activas (técnicas, no requieren consentimiento)
    analytics: false,
    marketing: false,
    timestamp: null,
    version: CONSENT_VERSION,
};

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
    const [prefs, setPrefs] = useState(DEFAULT_CONSENT);

    useEffect(() => {
        const existing = getConsent();
        if (!existing) {
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }
        setPrefs(existing);
    }, []);

    // AEPD: retirar el consentimiento debe ser tan fácil como darlo. Cualquier
    // sitio (footer, política de privacidad…) puede reabrir el panel disparando
    // el evento `tjm:cookie-consent-reopen`.
    useEffect(() => {
        const reopen = () => {
            const existing = getConsent();
            if (existing) setPrefs(existing);
            setShowSettings(true);
            setVisible(true);
        };
        window.addEventListener('tjm:cookie-consent-reopen', reopen);
        return () => window.removeEventListener('tjm:cookie-consent-reopen', reopen);
    }, []);

    const acceptAll = () => {
        saveConsent({ necessary: true, analytics: true, marketing: true });
        setVisible(false);
    };

    const rejectAll = () => {
        saveConsent({ necessary: true, analytics: false, marketing: false });
        setVisible(false);
    };

    const savePartial = () => {
        saveConsent(prefs);
        setShowSettings(false);
        setVisible(false);
    };

    const togglePref = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

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
                                    Usamos cookies técnicas necesarias para que la web funcione, y opcionalmente cookies de
                                    analítica y marketing para mejorar el servicio. Puedes aceptarlas todas, rechazarlas o
                                    configurar tu elección. Tu decisión queda guardada y la puedes cambiar cuando quieras.{' '}
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
                                        onClick={rejectAll}
                                        className="px-5 py-2.5 bg-white border-2 border-rural-700 text-rural-700 rounded-full text-sm font-bold hover:bg-rural-50 transition-colors flex-1"
                                        aria-label="Rechazar todas las cookies opcionales"
                                    >
                                        Rechazar todas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowSettings(true)}
                                        className="px-5 py-2.5 bg-white border-2 border-rural-700 text-rural-700 rounded-full text-sm font-bold hover:bg-rural-50 transition-colors flex items-center justify-center gap-2 flex-1"
                                    >
                                        <Settings2 size={16} aria-hidden="true" /> Configurar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={acceptAll}
                                        className="px-5 py-2.5 bg-rural-700 border-2 border-rural-700 text-white rounded-full text-sm font-bold hover:bg-rural-800 transition-colors flex-1"
                                        aria-label="Aceptar todas las cookies"
                                    >
                                        Aceptar todas
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-start justify-between mb-4">
                                    <h2 className="font-serif text-lg md:text-xl font-bold text-text-primary">
                                        Configura tus cookies
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
                                        desc="Imprescindibles para el funcionamiento del sitio (sesión, preferencias técnicas, seguridad). No se pueden desactivar."
                                        checked={true}
                                        disabled={true}
                                        onChange={() => {}}
                                    />
                                    <CookieRow
                                        label="Analítica"
                                        desc="Métricas anónimas de uso (páginas vistas, tiempo en sitio) para mejorar el contenido. Sin perfil personal."
                                        checked={prefs.analytics}
                                        onChange={() => togglePref('analytics')}
                                    />
                                    <CookieRow
                                        label="Marketing"
                                        desc="Cookies de terceros para mostrarte contenido relevante fuera de este sitio y medir campañas."
                                        checked={prefs.marketing}
                                        onChange={() => togglePref('marketing')}
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                    <button
                                        type="button"
                                        onClick={rejectAll}
                                        className="px-5 py-2.5 bg-white border-2 border-rural-700 text-rural-700 rounded-full text-sm font-bold hover:bg-rural-50 transition-colors flex-1"
                                    >
                                        Rechazar todas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={savePartial}
                                        className="px-5 py-2.5 bg-rural-700 text-white rounded-full text-sm font-bold hover:bg-rural-800 transition-colors flex-1"
                                    >
                                        Guardar selección
                                    </button>
                                </div>
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

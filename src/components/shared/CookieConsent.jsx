import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'tjm_cookie_consent';

const CookieConsent = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem(STORAGE_KEY);
        if (!consent) {
            const timer = setTimeout(() => setVisible(true), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const accept = () => {
        localStorage.setItem(STORAGE_KEY, 'accepted');
        setVisible(false);
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
                >
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 flex flex-col sm:flex-row items-center gap-4">
                        <p className="text-sm text-gray-600 flex-grow">
                            Usamos cookies técnicas para el funcionamiento del sitio. Sin rastreo ni publicidad.{' '}
                            <Link to="/privacidad" className="underline text-rural-700 font-medium">Política de privacidad</Link>
                        </p>
                        <button
                            onClick={accept}
                            className="px-6 py-2.5 bg-rural-700 text-white rounded-full text-sm font-bold hover:bg-rural-800 transition-colors whitespace-nowrap"
                        >
                            Entendido
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CookieConsent;

import React, { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// ============================================================
// AvisoActualizacion — «Hay una versión nueva. Actualizar»
// ============================================================
// La web es una PWA: el móvil se queda con la versión que descargó y, si
// Mari Carmen tiene el panel abierto (o instalado en la pantalla de inicio),
// puede pasarse días con la de antes sin saberlo. Antes el service worker se
// actualizaba «solo», pero sin decir nada: la pantalla que tenía delante
// seguía siendo la vieja hasta que cerrara y abriera.
//
// Ahora (vite.config.js → registerType: 'prompt'): cada hora se pregunta al
// servidor si hay versión nueva y, si la hay, sale esta barra abajo. Un toque
// y se recarga con la nueva. Nada se instala sin avisar.
// ============================================================

const CADA = 60 * 60 * 1000;   // una hora

const AvisoActualizacion = () => {
    const { needRefresh: [hayNueva], updateServiceWorker } = useRegisterSW({
        onRegisteredSW(url, registration) {
            if (!registration) return;
            // Preguntar al servidor cada hora y también al volver a la app
            // (en el móvil se deja abierta y vuelve al día siguiente).
            const comprobar = () => { if (navigator.onLine) registration.update().catch(() => {}); };
            setInterval(comprobar, CADA);
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') comprobar(); });
        },
    });

    useEffect(() => {
        if (hayNueva) document.body.classList.add('pb-24');
        return () => document.body.classList.remove('pb-24');
    }, [hayNueva]);

    if (!hayNueva) return null;
    return (
        <div role="status" className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 pointer-events-none">
            <div className="mx-auto max-w-md pointer-events-auto rounded-2xl bg-[#2C3319] text-white shadow-xl px-4 py-3 flex items-center gap-3">
                <p className="text-base leading-snug flex-1">Hay una versión nueva del panel.</p>
                <button
                    type="button"
                    onClick={async () => {
                        // workbox-window recarga cuando el SW nuevo toma el mando; si en
                        // dos segundos no ha pasado (navegadores raros), recargamos igual.
                        const t = setTimeout(() => window.location.reload(), 2000);
                        try { await updateServiceWorker(true); } catch { clearTimeout(t); window.location.reload(); }
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-white text-[#2C3319] font-bold px-4 min-h-[44px] shrink-0"
                >
                    <RefreshCw size={18} aria-hidden="true" /> Actualizar
                </button>
            </div>
        </div>
    );
};

export default AvisoActualizacion;

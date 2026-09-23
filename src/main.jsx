import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import AvisoActualizacion from './components/shared/AvisoActualizacion';

// Fuentes self-hosted (vía @fontsource). Evitan peticiones a Google Fonts → sin
// transferencia de la IP del visitante a Google (RGPD/LSSI). Nombres de familia
// idénticos a los del @theme en index.css ("Lato", "Playfair Display", etc.).
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/manrope/300.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';

import './index.css';

// Una pestaña abierta con la versión anterior pide piezas que, tras publicar,
// ya no existen: la pantalla se quedaba en BLANCO sin decir nada (23-sep, al
// abrir Calendario justo después de un despliegue). Si una pieza no carga, se
// recarga la página con la versión nueva. Una sola vez por minuto, para no
// entrar en bucle si el fallo es de red y no de versión.
const recargarPorVersionNueva = () => {
    try {
        const ultima = Number(sessionStorage.getItem('recarga-version') || 0);
        if (Date.now() - ultima < 60_000) return;
        sessionStorage.setItem('recarga-version', String(Date.now()));
    } catch { /* sin sessionStorage: se recarga igual */ }
    window.location.reload();
};
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); recargarPorVersionNueva(); });
window.addEventListener('unhandledrejection', (e) => {
    const msg = String(e?.reason?.message || e?.reason || '');
    if (/dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(msg)) {
        recargarPorVersionNueva();
    }
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <HelmetProvider>
            <BrowserRouter>
                <App />
                <AvisoActualizacion />
            </BrowserRouter>
        </HelmetProvider>
    </React.StrictMode>
);

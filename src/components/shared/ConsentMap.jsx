import { useEffect, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';

// Clave compartida en localStorage: una vez aceptado, todos los mapas de la
// web se cargan directamente sin volver a preguntar (RGPD: el consentimiento
// para Google Maps es opcional y separado de las cookies técnicas del sitio).
const STORAGE_KEY = 'tjm_maps_ok';

// Envoltorio con consentimiento previo para iframes de Google Maps. Antes de
// aceptar, no se hace ninguna petición a maps.google.com — solo se muestra un
// placeholder estático. Ocupa el 100% del contenedor que le pase el padre
// (igual que hacía el <iframe> directo que sustituye).
const ConsentMap = ({ src, title, className = '' }) => {
    const [accepted, setAccepted] = useState(false);

    useEffect(() => {
        try {
            if (localStorage.getItem(STORAGE_KEY) === '1') setAccepted(true);
        } catch {
            // localStorage no disponible (navegación privada estricta): no bloquea, solo no recuerda la elección.
        }
    }, []);

    const loadMap = () => {
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // si no se puede guardar, el mapa se carga igual para esta visita
        }
        setAccepted(true);
    };

    if (accepted) {
        return (
            <iframe
                title={title}
                src={src}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className={className}
            />
        );
    }

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center text-center gap-2.5 p-5 bg-rural-50 border border-rural-100 ${className}`}>
            <MapIcon size={26} className="text-rural-400" aria-hidden="true" />
            <p className="text-xs text-gray-600 leading-relaxed max-w-xs">
                Mapa de Google Maps — al cargarlo aceptas que Google reciba datos de tu navegación.
            </p>
            <button
                type="button"
                onClick={loadMap}
                className="px-4 py-2 rounded-full text-xs font-bold text-white bg-rural-700 hover:bg-rural-800 transition-colors"
            >
                Cargar mapa
            </button>
        </div>
    );
};

export default ConsentMap;

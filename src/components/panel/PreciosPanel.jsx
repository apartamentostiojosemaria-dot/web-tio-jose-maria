// Precios — la pantalla de la madre.
//
// Seis tarjetas con lo que hay puesto, en una línea cada una; al tocar una,
// se abre solo ese bloque. Antes eran los seis bloques abiertos uno detrás de
// otro: 10 pantallas de móvil para encontrar lo que se quería cambiar
// (auditoría 23-sep). El bloque abierto vive en la dirección de la página
// (?s=precios&p={"bloque":"temporadas"}), así que «Atrás» vuelve a las tarjetas.
//
// Lo que NO está aquí a propósito: recargo de fin de semana, descuentos de
// última hora, descuentos por reservar con antelación y subidas por ocupación.
// Eso es nuestro y vive en el panel completo.

import React, { useCallback, useEffect, useState } from 'react';
import { Home, Sun, Star, Moon, Ban, Gift, ChevronRight, ChevronLeft } from 'lucide-react';
import { Aviso, Cargando } from './precios/ui';
import { leerTodo } from './precios/datos';
import { hoy } from './precios/formato';

import BloqueApartamentos from './precios/BloqueApartamentos';
import BloqueTemporadas from './precios/BloqueTemporadas';
import BloqueEspeciales from './precios/BloqueEspeciales';
import BloqueMinimo from './precios/BloqueMinimo';
import BloqueCierres from './precios/BloqueCierres';
import BloqueExtras from './precios/BloqueExtras';

const VACIO = {
    apartamentos: [], temporadas: [], especiales: [],
    minimos: [], cierres: [], ocupadosFuera: 0, extras: [],
};

const fechaCorta = (iso) => {
    if (!iso) return '';
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(a, m - 1, d));
};

const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Cada tarjeta: qué es y, en una línea, lo que hay puesto ahora. */
const TARJETAS = [
    {
        id: 'apartamentos', icono: Home, titulo: 'Lo que cuesta cada apartamento',
        resumen: (d) => {
            const precios = d.apartamentos.map((a) => Number(a.price_low)).filter((x) => x > 0);
            if (precios.length === 0) return 'Sin precio puesto';
            const min = Math.min(...precios); const max = Math.max(...precios);
            return min === max ? `${min} € la noche` : `De ${min} a ${max} € la noche, días normales`;
        },
    },
    {
        id: 'temporadas', icono: Sun, titulo: 'Temporadas altas',
        resumen: (d) => {
            const hoyIso = hoy();
            const proxima = d.temporadas
                .filter((t) => String(t.end_date) >= hoyIso)
                .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[0];
            if (!proxima) return 'Ninguna por delante';
            return `La próxima: ${proxima.name} (${fechaCorta(proxima.start_date)})`;
        },
    },
    {
        id: 'especiales', icono: Star, titulo: 'Precio especial para unas fechas',
        resumen: (d) => (d.especiales.length === 0 ? 'Ninguno puesto' : cuantos(d.especiales.length, 'puesto', 'puestos')),
    },
    {
        id: 'minimo', icono: Moon, titulo: 'Mínimo de noches',
        resumen: (d) => {
            const general = d.minimos.find((m) => !m.valid_from && !m.valid_until);
            const n = Number(general?.threshold_days);
            const otras = d.minimos.length - (general ? 1 : 0);
            const base = n > 0 ? `${cuantos(n, 'noche', 'noches')} normalmente` : 'Sin mínimo general';
            return otras > 0 ? `${base} · ${cuantos(otras, 'excepción', 'excepciones')}` : base;
        },
    },
    {
        id: 'cierres', icono: Ban, titulo: 'No alquilar estos días',
        resumen: (d) => (d.cierres.length === 0 ? 'Nada cerrado por ti' : `${cuantos(d.cierres.length, 'cierre puesto', 'cierres puestos')} por ti`),
    },
    {
        id: 'extras', icono: Gift, titulo: 'Extras',
        resumen: (d) => {
            const activos = d.extras.filter((e) => e.active).length;
            return `${activos} de ${d.extras.length} se ofrecen en la web`;
        },
    },
];

export default function PreciosPanel({ ir, params = {} }) {
    const [datos, setDatos] = useState(VACIO);
    const [cargando, setCargando] = useState(true);
    const [fallo, setFallo] = useState('');
    const abierto = TARJETAS.some((t) => t.id === params.bloque) ? params.bloque : null;

    const cargar = useCallback(async () => {
        setCargando(true);
        setFallo('');
        try {
            setDatos(await leerTodo(hoy()));
        } catch (e) {
            setFallo(e.message || 'No he podido cargar los precios. Prueba a recargar la página.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // Cada bloque devuelve su trozo ya releído de la base; aquí solo se guarda.
    const actualiza = (clave) => (valor) => setDatos((d) => ({ ...d, [clave]: valor }));

    if (cargando) return <Cargando>Cargando los precios…</Cargando>;

    if (abierto) {
        return (
            <div className="space-y-6">
                <button
                    type="button"
                    onClick={() => ir('precios')}
                    className="inline-flex items-center gap-1 min-h-[44px] text-base font-bold text-rural-700 hover:underline"
                >
                    <ChevronLeft size={20} aria-hidden="true" /> Todos los precios
                </button>
                {fallo && <Aviso tono="mal">{fallo}</Aviso>}
                {abierto === 'apartamentos' && (
                    <BloqueApartamentos apartamentos={datos.apartamentos} onActualizar={actualiza('apartamentos')} />
                )}
                {abierto === 'temporadas' && (
                    <BloqueTemporadas temporadas={datos.temporadas} onActualizar={actualiza('temporadas')} />
                )}
                {abierto === 'especiales' && (
                    <BloqueEspeciales apartamentos={datos.apartamentos} especiales={datos.especiales} onActualizar={actualiza('especiales')} />
                )}
                {abierto === 'minimo' && (
                    <BloqueMinimo minimos={datos.minimos} temporadas={datos.temporadas} onActualizar={actualiza('minimos')} />
                )}
                {abierto === 'cierres' && (
                    <BloqueCierres apartamentos={datos.apartamentos} cierres={datos.cierres} ocupadosFuera={datos.ocupadosFuera} onActualizar={actualiza('cierres')} />
                )}
                {abierto === 'extras' && (
                    <BloqueExtras extras={datos.extras} onActualizar={actualiza('extras')} />
                )}
            </div>
        );
    }

    return (
        // El título "Precios" y los márgenes los pone PanelApp: aquí no se repiten.
        <div className="space-y-5">
            <p className="text-base text-gray-600 leading-relaxed">
                Aquí cambias tú lo que cuestan las cosas. Lo que guardes, la web lo cobra al momento.
                Toca lo que quieras cambiar.
            </p>

            {fallo && <Aviso tono="mal">{fallo}</Aviso>}

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TARJETAS.map((t) => (
                    <li key={t.id}>
                        <button
                            type="button"
                            onClick={() => ir('precios', { bloque: t.id })}
                            className="w-full h-full bg-white rounded-3xl border border-gray-200 shadow-sm p-4 min-h-[88px] text-left flex items-center gap-3 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                        >
                            <span className="w-11 h-11 rounded-2xl bg-rural-50 text-rural-700 flex items-center justify-center shrink-0">
                                <t.icono size={22} aria-hidden="true" />
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block font-bold text-base text-text-primary leading-tight">{t.titulo}</span>
                                <span className="block text-sm text-gray-600 leading-snug mt-0.5">{t.resumen(datos)}</span>
                            </span>
                            <ChevronRight size={20} className="text-gray-400 shrink-0" aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ul>

            <footer className="pt-2 text-center">
                <button
                    type="button"
                    onClick={cargar}
                    className="min-h-[48px] px-5 text-base font-bold text-rural-700 underline"
                >
                    Volver a mirar los precios de la web
                </button>
            </footer>
        </div>
    );
}

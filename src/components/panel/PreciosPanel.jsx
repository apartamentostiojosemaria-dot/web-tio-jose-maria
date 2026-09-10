// Precios — la pantalla de la madre.
//
// Una sola pantalla, seis bloques, todo a la vista bajando. Nada escondido
// detrás de pestañas ni de menús. Pensada para el móvil (375 px sin tener que
// mover la pantalla de lado) y se ensancha sola en el ordenador.
//
// Lo que NO está aquí a propósito: recargo de fin de semana, descuentos de
// última hora, descuentos por reservar con antelación y subidas por ocupación.
// Eso es nuestro y vive en el panel completo.

import React, { useCallback, useEffect, useState } from 'react';
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

export default function PreciosPanel() {
    const [datos, setDatos] = useState(VACIO);
    const [cargando, setCargando] = useState(true);
    const [fallo, setFallo] = useState('');

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

    return (
        // El título "Precios" y los márgenes los pone PanelApp: aquí no se repiten.
        <div className="space-y-10">
            <p className="text-base text-gray-600 leading-relaxed">
                Aquí cambias tú lo que cuestan las cosas. Lo que guardes, la web lo cobra al momento.
            </p>

            {fallo && <Aviso tono="mal">{fallo}</Aviso>}

            {cargando ? (
                <Cargando>Cargando los precios…</Cargando>
            ) : (
                <>
                    <BloqueApartamentos
                        apartamentos={datos.apartamentos}
                        onActualizar={actualiza('apartamentos')}
                    />

                    <BloqueTemporadas
                        temporadas={datos.temporadas}
                        onActualizar={actualiza('temporadas')}
                    />

                    <BloqueEspeciales
                        apartamentos={datos.apartamentos}
                        especiales={datos.especiales}
                        onActualizar={actualiza('especiales')}
                    />

                    <BloqueMinimo
                        minimos={datos.minimos}
                        temporadas={datos.temporadas}
                        onActualizar={actualiza('minimos')}
                    />

                    <BloqueCierres
                        apartamentos={datos.apartamentos}
                        cierres={datos.cierres}
                        ocupadosFuera={datos.ocupadosFuera}
                        onActualizar={actualiza('cierres')}
                    />

                    <BloqueExtras
                        extras={datos.extras}
                        onActualizar={actualiza('extras')}
                    />

                    <footer className="pt-4 pb-10 text-center">
                        <button
                            type="button"
                            onClick={cargar}
                            className="min-h-[48px] px-5 text-base font-bold text-rural-700 underline"
                        >
                            Volver a mirar los precios de la web
                        </button>
                    </footer>
                </>
            )}
        </div>
    );
}

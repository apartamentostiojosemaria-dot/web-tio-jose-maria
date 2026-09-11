import React, { useEffect, useRef, useState } from 'react';
import { UserCheck, Mail } from 'lucide-react';
import { Boton, Campo, claseInput, Aviso, formatoEuro } from '../ui';
import { Opcion } from './piezas';
import { buscarPersona } from './datos';
import { CANALES, buscarCanal } from './textos';

// ============================================================
// Paso 2 — Quién viene
// ============================================================
// Nombre, teléfono y correo (el correo es opcional, pero se dice qué se
// pierde sin él). Si ya la conocemos por el teléfono o el correo, se avisa
// y se rellena lo que sepamos. Y por dónde le ha llegado la reserva.
// ============================================================

const Paso2Quien = ({ valores, alCambiar, alSeguir, alAtras }) => {
    const { nombre, telefono, email, canal, localizador, comision, precio } = valores;

    const [conocida, setConocida] = useState(null);
    const [intentado, setIntentado] = useState(false);
    const ultimaBusqueda = useRef('');

    // Buscamos a la persona en cuanto hay teléfono o correo con pinta de serlo.
    useEffect(() => {
        const tel = String(telefono || '').replace(/\D/g, '');
        const correo = String(email || '').trim().toLowerCase();
        const buscable = tel.length >= 9 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
        if (!buscable) { setConocida(null); setIntentado(false); return; }

        const clave = `${tel}|${correo}`;
        if (clave === ultimaBusqueda.current) return;

        let cortado = false;
        const t = setTimeout(async () => {
            ultimaBusqueda.current = clave;
            const encontrada = await buscarPersona({ telefono: tel, email: correo });
            if (cortado) return;
            setIntentado(true);
            setConocida(encontrada);
        }, 500);
        return () => { cortado = true; clearTimeout(t); };
    }, [telefono, email]);

    const rellenarConLoQueSabemos = () => {
        const cambios = {};
        if (conocida.nombre && !nombre.trim()) cambios.nombre = conocida.nombre;
        if (conocida.telefono && !String(telefono).trim()) cambios.telefono = conocida.telefono;
        if (conocida.email && !String(email).trim()) cambios.email = conocida.email;
        alCambiar(cambios);
    };

    const elegirCanal = (valor) => {
        const c = buscarCanal(valor);
        const cambios = { canal: valor };
        if (!c?.deFuera) { cambios.localizador = ''; cambios.comision = ''; }
        else if (c.comisionSugerida && (comision === '' || comision == null)) {
            cambios.comision = Math.round((precio || 0) * c.comisionSugerida) / 100;
        }
        alCambiar(cambios);
    };

    const canalElegido = buscarCanal(canal);
    const deFuera = Boolean(canalElegido?.deFuera);
    const comisionNum = Number(comision) || 0;
    const nombreLimpio = String(nombre || '').trim();
    const correoLimpio = String(email || '').trim();
    const correoMal = correoLimpio !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio);
    const puedeSeguir = nombreLimpio.length >= 2 && Boolean(canal) && !correoMal;

    return (
        <div>
            {/* ---------- Ya ha estado aquí ---------- */}
            {conocida && (
                <Aviso
                    tono="bien"
                    icono={UserCheck}
                    className="mb-5"
                    titulo={
                        conocida.veces > 0
                            ? `Esta persona ya ha estado aquí (${conocida.veces} ${conocida.veces === 1 ? 'vez' : 'veces'})`
                            : 'Esta persona ya tiene otra reserva con nosotros'
                    }
                    texto={[conocida.nombre, conocida.telefono, conocida.email].filter(Boolean).join(' · ')}
                    accion={
                        (conocida.nombre && !nombreLimpio) || (conocida.telefono && !String(telefono).trim()) || (conocida.email && !correoLimpio)
                            ? { texto: 'Poner sus datos', onClick: rellenarConLoQueSabemos }
                            : undefined
                    }
                />
            )}
            {intentado && !conocida && (
                <p className="mb-5 text-base text-gray-600">Es la primera vez que viene.</p>
            )}

            {/* ---------- Datos ---------- */}
            <Campo etiqueta="Nombre y apellidos" htmlFor="nombre" obligatorio>
                <input
                    id="nombre" type="text" className={claseInput}
                    autoComplete="name" maxLength={120}
                    value={nombre}
                    onChange={(e) => alCambiar({ nombre: e.target.value })}
                    placeholder="Carmen García López"
                />
            </Campo>

            <Campo etiqueta="Teléfono" htmlFor="telefono"
                ayuda="Para poder llamarla o escribirle por WhatsApp.">
                <input
                    id="telefono" type="tel" className={claseInput}
                    autoComplete="tel" inputMode="tel" maxLength={30}
                    value={telefono}
                    onChange={(e) => alCambiar({ telefono: e.target.value })}
                    placeholder="600 11 22 33"
                />
            </Campo>

            <Campo etiqueta="Correo" htmlFor="email"
                error={correoMal ? 'Ese correo está incompleto. Tiene que llevar arroba y un punto.' : ''}
                ayuda="Si no lo pones, no se le puede mandar la confirmación ni, la víspera, el enlace para que rellene sus datos.">
                <input
                    id="email" type="email" className={claseInput}
                    autoComplete="email" inputMode="email" maxLength={200}
                    value={email}
                    onChange={(e) => alCambiar({ email: e.target.value })}
                    placeholder="carmen@gmail.com"
                />
            </Campo>

            {!correoLimpio && (
                <Aviso
                    tono="atencion" icono={Mail} className="-mt-1 mb-5"
                    titulo="Sin correo no se le manda nada"
                    texto="Ni la confirmación ni el enlace para que rellene sus datos. Si te lo puede dar, pídeselo ahora."
                />
            )}

            {/* ---------- Por dónde ha llegado ---------- */}
            <Campo etiqueta="¿Por dónde te ha llegado?" obligatorio>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CANALES.map((c) => (
                        <Opcion key={c.valor} elegida={canal === c.valor} icono={c.icono}
                            onClick={() => elegirCanal(c.valor)} className="justify-start">
                            {c.etiqueta}
                        </Opcion>
                    ))}
                </div>
            </Campo>

            {/* ---------- Solo si viene de una web de reservas ---------- */}
            {deFuera && (
                <div className="rounded-3xl border border-gray-200 bg-white p-5 mb-6">
                    <p className="font-bold text-lg text-text-primary mb-1">
                        Datos de {canalElegido.etiqueta}
                    </p>
                    <p className="text-base text-gray-600 mb-4">
                        Los dos son opcionales: si no los tienes a mano, sigue sin ellos.
                    </p>

                    <Campo etiqueta={`Número de la reserva de ${canalElegido.etiqueta}`} htmlFor="localizador">
                        <input
                            id="localizador" type="text" className={claseInput} maxLength={60}
                            value={localizador}
                            onChange={(e) => alCambiar({ localizador: e.target.value })}
                            placeholder="Por ejemplo: 4231987655"
                        />
                    </Campo>

                    <Campo etiqueta="Comisión que se lleva" htmlFor="comision"
                        ayuda={canalElegido.comisionSugerida
                            ? `Suele ser el ${canalElegido.comisionSugerida} %. Cámbialo si esta vez es otro.`
                            : 'En euros. Si no lo sabes, déjalo vacío.'}>
                        <input
                            id="comision" type="number" inputMode="decimal" min="0" step="0.01"
                            className={claseInput}
                            value={comision}
                            onChange={(e) => alCambiar({ comision: e.target.value === '' ? '' : Number(e.target.value) })}
                            placeholder="0"
                        />
                    </Campo>

                    {comisionNum > 0 && (
                        <p className="text-base text-gray-700 -mt-2">
                            De los {formatoEuro(precio)} te quedarán{' '}
                            <strong className="text-text-primary">{formatoEuro(Math.max(0, (precio || 0) - comisionNum))}</strong>.
                        </p>
                    )}
                </div>
            )}

            {/* ---------- Seguir ---------- */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Boton variante="secundario" onClick={alAtras} className="sm:w-auto">
                    Volver al paso anterior
                </Boton>
                <Boton ancho tamano="grande" disabled={!puedeSeguir} onClick={alSeguir} className="sm:flex-1">
                    Seguir
                </Boton>
            </div>
            {!puedeSeguir && (
                <p className="mt-2 text-center text-base text-gray-600">
                    Pon el nombre y di por dónde te ha llegado.
                </p>
            )}
        </div>
    );
};

export default Paso2Quien;

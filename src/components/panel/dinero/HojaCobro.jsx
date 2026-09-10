// La hoja de cobrar. La misma en la ficha de una reserva y en la pantalla
// de Dinero: se apunta un cobro igual desde los dos sitios.
//
// Pide solo tres cosas: cuánto, cómo y cuándo. Nada más.
// Y, aparte, el botón de mandarle un enlace para pagar.

import React, { useState, useEffect } from 'react';
import { Check, Link2, Copy, MessageCircle } from 'lucide-react';
import { Boton, Campo, claseInput, Aviso, formatoEuro, hoyISO } from '../ui';
import { Hoja, Opciones } from './ui';
import { FORMAS_DE_PAGO, enlaceWhatsApp, textoRecordatorioCobro } from './formato';
import { apuntarCobro, pedirEnlaceDePago, MOTIVOS_SIN_ENLACE } from './datos';

const dosDecimales = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * <HojaCobro abierta reserva={r} pendiente={135} onCerrar={} onCobrado={(reservaFresca)=>{}} />
 *
 * `onCobrado` recibe la reserva releída de la base: quien la abrió refresca
 * con eso y no con lo que creía que iba a pasar.
 */
export default function HojaCobro({ abierta, reserva, pendiente, onCerrar, onCobrado }) {
    const falta = dosDecimales(pendiente);
    const [importe, setImporte] = useState('');
    const [forma, setForma] = useState('transferencia');
    const [fecha, setFecha] = useState(hoyISO);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);
    const [enlace, setEnlace] = useState(null);
    const [avisoEnlace, setAvisoEnlace] = useState(null);
    const [pidiendoEnlace, setPidiendoEnlace] = useState(false);
    const [copiado, setCopiado] = useState(false);

    // Cada vez que se abre, empieza limpia y con lo que falta ya escrito:
    // lo normal es que le paguen justo eso.
    useEffect(() => {
        if (!abierta) return;
        setImporte(falta > 0 ? String(falta).replace('.', ',') : '');
        setForma(reserva?.channel === 'booking' ? 'booking' : 'transferencia');
        setFecha(hoyISO());
        setError(null);
        setEnlace(null);
        setAvisoEnlace(null);
        setCopiado(false);
    }, [abierta, falta, reserva?.channel]);

    const guardar = async () => {
        setGuardando(true); setError(null);
        try {
            const fresca = await apuntarCobro({
                bookingId: reserva.id, importe, forma, fecha,
            });
            onCobrado?.(fresca);
            onCerrar?.();
        } catch (e) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    };

    const pedirEnlace = async () => {
        setPidiendoEnlace(true); setAvisoEnlace(null); setEnlace(null);
        const { url, motivo } = await pedirEnlaceDePago(reserva?.booking_code);
        if (url) setEnlace(url);
        else setAvisoEnlace(MOTIVOS_SIN_ENLACE[motivo] || MOTIVOS_SIN_ENLACE.no_disponible);
        setPidiendoEnlace(false);
    };

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(enlace);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
        } catch {
            setAvisoEnlace('No he podido copiarlo. Mantén el dedo sobre el enlace y cópialo tú.');
        }
    };

    const waCobro = enlaceWhatsApp(
        reserva?.guest_phone,
        enlace
            ? `${textoRecordatorioCobro(reserva, falta, formatoEuro)}\n\nAquí puedes pagarlo:\n${enlace}`
            : textoRecordatorioCobro(reserva, falta, formatoEuro),
    );

    const idFormas = React.useId();

    return (
        <Hoja
            abierta={abierta}
            titulo="Apuntar un cobro"
            explicacion={reserva?.guest_name ? `De ${reserva.guest_name}.` : undefined}
            onCerrar={onCerrar}
        >
            {falta > 0 && (
                <p className="text-base text-gray-700">
                    Falta por cobrar <strong className="text-amber-700">{formatoEuro(falta)}</strong>.
                </p>
            )}

            <Campo etiqueta="¿Cuánto te han pagado?" htmlFor="cobro-importe">
                <div className="relative">
                    <input
                        id="cobro-importe" type="text" inputMode="decimal" value={importe}
                        onChange={(e) => setImporte(e.target.value.replace(/[^0-9.,]/g, ''))}
                        className={`${claseInput} min-h-[60px] text-2xl font-bold pr-12`}
                        autoComplete="off"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400 pointer-events-none">€</span>
                </div>
            </Campo>

            <div className="mb-5">
                <p id={idFormas} className="block text-base font-bold text-text-primary mb-2">¿Cómo te lo han pagado?</p>
                <Opciones opciones={FORMAS_DE_PAGO} valor={forma} onChange={setForma} etiquetadoPor={idFormas} />
            </div>

            <Campo etiqueta="¿Qué día?" ayuda="Si ha sido hoy, déjalo como está." htmlFor="cobro-fecha">
                <input id="cobro-fecha" type="date" value={fecha} max={hoyISO()}
                    onChange={(e) => setFecha(e.target.value)} className={claseInput} />
            </Campo>

            {error && <Aviso tono="urgente" titulo={error} />}

            <Boton ancho tamano="grande" icono={Check} onClick={guardar} cargando={guardando}>
                Apuntar el cobro
            </Boton>

            {/* ---------- Enlace para pagar ---------- */}
            <div className="border-t border-gray-100 pt-5">
                <p className="text-base font-bold text-text-primary mb-1">¿Prefieres que lo pague con tarjeta?</p>
                <p className="text-sm text-gray-600 mb-3">Le mandas un enlace y paga desde el móvil.</p>

                {!enlace ? (
                    <Boton ancho variante="secundario" icono={Link2} onClick={pedirEnlace} cargando={pidiendoEnlace}>
                        Mandarle un enlace para pagar
                    </Boton>
                ) : (
                    <div className="space-y-3">
                        {/* El enlace de Stripe son 700 caracteres de galimatias: en el
                            movil ocupaba un tercio de la pantalla en letra de 14 px y
                            empujaba los dos botones utiles fuera de la vista. Se dice
                            que esta listo y se dan los botones; el enlace viaja en el
                            portapapeles o en el WhatsApp, que es donde hace falta. */}
                        <p className="text-base font-semibold text-rural-800 bg-rural-50 rounded-2xl p-3 border border-rural-200">
                            Enlace listo. Mándaselo y, en cuanto pague, el cobro se apunta solo.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Boton variante="secundario" icono={Copy} onClick={copiar}>
                                {copiado ? 'Copiado' : 'Copiar el enlace'}
                            </Boton>
                            {waCobro && (
                                <Boton variante="secundario" icono={MessageCircle}
                                    onClick={() => window.open(waCobro, '_blank', 'noopener')}>
                                    Mandarlo por WhatsApp
                                </Boton>
                            )}
                        </div>
                    </div>
                )}

                {avisoEnlace && (
                    <div className="mt-3 space-y-3">
                        <Aviso tono="atencion" titulo={avisoEnlace} />
                        {waCobro && (
                            <Boton ancho variante="secundario" icono={MessageCircle}
                                onClick={() => window.open(waCobro, '_blank', 'noopener')}>
                                Recordárselo por WhatsApp
                            </Boton>
                        )}
                    </div>
                )}
            </div>
        </Hoja>
    );
}

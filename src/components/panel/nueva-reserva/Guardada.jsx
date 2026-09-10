import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, PlusCircle } from 'lucide-react';
import { Boton, Aviso, formatoEuro, fechaEnPalabras } from '../ui';
import { Linea } from './piezas';

// ============================================================
// Guardada — la pantalla de "ya está"
// ============================================================
// No se salta sola a la ficha: lo primero que necesita saber es que la
// reserva está guardada, y si algo no ha salido (el correo, el enlace) se
// lo decimos aquí, no en un sitio del que ya se ha ido.
// ============================================================

const Guardada = ({ resultado, alVerReserva, alApuntarOtra }) => {
    const { codigo, nombre, apartamento, entrada, salida, total, cobrado, correo, enlace } = resultado;
    const [copiado, setCopiado] = useState(false);
    const pendiente = Math.max(0, total - cobrado);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(enlace.url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 3000);
        } catch { /* si el navegador no deja, el enlace se ve igual debajo */ }
    };

    return (
        <div>
            <div className="text-center py-6">
                <span className="w-16 h-16 mx-auto mb-4 rounded-full bg-rural-600 text-white flex items-center justify-center">
                    <CheckCircle2 size={34} aria-hidden="true" />
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary">
                    Reserva guardada
                </h2>
                <p className="text-base text-gray-600 mt-1">
                    Ya está en el calendario. Su número es <strong className="text-text-primary">{codigo}</strong>.
                </p>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 mb-5">
                <Linea etiqueta="Quién">{nombre}</Linea>
                <Linea etiqueta="Entra">{fechaEnPalabras(entrada)}</Linea>
                <Linea etiqueta="Sale">{fechaEnPalabras(salida)}</Linea>
                <Linea etiqueta="Dónde">{apartamento}</Linea>
                <Linea etiqueta="Total" fuerte>{formatoEuro(total)}</Linea>
                <Linea etiqueta="Cobrado">{formatoEuro(cobrado)}</Linea>
                <Linea etiqueta="Queda por cobrar" fuerte>{formatoEuro(pendiente)}</Linea>
            </div>

            {/* ---------- El correo ---------- */}
            {correo === 'enviado' && (
                <Aviso tono="bien" className="mb-4"
                    titulo="Le hemos mandado la confirmación por correo"
                    texto="Dentro va el enlace para que rellene sus datos." />
            )}
            {correo === 'sin-correo' && (
                <Aviso tono="info" className="mb-4"
                    titulo="No se le ha mandado ningún correo"
                    texto="No pusiste su dirección. Puedes añadirla en su ficha y mandárselo desde ahí." />
            )}
            {correo === 'fallo' && (
                <Aviso tono="atencion" className="mb-4"
                    titulo="No se ha podido mandar el correo"
                    texto="La reserva está guardada, tranquila. Puedes volver a mandarlo desde la ficha de la reserva." />
            )}

            {/* ---------- El enlace de pago ---------- */}
            {enlace?.url && (
                <div className="rounded-3xl border-2 border-rural-200 bg-rural-50 p-5 mb-4">
                    <p className="font-bold text-lg text-text-primary mb-1">Enlace para que pague</p>
                    <p className="text-base text-gray-700 mb-3">
                        Cópialo y mándaselo por WhatsApp. Cuando pague, se apunta solo.
                    </p>
                    <p className="text-sm break-all bg-white rounded-2xl border border-gray-200 p-3 mb-3">
                        {enlace.url}
                    </p>
                    <Boton variante={copiado ? 'suave' : 'secundario'} ancho
                        icono={copiado ? Check : Copy} onClick={copiar}>
                        {copiado ? 'Copiado' : 'Copiar el enlace'}
                    </Boton>
                </div>
            )}
            {enlace?.fallo && (
                <Aviso tono="atencion" className="mb-4"
                    titulo="El enlace para pagar no se ha podido hacer"
                    texto="La reserva está guardada y el dinero pendiente apuntado. Cóbralo por transferencia o Bizum, o inténtalo desde la ficha más tarde." />
            )}

            <div className="flex flex-col gap-3 mt-6">
                <Boton ancho tamano="grande" onClick={alVerReserva}>
                    Ver la reserva
                </Boton>
                <Boton ancho variante="secundario" icono={PlusCircle} onClick={alApuntarOtra}>
                    Apuntar otra reserva
                </Boton>
            </div>
        </div>
    );
};

export default Guardada;

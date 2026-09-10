import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { MessageCircle, Copy, Check } from 'lucide-react';
import { Boton } from '../ui';
import { enlacePrecheckin, enlaceCorto, abrirWhatsapp, textoRecordatorio } from './datos';

// ============================================================
// CodigoQR — el cuadrado que el huésped escanea con SU móvil
// ============================================================
// Por qué esto y no teclear los datos ella: la Agencia de Protección de
// Datos recomienda expresamente dar al cliente un formulario que rellene él
// mismo, y sanciona guardar copias del documento. Ella mira el documento y
// lo compara; escribir es cosa del huésped.
//
// El cuadrado se dibuja aquí mismo, en el propio móvil (qrcode.react, que ya
// estaba en el proyecto). No se pide a ningún servicio de fuera: si en
// Hinojares se va la línea, el cuadrado sigue saliendo, y además el enlace de
// una reserva no tiene por qué pasar por la web de nadie.
// ============================================================

const CodigoQR = ({ reserva, tamano = 260 }) => {
    const [copiado, setCopiado] = useState(false);
    const codigo = reserva?.booking_code || '';
    const enlace = enlacePrecheckin(codigo, { absoluto: true });

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(enlace);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 3000);
        } catch { /* sin permiso: queda el enlace escrito debajo */ }
    };

    const porWhatsapp = () => {
        const ido = abrirWhatsapp(reserva?.guest_phone, textoRecordatorio(reserva, { enLaPuerta: true }));
        if (!ido) {
            window.open(
                `https://wa.me/?text=${encodeURIComponent(textoRecordatorio(reserva, { enLaPuerta: true }))}`,
                '_blank', 'noopener',
            );
        }
    };

    if (!codigo) {
        return (
            <p className="text-base text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                Esta reserva no tiene código, así que no puedo sacar el cuadrado. Avisa a Jesús.
            </p>
        );
    }

    return (
        <div>
            <p className="text-base text-gray-700 leading-relaxed">
                Enséñale la pantalla. Con la cámara de su móvil apuntando aquí se le abre el
                formulario ya con su reserva puesta.
            </p>

            <div className="mt-4 flex justify-center">
                <div className="bg-white p-4 rounded-3xl border-2 border-gray-200">
                    <QRCodeSVG
                        value={enlace}
                        size={tamano}
                        level="M"
                        marginSize={0}
                        bgColor="#ffffff"
                        fgColor="#2C3319"
                        style={{ width: '100%', height: 'auto', maxWidth: tamano, display: 'block' }}
                        aria-label="Código para escanear con el móvil"
                    />
                </div>
            </div>

            <p className="mt-4 text-sm text-gray-600">Si el cuadrado no le funciona, que escriba esto:</p>
            <p className="mt-1 text-base font-mono font-bold text-rural-800 break-all leading-snug">
                {enlaceCorto(codigo)}
            </p>

            <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
                <Boton icono={MessageCircle} onClick={porWhatsapp} ancho>
                    Mandárselo por WhatsApp
                </Boton>
                <Boton
                    variante="secundario"
                    icono={copiado ? Check : Copy}
                    onClick={copiar}
                    ancho
                >
                    {copiado ? 'Copiado' : 'Copiar el enlace'}
                </Boton>
            </div>
        </div>
    );
};

export default CodigoQR;

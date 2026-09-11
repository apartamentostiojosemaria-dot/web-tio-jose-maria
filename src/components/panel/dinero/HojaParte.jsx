// Los datos que pide la policía, en la ficha de una reserva.
//
// Aquí NO se ven nombres, documentos ni direcciones de los viajeros: solo
// el semáforo (están todos / falta alguien) y el botón de recordárselo.
// Los datos en sí viven en otra pantalla y con otro permiso.

import React from 'react';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { Boton, Aviso } from '../ui';
import { Hoja, SemaforoPolicia } from './ui';
import { enlaceWhatsApp, textoRecordatorioPolicia } from './formato';

export default function HojaParte({ abierta, reserva, parte, onCerrar, onVerDatos }) {
    const wa = enlaceWhatsApp(reserva?.guest_phone, textoRecordatorioPolicia(reserva));
    const personas = reserva?.pax_count || 1;
    const rellenos = parte?.viajeros_rellenos ?? null;

    return (
        <Hoja abierta={abierta} titulo="Datos de la policía" onCerrar={onCerrar}
            explicacion={reserva?.guest_name ? `De la reserva de ${reserva.guest_name}.` : undefined}>

            <div className="flex items-center gap-3 flex-wrap">
                <SemaforoPolicia parte={parte} />
                {rellenos != null && (
                    <span className="text-base text-gray-700">
                        {rellenos} de {personas} {personas === 1 ? 'persona' : 'personas'}
                    </span>
                )}
            </div>

            {parte == null && (
                <Aviso tono="info"
                    titulo="Todavía no puedo decirte si están rellenos"
                    texto="Esta parte se está terminando por dentro. Mientras tanto, puedes recordárselo igual." />
            )}

            {parte?.faltan === false && (
                <Aviso tono="bien" titulo="Están todos. No tienes que hacer nada más." />
            )}

            {parte?.faltan === true && (
                <Aviso tono="atencion"
                    titulo={parte.faltan_cuantos === 1 ? 'Falta 1 persona por rellenar sus datos' : `Faltan ${parte.faltan_cuantos} personas por rellenar sus datos`}
                    texto="Hay que tenerlos antes de que entren." />
            )}

            {wa ? (
                <Boton ancho tamano="grande" icono={MessageCircle}
                    onClick={() => window.open(wa, '_blank', 'noopener')}>
                    Recordárselo por WhatsApp
                </Boton>
            ) : (
                <Aviso tono="atencion"
                    titulo="No tienes su teléfono apuntado"
                    texto="Sin teléfono no se le puede escribir por WhatsApp. Apúntaselo en su ficha." />
            )}

            <Boton ancho variante="secundario" icono={ArrowRight} onClick={onVerDatos}>
                Ver los datos que ha rellenado
            </Boton>
        </Hoja>
    );
}

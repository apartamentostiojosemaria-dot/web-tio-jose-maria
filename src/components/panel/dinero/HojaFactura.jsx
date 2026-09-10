// La factura de una reserva, con tres cosas y nada más:
//   Hacer factura · Mandarla por correo · Esta no necesita factura.
//
// Ni series, ni números, ni nada de lo que hace por dentro. Si algo de eso
// aparece en pantalla, está mal.

import React, { useState } from 'react';
import { FileText, Send, Eye, Check } from 'lucide-react';
import { Boton, Aviso } from '../ui';
import { Hoja } from './ui';
import { diaMesYAno } from './formato';
import { hacerFactura, mandarFactura, verFacturaPdf, marcarSinFactura } from './datos';

export default function HojaFactura({ abierta, reserva, factura, onCerrar, onCambio }) {
    const [trabajando, setTrabajando] = useState(null);   // 'hacer' | 'mandar' | 'ver' | 'sin'
    const [error, setError] = useState(null);
    const [bien, setBien] = useState(null);

    const sinFactura = !!reserva?.invoice_not_needed;
    const yaMandada = !!factura?.email_sent_at;

    const hacer = async (tambienMandar) => {
        setTrabajando(tambienMandar ? 'mandar' : 'hacer'); setError(null); setBien(null);
        try {
            await hacerFactura(reserva.id);
            if (tambienMandar) await mandarFactura(reserva.id);
            setBien(tambienMandar ? 'Factura hecha y mandada por correo.' : 'Factura hecha.');
            await onCambio?.();
        } catch (e) { setError(e.message); } finally { setTrabajando(null); }
    };

    const mandar = async () => {
        setTrabajando('mandar'); setError(null); setBien(null);
        try {
            await mandarFactura(reserva.id, { forzar: yaMandada });
            setBien('Mandada por correo.');
            await onCambio?.();
        } catch (e) { setError(e.message); } finally { setTrabajando(null); }
    };

    const ver = async () => {
        setTrabajando('ver'); setError(null);
        try {
            const url = await verFacturaPdf(factura.id);
            window.open(url, '_blank', 'noopener');
        } catch (e) { setError(e.message); } finally { setTrabajando(null); }
    };

    const alternarSinFactura = async () => {
        setTrabajando('sin'); setError(null); setBien(null);
        try {
            await marcarSinFactura(reserva.id, !sinFactura);
            await onCambio?.();
        } catch (e) { setError(e.message); } finally { setTrabajando(null); }
    };

    return (
        <Hoja abierta={abierta} titulo="Factura" onCerrar={onCerrar}
            explicacion={reserva?.guest_name ? `De la reserva de ${reserva.guest_name}.` : undefined}>

            {factura ? (
                <Aviso tono="bien"
                    titulo={`Factura hecha el ${diaMesYAno(factura.fecha_emision)}`}
                    texto={yaMandada ? `Mandada por correo el ${diaMesYAno(String(factura.email_sent_at).slice(0, 10))}.` : 'Todavía no se le ha mandado.'} />
            ) : sinFactura ? (
                <Aviso tono="info" titulo="Esta reserva está marcada como que no necesita factura." />
            ) : (
                <Aviso tono="atencion" titulo="Esta reserva todavía no tiene factura." />
            )}

            {error && <Aviso tono="urgente" titulo={error} />}
            {bien && <Aviso tono="bien" titulo={bien} />}

            <div className="space-y-3">
                {!factura && !sinFactura && (
                    <>
                        <Boton ancho tamano="grande" icono={FileText}
                            onClick={() => hacer(false)} cargando={trabajando === 'hacer'}>
                            Hacer la factura
                        </Boton>
                        <Boton ancho variante="secundario" icono={Send}
                            onClick={() => hacer(true)} cargando={trabajando === 'mandar'}>
                            Hacerla y mandársela por correo
                        </Boton>
                    </>
                )}

                {factura && (
                    <>
                        <Boton ancho tamano="grande" icono={Send} onClick={mandar} cargando={trabajando === 'mandar'}>
                            {yaMandada ? 'Volver a mandársela por correo' : 'Mandársela por correo'}
                        </Boton>
                        <Boton ancho variante="secundario" icono={Eye} onClick={ver} cargando={trabajando === 'ver'}>
                            Ver la factura
                        </Boton>
                    </>
                )}

                {!factura && (
                    <Boton ancho variante={sinFactura ? 'secundario' : 'suave'} icono={sinFactura ? Check : undefined}
                        onClick={alternarSinFactura} cargando={trabajando === 'sin'}>
                        {sinFactura ? 'Sí que hace falta factura' : 'Esta no necesita factura'}
                    </Boton>
                )}
            </div>
        </Hoja>
    );
}

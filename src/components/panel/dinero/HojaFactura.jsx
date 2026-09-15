// La factura de una reserva, con tres cosas y nada más:
//   Hacer factura · Mandarla por correo · Esta no necesita factura.
//
// Ni series, ni números, ni nada de lo que hace por dentro. Si algo de eso
// aparece en pantalla, está mal.
//
// Las rectificativas (abonos) las hace Jesús desde la vista completa. Aquí
// solo se VE lo que pasó: «se le abonaron 60 €» o «la factura del 3/9 está
// anulada» — y si está anulada y la reserva sigue viva, se puede hacer otra.

import React, { useState } from 'react';
import { FileText, Send, Eye, Check } from 'lucide-react';
import { Hoja, Boton, Aviso, formatoEuro } from '../ui';
import { diaMesYAno } from './formato';
import { hacerFactura, mandarFactura, verFacturaPdf, marcarSinFactura } from './datos';

export default function HojaFactura({ abierta, reserva, factura, anuladas = [], onCerrar, onCambio }) {
    const [trabajando, setTrabajando] = useState(null);   // 'hacer' | 'mandar' | 'ver' | 'sin'
    const [error, setError] = useState(null);
    const [bien, setBien] = useState(null);

    const sinFactura = !!reserva?.invoice_not_needed;
    const yaMandada = !!factura?.email_sent_at;
    const cancelada = reserva?.status === 'cancelled';
    const ultimaAnulada = anuladas.length ? anuladas[anuladas.length - 1] : null;
    const motivoDe = (f) => f?.rectificativas?.[f.rectificativas.length - 1]?.motivo_rectificacion;
    const fechaDe = (f) => f?.rectificativas?.[f.rectificativas.length - 1]?.fecha_emision;

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
            ) : ultimaAnulada ? (
                <Aviso tono="atencion"
                    titulo={`La factura del ${diaMesYAno(ultimaAnulada.fecha_emision)} está anulada${fechaDe(ultimaAnulada) ? ` desde el ${diaMesYAno(fechaDe(ultimaAnulada))}` : ''}.`}
                    texto={(motivoDe(ultimaAnulada) ? `Motivo: ${motivoDe(ultimaAnulada)}. ` : '')
                        + (cancelada ? 'La reserva está cancelada: no hace falta otra.'
                            : sinFactura ? 'Está marcada como que no necesita factura.'
                                : 'Si el huésped sigue necesitando factura, haz una nueva.')} />
            ) : sinFactura ? (
                <Aviso tono="info" titulo="Esta reserva está marcada como que no necesita factura." />
            ) : (
                <Aviso tono="atencion" titulo="Esta reserva todavía no tiene factura." />
            )}

            {factura && factura.abonado > 0 && (
                <Aviso tono="info"
                    titulo={`Jesús le abonó ${formatoEuro(factura.abonado)} de esta factura${fechaDe(factura) ? ` el ${diaMesYAno(fechaDe(factura))}` : ''}.`}
                    texto={motivoDe(factura) ? `Motivo: ${motivoDe(factura)}.` : undefined} />
            )}

            {error && <Aviso tono="urgente" titulo={error} />}
            {bien && <Aviso tono="bien" titulo={bien} />}

            <div className="space-y-3">
                {!factura && !sinFactura && !cancelada && (
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

                {!factura && !cancelada && (
                    <Boton ancho variante={sinFactura ? 'secundario' : 'suave'} icono={sinFactura ? Check : undefined}
                        onClick={alternarSinFactura} cargando={trabajando === 'sin'}>
                        {sinFactura ? 'Sí que hace falta factura' : 'Esta no necesita factura'}
                    </Boton>
                )}
            </div>
        </Hoja>
    );
}

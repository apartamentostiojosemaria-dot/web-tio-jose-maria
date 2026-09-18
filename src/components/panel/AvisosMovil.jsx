import React, { useEffect, useState } from 'react';
import { BellRing, BellOff, Check, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Tarjeta, Boton } from './ui';

// ============================================================
// AvisosMovil — «Avisarme en este móvil»
// ============================================================
// Web Push (migración 0041). Un toque: el navegador pide permiso, se guarda
// la suscripción de ESTE móvil en push_subscriptions y a partir de ahí la
// base avisa sola (rellenan la policía, reserva nueva, piden factura, hora de
// llegada). Se enseña solo mientras no esté activado; una vez activado, una
// línea pequeña con «Quitar».
//
// En iPhone los avisos solo funcionan con el panel instalado en la pantalla
// de inicio (iOS 16.4+): si se abre desde Safari suelto, se explica eso.
// ============================================================

const base64UrlABytes = (b64) => {
    const relleno = '='.repeat((4 - (b64.length % 4)) % 4);
    const crudo = atob((b64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
};

const esIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const instalada = () => window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;

const AvisosMovil = () => {
    const [estado, setEstado] = useState('mirando');   // mirando | no_soportado | ios_sin_instalar | apagado | activo | trabajando | error | denegado
    const [error, setError] = useState(null);

    useEffect(() => {
        (async () => {
            if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
                setEstado(esIos() && !instalada() ? 'ios_sin_instalar' : 'no_soportado'); return;
            }
            if (Notification.permission === 'denied') { setEstado('denegado'); return; }
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (!sub) { setEstado('apagado'); return; }
                // ¿Está apuntada en la base (y no caída)?
                const { data } = await supabase.from('push_subscriptions').select('id, failed_at').eq('endpoint', sub.endpoint).maybeSingle();
                setEstado(data && !data.failed_at ? 'activo' : 'apagado');
            } catch { setEstado('apagado'); }
        })();
    }, []);

    const activar = async () => {
        setEstado('trabajando'); setError(null);
        try {
            const permiso = await Notification.requestPermission();
            if (permiso !== 'granted') { setEstado('denegado'); return; }
            const { data: clave, error: e1 } = await supabase.rpc('tjm_push_clave_publica');
            if (e1 || !clave) throw new Error('Los avisos no están configurados todavía. Avisa a Jesús.');
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlABytes(clave) });
            const { data: { user } } = await supabase.auth.getUser();
            const j = sub.toJSON();
            const { error: e2 } = await supabase.from('push_subscriptions').upsert({
                user_id: user.id, endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
                user_agent: navigator.userAgent.slice(0, 200), failed_at: null, fail_reason: null,
            }, { onConflict: 'endpoint' });
            if (e2) throw e2;
            setEstado('activo');
        } catch (e) { setError(e.message || 'No se ha podido activar.'); setEstado('error'); }
    };

    const quitar = async () => {
        setEstado('trabajando');
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) { await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
        } catch { /* da igual: se queda como apagado */ }
        setEstado('apagado');
    };

    if (estado === 'mirando' || estado === 'no_soportado') return null;

    if (estado === 'activo') {
        return (
            <p className="text-sm text-gray-600 flex items-center gap-2 px-1">
                <Check size={16} className="text-rural-700" aria-hidden="true" />
                Este móvil recibe los avisos.
                <button type="button" onClick={quitar} className="underline text-gray-500 min-h-[44px] px-2">Quitar</button>
            </p>
        );
    }

    return (
        <Tarjeta>
            <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-2xl bg-rural-50 text-rural-700 flex items-center justify-center shrink-0" aria-hidden="true">
                    {estado === 'denegado' ? <BellOff size={20} /> : estado === 'ios_sin_instalar' ? <Smartphone size={20} /> : <BellRing size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-lg text-text-primary">Que te avise el móvil</p>
                    {estado === 'ios_sin_instalar' ? (
                        <p className="text-base text-gray-700 mt-1 leading-relaxed">
                            En el iPhone los avisos solo funcionan con el panel puesto en la pantalla de inicio:
                            pulsa el botón de compartir de Safari (el cuadrado con la flecha) y luego «Añadir a pantalla de inicio».
                            Ábrelo desde ese icono y aquí saldrá el botón.
                        </p>
                    ) : estado === 'denegado' ? (
                        <p className="text-base text-gray-700 mt-1 leading-relaxed">
                            Este móvil tiene los avisos bloqueados para esta web. Se cambia en los ajustes del navegador
                            (Notificaciones → tiojosemaria.com → Permitir).
                        </p>
                    ) : (
                        <>
                            <p className="text-base text-gray-700 mt-1 leading-relaxed">
                                Te avisa cuando rellenan los datos de la policía, cuando entra una reserva, cuando piden
                                factura y cuando dicen a qué hora llegan. Un toque abre la reserva.
                            </p>
                            {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
                            <Boton className="mt-3" icono={BellRing} onClick={activar} cargando={estado === 'trabajando'}>
                                Avisarme en este móvil
                            </Boton>
                        </>
                    )}
                </div>
            </div>
        </Tarjeta>
    );
};

export default AvisosMovil;

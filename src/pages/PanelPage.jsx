import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import PanelLogin from '../components/panel/PanelLogin';
import PanelApp from '../components/panel/PanelApp';
import { Cargando, Boton } from '../components/panel/ui';

// ============================================================
// PanelPage — la puerta de /panel
// ============================================================
// Decide qué se ve:
//   - Todavía comprobando  → "Un momento…"
//   - Sin sesión           → PanelLogin (entrar con un número, sin contraseña)
//   - Con permiso          → PanelApp
//   - Sin permiso          → un mensaje claro, sin palabras raras
//
// Tiene su propia comprobación de sesión (no depende de App.jsx) para que
// esta ruta funcione sola y no haya que tocar el resto de la web.
// Pueden entrar los perfiles con `role` 'staff' (ella) o 'admin' (Jesús).
// ============================================================

const CON_PERMISO = ['staff', 'admin'];

const PanelPage = () => {
    const [sesion, setSesion] = useState(null);
    const [perfil, setPerfil] = useState(null);
    const [comprobando, setComprobando] = useState(true);

    useEffect(() => {
        let cortado = false;

        const cargarPerfil = async (idUsuario) => {
            const { data } = await supabase.from('profiles').select('*').eq('id', idUsuario).maybeSingle();
            if (cortado) return;
            setPerfil(data || null);
            setComprobando(false);
        };

        let usuarioActual = null;

        supabase.auth.getSession().then(({ data }) => {
            if (cortado) return;
            setSesion(data?.session || null);
            if (data?.session) { usuarioActual = data.session.user.id; cargarPerfil(data.session.user.id); }
            else setComprobando(false);
        });

        // Ojo: Supabase dispara SIGNED_IN / TOKEN_REFRESHED cada vez que la
        // pestana vuelve a primer plano. Si en cada aviso volviesemos a
        // "comprobando", el panel se remonta y ella acaba otra vez en "Hoy"
        // solo por haber mirado WhatsApp. Solo recargamos si CAMBIA el usuario.
        const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
            if (cortado) return;
            const nuevoId = s?.user?.id || null;
            setSesion(s || null);
            if (!nuevoId) { usuarioActual = null; setPerfil(null); setComprobando(false); return; }
            if (nuevoId === usuarioActual) return;   // mismo usuario: no remontamos
            usuarioActual = nuevoId;
            setComprobando(true);
            cargarPerfil(nuevoId);
        });

        return () => { cortado = true; sub.subscription.unsubscribe(); };
    }, []);

    if (comprobando) {
        return (
            <div className="min-h-screen bg-rural-50 flex items-center justify-center">
                <Cargando texto="Un momento…" />
            </div>
        );
    }

    if (!sesion) return <PanelLogin />;

    const puede = perfil && perfil.is_active !== false && CON_PERMISO.includes(perfil.role);
    if (!puede) return <SinPermiso correo={sesion?.user?.email} hayPerfil={!!perfil} />;

    return <PanelApp perfil={perfil} />;
};

const SinPermiso = ({ correo, hayPerfil }) => (
    <div className="min-h-screen bg-rural-50 flex items-center justify-center p-5">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-7 max-w-md w-full text-center">
            <h1 className="font-serif text-2xl font-bold text-text-primary mb-3">
                Este correo todavía no puede entrar aquí
            </h1>
            <p className="text-base text-gray-600">
                Has entrado como <span className="font-bold text-text-primary break-all">{correo}</span>, pero
                {hayPerfil
                    ? ' este correo no tiene permiso para ver la gestión de los apartamentos.'
                    : ' todavía no tienes ficha en el sistema.'}
            </p>
            <p className="text-base text-gray-600 mt-3">
                Dile a Jesús que te dé permiso y en un minuto lo tienes.
            </p>
            <div className="mt-6 flex justify-center">
                <Boton variante="secundario"
                    onClick={() => supabase.auth.signOut().then(() => window.location.assign('/panel'))}>
                    Salir y probar con otro correo
                </Boton>
            </div>
        </div>
    </div>
);

export default PanelPage;

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, ArrowRight, ChevronLeft, RefreshCw, Check } from 'lucide-react';
import { Boton, Campo, claseInput } from './ui';

// ============================================================
// PanelLogin — entrar sin contraseña
// ============================================================
// Ella escribe su correo, le llega un código de 6 números y entra.
// La sesión se queda guardada en el móvil (supabase-js guarda y renueva
// el acceso solo), así que en el día a día no vuelve a ver esta pantalla.
//
// Cómo funciona por dentro (no hace falta tocar nada del servidor):
//   1. `request-otp` manda el código por correo. Esa función ya deja pasar
//      a cualquier correo que esté en `profiles`, así que en cuanto exista
//      la ficha de la madre en `profiles` con su correo, funciona igual que
//      para un huésped. No ha habido que cambiarla.
//   2. `verify-otp` comprueba el código y devuelve un enlace de acceso.
//      En vez de saltar a ese enlace (que nos sacaría de /panel y volvería
//      a la portada), sacamos su `token` y abrimos la sesión aquí mismo con
//      `supabase.auth.verifyOtp`. Así se queda en /panel y no se pierde.
//      Si eso fallara, se salta al enlace como plan B.
// ============================================================

const PanelLogin = () => {
    const [paso, setPaso] = useState('correo');   // correo | codigo | dentro
    const [correo, setCorreo] = useState('');
    const [digitos, setDigitos] = useState(['', '', '', '', '', '']);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    const [espera, setEspera] = useState(0);
    const refs = useRef([]);

    useEffect(() => {
        if (espera <= 0) return;
        const t = setTimeout(() => setEspera((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [espera]);

    const llamar = (fn, cuerpo) =>
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(cuerpo),
        });

    const pedirCodigo = async () => {
        const limpio = correo.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
            setError('Escribe tu correo completo, con la arroba. Por ejemplo: nombre@gmail.com');
            return;
        }
        setCargando(true); setError(null);
        try {
            const res = await llamar('request-otp', { email: limpio });
            const datos = await res.json().catch(() => ({}));
            if (datos?.error === 'too_many_requests') {
                setError('Has pedido varios códigos seguidos. Espera unos minutos y vuelve a intentarlo.');
                return;
            }
            if (!res.ok) {
                setError('No hemos podido mandarte el código ahora mismo. Inténtalo en un minuto.');
                return;
            }
            setPaso('codigo');
            setEspera(60);
            setTimeout(() => refs.current[0]?.focus(), 100);
        } catch {
            setError('No hay conexión. Comprueba el wifi o los datos del móvil.');
        } finally {
            setCargando(false);
        }
    };

    const comprobarCodigo = async (codigo) => {
        setCargando(true); setError(null);
        try {
            const res = await llamar('verify-otp', { email: correo.trim().toLowerCase(), code: codigo });
            const datos = await res.json().catch(() => ({}));
            if (!res.ok || !datos?.action_link) {
                setError('Ese código no vale o ha caducado. Pide otro.');
                setDigitos(['', '', '', '', '', '']);
                refs.current[0]?.focus();
                return;
            }

            // Abrimos la sesión aquí mismo, sin salir de esta pantalla.
            let dentro = false;
            try {
                const enlace = new URL(datos.action_link);
                const token_hash = enlace.searchParams.get('token');
                if (token_hash) {
                    const { error: fallo } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' });
                    dentro = !fallo;
                }
            } catch { /* plan B abajo */ }

            setPaso('dentro');
            if (!dentro) window.location.href = datos.action_link;
        } catch {
            setError('No hay conexión. Vuelve a intentarlo.');
        } finally {
            setCargando(false);
        }
    };

    const escribirDigito = (i, valor) => {
        const n = valor.replace(/\D/g, '').slice(-1);
        const siguiente = [...digitos];
        siguiente[i] = n;
        setDigitos(siguiente);
        if (n && i < 5) refs.current[i + 1]?.focus();
        const completo = siguiente.join('');
        if (completo.length === 6 && siguiente.every((d) => d !== '')) comprobarCodigo(completo);
    };

    const pegar = (e) => {
        const texto = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (texto.length !== 6) return;
        e.preventDefault();
        setDigitos(texto.split(''));
        comprobarCodigo(texto);
    };

    const teclaAtras = (i, e) => {
        if (e.key === 'Backspace' && !digitos[i] && i > 0) refs.current[i - 1]?.focus();
    };

    return (
        <div className="min-h-screen bg-rural-50 px-5 py-10 flex flex-col">
            <header className="max-w-md w-full mx-auto mb-8">
                <p className="text-xs uppercase tracking-[0.25em] font-bold text-gray-500">Apartamentos</p>
                <h1 className="font-serif text-3xl font-bold text-text-primary leading-tight mt-1">
                    Tío José María
                </h1>
            </header>

            <main className="max-w-md w-full mx-auto flex-1">
                {paso === 'correo' && (
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                        <h2 className="text-xl font-bold text-text-primary mb-2">Entrar</h2>
                        <p className="text-base text-gray-600 mb-6">
                            Escribe tu correo y te mandamos un número de seis cifras para entrar.
                            No hace falta contraseña.
                        </p>

                        <form onSubmit={(e) => { e.preventDefault(); pedirCodigo(); }} noValidate>
                            <Campo etiqueta="Tu correo" htmlFor="panel-correo" error={error}>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                                    <input
                                        id="panel-correo"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="email"
                                        autoFocus
                                        value={correo}
                                        onChange={(e) => setCorreo(e.target.value)}
                                        placeholder="nombre@correo.com"
                                        className={`${claseInput} pl-12`}
                                    />
                                </div>
                            </Campo>

                            <Boton type="submit" ancho tamano="grande" icono={ArrowRight}
                                cargando={cargando} disabled={!correo}>
                                {cargando ? 'Mandando…' : 'Mandarme el número'}
                            </Boton>
                        </form>
                    </div>
                )}

                {paso === 'codigo' && (
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                        <button type="button"
                            onClick={() => { setPaso('correo'); setDigitos(['', '', '', '', '', '']); setError(null); }}
                            className="inline-flex items-center gap-1 min-h-[44px] text-sm font-semibold text-gray-600 hover:text-text-primary -ml-1 mb-2">
                            <ChevronLeft size={18} aria-hidden="true" /> Cambiar de correo
                        </button>

                        <h2 className="text-xl font-bold text-text-primary mb-2">Escribe el número</h2>
                        <p className="text-base text-gray-600 mb-1">Te lo hemos mandado a</p>
                        <p className="text-base font-bold text-text-primary mb-6 break-all">{correo}</p>

                        <div className="flex justify-between gap-2 mb-4" role="group" aria-label="Número de seis cifras">
                            {digitos.map((d, i) => (
                                <input
                                    key={i}
                                    ref={(el) => (refs.current[i] = el)}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                                    maxLength={1}
                                    value={d}
                                    aria-label={`Cifra ${i + 1} de 6`}
                                    onChange={(e) => escribirDigito(i, e.target.value)}
                                    onKeyDown={(e) => teclaAtras(i, e)}
                                    onPaste={i === 0 ? pegar : undefined}
                                    disabled={cargando}
                                    className="w-12 h-16 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-white border-2 border-gray-200 rounded-2xl outline-none focus:border-rural-600 focus-visible:ring-4 focus-visible:ring-rural-600/20 transition-colors"
                                />
                            ))}
                        </div>

                        {cargando && <p className="text-sm text-gray-500 text-center" role="status">Comprobando…</p>}

                        {error && (
                            <p role="alert" className="text-base font-semibold text-red-700 text-center mt-2">{error}</p>
                        )}

                        <div className="mt-6 text-center">
                            <button type="button" onClick={pedirCodigo} disabled={espera > 0 || cargando}
                                className="inline-flex items-center gap-2 min-h-[44px] px-3 text-sm font-semibold text-rural-700 hover:text-rural-800 disabled:opacity-40">
                                <RefreshCw size={15} aria-hidden="true" />
                                {espera > 0 ? `Pedir otro número dentro de ${espera} s` : 'Pedir otro número'}
                            </button>
                        </div>

                        <p className="mt-6 text-sm text-gray-500 text-center leading-relaxed">
                            Si no lo ves en el correo, mira en la carpeta de correo no deseado.
                            A veces tarda un par de minutos.
                        </p>
                    </div>
                )}

                {paso === 'dentro' && (
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-10 text-center">
                        <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center bg-rural-600">
                            <Check size={30} className="text-white" aria-hidden="true" />
                        </div>
                        <p className="text-xl font-bold text-text-primary">Entrando…</p>
                    </div>
                )}
            </main>

            <footer className="max-w-md w-full mx-auto mt-10">
                <p className="text-sm text-gray-500">
                    ¿Algún problema para entrar? Llama a Jesús y lo miramos.
                </p>
            </footer>
        </div>
    );
};

export default PanelLogin;

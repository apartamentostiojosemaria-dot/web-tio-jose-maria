import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Sun, CalendarDays, PlusCircle, BookMarked, Users, Euro, Tag, Brush, Shield,
    LogOut, ChevronLeft, LayoutGrid, Menu,
} from 'lucide-react';
import { Cargando, Hoja } from './ui';

// ============================================================
// PanelApp — el armazón del panel sencillo (/panel)
// ============================================================
// Quien lo usa: la madre de Jesús. Se defiende con el móvil y con el
// ordenador, pero no es técnica. Reglas que no se tocan:
//   - Nada escondido: en el móvil hay barra abajo con lo de cada día y,
//     además, tarjetas grandes en la portada a TODAS las secciones.
//     En el ordenador, la lista entera siempre a la vista, a la izquierda.
//   - Cada pantalla se entiende sola. Si hace falta explicarla, está mal.
//   - Palabras suyas. Prohibido en pantalla: iCal, hold, token, XML, API,
//     Verifactu, SOAP, OTA, sincronizar, check-in/check-out, KPI, panel de
//     control en inglés. Buenas: reserva, huésped, entra, sale, cobrado,
//     pendiente, datos de la policía, factura, limpieza.
//
// CONTRATO PARA LOS DEMÁS AGENTES
// Cada sección recibe estas props y no necesita saber nada más del armazón:
//   ir(seccionId, params)  → cambia de pantalla. Ej: ir('reserva', { reservaId: 12 })
//   volver()               → vuelve a la pantalla anterior
//   perfil                 → fila de `profiles` de quien ha entrado
//   params                 → lo que le pasó quien la abrió (objeto, nunca null)
//   protegerSalida(aviso)  → con un texto, pregunta antes de salir de la
//                            pantalla (también con el «Atrás» del móvil);
//                            con null, deja salir sin preguntar.
// Secciones registradas abajo en SECCIONES (visibles) y OCULTAS (fichas).
// ============================================================

const PanelHome = lazy(() => import('./PanelHome'));
const CalendarioPanel = lazy(() => import('./CalendarioPanel'));
const NuevaReservaPanel = lazy(() => import('./NuevaReservaPanel'));
const ReservasPanel = lazy(() => import('./ReservasPanel'));
const ReservaFicha = lazy(() => import('./ReservaFicha'));
const ClientesPanel = lazy(() => import('./ClientesPanel'));
const DineroPanel = lazy(() => import('./DineroPanel'));
const PreciosPanel = lazy(() => import('./PreciosPanel'));
const LimpiezasPanel = lazy(() => import('./LimpiezasPanel'));
const ParteViajerosPanel = lazy(() => import('./ParteViajerosPanel'));
const CheckinPanel       = lazy(() => import('./CheckinPanel'));

/** Secciones que se ven en el menú, en el orden en que ella las usa. */
export const SECCIONES = [
    { id: 'inicio', etiqueta: 'Hoy', icono: Sun, resumen: 'Quién llega y quién se va' },
    { id: 'calendario', etiqueta: 'Calendario', icono: CalendarDays, resumen: 'Qué está libre y qué está ocupado' },
    { id: 'nueva-reserva', etiqueta: 'Apuntar reserva', icono: PlusCircle, resumen: 'Alguien llama y quiere venir' },
    { id: 'reservas', etiqueta: 'Reservas', icono: BookMarked, resumen: 'Todas, una por una' },
    { id: 'clientes', etiqueta: 'Clientes', icono: Users, resumen: 'Teléfonos, notas y quién ya vino' },
    { id: 'dinero', etiqueta: 'Dinero', icono: Euro, resumen: 'Lo cobrado y lo que falta' },
    { id: 'precios', etiqueta: 'Precios', icono: Tag, resumen: 'Por noche, temporadas y días cerrados' },
    { id: 'limpiezas', etiqueta: 'Limpiezas', icono: Brush, resumen: 'Qué apartamento toca' },
    { id: 'parte', etiqueta: 'Datos de la policía', icono: Shield, resumen: 'Quién los ha rellenado y quién no' },
];

/** Pantallas que no salen en el menú porque se abren desde otra. */
const OCULTAS = [
    { id: 'reserva', etiqueta: 'Reserva' },
    { id: 'checkin', etiqueta: 'Hacer el check-in' },
];

/**
 * La barra de abajo del móvil: lo de todos los días, con «Apuntar» en el
 * centro. El resto (Clientes, Dinero, Precios, Limpiezas, Policía) va en «Más».
 */
const EN_LA_BARRA = ['inicio', 'calendario', 'nueva-reserva', 'reservas'];

const TODAS = [...SECCIONES, ...OCULTAS];
const buscarSeccion = (id) => TODAS.find((s) => s.id === id) || SECCIONES[0];

// ---------- La pantalla vive en la dirección de la página ----------
// /panel?s=reserva&p={"reservaId":60}. Así el «Atrás» del móvil vuelve a la
// pantalla anterior en vez de sacarla del panel, y recargar la deja donde
// estaba (23-sep: recargar la devolvía a «Hoy»).
const leerDeLaDireccion = () => {
    try {
        const q = new URLSearchParams(window.location.search);
        const seccion = q.get('s');
        if (!seccion || !TODAS.some((x) => x.id === seccion)) return { seccion: 'inicio', params: {} };
        const p = q.get('p');
        return { seccion, params: p ? JSON.parse(p) : {} };
    } catch {
        return { seccion: 'inicio', params: {} };
    }
};

const direccionDe = ({ seccion, params }) => {
    if (seccion === 'inicio') return window.location.pathname;
    const q = new URLSearchParams({ s: seccion });
    // `abrir` solo sirve al entrar desde un aviso: no se guarda, o se
    // reabriría la hoja cada vez que vuelve atrás o recarga.
    const { abrir, ...resto } = params || {};
    if (Object.keys(resto).length > 0) q.set('p', JSON.stringify(resto));
    return `${window.location.pathname}?${q.toString()}`;
};

const PanelApp = ({ perfil }) => {
    const [vista, setVista] = useState(leerDeLaDireccion);
    const [saliendo, setSaliendo] = useState(false);
    const [menuMas, setMenuMas] = useState(false);
    // Una pantalla a medias (apuntar reserva) pone aquí qué se pierde si se va.
    const salidaProtegida = useRef(null);
    const protegerSalida = useCallback((aviso) => { salidaProtegida.current = aviso || null; }, []);
    const puedeIrse = () => {
        if (!salidaProtegida.current) return true;
        // eslint-disable-next-line no-alert
        const si = window.confirm(salidaProtegida.current);
        if (si) salidaProtegida.current = null;
        return si;
    };

    const vistaActual = useRef(vista);
    useEffect(() => { vistaActual.current = vista; }, [vista]);

    useEffect(() => {
        window.history.replaceState({ panel: true, vista, profundidad: 0 }, '', direccionDe(vista));
        const alVolver = (e) => {
            if (!puedeIrse()) {
                // Se queda: se deshace el paso atrás del navegador.
                window.history.pushState({ panel: true, vista: vistaActual.current, profundidad: (e.state?.profundidad ?? 0) + 1 }, '', direccionDe(vistaActual.current));
                return;
            }
            setVista(e.state?.vista || leerDeLaDireccion());
            window.scrollTo({ top: 0 });
        };
        window.addEventListener('popstate', alVolver);
        return () => window.removeEventListener('popstate', alVolver);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const ir = useCallback((seccion, params = {}) => {
        if (!puedeIrse()) return;
        const nueva = { seccion, params: params || {} };
        const profundidad = (window.history.state?.profundidad ?? 0) + 1;
        window.history.pushState({ panel: true, vista: nueva, profundidad }, '', direccionDe(nueva));
        setVista(nueva);
        window.scrollTo({ top: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const volver = useCallback(() => {
        // Si hay pantalla anterior dentro del panel, es el mismo «Atrás» del
        // navegador; si se entró directo aquí, a «Hoy».
        if ((window.history.state?.profundidad ?? 0) > 0) {
            window.history.back();
            return;
        }
        if (!puedeIrse()) return;
        const inicio = { seccion: 'inicio', params: {} };
        window.history.replaceState({ panel: true, vista: inicio, profundidad: 0 }, '', direccionDe(inicio));
        setVista(inicio);
        window.scrollTo({ top: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const s = buscarSeccion(vista.seccion);
        document.title = `${s.etiqueta} · Apartamentos Tío José María`;
    }, [vista.seccion]);

    // Con la primera pantalla ya pintada, se bajan las demás en segundo plano:
    // abrir una sección por primera vez ya no espera a descargarla (23-sep).
    useEffect(() => {
        const precargar = () => {
            import('./CalendarioPanel'); import('./ReservasPanel'); import('./ReservaFicha');
            import('./NuevaReservaPanel'); import('./ClientesPanel'); import('./DineroPanel');
            import('./PreciosPanel'); import('./LimpiezasPanel'); import('./ParteViajerosPanel');
            import('./CheckinPanel');
        };
        const id = 'requestIdleCallback' in window
            ? window.requestIdleCallback(precargar, { timeout: 4000 })
            : window.setTimeout(precargar, 2500);
        return () => ('cancelIdleCallback' in window ? window.cancelIdleCallback(id) : window.clearTimeout(id));
    }, []);

    const salir = async () => {
        setSaliendo(true);
        await supabase.auth.signOut();
        window.location.assign('/panel');
    };

    const actual = buscarSeccion(vista.seccion);
    const props = { ir, volver, perfil, params: vista.params || {}, protegerSalida };
    const nombre = (perfil?.full_name || perfil?.email || '').split(' ')[0];
    // Cambiar de vista: solo quien tiene el panel completo. La madre (staff) no lo ve.
    const esAdmin = perfil?.role === 'admin';

    return (
        <div className="min-h-screen bg-rural-50 md:flex">
            {/* ---------- Menú de la izquierda (ordenador) ---------- */}
            <aside className="hidden md:flex md:flex-col md:w-72 lg:w-80 shrink-0 bg-white border-r border-gray-200 h-screen sticky top-0">
                <div className="p-6 border-b border-gray-100">
                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-gray-500">Apartamentos</p>
                    <p className="font-serif text-xl font-bold text-text-primary leading-tight mt-0.5">Tío José María</p>
                </div>

                <nav className="flex-1 overflow-y-auto p-3" aria-label="Secciones">
                    <ul className="space-y-1">
                        {SECCIONES.map((s) => (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    onClick={() => ir(s.id)}
                                    aria-current={vista.seccion === s.id ? 'page' : undefined}
                                    className={`w-full flex items-center gap-3 px-4 min-h-[52px] rounded-2xl text-left text-base transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30 ${
                                        vista.seccion === s.id
                                            ? 'bg-rural-600 text-white font-bold'
                                            : 'text-text-primary hover:bg-rural-50 font-semibold'
                                    }`}
                                >
                                    <s.icono size={22} aria-hidden="true" className={vista.seccion === s.id ? 'text-white' : 'text-rural-600'} />
                                    <span>{s.etiqueta}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="p-3 border-t border-gray-100">
                    <p className="px-4 pb-2 text-sm text-gray-600 truncate">
                        {perfil?.full_name || perfil?.email}
                    </p>
                    {esAdmin && (
                        <a href="/admin"
                            className="w-full flex items-center gap-3 px-4 min-h-[52px] rounded-2xl text-base font-bold text-rural-700 hover:bg-rural-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30">
                            <LayoutGrid size={20} aria-hidden="true" /> Vista completa
                        </a>
                    )}
                    <button type="button" onClick={salir} disabled={saliendo}
                        className="w-full flex items-center gap-3 px-4 min-h-[52px] rounded-2xl text-base font-bold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-600/20">
                        <LogOut size={20} aria-hidden="true" /> Salir
                    </button>
                </div>
            </aside>

            {/* ---------- Contenido ---------- */}
            <div className="flex-1 min-w-0 flex flex-col">
                {/* Cabecera (móvil y ordenador) */}
                <header className="bg-white border-b border-gray-200 px-4 py-3 md:px-8 md:py-4 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        {vista.seccion !== 'inicio' && (
                            <button type="button" onClick={volver}
                                className="md:hidden -ml-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-rural-700 hover:bg-rural-50"
                                aria-label="Volver">
                                <ChevronLeft size={26} aria-hidden="true" />
                            </button>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="md:hidden text-xs uppercase tracking-[0.18em] font-bold text-gray-500 truncate">
                                Apartamentos Tío José María
                            </p>
                            <h1 className="text-lg md:text-2xl font-bold text-text-primary leading-tight truncate">
                                {actual.etiqueta}
                            </h1>
                        </div>
                        {nombre && (
                            <p className="hidden sm:block text-sm text-gray-600 shrink-0">
                                Hola, <span className="font-bold text-text-primary">{nombre}</span>
                            </p>
                        )}
                        {/* En el móvil, «Salir» y «Vista completa» viven en «Más»:
                            arriba a la derecha caían bajo el pulgar y un toque sin
                            querer obligaba a pedir el código otra vez (23-sep). */}
                    </div>
                </header>

                <main className="flex-1 px-4 py-5 md:px-8 md:py-8 pb-28 md:pb-10 max-w-4xl xl:max-w-6xl 2xl:max-w-7xl w-full">
                    <Suspense fallback={<Cargando texto="Abriendo…" />}>
                        {vista.seccion === 'inicio' && <PanelHome {...props} secciones={SECCIONES} />}
                        {vista.seccion === 'calendario' && <CalendarioPanel {...props} />}
                        {vista.seccion === 'nueva-reserva' && <NuevaReservaPanel {...props} />}
                        {vista.seccion === 'reservas' && <ReservasPanel {...props} />}
                        {vista.seccion === 'reserva' && <ReservaFicha {...props} />}
                        {vista.seccion === 'clientes' && <ClientesPanel {...props} />}
                        {vista.seccion === 'dinero' && <DineroPanel {...props} />}
                        {vista.seccion === 'precios' && <PreciosPanel {...props} />}
                        {vista.seccion === 'limpiezas' && <LimpiezasPanel {...props} />}
                        {vista.seccion === 'parte' && <ParteViajerosPanel {...props} />}
                        {vista.seccion === 'checkin' && <CheckinPanel {...props} />}
                    </Suspense>
                </main>
            </div>

            {/* ---------- Barra de abajo (solo móvil) ---------- */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]"
                aria-label="Lo de cada día">
                <ul className="flex items-end">
                    {EN_LA_BARRA.map((id) => {
                        const s = buscarSeccion(id);
                        const activa = vista.seccion === s.id;
                        // «Apuntar» en el centro y destacado: es lo que hace
                        // cuando suena el teléfono, y no estaba en la barra.
                        if (id === 'nueva-reserva') {
                            return (
                                <li key={s.id} className="flex-1 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => ir(s.id)}
                                        aria-current={activa ? 'page' : undefined}
                                        className="-mt-5 mb-1 flex flex-col items-center gap-1 focus:outline-none"
                                    >
                                        <span className="w-14 h-14 rounded-full bg-rural-600 text-white shadow-lg flex items-center justify-center ring-4 ring-white">
                                            <s.icono size={28} aria-hidden="true" />
                                        </span>
                                        <span className="text-xs leading-none font-bold text-rural-700">Apuntar</span>
                                    </button>
                                </li>
                            );
                        }
                        return (
                            <li key={s.id} className="flex-1">
                                <button
                                    type="button"
                                    onClick={() => ir(s.id)}
                                    aria-current={activa ? 'page' : undefined}
                                    className={`w-full min-h-[64px] flex flex-col items-center justify-center gap-1 px-1 py-2 ${
                                        activa ? 'text-rural-700' : 'text-gray-500'
                                    }`}
                                >
                                    <s.icono size={24} aria-hidden="true" />
                                    <span className={`text-xs leading-none ${activa ? 'font-bold' : 'font-semibold'}`}>
                                        {s.etiqueta}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                    <li className="flex-1">
                        <button
                            type="button"
                            onClick={() => setMenuMas(true)}
                            aria-expanded={menuMas}
                            className={`w-full min-h-[64px] flex flex-col items-center justify-center gap-1 px-1 py-2 ${
                                !EN_LA_BARRA.includes(vista.seccion) && vista.seccion !== 'inicio' ? 'text-rural-700' : 'text-gray-500'
                            }`}
                        >
                            <Menu size={24} aria-hidden="true" />
                            <span className="text-xs leading-none font-semibold">Más</span>
                        </button>
                    </li>
                </ul>
            </nav>

            {/* ---------- «Más»: el resto de secciones, y salir ---------- */}
            <Hoja abierta={menuMas} titulo="Todo lo demás" onCerrar={() => setMenuMas(false)}>
                <ul className="grid grid-cols-2 gap-3">
                    {SECCIONES.filter((s) => !EN_LA_BARRA.includes(s.id)).map((s) => (
                        <li key={s.id}>
                            <button
                                type="button"
                                onClick={() => { setMenuMas(false); ir(s.id); }}
                                className="w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-4 min-h-[104px] text-left flex flex-col gap-2 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                            >
                                <span className="w-10 h-10 rounded-2xl bg-rural-50 text-rural-700 flex items-center justify-center">
                                    <s.icono size={22} aria-hidden="true" />
                                </span>
                                <span className="font-bold text-base text-text-primary leading-tight">{s.etiqueta}</span>
                                <span className="text-sm text-gray-600 leading-snug">{s.resumen}</span>
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
                    {esAdmin && (
                        <a href="/admin"
                            className="w-full flex items-center gap-3 px-4 min-h-[52px] rounded-2xl text-base font-bold text-rural-700 hover:bg-rural-50">
                            <LayoutGrid size={20} aria-hidden="true" /> Vista completa
                        </a>
                    )}
                    <button type="button" onClick={salir} disabled={saliendo}
                        className="w-full flex items-center gap-3 px-4 min-h-[52px] rounded-2xl text-base font-bold text-red-700 hover:bg-red-50">
                        <LogOut size={20} aria-hidden="true" /> Salir del panel
                    </button>
                </div>
            </Hoja>
        </div>
    );
};

export default PanelApp;

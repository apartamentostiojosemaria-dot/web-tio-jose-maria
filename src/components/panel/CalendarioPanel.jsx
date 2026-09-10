import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, ChevronRight, CalendarDays, Rows3, LayoutGrid } from 'lucide-react';
import {
    Boton, Aviso, Cargando,
    aFecha, aISO, hoyISO, canalSiImporta,
} from './ui';

// ============================================================
// CalendarioPanel — Calendario (sección 4.2 del plan)
// ============================================================
// Quien lo usa: la madre de Jesús, en el móvil y en el ordenador.
// Lo que viene a mirar es una sola cosa: "¿qué tengo libre y quién está
// dentro?". Todo lo demás sobra.
//
// Dos vistas, la misma información:
//   · SEMANA (siempre, y única en el móvil): una tarjeta por día y dentro
//     los cuatro apartamentos como botones grandes. En vertical, así que a
//     375 px no hay nada que arrastrar de lado. Se cambia de semana con las
//     flechas o deslizando el dedo, y "Ir a hoy" vuelve al sitio.
//   · MES (solo cuando la pantalla da de sí de verdad): la rejilla del mes
//     de toda la vida, 7 columnas, y en cada día los cuatro apartamentos
//     con su color. Es para VER de un vistazo; al tocar un día se abre esa
//     semana, que es donde se HACEN las cosas. Así nada de lo que se pulsa
//     baja de 44 px y no hace falta apuntar a una barra de tres píxeles.
//     Se decide midiendo el ancho REAL del contenedor (no el de la
//     ventana): con el menú de la izquierda ocupando 288 px, mirar el
//     ancho de la ventana engañaría y saldría un mes ilegible.
//
// Colores con significado y leyenda en palabras, siempre a la vista:
//   verde = libre · azul = ocupado · gris = no alquilable.
// De dónde viene una reserva NUNCA es un color: si vino de fuera, el
// propio recuadro lo dice debajo en letra pequeña ("por Booking").
//
// Los días que llegan de otras webs (`blocked_dates` con source distinto
// de 'manual'/'cierre') se enseñan como "Ocupado por otra web" y no se
// pueden tocar desde aquí: los pone la otra web y los quitaría ella sola.
// Los días cerrados a mano tampoco se quitan aquí; eso vive en Precios
// ("No alquilar estos días").
//
// Datos: DOS consultas por rango (reservas y días ocupados) y una sola de
// apartamentos al entrar. Nunca una consulta por día. El rango que se pide
// es el mes entero del día en el que estás, con una semana de margen a cada
// lado, así que moverte de semana dentro del mes no vuelve a pedir nada.
//
// Props del armazón (PanelApp): ir, volver, perfil, params.
// Salidas: ir('nueva-reserva', { fecha, apartamentoId }) · ir('reserva', { reservaId })
// ============================================================

// Estados vivos de una reserva. 'cancelled' no ocupa nada.
const ESTADOS_VIVOS = ['hold', 'pending', 'confirmed', 'completed'];

// Bloqueos puestos por nosotros (los de fuera son todo lo demás).
const BLOQUEOS_PROPIOS = ['manual', 'cierre'];

// A partir de este ancho de contenedor la rejilla del mes se lee bien
// (7 columnas de ~95 px o más). Por debajo, semana y punto.
const ANCHO_MINIMO_MES = 700;

// ---------- Fechas (locales de esta pantalla; ui.jsx no se toca) ----------

/**
 * Sumar días de calendario, NO 24 horas.
 * Sumando milisegundos, el domingo que se cambia la hora (25-oct-2026 en
 * España tiene 25 horas) el resultado se queda en el mismo día y la semana
 * repite fecha. Se vio en pantalla: React avisando de dos días 2026-10-25.
 * Construyendo la fecha por año/mes/día no puede pasar.
 */
const sumarDias = (iso, n) => {
    const f = aFecha(iso);
    if (!f) return '';
    return aISO(new Date(f.getFullYear(), f.getMonth(), f.getDate() + n));
};

/** Lunes de la semana de `iso`. */
const lunesDe = (iso) => {
    const f = aFecha(iso);
    return sumarDias(iso, -((f.getDay() + 6) % 7));
};

const primeroDeMes = (iso) => `${String(iso).slice(0, 7)}-01`;

const ultimoDeMes = (iso) => {
    const f = aFecha(iso);
    return aISO(new Date(f.getFullYear(), f.getMonth() + 1, 0));
};

/** Lista de días 'AAAA-MM-DD' de `desde` a `hasta`, los dos incluidos. */
const diasEntre = (desde, hasta) => {
    const out = [];
    let d = desde;
    let tope = 0;
    while (d <= hasta && tope++ < 500) { out.push(d); d = sumarDias(d, 1); }
    return out;
};

const NOMBRE_MES = (iso) =>
    new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(aFecha(iso));

const DIA_Y_NUMERO = (iso) =>
    new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric' }).format(aFecha(iso));

const SOLO_MES = (iso) =>
    new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(aFecha(iso));

/** 'Del 7 al 13 de septiembre' · 'Del 28 de septiembre al 4 de octubre' */
const tituloSemana = (lunes) => {
    const domingo = sumarDias(lunes, 6);
    const d1 = aFecha(lunes).getDate();
    const d2 = aFecha(domingo).getDate();
    if (lunes.slice(0, 7) === domingo.slice(0, 7)) {
        return `Del ${d1} al ${d2} de ${SOLO_MES(lunes)}`;
    }
    return `Del ${d1} de ${SOLO_MES(lunes)} al ${d2} de ${SOLO_MES(domingo)}`;
};

const mayus = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

// ---------- Cómo se pinta cada estado ----------

const PINTA = {
    // Ojo con la paleta: rural-300 y rural-400 son beige y marrón, no verde.
    // El verde de verdad empieza en rural-500.
    libre: {
        caja: 'bg-white border-rural-500 hover:bg-rural-50',
        titulo: 'text-rural-700',
        pie: 'text-rural-700',
        punto: 'bg-white border-2 border-rural-600',
        palabra: 'Libre',
    },
    ocupado: {
        caja: 'bg-blue-50 border-blue-300',
        titulo: 'text-blue-900',
        pie: 'text-blue-800',
        punto: 'bg-blue-400 border-2 border-blue-500',
        palabra: 'Ocupado',
    },
    cerrado: {
        caja: 'bg-gray-100 border-gray-300',
        titulo: 'text-gray-700',
        pie: 'text-gray-600',
        punto: 'bg-gray-300 border-2 border-gray-400',
        palabra: 'No alquilable',
    },
};

// ============================================================

const CalendarioPanel = ({ ir, params = {} }) => {
    const hoy = useMemo(hoyISO, []);
    const [ancla, setAncla] = useState(() => (params.fecha ? String(params.fecha).slice(0, 10) : hoy));
    const [modo, setModo] = useState(null);          // 'semana' | 'mes' (null = aún midiendo)
    const [eligioElla, setEligioElla] = useState(false);
    const [apartamentos, setApartamentos] = useState([]);
    const [reservas, setReservas] = useState([]);
    const [bloqueos, setBloqueos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [fallo, setFallo] = useState(null);

    const cajaRef = useRef(null);
    const [ancho, setAncho] = useState(0);

    // ---------- Cuánto sitio hay de verdad (el del contenedor, no el de la ventana) ----------
    useEffect(() => {
        const caja = cajaRef.current;
        if (!caja) return undefined;
        const medir = () => setAncho(caja.getBoundingClientRect().width);
        medir();
        // Cinturón y tirantes: el observador y, además, el 'resize' de la
        // ventana. Girar el móvil o cambiar el tamaño de la ventana tiene que
        // recolocar la vista sí o sí; hay entornos donde el observador no
        // salta con un cambio de tamaño y nos quedaríamos con el mes apretado.
        const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
        if (obs) obs.observe(caja);
        window.addEventListener('resize', medir);
        window.addEventListener('orientationchange', medir);
        return () => {
            if (obs) obs.disconnect();
            window.removeEventListener('resize', medir);
            window.removeEventListener('orientationchange', medir);
        };
    }, []);

    const cabeMes = ancho >= ANCHO_MINIMO_MES;

    // Mientras ella no toque el interruptor Semana/Mes, la vista la decide el
    // sitio que hay: pantalla grande → mes, móvil → semana, y si la ventana se
    // estrecha el mes se cierra solo (nunca hay rejilla apretada ni nada que
    // arrastrar de lado). En cuanto ELLA elige, manda su elección y no se le
    // vuelve a cambiar por debajo.
    useEffect(() => {
        if (ancho === 0 || eligioElla) return;
        setModo(cabeMes ? 'mes' : 'semana');
    }, [ancho, cabeMes, eligioElla]);

    const elegirModo = (m) => { setEligioElla(true); setModo(m); };

    // ---------- Apartamentos (una vez) ----------
    useEffect(() => {
        let cortado = false;
        (async () => {
            const { data } = await supabase
                .from('apartments')
                .select('id, name, capacity_people')
                .eq('is_active', true)
                .order('id');
            if (!cortado) setApartamentos(data || []);
        })();
        return () => { cortado = true; };
    }, []);

    // ---------- Reservas y días ocupados del mes que estás mirando ----------
    const desde = useMemo(() => sumarDias(primeroDeMes(ancla), -7), [ancla]);
    const hasta = useMemo(() => sumarDias(ultimoDeMes(ancla), 7), [ancla]);

    useEffect(() => {
        let cortado = false;
        setCargando(true);
        (async () => {
            const [res, blo] = await Promise.all([
                supabase.from('guest_bookings')
                    .select('id, guest_name, apartment_id, check_in, check_out, status, channel, source, pax_count, expires_at')
                    .in('status', ESTADOS_VIVOS)
                    .lte('check_in', hasta)
                    .gte('check_out', desde),
                supabase.from('blocked_dates')
                    .select('id, apartment_id, start_date, end_date, source, reason')
                    .lte('start_date', hasta)
                    .gte('end_date', desde),
            ]);
            if (cortado) return;
            setFallo(res.error || blo.error ? 'No hemos podido traer el calendario.' : null);
            setReservas(res.data || []);
            setBloqueos(blo.data || []);
            setCargando(false);
        })();
        return () => { cortado = true; };
    }, [desde, hasta]);

    // ---------- Qué hay en cada apartamento cada día ----------
    // Un solo recorrido: clave `id|AAAA-MM-DD`. Manda la reserva sobre el
    // bloqueo, porque si hay las dos cosas lo que ella necesita ver es quién
    // está dentro.
    const ocupacion = useMemo(() => {
        const mapa = new Map();
        const ahora = Date.now();

        // 1) Días que vienen de otras webs o cerrados a mano.
        //    `end_date` es INCLUSIVA en esta tabla (así la lee la base).
        bloqueos.forEach((b) => {
            if (!b.apartment_id) return;
            const propio = BLOQUEOS_PROPIOS.includes(String(b.source || 'manual').toLowerCase());
            const ini = b.start_date > desde ? b.start_date : desde;
            const fin = b.end_date < hasta ? b.end_date : hasta;
            diasEntre(ini, fin).forEach((dia) => {
                mapa.set(`${b.apartment_id}|${dia}`, propio
                    ? { estado: 'cerrado', titulo: 'No alquilable', pie: b.reason || '' }
                    : { estado: 'ocupado', titulo: 'Ocupado', pie: 'por otra web', deFuera: true });
            });
        });

        // 2) Reservas. `check_out` es el día que se va: esa noche ya está libre.
        reservas.forEach((r) => {
            if (!r.apartment_id) return;
            // Una reserva a medio hacer por la web caduca sola; si ya caducó, no ocupa.
            if (r.status === 'hold' && r.expires_at && new Date(r.expires_at).getTime() < ahora) return;
            const ini = r.check_in > desde ? r.check_in : desde;
            const finReal = sumarDias(r.check_out, -1);
            const fin = finReal < hasta ? finReal : hasta;
            if (fin < ini) return;
            const deFuera = canalSiImporta(r);
            diasEntre(ini, fin).forEach((dia) => {
                mapa.set(`${r.apartment_id}|${dia}`, {
                    estado: 'ocupado',
                    titulo: r.status === 'hold' ? 'Reservando ahora' : (r.guest_name || 'Sin nombre'),
                    pie: deFuera ? `por ${deFuera}` : '',
                    reservaId: r.id,
                    entra: r.check_in === dia,
                    sale: sumarDias(dia, 1) === r.check_out,
                });
            });
        });

        return mapa;
    }, [reservas, bloqueos, desde, hasta]);

    const queHay = useCallback(
        (apartamentoId, dia) => ocupacion.get(`${apartamentoId}|${dia}`) || { estado: 'libre', titulo: 'Libre', pie: '' },
        [ocupacion],
    );

    // ---------- Moverse ----------
    const lunes = useMemo(() => lunesDe(ancla), [ancla]);
    const moverSemana = (n) => setAncla(sumarDias(lunes, n * 7));
    const moverMes = (n) => {
        const f = aFecha(primeroDeMes(ancla));
        setAncla(aISO(new Date(f.getFullYear(), f.getMonth() + n, 1)));
    };
    const irAHoy = () => setAncla(hoy);

    const enMes = modo === 'mes';
    const estaEnHoy = enMes ? ancla.slice(0, 7) === hoy.slice(0, 7) : lunes === lunesDe(hoy);

    // ---------- Deslizar el dedo (móvil) ----------
    const toque = useRef(null);
    const alEmpezarToque = (e) => {
        const t = e.touches?.[0];
        toque.current = t ? { x: t.clientX, y: t.clientY } : null;
    };
    const alSoltarToque = (e) => {
        const ini = toque.current;
        const t = e.changedTouches?.[0];
        toque.current = null;
        if (!ini || !t) return;
        const dx = t.clientX - ini.x;
        const dy = t.clientY - ini.y;
        if (Math.abs(dx) < 60 || Math.abs(dy) > 45) return;
        (enMes ? moverMes : moverSemana)(dx < 0 ? 1 : -1);
    };

    return (
        <div ref={cajaRef} className="w-full max-w-full overflow-x-hidden space-y-4">

            {/* ---------- Dónde estoy y cómo me muevo ---------- */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => (enMes ? moverMes(-1) : moverSemana(-1))}
                    aria-label={enMes ? 'Mes anterior' : 'Semana anterior'}
                    className="shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl border-2 border-gray-200 bg-white text-rural-700 hover:bg-rural-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                >
                    <ChevronLeft size={24} aria-hidden="true" />
                </button>

                <p className="flex-1 min-w-0 text-center font-bold text-base sm:text-lg text-text-primary leading-tight" aria-live="polite">
                    {enMes ? mayus(NOMBRE_MES(ancla)) : tituloSemana(lunes)}
                </p>

                <button
                    type="button"
                    onClick={() => (enMes ? moverMes(1) : moverSemana(1))}
                    aria-label={enMes ? 'Mes siguiente' : 'Semana siguiente'}
                    className="shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl border-2 border-gray-200 bg-white text-rural-700 hover:bg-rural-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                >
                    <ChevronRight size={24} aria-hidden="true" />
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Boton variante={estaEnHoy ? 'suave' : 'secundario'} icono={CalendarDays} onClick={irAHoy}>
                    Ir a hoy
                </Boton>

                {cabeMes && (
                    <div className="ml-auto inline-flex rounded-2xl border-2 border-gray-200 bg-white p-1" role="group" aria-label="Cómo lo quieres ver">
                        <BotonVista activo={modo === 'semana'} icono={Rows3} onClick={() => elegirModo('semana')}>Semana</BotonVista>
                        <BotonVista activo={enMes} icono={LayoutGrid} onClick={() => elegirModo('mes')}>Mes</BotonVista>
                    </div>
                )}
            </div>

            {/* ---------- Leyenda, en palabras ---------- */}
            <Leyenda />

            {fallo && <Aviso tono="urgente" titulo={fallo} texto="Vuelve a entrar en un momento. Si sigue igual, avisa a Jesús." />}

            {/* ---------- El calendario ---------- */}
            {cargando || modo === null ? (
                <Cargando texto="Mirando el calendario…" />
            ) : apartamentos.length === 0 ? (
                <Aviso tono="atencion" titulo="Todavía no hay apartamentos dados de alta." />
            ) : (
                <div onTouchStart={alEmpezarToque} onTouchEnd={alSoltarToque}>
                    {enMes ? (
                        <VistaMes
                            ancla={ancla}
                            hoy={hoy}
                            apartamentos={apartamentos}
                            queHay={queHay}
                            alElegirDia={(dia) => { setAncla(dia); elegirModo('semana'); }}
                        />
                    ) : (
                        <VistaSemana
                            lunes={lunes}
                            hoy={hoy}
                            apartamentos={apartamentos}
                            queHay={queHay}
                            ir={ir}
                        />
                    )}
                </div>
            )}

            <p className="text-sm text-gray-600 leading-relaxed pt-1">
                {enMes
                    ? 'Toca un día para verlo de cerca y apuntar una reserva.'
                    : 'Toca un apartamento libre para apuntar una reserva ahí. Toca a un huésped para ver su reserva.'}
            </p>
        </div>
    );
};

// ============================================================
// Piezas
// ============================================================

const BotonVista = ({ activo, icono: Icono, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={activo}
        className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl text-base font-bold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30 ${
            activo ? 'bg-rural-600 text-white' : 'text-rural-700 hover:bg-rural-50'
        }`}
    >
        <Icono size={18} aria-hidden="true" />
        {children}
    </button>
);

const Leyenda = () => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white border border-gray-200 px-4 py-3">
        {['libre', 'ocupado', 'cerrado'].map((e) => (
            <span key={e} className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                <span className={`w-4 h-4 rounded-md ${PINTA[e].punto}`} aria-hidden="true" />
                {PINTA[e].palabra}
            </span>
        ))}
        <span className="text-sm text-gray-600">Lo que llega de otras webs sale como ocupado, y ahí no se toca.</span>
    </div>
);

// ---------- Semana: una tarjeta por día, en vertical ----------

const VistaSemana = ({ lunes, hoy, apartamentos, queHay, ir }) => (
    <ul className="space-y-3">
        {diasEntre(lunes, sumarDias(lunes, 6)).map((dia) => {
            const esHoy = dia === hoy;
            const pasado = dia < hoy;
            return (
                <li
                    key={dia}
                    className={`rounded-3xl border bg-white shadow-sm overflow-hidden ${
                        esHoy ? 'border-rural-600 border-2' : 'border-gray-200'
                    } ${pasado ? 'opacity-70' : ''}`}
                >
                    <div className={`flex items-center gap-2 px-4 py-2.5 ${esHoy ? 'bg-rural-600' : 'bg-gray-50'}`}>
                        <p className={`font-bold text-base ${esHoy ? 'text-white' : 'text-text-primary'}`}>
                            {mayus(DIA_Y_NUMERO(dia))}
                        </p>
                        {esHoy && (
                            <span className="ml-auto text-xs font-bold uppercase tracking-widest text-white/90">Hoy</span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
                        {apartamentos.map((a) => (
                            <Hueco key={a.id} apartamento={a} dia={dia} info={queHay(a.id, dia)} ir={ir} />
                        ))}
                    </div>
                </li>
            );
        })}
    </ul>
);

/** Un apartamento en un día concreto. Solo es botón si se puede hacer algo. */
const Hueco = ({ apartamento, dia, info, ir }) => {
    const p = PINTA[info.estado] || PINTA.libre;
    const base = `rounded-2xl border-2 px-3 py-2.5 min-h-[64px] w-full text-left flex flex-col justify-center ${p.caja}`;

    const cuerpo = (
        <>
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 truncate">
                {apartamento.name}
            </span>
            {/* El nombre del huésped NO se recorta: a 375 px cabe en dos
                líneas y "Carmen Prueba…" no le dice nada a nadie. */}
            <span className={`block text-base font-bold leading-tight break-words ${p.titulo}`}>
                {info.titulo}
            </span>
            {info.pie && (
                <span className={`block text-xs leading-tight truncate ${p.pie}`}>{info.pie}</span>
            )}
        </>
    );

    if (info.estado === 'libre') {
        return (
            <button
                type="button"
                onClick={() => ir('nueva-reserva', { fecha: dia, apartamentoId: apartamento.id })}
                aria-label={`${apartamento.name} libre el ${DIA_Y_NUMERO(dia)}. Apuntar una reserva.`}
                className={`${base} transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30 active:scale-[0.99]`}
            >
                {cuerpo}
            </button>
        );
    }

    if (info.reservaId) {
        return (
            <button
                type="button"
                onClick={() => ir('reserva', { reservaId: info.reservaId })}
                aria-label={`${apartamento.name} ocupado el ${DIA_Y_NUMERO(dia)} por ${info.titulo}. Ver la reserva.`}
                className={`${base} transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30 active:scale-[0.99]`}
            >
                {cuerpo}
            </button>
        );
    }

    // Ocupado por otra web o cerrado a mano: se ve, no se toca.
    return (
        <div className={base} aria-label={`${apartamento.name}: ${info.titulo} ${info.pie}`}>
            {cuerpo}
        </div>
    );
};

// ---------- Mes: la rejilla de toda la vida, solo para ver ----------

const CABECERA_MES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const VistaMes = ({ ancla, hoy, apartamentos, queHay, alElegirDia }) => {
    const primero = primeroDeMes(ancla);
    const dias = diasEntre(lunesDe(primero), sumarDias(lunesDe(ultimoDeMes(ancla)), 6));
    const mesActual = primero.slice(0, 7);

    return (
        <div className="w-full">
            <div className="grid grid-cols-7 gap-1 mb-1">
                {CABECERA_MES.map((d) => (
                    <p key={d} className="text-center text-xs font-bold uppercase tracking-wide text-gray-500 py-1">{d}</p>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {dias.map((dia) => {
                    const deOtroMes = dia.slice(0, 7) !== mesActual;
                    const esHoy = dia === hoy;
                    const celdas = apartamentos.map((a) => ({ a, info: queHay(a.id, dia) }));
                    const libres = celdas.filter((c) => c.info.estado === 'libre').length;
                    const resumen = libres === 0
                        ? 'todo ocupado'
                        : libres === celdas.length ? 'todo libre' : `${libres} libre${libres === 1 ? '' : 's'}`;

                    return (
                        <button
                            key={dia}
                            type="button"
                            onClick={() => alElegirDia(dia)}
                            aria-label={`${DIA_Y_NUMERO(dia)}: ${resumen}. Ver esta semana.`}
                            title={celdas.map((c) => `${c.a.name}: ${c.info.titulo}${c.info.pie ? ` (${c.info.pie})` : ''}`).join(' · ')}
                            className={`rounded-xl border p-1.5 min-h-[104px] text-left flex flex-col gap-1 bg-white transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30 ${
                                esHoy ? 'border-rural-600 border-2' : 'border-gray-200'
                            } ${deOtroMes ? 'opacity-45' : ''}`}
                        >
                            <span className={`text-sm font-bold leading-none ${esHoy ? 'text-rural-700' : 'text-text-primary'}`}>
                                {aFecha(dia).getDate()}
                                {esHoy && <span className="ml-1 text-[10px] font-bold uppercase text-rural-700">hoy</span>}
                            </span>

                            <span className="flex flex-col gap-0.5">
                                {celdas.map(({ a, info }) => {
                                    const p = PINTA[info.estado] || PINTA.libre;
                                    return (
                                        // El nombre del apartamento va ENTERO (Albahaca, no "Alb"):
                                        // en una rejilla de mes las abreviaturas se leen a medias y
                                        // esta pantalla es justo la que se mira de un vistazo.
                                        <span key={a.id} className={`flex items-center gap-1 rounded-md border px-1 py-[3px] ${p.caja.replace(/hover:[^\s]+/g, '')}`}>
                                            <span className="text-[10px] font-bold text-gray-600 shrink-0">{a.name}</span>
                                            <span className={`text-[10px] leading-none truncate ${p.titulo}`}>
                                                {info.estado === 'libre' ? 'libre' : info.titulo}
                                            </span>
                                        </span>
                                    );
                                })}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarioPanel;

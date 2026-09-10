import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, PlusCircle, ChevronRight, BookMarked, X } from 'lucide-react';
import {
    Boton, Aviso, Cargando, Vacio, Campo, claseInput,
    aFecha, hoyISO, formatoEuro, cobradoDe, pendienteDe, canalSiImporta,
} from './ui';

// ============================================================
// ReservasPanel — Reservas (la lista)
// ============================================================
// Quien lo usa: la madre de Jesús. Viene aquí a buscar a alguien y a ver
// cómo está esa reserva. Nada más.
//
// Tres grupos y en este orden, que es el orden en que le importan:
//   AHORA MISMO (los que están dentro) · PRÓXIMAS · PASADAS.
// Las canceladas no se borran de la vista, pero se quedan detrás de un
// interruptor: no estorban y siguen estando si las busca.
//
// Cada línea dice lo que ella miraría: quién, qué apartamento, qué días en
// palabras ("del 25 al 27 de septiembre") y el dinero en corto ("Pendiente
// 135 €" en ámbar, "Cobrado" en verde). Si vino de otra web, un apunte
// pequeño debajo ("por Booking"): cambia quién cobra, así que importa.
//
// Buscar: por nombre o por teléfono, sin acentos y sin importar espacios ni
// prefijos. Ni un filtro más: nada de estados, canales ni fechas.
//
// Lo que NO sale aquí: las reservas a medio hacer por la web (status
// 'hold'). Son un apaño de quince minutos del motor de pago; aparecer en su
// lista solo la confundiría. Si cuajan, entran como confirmadas.
//
// Props del armazón (PanelApp): ir, volver, perfil, params.
// Salidas: ir('reserva', { reservaId }) · ir('nueva-reserva')
// ============================================================

const CUANTAS_TRAEMOS = 400;   // sobra de largo: aquí se hacen decenas al año

// ---------- Fechas en palabras (locales de esta pantalla) ----------

const MES = (iso) => new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(aFecha(iso));

/** 'del 25 al 27 de septiembre' · 'del 28 de septiembre al 2 de octubre' */
const fechasEnPalabras = (entra, sale, hoy) => {
    const f1 = aFecha(entra);
    const f2 = aFecha(sale);
    if (!f1 || !f2) return '';
    const ano = sale.slice(0, 4) !== hoy.slice(0, 4) ? ` de ${sale.slice(0, 4)}` : '';
    if (entra.slice(0, 7) === sale.slice(0, 7)) {
        return `del ${f1.getDate()} al ${f2.getDate()} de ${MES(sale)}${ano}`;
    }
    return `del ${f1.getDate()} de ${MES(entra)} al ${f2.getDate()} de ${MES(sale)}${ano}`;
};

// ---------- Buscar ----------

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const soloNumeros = (t) => String(t || '').replace(/\D/g, '');

// ============================================================

const ReservasPanel = ({ ir }) => {
    const hoy = useMemo(hoyISO, []);
    const [cargando, setCargando] = useState(true);
    const [fallo, setFallo] = useState(null);
    const [reservas, setReservas] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [verCanceladas, setVerCanceladas] = useState(false);

    useEffect(() => {
        let cortado = false;
        (async () => {
            const [apart, res] = await Promise.all([
                supabase.from('apartments').select('id, name'),
                supabase.from('guest_bookings')
                    .select('id, guest_name, guest_phone, apartment_id, check_in, check_out, status, payment_status, total_price, paid_amount, pending_amount, channel, source, pax_count')
                    .neq('status', 'hold')
                    .order('check_in', { ascending: false })
                    .limit(CUANTAS_TRAEMOS),
            ]);
            if (cortado) return;

            const nombreApto = {};
            (apart.data || []).forEach((a) => { nombreApto[a.id] = a.name; });

            setFallo(res.error ? 'No hemos podido traer las reservas.' : null);
            setReservas((res.data || []).map((r) => ({
                ...r,
                apartamento: nombreApto[r.apartment_id] || 'Apartamento',
                _busca: `${sinAcentos(r.guest_name)} ${soloNumeros(r.guest_phone)}`,
            })));
            setCargando(false);
        })();
        return () => { cortado = true; };
    }, []);

    // ---------- Filtrar y repartir en grupos ----------
    const { ahora, proximas, pasadas, canceladas, hayAlgo } = useMemo(() => {
        const texto = sinAcentos(busqueda).trim();
        const numero = soloNumeros(busqueda);
        const encaja = (r) => {
            if (!texto && !numero) return true;
            if (texto && r._busca.includes(texto)) return true;
            if (numero.length >= 3 && soloNumeros(r.guest_phone).includes(numero)) return true;
            return false;
        };

        const g = { ahora: [], proximas: [], pasadas: [], canceladas: [] };
        reservas.filter(encaja).forEach((r) => {
            // Quien se va HOY sigue estando dentro hasta las 12:00, así que
            // cuenta como "ahora mismo": es lo mismo que dice la pantalla de
            // inicio ("Se van hoy"). A "Pasadas" solo se pasa al día siguiente.
            if (r.status === 'cancelled') g.canceladas.push(r);
            else if (r.check_out < hoy) g.pasadas.push(r);
            else if (r.check_in <= hoy) g.ahora.push(r);
            else g.proximas.push(r);
        });

        g.ahora.sort((a, b) => a.check_out.localeCompare(b.check_out));
        g.proximas.sort((a, b) => a.check_in.localeCompare(b.check_in));
        g.pasadas.sort((a, b) => b.check_out.localeCompare(a.check_out));
        g.canceladas.sort((a, b) => b.check_in.localeCompare(a.check_in));

        return { ...g, hayAlgo: g.ahora.length + g.proximas.length + g.pasadas.length + g.canceladas.length > 0 };
    }, [reservas, busqueda, hoy]);

    if (cargando) return <Cargando texto="Trayendo las reservas…" />;

    const buscando = busqueda.trim().length > 0;

    return (
        <div className="w-full max-w-full space-y-5">

            {/* ---------- Lo primero: apuntar una reserva ---------- */}
            <Boton ancho tamano="grande" icono={PlusCircle} onClick={() => ir('nueva-reserva')}>
                Apuntar una reserva
            </Boton>

            {fallo && <Aviso tono="urgente" titulo={fallo} texto="Vuelve a entrar en un momento. Si sigue igual, avisa a Jesús." />}

            {/* ---------- Buscar ---------- */}
            <Campo etiqueta="Buscar" ayuda="Escribe el nombre o el teléfono" htmlFor="buscar-reserva" className="mb-0">
                <div className="relative">
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input
                        id="buscar-reserva"
                        type="search"
                        inputMode="search"
                        autoComplete="off"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Carmen, 600 11 22 33…"
                        className={`${claseInput} pl-12 ${busqueda ? 'pr-14' : ''}`}
                    />
                    {busqueda && (
                        <button
                            type="button"
                            onClick={() => setBusqueda('')}
                            aria-label="Borrar lo escrito"
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </Campo>

            {/* ---------- Los grupos ---------- */}
            {!hayAlgo ? (
                <Vacio
                    icono={BookMarked}
                    mensaje={buscando
                        ? 'No hay ninguna reserva con eso. Prueba con menos letras.'
                        : 'Todavía no hay ninguna reserva apuntada.'}
                    accion={buscando
                        ? { texto: 'Ver todas', onClick: () => setBusqueda('') }
                        : { texto: 'Apuntar una reserva', icono: PlusCircle, onClick: () => ir('nueva-reserva') }}
                />
            ) : (
                <div className="space-y-6">
                    {/* Los tres grupos salen SIEMPRE en el mismo sitio (aunque estén
                        vacíos): la pantalla no cambia de forma y ella no tiene que
                        buscar dónde ha ido a parar nada. Solo al buscar se esconden
                        los que no traen resultados, para no llenar de huecos. */}
                    <Grupo titulo="Ahora mismo" pie="Están dentro" reservas={ahora} hoy={hoy} ir={ir}
                        vacio={buscando ? null : 'Ahora mismo no hay nadie dentro.'} />
                    <Grupo titulo="Próximas" pie="Todavía no han llegado" reservas={proximas} hoy={hoy} ir={ir}
                        vacio={buscando ? null : 'No hay ninguna reserva por venir.'} />
                    <Grupo titulo="Pasadas" pie="Ya se fueron" reservas={pasadas} hoy={hoy} ir={ir}
                        vacio={buscando ? null : 'Todavía no se ha ido nadie.'} />

                    {/* ---------- Canceladas: ahí están, pero fuera del camino ---------- */}
                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={() => setVerCanceladas((v) => !v)}
                            aria-expanded={verCanceladas}
                            className="w-full flex items-center gap-3 min-h-[52px] px-4 rounded-2xl border-2 border-gray-200 bg-white text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                        >
                            <span
                                aria-hidden="true"
                                className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition-colors ${verCanceladas ? 'bg-rural-600' : 'bg-gray-300'}`}
                            >
                                <span className={`block w-6 h-6 rounded-full bg-white transition-transform ${verCanceladas ? 'translate-x-5' : ''}`} />
                            </span>
                            <span className="flex-1 text-base font-bold text-text-primary">
                                Ver también las canceladas
                            </span>
                            {canceladas.length > 0 && (
                                <span className="shrink-0 text-sm font-semibold text-gray-500">{canceladas.length}</span>
                            )}
                        </button>

                        {verCanceladas && (
                            <div className="mt-4">
                                <Grupo
                                    titulo="Canceladas"
                                    pie="No cuentan para nada"
                                    reservas={canceladas}
                                    hoy={hoy}
                                    ir={ir}
                                    vacio="No hay ninguna cancelada."
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================

const Grupo = ({ titulo, pie, reservas, hoy, ir, vacio }) => {
    if (reservas.length === 0 && !vacio) return null;
    const id = `grupo-${sinAcentos(titulo).replace(/\s+/g, '-')}`;
    return (
        <section aria-labelledby={id}>
            <div className="flex items-baseline gap-2 mb-2 px-1">
                <h2 id={id} className="text-lg font-bold text-text-primary">{titulo}</h2>
                <span className="text-sm text-gray-600">
                    {reservas.length > 0 ? `${reservas.length} · ${pie}` : pie}
                </span>
            </div>

            {reservas.length === 0 ? (
                <p className="px-1 text-base text-gray-600">{vacio}</p>
            ) : (
                <ul className="bg-white rounded-3xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
                    {reservas.map((r) => <Linea key={r.id} r={r} hoy={hoy} ir={ir} />)}
                </ul>
            )}
        </section>
    );
};

const Linea = ({ r, hoy, ir }) => {
    const cancelada = r.status === 'cancelled';
    const falta = pendienteDe(r);
    const cobrado = cobradoDe(r);
    const deFuera = canalSiImporta(r);

    return (
        <li>
            <button
                type="button"
                onClick={() => ir('reserva', { reservaId: r.id })}
                className="w-full text-left px-4 sm:px-5 py-3.5 min-h-[72px] flex items-center gap-3 hover:bg-rural-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
            >
                {/* Nada de recortar el nombre ni las fechas: en un móvil de 375 px
                    "PRUEBA-PART…" y "del 10 a…" no dicen nada. Que ocupen dos
                    líneas si hace falta, y el dinero se va debajo. En pantalla
                    ancha vuelve a su sitio, a la derecha. */}
                <span className="flex-1 min-w-0">
                    <span className="block font-bold text-lg text-text-primary leading-snug break-words">
                        {r.guest_name || 'Sin nombre'}
                    </span>
                    <span className="block text-base text-gray-700 leading-snug">
                        {r.apartamento} · {fechasEnPalabras(r.check_in, r.check_out, hoy)}
                    </span>
                    {deFuera && (
                        <span className="block text-sm text-gray-500">por {deFuera}</span>
                    )}
                    <span className="sm:hidden block mt-2">
                        <Etiqueta cancelada={cancelada} falta={falta} cobrado={cobrado} />
                    </span>
                </span>

                <span className="shrink-0 flex items-center gap-2">
                    <span className="hidden sm:block">
                        <Etiqueta cancelada={cancelada} falta={falta} cobrado={cobrado} />
                    </span>
                    <ChevronRight size={20} className="text-gray-400" aria-hidden="true" />
                </span>
            </button>
        </li>
    );
};

/** El dinero en corto, que es lo único que ella mira de un vistazo. */
const Etiqueta = ({ cancelada, falta, cobrado }) => {
    if (cancelada) {
        return (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-600">
                Cancelada
            </span>
        );
    }
    if (falta > 0) {
        return (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-800 tabular-nums text-right">
                Pendiente {formatoEuro(falta)}
            </span>
        );
    }
    if (cobrado > 0) {
        return (
            <span className="inline-flex items-center rounded-full border border-rural-200 bg-rural-50 px-3 py-1.5 text-sm font-bold text-rural-700">
                Cobrado
            </span>
        );
    }
    return (
        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-600">
            Sin importe
        </span>
    );
};

export default ReservasPanel;

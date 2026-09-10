import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowDownRight, ArrowUpRight, Shield, Euro, Brush, ChevronRight } from 'lucide-react';
import {
    Tarjeta, Aviso, Cargando, formatoEuro,
    hoyISO, aISO, aFecha, fechaEnPalabrasRelativa, saludo,
    pendienteDe, canalSiImporta,
    HORA_ENTRADA, HORA_SALIDA, sumarDias
} from './ui';

// ============================================================
// PanelHome — la primera pantalla (sección 4.1 del plan)
// ============================================================
// Arriba: la fecha de hoy en palabras.
// Luego: quién llega hoy y quién se va hoy. Si no hay nadie, se dice en
// una línea tranquila y ya está.
// Después: avisos, y SOLO si hay algo que hacer. Si no hay nada, la
// pantalla se queda limpia. Aquí no van porcentajes de ocupación,
// ingresos del mes ni gráficos: eso es del panel de Jesús.
// Al final: las tarjetas grandes a todas las secciones (nada escondido).
// ============================================================

const ESTADOS_VIVOS = ['confirmed', 'pending', 'completed'];
const DIAS_AVISO_POLICIA = 3;   // avisamos de los datos que faltan con 3 días
const DIAS_AVISO_COBRO = 10;    // y del dinero pendiente con 10

// Lo que YA se fue y sigue debiendo. Sin esto, el dinero de un huésped que
// se marchó sin pagar desaparecía de la pantalla el día que salía por la
// puerta: nadie volvía a verlo hasta entrar a "Dinero" a propósito.
const DIAS_DEUDA_VIEJA = 365;
// Y una limpieza atrasada tampoco salía aquí: solo dentro de "Limpiezas".
const HECHAS = ['done', 'skipped'];

const PanelHome = ({ ir, perfil, secciones = [] }) => {
    const [cargando, setCargando] = useState(true);
    const [hoy] = useState(hoyISO);
    const [llegan, setLlegan] = useState([]);
    const [seVan, setSeVan] = useState([]);
    const [avisos, setAvisos] = useState([]);

    useEffect(() => {
        let cortado = false;

        (async () => {
            const dentroDe = (dias) => aISO(sumarDias(hoy, dias));

            const [apart, delDia, proximas, vencidas, limpiezas] = await Promise.all([
                supabase.from('apartments').select('id, name'),
                supabase.from('guest_bookings').select('*')
                    .in('status', ESTADOS_VIVOS)
                    .or(`check_in.eq.${hoy},check_out.eq.${hoy}`),
                supabase.from('guest_bookings').select('*')
                    .in('status', ['confirmed', 'pending'])
                    .gte('check_in', hoy)
                    .lte('check_in', dentroDe(DIAS_AVISO_COBRO))
                    .order('check_in', { ascending: true }),
                // Ya se fueron y todavía deben.
                supabase.from('guest_bookings').select('*')
                    .in('status', ESTADOS_VIVOS)
                    .lt('check_out', hoy)
                    .gte('check_out', dentroDe(-DIAS_DEUDA_VIEJA))
                    .order('check_out', { ascending: false }),
                // Limpiezas de días pasados que siguen sin marcar.
                supabase.from('cleaning_tasks')
                    .select('id, apartment_id, scheduled_date, status')
                    .lt('scheduled_date', hoy)
                    .gte('scheduled_date', dentroDe(-DIAS_DEUDA_VIEJA))
                    .order('scheduled_date', { ascending: true }),
            ]);

            if (cortado) return;

            const nombreApto = {};
            (apart.data || []).forEach((a) => { nombreApto[a.id] = a.name; });
            const conApto = (r) => ({ ...r, apartamento: nombreApto[r.apartment_id] || 'Apartamento' });

            const dia = (delDia.data || []).map(conApto);
            setLlegan(dia.filter((r) => r.check_in === hoy));
            setSeVan(dia.filter((r) => r.check_out === hoy));

            setAvisos(await construirAvisos(
                (proximas.data || []).map(conApto),
                (vencidas.data || []).map(conApto),
                (limpiezas.data || []).filter((t) => !HECHAS.includes(t.status)).map(conApto),
                hoy, dentroDe,
            ));
            setCargando(false);
        })();

        return () => { cortado = true; };
    }, [hoy]);

    const tarjetas = secciones.filter((s) => s.id !== 'inicio');
    const nombre = (perfil?.full_name || '').split(' ')[0];

    if (cargando) return <Cargando texto="Mirando cómo va el día…" />;

    return (
        <div className="space-y-6">
            {/* ---------- Hoy ---------- */}
            <section aria-labelledby="hoy-t">
                <h2 id="hoy-t" className="font-serif text-2xl md:text-3xl font-bold text-text-primary">
                    {fechaEnPalabrasRelativa(hoy)}
                </h2>
                {nombre && <p className="text-base text-gray-600 mt-1">{saludo()}, {nombre}.</p>}
            </section>

            {/* ---------- Llegan y se van ---------- */}
            {llegan.length === 0 && seVan.length === 0 ? (
                <Tarjeta>
                    <p className="text-lg text-text-primary">Hoy no llega ni se va nadie.</p>
                </Tarjeta>
            ) : (
                <div className="space-y-4">
                    <ListaDelDia
                        titulo="Llegan hoy"
                        icono={ArrowDownRight}
                        horario={`Entran ${HORA_ENTRADA}`}
                        reservas={llegan}
                        vacio="Hoy no llega nadie."
                        ir={ir}
                    />
                    <ListaDelDia
                        titulo="Se van hoy"
                        icono={ArrowUpRight}
                        horario={`Se van ${HORA_SALIDA}`}
                        reservas={seVan}
                        vacio="Hoy no se va nadie."
                        ir={ir}
                    />
                </div>
            )}

            {/* ---------- Avisos: solo si hay algo ---------- */}
            {avisos.length > 0 && (
                <section aria-labelledby="pend-t" className="space-y-3">
                    <h3 id="pend-t" className="text-base font-bold text-text-primary">Cosas por hacer</h3>
                    {avisos.map((a) => (
                        <Aviso key={a.clave} tono={a.tono} titulo={a.titulo} texto={a.texto}
                            icono={a.icono} accion={{ texto: a.accion, onClick: () => ir(a.seccion, a.params) }} />
                    ))}
                </section>
            )}

            {/* ---------- Todo lo demás, a la vista ---------- */}
            <section aria-labelledby="ir-t" className="pt-2">
                <h3 id="ir-t" className="text-base font-bold text-text-primary mb-3">¿Qué quieres hacer?</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {tarjetas.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => ir(s.id)}
                            className="bg-white rounded-3xl border border-gray-200 shadow-sm p-4 min-h-[112px] text-left flex flex-col gap-2 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30 active:scale-[0.99]"
                        >
                            <span className="w-11 h-11 rounded-2xl bg-rural-50 text-rural-700 flex items-center justify-center">
                                <s.icono size={22} aria-hidden="true" />
                            </span>
                            <span className="font-bold text-base text-text-primary leading-tight">{s.etiqueta}</span>
                            <span className="text-sm text-gray-600 leading-snug">{s.resumen}</span>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
};

// ============================================================

const ListaDelDia = ({ titulo, icono: Icono, horario, reservas, vacio, ir }) => (
    <Tarjeta>
        <div className="flex items-center gap-2 mb-1">
            <Icono size={20} className="text-rural-600" aria-hidden="true" />
            <h3 className="font-bold text-lg text-text-primary">{titulo}</h3>
        </div>
        {reservas.length === 0 ? (
            <p className="text-base text-gray-600">{vacio}</p>
        ) : (
            <>
                <p className="text-sm text-gray-600 mb-3">{horario}</p>
                <ul className="divide-y divide-gray-100 -mx-5">
                    {reservas.map((r) => (
                        <li key={r.id}>
                            <button
                                type="button"
                                onClick={() => ir('reserva', { reservaId: r.id })}
                                className="w-full text-left px-5 py-3 min-h-[64px] flex items-center gap-3 hover:bg-rural-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                            >
                                <span className="flex-1 min-w-0">
                                    <span className="block font-bold text-lg text-text-primary truncate">
                                        {r.guest_name || 'Sin nombre'}
                                    </span>
                                    <span className="block text-base text-gray-600">
                                        {r.apartamento} · {r.pax_count || 1} {r.pax_count === 1 ? 'persona' : 'personas'}
                                        {canalSiImporta(r) ? ` · ${canalSiImporta(r)}` : ''}
                                    </span>
                                </span>
                                <ChevronRight size={20} className="text-gray-400 shrink-0" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            </>
        )}
    </Tarjeta>
);

// ============================================================
// Avisos: solo lo que ella puede resolver hoy. Nada informativo.
// Si la vista `v_parte_estado` todavía no existe (la está creando otro
// agente), el aviso de los datos de la policía simplemente no sale; el
// resto de la pantalla funciona igual.
// ============================================================

async function construirAvisos(proximas, vencidas, limpiezasAtrasadas, hoy, dentroDe) {
    const avisos = [];
    const limitePolicia = dentroDe(DIAS_AVISO_POLICIA);

    // 1) Datos de la policía que faltan
    const porLlegarPronto = proximas.filter((r) => r.check_in <= limitePolicia);
    if (porLlegarPronto.length > 0) {
        const { data: parte } = await supabase
            .from('v_parte_estado')
            .select('*')
            .in('booking_id', porLlegarPronto.map((r) => r.id));

        if (parte) {
            const porReserva = {};
            parte.forEach((p) => { porReserva[p.booking_id] = p; });
            porLlegarPronto.forEach((r) => {
                const p = porReserva[r.id];
                // v_parte_estado expone `faltan` (booleano) y `faltan_cuantos`.
                // Si la reserva no sale en la vista, no avisamos: mejor callar
                // que dar un aviso falso todos los dias.
                if (!p || p.faltan !== true) return;
                avisos.push({
                    clave: `policia-${r.id}`,
                    tono: r.check_in === hoy ? 'urgente' : 'atencion',
                    icono: Shield,
                    titulo: `Faltan los datos de la policía de ${r.guest_name || 'este huésped'}`,
                    texto: r.check_in === hoy
                        ? `Llega hoy a ${r.apartamento}.`
                        : `Llega el ${r.check_in.slice(8, 10)} a ${r.apartamento}.`,
                    accion: 'Recordárselo',
                    seccion: 'reserva',
                    params: { reservaId: r.id, abrir: 'parte' },
                });
            });
        }
    }

    // 2) Reservas con dinero pendiente
    proximas.forEach((r) => {
        const falta = pendienteDe(r);
        if (falta <= 0) return;
        const de = canalSiImporta(r);
        avisos.push({
            clave: `cobro-${r.id}`,
            tono: 'atencion',
            icono: Euro,
            titulo: `Reserva de ${r.guest_name || 'un huésped'}${de ? ` (${de})` : ''} sin cobrar del todo`,
            texto: `Faltan ${formatoEuro(falta)} · llega el ${r.check_in.slice(8, 10)} a ${r.apartamento}.`,
            accion: 'Cobrar',
            seccion: 'reserva',
            params: { reservaId: r.id, abrir: 'cobro' },
        });
    });

    // 3) Limpiezas que se han quedado atrás
    if (limpiezasAtrasadas.length > 0) {
        const primera = limpiezasAtrasadas[0];
        const n = limpiezasAtrasadas.length;
        avisos.push({
            clave: 'limpiezas-atrasadas',
            tono: 'atencion',
            icono: Brush,
            titulo: n === 1
                ? `Queda por limpiar ${primera.apartamento}`
                : `Quedan ${n} limpiezas por hacer`,
            texto: n === 1
                ? `Era del ${diaYMes(primera.scheduled_date)} y sigue sin marcar.`
                : `La más antigua es del ${diaYMes(primera.scheduled_date)}.`,
            accion: 'Ver las limpiezas',
            seccion: 'limpiezas',
            params: {},
        });
    }

    // 4) Dinero de gente que YA se fue y no ha pagado. Va al final porque no
    //    corre prisa hoy, pero tiene que estar: si no, se olvida para siempre.
    vencidas.forEach((r) => {
        const falta = pendienteDe(r);
        if (falta <= 0) return;
        const de = canalSiImporta(r);
        avisos.push({
            clave: `deuda-${r.id}`,
            tono: 'atencion',
            icono: Euro,
            titulo: `${r.guest_name || 'Un huésped'}${de ? ` (${de})` : ''} ya se fue y falta cobrar`,
            texto: `Faltan ${formatoEuro(falta)} · estuvo en ${r.apartamento} y se fue el ${diaYMes(r.check_out)}.`,
            accion: 'Cobrar',
            seccion: 'reserva',
            params: { reservaId: r.id, abrir: 'cobro' },
        });
    });

    return avisos.slice(0, 6);
}

/** '22 de julio' */
function diaYMes(iso) {
    const f = aFecha(iso);
    if (!f) return '';
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(f);
}

export default PanelHome;

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AvisosMovil from './AvisosMovil';
import { ArrowDownRight, ArrowUpRight, Shield, Euro, Brush, ChevronRight, Check, MailWarning } from 'lucide-react';
import {
    Tarjeta, Aviso, Cargando, formatoEuro,
    hoyISO, aISO, aFecha, fechaEnPalabrasRelativa, fechaCorta, saludo,
    pendienteDe, canalSiImporta, loPagaElPortal, netoDelPortal, cuandoPagaElPortal,
    seCobraConTarjetaDelPortal,
    HORA_ENTRADA, HORA_SALIDA, sumarDias, sinPruebas,
} from './ui';
import { recordatorioEnPalabras } from './checkin/datos';

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
    // «El sistema»: correos que no llegan, dominio caído, partes rechazados
    // (migración 0043). Solo se enseña cuando hay algo mal.
    const [sistema, setSistema] = useState([]);

    useEffect(() => {
        let cortado = false;

        (async () => {
            const dentroDe = (dias) => aISO(sumarDias(hoy, dias));

            // Todo a la vez (23-sep): el estado del sistema y el parte salían
            // DESPUÉS de lo demás y la pantalla esperaba dos viajes en vez de uno.
            supabase.rpc('tjm_salud').then(({ data }) => { if (!cortado && data) setSistema(avisosDelSistema(data)); });

            const [apart, delDia, proximas, vencidas, limpiezas, parte] = await Promise.all([
                supabase.from('apartments').select('id, name'),
                sinPruebas(supabase.from('guest_bookings').select('*'))
                    .in('status', ESTADOS_VIVOS)
                    .or(`check_in.eq.${hoy},check_out.eq.${hoy}`),
                sinPruebas(supabase.from('guest_bookings').select('*'))
                    .in('status', ['confirmed', 'pending'])
                    .gte('check_in', hoy)
                    .lte('check_in', dentroDe(DIAS_AVISO_COBRO))
                    .order('check_in', { ascending: true }),
                // Ya se fueron y todavía deben.
                sinPruebas(supabase.from('guest_bookings').select('*'))
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
                // El parte de los que llegan pronto (por fechas, sin esperar a saber cuáles).
                supabase.from('v_parte_estado').select('*')
                    .gte('check_in', hoy)
                    .lte('check_in', dentroDe(DIAS_AVISO_POLICIA)),
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
                hoy, dentroDe, parte.error ? null : (parte.data || []),
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

            {/* ---------- Llegan y se van: UNA tarjeta ----------
                Antes eran dos tarjetas más el aviso del móvil, y «Cosas por
                hacer» empezaba en el píxel 731 de 753 del móvil: lo urgente no
                se veía sin bajar (auditoría 23-sep). */}
            {llegan.length === 0 && seVan.length === 0 ? (
                <Tarjeta>
                    <p className="text-lg text-text-primary">Hoy no llega ni se va nadie.</p>
                </Tarjeta>
            ) : (
                <Tarjeta>
                    <ListaDelDia
                        titulo="Llegan hoy"
                        icono={ArrowDownRight}
                        horario={`Entran ${HORA_ENTRADA}`}
                        reservas={llegan}
                        vacio="Hoy no llega nadie."
                        ir={ir}
                    />
                    <div className="border-t border-gray-100 my-3 -mx-5" />
                    <ListaDelDia
                        titulo="Se van hoy"
                        icono={ArrowUpRight}
                        horario={`Se van ${HORA_SALIDA}`}
                        reservas={seVan}
                        vacio="Hoy no se va nadie."
                        ir={ir}
                    />
                </Tarjeta>
            )}

            {/* ---------- Lo que hay que hacer, justo debajo ---------- */}
            {avisos.length > 0 && (
                <section aria-labelledby="pend-t" className="space-y-3">
                    <h3 id="pend-t" className="text-base font-bold text-text-primary">Cosas por hacer</h3>
                    {avisos.map((a) => (
                        <Aviso key={a.clave} tono={a.tono} titulo={a.titulo} texto={a.texto}
                            icono={a.icono} accion={{ texto: a.accion, onClick: () => ir(a.seccion, a.params) }} />
                    ))}
                </section>
            )}

            {/* ---------- El sistema: solo si algo no funciona ---------- */}
            {sistema.length > 0 && (
                <section aria-labelledby="sis-t" className="space-y-3">
                    <h3 id="sis-t" className="text-base font-bold text-text-primary">El sistema</h3>
                    {sistema.map((a) => (
                        <Aviso key={a.clave} tono={a.tono} titulo={a.titulo} texto={a.texto} icono={a.icono}
                            accion={a.seccion ? { texto: a.accion, onClick: () => ir(a.seccion) } : undefined} />
                    ))}
                </section>
            )}

            {/* ---------- Que te avise el móvil (solo hasta que esté activado) ----------
                Es un ajuste de una vez: va detrás de lo del día. */}
            <AvisosMovil />

            {/* ---------- Todo lo demás, a la vista ----------
                Solo en el móvil: en el ordenador ya está el menú de la
                izquierda y esto lo repetía (524 px). */}
            <section aria-labelledby="ir-t" className="pt-2 md:hidden">
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

// Lo que devuelve tjm_salud(), en frases. Sin jerga: qué pasa y qué hacer.
function avisosDelSistema(s) {
    const lista = [];
    const correo = s.correo;
    const fallidos = Number(s.envios?.fallidos_24h) || 0;
    const ultimos = s.envios?.ultimos_fallidos || [];

    if (correo && correo.ok === false) {
        const desde = correo.comprobado_at ? fechaCorta(correo.comprobado_at.slice(0, 10)) : 'hoy';
        lista.push({
            clave: 'correo-caido', tono: 'urgente', icono: MailWarning,
            titulo: 'Los correos del sistema no están saliendo',
            texto: `Se detectó ${desde}. Jesús ya tiene el aviso. Hasta que se arregle, a quien llegue estos días escríbele tú por WhatsApp: cómo llegar, la casa y los datos de la policía.`,
        });
    } else if (fallidos > 0) {
        const quien = ultimos.slice(0, 3).map((e) => `${e.asunto || 'correo'}${e.guest_name ? ` (${e.guest_name})` : ''}`).join(' · ');
        lista.push({
            clave: 'correos-fallidos', tono: 'atencion', icono: MailWarning,
            titulo: fallidos === 1 ? 'Un correo no ha llegado hoy' : `${fallidos} correos no han llegado hoy`,
            texto: `${quien}. Puede ser una dirección mal escrita: mira el correo del huésped en su reserva y, si está mal, corrígelo y escríbele por WhatsApp.`,
            seccion: 'reservas', accion: 'Ver reservas',
        });
    }

    const rech = Number(s.partes?.rechazados) || 0;
    const faltan = Number(s.partes?.faltan_datos) || 0;
    if (rech + faltan > 0) {
        lista.push({
            clave: 'partes', tono: 'atencion', icono: Shield,
            titulo: rech > 0 ? 'La policía ha rechazado un parte' : 'Un parte no puede salir: faltan datos',
            texto: rech > 0
                ? `${rech === 1 ? 'Hay una reserva' : `Hay ${rech} reservas`} con el parte rechazado. En «Datos de la policía» está el motivo.`
                : `${faltan === 1 ? 'Una reserva' : `${faltan} reservas`} ya han entrado y falta algún dato de los huéspedes.`,
            seccion: 'parte', accion: 'Ver datos de la policía',
        });
    }
    return lista;
}

// La hora avisada solo importa el día que llegan (no el día que se van).
const hoyDe = (r) => r.check_in;
const ListaDelDia = ({ titulo, icono: Icono, horario, reservas, vacio, ir }) => (
    <div>
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
                                        {r.hora_llegada_prevista && r.check_in === hoyDe(r) ? ` · llegan sobre las ${String(r.hora_llegada_prevista).slice(0, 5)}` : ''}
                                    </span>
                                </span>
                                <ChevronRight size={20} className="text-gray-400 shrink-0" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            </>
        )}
    </div>
);

// ============================================================
// Avisos: solo lo que ella puede resolver hoy. Nada informativo.
// Si la vista `v_parte_estado` todavía no existe (la está creando otro
// agente), el aviso de los datos de la policía simplemente no sale; el
// resto de la pantalla funciona igual.
// ============================================================

async function construirAvisos(proximas, vencidas, limpiezasAtrasadas, hoy, dentroDe, parte) {
    const avisos = [];
    const limitePolicia = dentroDe(DIAS_AVISO_POLICIA);

    // 1) Datos de la policía que faltan (el parte ya viene cargado con lo demás)
    const porLlegarPronto = proximas.filter((r) => r.check_in <= limitePolicia);
    if (porLlegarPronto.length > 0) {

        if (parte) {
            const porReserva = {};
            parte.forEach((p) => { porReserva[p.booking_id] = p; });
            porLlegarPronto.forEach((r) => {
                const p = porReserva[r.id];
                // v_parte_estado expone `faltan` (booleano) y `faltan_cuantos`.
                // Si la reserva no sale en la vista, no avisamos: mejor callar
                // que dar un aviso falso todos los dias.
                if (!p) return;
                // Ya han rellenado, llegan hoy y no se ha apuntado la entrada:
                // lo que toca es darles la llave y terminar el check-in.
                if (p.faltan !== true) {
                    if (p.completo === true && r.check_in === hoy && !r.checkin_at) {
                        avisos.push({
                            clave: `checkin-${r.id}`,
                            tono: 'bien',
                            icono: Check,
                            titulo: `${r.guest_name || 'El huésped'} ya ha rellenado los datos de la policía`,
                            texto: `Llega hoy a ${r.apartamento}. Cuando le des la llave, termina el check-in.`,
                            accion: 'Terminar el check-in',
                            seccion: 'checkin',
                            params: { reservaId: r.id },
                        });
                    }
                    return;
                }
                avisos.push({
                    clave: `policia-${r.id}`,
                    tono: r.check_in === hoy ? 'urgente' : 'atencion',
                    icono: Shield,
                    titulo: `Faltan los datos de la policía de ${r.guest_name || 'este huésped'}`,
                    texto: (r.check_in === hoy
                        ? `Llega hoy a ${r.apartamento}.`
                        : `Llega el ${r.check_in.slice(8, 10)} a ${r.apartamento}.`)
                        + (r.recordatorio_parte_at ? ` ${recordatorioEnPalabras(r.recordatorio_parte_at, r.recordatorio_parte_via)}.` : ''),
                    accion: r.recordatorio_parte_at ? 'Recordárselo otra vez' : 'Recordárselo',
                    // A «Datos de la policía»: ahí está el botón que le manda el
                    // enlace por WhatsApp o correo. La ficha de la reserva no lo
                    // tiene y «abrir: parte» ya no abría nada (23-sep).
                    seccion: 'parte',
                    params: {},
                });
            });
        }
    }

    // 2) Reservas con dinero pendiente
    proximas.forEach((r) => {
        const falta = pendienteDe(r);
        if (falta <= 0) return;
        const de = canalSiImporta(r);
        // Lo que paga el portal no es una deuda del huésped: solo avisa cuando
        // ya se puede cobrar la tarjeta de Booking. Airbnb y Holidu lo
        // ingresan solos: nada que hacer (auditoría 23-sep).
        if (loPagaElPortal(r)) {
            const desde = cuandoPagaElPortal(r);
            if (!seCobraConTarjetaDelPortal(r) || !desde || desde > hoy) return;
            avisos.push({
                clave: `cobro-${r.id}`,
                tono: 'atencion',
                icono: Euro,
                titulo: `Ya se puede cobrar la tarjeta de Booking de ${r.guest_name || 'un huésped'}`,
                texto: `${formatoEuro(netoDelPortal(r))} · llega el ${r.check_in.slice(8, 10)} a ${r.apartamento}.`,
                accion: 'Cobrar la tarjeta',
                seccion: 'reserva',
                params: { reservaId: r.id, abrir: 'cobro' },
            });
            return;
        }
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
        // Ya se fue y el portal sigue sin pagar: lo que toca es mirar si ha
        // llegado el ingreso y apuntarlo, no cobrarle al huésped.
        if (loPagaElPortal(r)) {
            avisos.push({
                clave: `deuda-${r.id}`,
                tono: 'atencion',
                icono: Euro,
                titulo: `¿Ha pagado ${de || 'el portal'} lo de ${r.guest_name || 'este huésped'}?`,
                texto: `Tendrían que haberte pagado ${formatoEuro(netoDelPortal(r))}. Se fue el ${diaYMes(r.check_out)} de ${r.apartamento}. Si ya ha llegado, apúntalo.`,
                accion: 'Apuntar el pago',
                seccion: 'reserva',
                params: { reservaId: r.id, abrir: 'cobro' },
            });
            return;
        }
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

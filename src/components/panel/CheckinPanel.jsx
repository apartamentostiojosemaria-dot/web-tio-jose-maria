import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import {
    QrCode, Check, LogOut, Pencil, ChevronLeft, RefreshCw, ExternalLink, Users,
} from 'lucide-react';
import {
    Boton, Tarjeta, Chip, Aviso, Cargando,
    hoyISO, fechaEnPalabras, HORA_ENTRADA,
} from './ui';
import { Hoja } from './dinero/ui';
import CodigoQR from './checkin/CodigoQR';
import Persona from './checkin/Persona';
import {
    cargarCheckin, escucharCheckin, marcarCoincide, leerComprobadoLocal,
    apuntarEntrada, apuntarSalida, enlacePrecheckin, edadEn, EDAD_FIRMA,
} from './checkin/datos';

// El formulario del huesped, tal cual, para «Rellenarlo yo». Se carga solo
// cuando hace falta: son 40 KB de paises que ella no necesita cada vez.
const FormularioHuesped = lazy(() => import('../../pages/PrecheckinPage'));

// ============================================================
// CheckinPanel — «Hacer el check-in»
// ============================================================
// La pantalla que faltaba. Quien la usa es la madre de Jesús: recibe en
// persona entre las 16:00 y las 20:00, entrega la llave a mano y no es nada
// tecnológica. Mucha gente llega con el DNI en la mano y sin haber rellenado
// nada.
//
// LA REGLA QUE ORDENA TODO LO DEMÁS:
//   ella sólo hace tres cosas —enseñar el cuadrado, mirar el documento y dar
//   la llave—. Todo lo que no sean esas tres cosas lo hace el sistema solo.
//
// Y una que manda sobre el diseño: la Agencia de Protección de Datos sanciona
// guardar copias de documentos de identidad. La ley sólo le pide a ella
// MIRAR el documento y comprobar que coincide (art. 4.3 del RD 933/2021).
// Por eso aquí no hay cámara, ni subida de ficheros, ni un hueco para teclear
// el documento de otro. El huésped escribe en SU móvil.
//
// Palabras prohibidas en pantalla: SES, MIR, RD 933/2021, XML, parte
// telemático, servicio web, token. Se dice: datos de la policía, el check-in,
// quién ha rellenado, firmar, mandar el parte.
// ============================================================

const CheckinPanel = ({ ir, volver, params = {} }) => {
    const reservaId = Number(params?.reservaId) || null;

    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [comprobado, setComprobado] = useState({});
    const [avisoGuardado, setAvisoGuardado] = useState(null); // 'aparato' | null
    const [ocupada, setOcupada] = useState(null);             // id de persona
    const [verQR, setVerQR] = useState(false);
    const [verFormulario, setVerFormulario] = useState(false);
    const [mensaje, setMensaje] = useState(null);
    const [terminando, setTerminando] = useState(false);
    const [ultimaLectura, setUltimaLectura] = useState(null);

    const cuantosAntes = useRef(0);
    const hoy = hoyISO();

    // ------------------------------------------------------------ cargar
    const recargar = useCallback(async (silencioso = false) => {
        if (!reservaId) { setError('sin_reserva'); return; }
        try {
            const d = await cargarCheckin(reservaId);
            setDatos(d);
            setUltimaLectura(new Date());
            setError(null);

            // «Ya está Carmen ✓»: cuando entra alguien nuevo, se dice.
            if (silencioso && d.personas.length > cuantosAntes.current) {
                const nuevos = d.personas.slice(cuantosAntes.current);
                const nombres = nuevos.map((p) => p.nombre).filter(Boolean);
                if (nombres.length > 0) {
                    setMensaje({
                        tono: 'bien',
                        titulo: nombres.length === 1
                            ? `Ya está ${nombres[0]}`
                            : `Ya están ${nombres.join(' y ')}`,
                        texto: 'Acaba de llegar desde su móvil.',
                    });
                }
            }
            cuantosAntes.current = d.personas.length;
        } catch (e) {
            if (!silencioso) setError(e.message === 'reserva_no_encontrada' ? 'no_encontrada' : 'carga');
        }
    }, [reservaId]);

    useEffect(() => {
        setComprobado(leerComprobadoLocal(reservaId));
        recargar(false);
    }, [reservaId, recargar]);

    // ------------------------------------------------------- estar al día
    // Mientras ella tiene la pantalla abierta, la lista crece sola delante de
    // ella según van rellenando. Se mira más a menudo cuando falta gente.
    useEffect(() => {
        if (!reservaId || !datos) return undefined;
        const faltaGente = (datos.rellenos || 0) < plazas(datos);
        const parar = escucharCheckin(reservaId, () => recargar(true), {
            cadaMs: faltaGente ? 4000 : 15000,
        });
        return parar;
    }, [reservaId, datos, recargar]);

    // ------------------------------------------------------------ acciones
    const coincide = async (persona, valor = true) => {
        setOcupada(persona.id);
        const r = await marcarCoincide(reservaId, persona.id, valor);
        setComprobado((c) => {
            const nuevo = { ...c };
            if (valor) nuevo[persona.id] = r.cuando;
            else delete nuevo[persona.id];
            return nuevo;
        });
        if (r.donde === 'aparato') setAvisoGuardado('aparato');
        setOcupada(null);
    };

    const terminar = async () => {
        setTerminando(true);
        setMensaje(null);
        const r = await apuntarEntrada(reservaId);
        if (r.ok) {
            setMensaje({
                tono: 'bien',
                titulo: 'Check-in hecho',
                texto: `Queda apuntado que han entrado hoy a las ${hora(r.cuando)}. Ya puedes darles la llave.`,
            });
            await recargar(true);
        } else if (r.motivo === 'sin_columna') {
            setMensaje({
                tono: 'atencion',
                titulo: 'No he podido apuntar la hora de entrada',
                texto: 'Los datos están guardados y el parte sale igual, pero la hora de entrada todavía no se puede apuntar aquí. Avísale a Jesús; es cosa suya, no tuya.',
            });
        } else {
            setMensaje({
                tono: 'atencion',
                titulo: 'No se ha podido apuntar',
                texto: `${r.mensaje || 'Prueba otra vez en un momento.'} Si sigue igual, avisa a Jesús.`,
            });
        }
        setTerminando(false);
    };

    const marcharse = async () => {
        setTerminando(true);
        const r = await apuntarSalida(reservaId);
        setMensaje(r.ok
            ? { tono: 'bien', titulo: 'Apuntado que se han ido', texto: `Hoy a las ${hora(r.cuando)}.` }
            : r.motivo === 'sin_columna'
                ? { tono: 'atencion', titulo: 'No he podido apuntar la salida', texto: 'Todavía no se puede apuntar aquí. Avisa a Jesús.' }
                : { tono: 'atencion', titulo: 'No se ha podido apuntar', texto: r.mensaje || '' });
        if (r.ok) await recargar(true);
        setTerminando(false);
    };

    // ------------------------------------------------------------ pintado
    if (error === 'sin_reserva' || error === 'no_encontrada') {
        return (
            <div className="max-w-3xl">
                <Aviso
                    tono="atencion"
                    titulo="No sé de qué reserva es este check-in"
                    texto="Entra en la reserva y toca «Hacer el check-in»."
                    accion={{ texto: 'Ver las reservas', onClick: () => ir('reservas') }}
                />
            </div>
        );
    }
    if (error === 'carga' && !datos) {
        return (
            <div className="max-w-3xl">
                <Aviso
                    tono="atencion"
                    titulo="No he podido abrir la reserva"
                    texto="Prueba a actualizar dentro de un momento."
                    accion={{ texto: 'Probar otra vez', icono: RefreshCw, onClick: () => recargar(false) }}
                />
            </div>
        );
    }
    if (!datos) return <Cargando texto="Abriendo el check-in…" />;

    const { reserva, personas, rellenos, puedeVerPersonas } = datos;
    const total = plazas(datos);
    const faltan = Math.max(total - rellenos, 0);
    const estanTodos = faltan === 0 && rellenos > 0;
    const cuantosComprobados = personas.filter((p) => comprobado[p.id]).length;
    const todosComprobados = personas.length > 0 && cuantosComprobados === personas.length;
    const sinFirma = personas.filter((p) => !p.firma_base64 && necesitaFirmar(p, reserva.check_in));
    const yaEntraron = !!reserva.checkin_at;
    const yaSalieron = !!reserva.checkout_at;

    return (
        <div className="max-w-3xl">
            {/* Volver: en el móvil está en la cabecera; en el ordenador, aquí */}
            <button
                type="button"
                onClick={volver}
                className="hidden md:inline-flex items-center gap-1.5 mb-4 min-h-[44px] px-3 -ml-3 rounded-xl text-rural-700 font-bold hover:bg-rural-50"
            >
                <ChevronLeft size={20} aria-hidden="true" /> Volver
            </button>

            {/* ---------- Quién llega ---------- */}
            <Tarjeta className="mb-5">
                <p className="font-serif text-2xl sm:text-3xl font-bold text-text-primary leading-tight break-words">
                    {reserva.guest_name || 'Sin nombre'}
                </p>
                <p className="text-lg text-gray-700 mt-1">
                    {reserva.apartments?.name} · {total} {total === 1 ? 'persona' : 'personas'}
                </p>
                <p className="text-base text-gray-600">
                    {reserva.check_in === hoy ? 'Llega hoy' : `Llega el ${fechaEnPalabras(reserva.check_in)}`}
                    {' · '}se recibe {HORA_ENTRADA}
                </p>

                <p className={`mt-4 font-serif text-3xl sm:text-4xl font-bold leading-none ${
                    estanTodos ? 'text-rural-700' : 'text-amber-700'
                }`}>
                    Han rellenado {rellenos} de {total}
                </p>
                {estanTodos ? (
                    <p className="mt-2 text-base font-bold text-rural-700 flex items-center gap-1.5">
                        <Check size={18} aria-hidden="true" /> Están todos
                    </p>
                ) : (
                    <p className="mt-2 text-base text-gray-700">
                        {faltan === total
                            ? 'Todavía no ha rellenado nadie. Enséñale el código.'
                            : `Falta${faltan === 1 ? '' : 'n'} ${faltan}. Enséñale el código a quien falte.`}
                    </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                    {yaEntraron && <Chip tono="verde" icono={Check}>Entraron a las {hora(reserva.checkin_at)}</Chip>}
                    {yaSalieron && <Chip tono="neutro" icono={LogOut}>Se fueron a las {hora(reserva.checkout_at)}</Chip>}
                    {ultimaLectura && !estanTodos && (
                        <Chip tono="neutro">Se actualiza sola · {hora(ultimaLectura)}</Chip>
                    )}
                </div>
            </Tarjeta>

            {mensaje && (
                <Aviso
                    className="mb-5"
                    tono={mensaje.tono}
                    titulo={mensaje.titulo}
                    texto={mensaje.texto}
                />
            )}

            {/* ---------- Lo primero que hace: enseñar el código ---------- */}
            <Boton
                icono={QrCode}
                tamano="grande"
                ancho
                onClick={() => setVerQR(true)}
                className="mb-3"
            >
                Enseñar el código
            </Boton>

            <div className="mb-6 flex flex-col sm:flex-row gap-2.5">
                <Boton variante="suave" icono={RefreshCw} onClick={() => recargar(false)} ancho>
                    Actualizar
                </Boton>
                <Boton variante="secundario" icono={Pencil} onClick={() => setVerFormulario(true)} ancho>
                    Rellenarlo yo
                </Boton>
            </div>

            {/* ---------- La lista ---------- */}
            <section className="mb-6">
                <h2 className="text-sm uppercase tracking-[0.15em] font-bold text-gray-500 mb-1">
                    Quién ha rellenado
                </h2>
                <p className="text-base text-gray-600 mb-4 leading-relaxed">
                    Mira el documento que te enseñan y compáralo con lo que pone aquí.
                    Si es el mismo, toca «Coincide». No hace falta nada más:
                    ni copiarlo, ni hacerle foto.
                </p>

                {!puedeVerPersonas ? (
                    <Aviso
                        tono="atencion"
                        titulo="Aquí no puedo enseñarte la lista"
                        texto={`Sé que han rellenado ${rellenos}, pero desde esta cuenta no puedo ver quién es quién. Avisa a Jesús: es un permiso que falta, no un fallo tuyo.`}
                    />
                ) : personas.length === 0 ? (
                    <Tarjeta>
                        <div className="text-center py-6">
                            <Users size={30} className="mx-auto mb-3 text-gray-300" aria-hidden="true" />
                            <p className="text-base text-gray-600">
                                Todavía no ha rellenado nadie. Enséñale el código y verás cómo van
                                apareciendo aquí solos.
                            </p>
                        </div>
                    </Tarjeta>
                ) : (
                    <ul className="space-y-4">
                        {personas.map((p) => (
                            <li key={p.id}>
                                <Persona
                                    persona={p}
                                    fechaEntrada={reserva.check_in}
                                    comprobado={!!comprobado[p.id]}
                                    ocupado={ocupada === p.id}
                                    onCoincide={(x) => coincide(x, true)}
                                    onNoCoincide={(x) => coincide(x, false)}
                                />
                            </li>
                        ))}
                    </ul>
                )}

                {avisoGuardado === 'aparato' && (
                    <p className="mt-4 text-sm text-gray-600 leading-snug">
                        Lo comprobado se está guardando en este aparato hasta que Jesús termine
                        un ajuste. Si haces el check-in desde otro sitio, tendrás que volver a
                        marcarlo.
                    </p>
                )}

                {faltan > 0 && personas.length > 0 && (
                    <p className="mt-4 text-base text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                        Falta{faltan === 1 ? '' : 'n'} {faltan} {faltan === 1 ? 'persona' : 'personas'} por
                        rellenar. Pásale el código al siguiente.
                    </p>
                )}

                {sinFirma.length > 0 && (
                    <p className="mt-3 text-base text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                        {sinFirma.length === 1
                            ? `${sinFirma[0].nombre || 'Una persona'} no ha firmado.`
                            : `${sinFirma.length} personas no han firmado.`}{' '}
                        Que vuelvan a abrir el enlace en su móvil y firmen con el dedo.
                        Firman todos los mayores de 14 años.
                    </p>
                )}
            </section>

            {/* ---------- Terminar ---------- */}
            <section className="space-y-3 pb-4">
                {!yaEntraron ? (
                    <>
                        <Boton
                            icono={Check}
                            tamano="grande"
                            ancho
                            onClick={terminar}
                            cargando={terminando}
                        >
                            Terminar el check-in
                        </Boton>
                        <p className="text-sm text-gray-600 leading-snug">
                            {estanTodos && todosComprobados
                                ? 'Están todos y los has comprobado. Se apunta la hora de entrada y ya está.'
                                : 'Se apunta la hora a la que han entrado. Puedes darle aunque falte gente: lo que falte se queda avisado.'}
                        </p>
                    </>
                ) : (
                    <Boton
                        variante="secundario"
                        icono={LogOut}
                        tamano="grande"
                        ancho
                        onClick={marcharse}
                        cargando={terminando}
                        disabled={yaSalieron}
                    >
                        {yaSalieron ? 'Ya se habían ido' : 'Se han ido'}
                    </Boton>
                )}

                <Boton variante="suave" ancho onClick={() => ir('parte', { reservaId })}>
                    Ver los datos de la policía
                </Boton>
            </section>

            {/* ---------- El cuadrado ---------- */}
            <Hoja
                abierta={verQR}
                titulo="Que lo escanee con su móvil"
                onCerrar={() => setVerQR(false)}
            >
                <CodigoQR reserva={reserva} />
                <p className="text-sm text-gray-600 leading-snug">
                    Cuando termine, su nombre aparece solo en la lista. No cierres esta pantalla
                    hasta que lo veas.
                </p>
            </Hoja>

            {/* ---------- Rellenarlo yo ---------- */}
            <Hoja
                abierta={verFormulario}
                titulo="Rellenarlo tú"
                explicacion="Mejor que lo haga el huésped en su móvil: es su documento y sus datos. Pero si no puede, aquí lo tienes."
                onCerrar={() => { setVerFormulario(false); recargar(false); }}
            >
                {/* El MISMO formulario del huésped, aquí dentro. No una copia
                    ni un marco aparte: dos formularios distintos acabarían
                    diciendo cosas distintas, y esto va a un parte policial. */}
                <Suspense fallback={<Cargando texto="Abriendo el formulario…" />}>
                    <FormularioHuesped
                        codigo={reserva.booking_code}
                        dentroDelPanel
                        alTerminar={() => { recargar(false); }}
                    />
                </Suspense>
                <a
                    href={enlacePrecheckin(reserva.booking_code)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full min-h-[52px] px-5 rounded-2xl font-bold text-base bg-white text-rural-700 border-2 border-rural-200 hover:bg-rural-50"
                >
                    <ExternalLink size={20} aria-hidden="true" /> Abrirlo a pantalla completa
                </a>
                <p className="text-sm text-gray-600 leading-snug">
                    Recuerda: se puede escribir lo que te digan, pero el documento no se
                    fotografía ni se guarda. Sólo se mira.
                </p>
            </Hoja>
        </div>
    );
};

// ---------------------------------------------------------------- ayudas

/** Cuántas personas se esperan. Nunca menos de las que ya han rellenado. */
function plazas(datos) {
    const dice = Number(datos?.reserva?.pax_count) || 1;
    return Math.max(dice, datos?.rellenos || 0, 1);
}

/** Firman todos los mayores de catorce. Ni 16 ni 18. */
function necesitaFirmar(p, fechaEntrada) {
    const edad = edadEn(p?.fecha_nacimiento, fechaEntrada);
    return edad === null || edad >= EDAD_FIRMA;
}

/** '17:42' en hora de España, venga de donde venga el móvil. */
function hora(cuando) {
    if (!cuando) return '';
    const f = cuando instanceof Date ? cuando : new Date(cuando);
    if (Number.isNaN(f.getTime())) return '';
    return new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit',
    }).format(f);
}

export default CheckinPanel;

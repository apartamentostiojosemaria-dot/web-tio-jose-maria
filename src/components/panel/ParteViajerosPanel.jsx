import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Shield, MessageCircle, Mail, Send, FileDown, Check, RefreshCw, CircleAlert,
    QrCode,
} from 'lucide-react';
import {
    Boton, Aviso, Cargando, Vacio, Chip,
    hoyISO, aFecha, aISO, fechaEnPalabras, fechaCorta,
} from './ui';
import { telefonoParaWhatsapp, textoRecordatorio } from './checkin/datos';

// ============================================================
// ParteViajerosPanel — «Datos de la policía»
// ============================================================
// La pantalla de la madre. Una fila por reserva con un semáforo que se
// entiende de un vistazo, con su palabra al lado del color:
//   🟢 Listo         → están todos, o el parte ya está mandado
//   🟡 Faltan N de M → todavía no han rellenado todos
//   🔴 Avisa a Jesús → algo falló al mandarlo. Ella no arregla nada.
//   ⚪ Todavía no toca → se les pide 7 días antes de llegar
//
// Y, sobre todo, la PUERTA AL CHECK-IN: cada fila tiene «Hacer el check-in»,
// que lleva a la pantalla que se usa con el huésped delante (código para su
// móvil, lista para comparar con el documento, hora real de entrada). Antes
// esta pantalla sólo miraba; ahora desde aquí también se hace.
//
// Los otros dos botones por reserva: «Recordárselo» (WhatsApp o correo, con
// el texto ya escrito) y «Mandar el parte».
//
// Reglas de esta pantalla, innegociables:
//   - Ni una palabra técnica. Nada de SES, MIR, XML, envío telemático,
//     esquema, servicio web ni códigos. Se dice: datos de la policía,
//     mandar el parte, mandado, falta gente por rellenar.
//   - Ella NO ve el documento de identidad de nadie: la vista
//     `v_parte_estado` sólo trae cuántos han rellenado, nunca quién es
//     quién ni su documento. Los datos personales no salen de la base.
//   - Móvil primero: 375 px sin desplazamiento lateral, nada pulsable
//     por debajo de 44 px.
//
// Mientras no haya credenciales para mandarlo por el ordenador, el botón
// «Mandar el parte» le prepara la hoja de registro en PDF para que la
// mande como la manda hoy, y luego ella confirma con un toque que ya está
// mandada. No se marca nada como mandado sin que ella lo diga: un parte
// que dice «mandado» sin estarlo es peor que uno que dice «pendiente».
// ============================================================

/** Días antes de la llegada en que se le pide al huésped que rellene. */
const DIAS_ANTES = 7;

/** Cuántos días hacia adelante enseñamos. Más allá no es cosa de hoy. */
const HORIZONTE_DIAS = 60;

const URL_FUNCION = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-ses-hospedajes`;

// ---------------------------------------------------------------- semáforo

/**
 * Traduce una fila de `v_parte_estado` a lo que se ve en pantalla.
 * `estado_envio` puede venir como 'sin_datos' | 'pendiente_envio' |
 * 'enviado' | 'error'. Si algún día trae un valor nuevo, cae en el caso
 * general y no rompe nada.
 */
function semaforoDe(fila, hoy) {
    const total = Math.max(Number(fila.pax_count) || 1, 1);
    const rellenos = Number(fila.viajeros_rellenos) || 0;
    const faltan = Number(fila.faltan_cuantos ?? Math.max(total - rellenos, 0));
    const yaMandado = fila.estado_envio === 'enviado';
    const conProblema = fila.estado_envio === 'error';

    // ¿Todavía no toca? Se les pide 7 días antes de que lleguen.
    const diasParaLlegar = Math.round(
        (aFecha(fila.check_in) - aFecha(hoy)) / 86400000,
    );
    const noTocaAun = rellenos === 0 && diasParaLlegar > DIAS_ANTES;

    if (yaMandado) {
        return {
            tono: 'verde', color: 'bg-rural-600', etiqueta: 'Listo',
            texto: fila.ultimo_envio
                ? `Parte mandado el ${fechaCorta(String(fila.ultimo_envio).slice(0, 10))}`
                : 'Parte mandado',
            mandado: true, listo: true, noTocaAun: false, faltan: 0, rellenos, total,
        };
    }
    if (conProblema) {
        return {
            tono: 'rojo', color: 'bg-red-500', etiqueta: 'Avisa a Jesús',
            texto: 'El parte no se pudo mandar. Avisa a Jesús.',
            mandado: false, listo: rellenos >= total, noTocaAun: false, faltan, rellenos, total,
        };
    }
    if (noTocaAun) {
        return {
            tono: 'neutro', color: 'bg-gray-300', etiqueta: 'Todavía no toca',
            texto: 'Todavía no toca',
            mandado: false, listo: false, noTocaAun: true, faltan, rellenos, total,
        };
    }
    if (faltan <= 0 && rellenos > 0) {
        return {
            tono: 'verde', color: 'bg-rural-600', etiqueta: 'Listo',
            texto: 'Todos han rellenado sus datos',
            mandado: false, listo: true, noTocaAun: false, faltan: 0, rellenos, total,
        };
    }
    if (rellenos === 0) {
        return {
            tono: 'ambar', color: 'bg-amber-500', etiqueta: `Faltan ${total} de ${total}`,
            texto: total === 1 ? 'No ha rellenado sus datos' : 'Nadie ha rellenado sus datos',
            mandado: false, listo: false, noTocaAun: false, faltan, rellenos, total,
        };
    }
    return {
        tono: 'ambar', color: 'bg-amber-500', etiqueta: `Faltan ${faltan} de ${total}`,
        texto: `Faltan ${faltan} de ${total}`,
        mandado: false, listo: false, noTocaAun: false, faltan, rellenos, total,
    };
}

// ---------------------------------------------------------------- recados

// El arreglo del teléfono, el enlace del formulario y el texto del recado
// viven en `checkin/datos.js`: los usan esta pantalla y la del check-in.
// Tenerlos escritos dos veces era la forma segura de que un día dijeran
// cosas distintas.

// ---------------------------------------------------------------- pantalla

const ParteViajerosPanel = ({ ir, params = {} }) => {
    const [filas, setFilas] = useState(null);
    const [contactos, setContactos] = useState({});
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(null);   // booking_id en marcha
    const [mensaje, setMensaje] = useState(null);   // { tono, titulo, texto }
    const [preparados, setPreparados] = useState({}); // booking_id → true
    const hoy = hoyISO();
    const destacada = params?.reservaId ? Number(params.reservaId) : null;
    const refDestacada = useRef(null);

    const cargar = useCallback(async () => {
        setError(null);
        // Dias de calendario, no 24 h: sumando milisegundos, el cambio de hora
        // corre el limite un dia y una reserva del borde se queda fuera.
        const f = aFecha(hoy);
        const limite = aISO(new Date(f.getFullYear(), f.getMonth(), f.getDate() + HORIZONTE_DIAS));

        const { data, error: err } = await supabase
            .from('v_parte_estado')
            .select('*')
            .lte('check_in', limite)
            .gte('check_out', hoy)
            .order('check_in', { ascending: true });

        if (err) {
            setError('No hemos podido abrir la lista. Prueba a actualizar dentro de un momento.');
            setFilas([]);
            return;
        }
        const lista = data || [];
        setFilas(lista);

        // Teléfono y correo para poder recordárselo. Salen de la reserva,
        // no del parte: aquí no se toca ningún dato de documento.
        if (lista.length > 0) {
            const { data: reservas } = await supabase
                .from('guest_bookings')
                .select('id, guest_phone, guest_email')
                .in('id', lista.map((f) => f.booking_id));
            const mapa = {};
            (reservas || []).forEach((r) => { mapa[r.id] = r; });
            setContactos(mapa);
        }
    }, [hoy]);

    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => {
        if (destacada && refDestacada.current) {
            refDestacada.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, [destacada, filas]);

    const grupos = useMemo(() => {
        if (!filas) return null;
        const dentro = [], pronto = [], luego = [];
        const limitePronto = aISO(new Date(aFecha(hoy).getTime() + 14 * 86400000));
        filas.forEach((f) => {
            if (f.check_in <= hoy) dentro.push(f);
            else if (f.check_in <= limitePronto) pronto.push(f);
            else luego.push(f);
        });
        return { dentro, pronto, luego };
    }, [filas, hoy]);

    // ---------------------------------------------------------- acciones

    const llamarFuncion = async (cuerpo) => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(URL_FUNCION, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                authorization: `Bearer ${session?.access_token || ''}`,
            },
            body: JSON.stringify(cuerpo),
        });
        const texto = await res.text();
        let cuerpoRes = {};
        try { cuerpoRes = JSON.parse(texto); } catch { /* respuesta rara */ }
        if (!res.ok) throw new Error(cuerpoRes?.mensaje || 'No ha salido bien');
        return cuerpoRes;
    };

    const descargar = (documento) => {
        if (!documento?.base64) return;
        const bytes = Uint8Array.from(atob(documento.base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: documento.tipo || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = documento.nombre || 'hoja-de-registro.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    };

    const mandarParte = async (fila) => {
        setOcupado(fila.booking_id);
        setMensaje(null);
        try {
            const r = await llamarFuncion({ accion: 'mandar', booking_id: fila.booking_id });
            if (r.estado === 'mandado') {
                setMensaje({
                    tono: 'bien',
                    titulo: `Parte de ${fila.guest_name || 'la reserva'} mandado`,
                    texto: 'Ya está. No tienes que hacer nada más.',
                });
                await cargar();
            } else if (r.estado === 'preparado') {
                descargar(r.documento);
                setPreparados((p) => ({ ...p, [fila.booking_id]: true }));
                setMensaje({
                    tono: 'info',
                    titulo: 'Te lo he preparado en un papel',
                    texto: 'Se te acaba de descargar la hoja con los datos de la reserva. Mándala como la mandas siempre y, cuando lo hayas hecho, dale a «Ya lo he mandado».',
                });
            } else {
                setMensaje({
                    tono: 'atencion',
                    titulo: 'No se ha podido mandar',
                    texto: r.mensaje || 'Vuelve a probar en un rato. Si sigue igual, avisa a Jesús.',
                });
            }
        } catch (e) {
            setMensaje({
                tono: 'atencion',
                titulo: 'No se ha podido mandar',
                texto: `${e.message}. Si sigue igual, avisa a Jesús.`,
            });
        } finally {
            setOcupado(null);
        }
    };

    const confirmarMandado = async (fila) => {
        setOcupado(fila.booking_id);
        try {
            await llamarFuncion({ accion: 'ya-lo-he-mandado', booking_id: fila.booking_id });
            setPreparados((p) => ({ ...p, [fila.booking_id]: false }));
            setMensaje({
                tono: 'bien',
                titulo: 'Apuntado',
                texto: `Queda guardado que mandaste el parte hoy, ${fechaEnPalabras(hoy)}.`,
            });
            await cargar();
        } catch (e) {
            setMensaje({ tono: 'atencion', titulo: 'No se ha podido apuntar', texto: e.message });
        } finally {
            setOcupado(null);
        }
    };

    const verDocumento = async (fila) => {
        setOcupado(fila.booking_id);
        try {
            const r = await llamarFuncion({ accion: 'documento', booking_id: fila.booking_id });
            descargar(r.documento);
        } catch (e) {
            setMensaje({ tono: 'atencion', titulo: 'No se ha podido abrir el papel', texto: e.message });
        } finally {
            setOcupado(null);
        }
    };

    // ---------------------------------------------------------- pintado

    if (filas === null) return <Cargando texto="Mirando quién ha rellenado…" />;

    const hayAlgo = filas.length > 0;

    return (
        <div className="max-w-3xl">
            <header className="mb-5">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary">
                    Datos de la policía
                </h1>
                <p className="text-base text-gray-600 mt-1 leading-relaxed">
                    Cada persona que se aloja tiene que dejarnos sus datos. Aquí ves quién los
                    ha rellenado y quién no, y desde cada reserva puedes <strong>hacer el
                    check-in</strong> con el huésped delante.
                </p>
            </header>

            {mensaje && (
                <Aviso
                    className="mb-5"
                    tono={mensaje.tono}
                    titulo={mensaje.titulo}
                    texto={mensaje.texto}
                />
            )}

            {error && <Aviso className="mb-5" tono="atencion" titulo={error} />}

            <div className="mb-6">
                <Boton variante="suave" icono={RefreshCw} onClick={cargar}>Actualizar</Boton>
            </div>

            {!hayAlgo ? (
                <Vacio
                    icono={Shield}
                    mensaje={`No hay nadie alojado ni que llegue en los próximos ${HORIZONTE_DIAS} días. Las reservas más lejanas aparecen aquí solas cuando se acerca la fecha.`}
                />
            ) : (
                <>
                    <Grupo titulo="Están aquí ahora" filas={grupos.dentro} vacio="Ahora mismo no hay nadie alojado."
                        {...{ ir, hoy, contactos, ocupado, preparados, destacada, refDestacada, mandarParte, confirmarMandado, verDocumento }} />
                    <Grupo titulo="Llegan en los próximos días" filas={grupos.pronto} vacio="Nadie llega esta quincena."
                        {...{ ir, hoy, contactos, ocupado, preparados, destacada, refDestacada, mandarParte, confirmarMandado, verDocumento }} />
                    <Grupo titulo="Más adelante" filas={grupos.luego} vacio={null}
                        {...{ ir, hoy, contactos, ocupado, preparados, destacada, refDestacada, mandarParte, confirmarMandado, verDocumento }} />
                </>
            )}
        </div>
    );
};

const Grupo = ({ titulo, filas, vacio, ...resto }) => {
    if (!filas || (filas.length === 0 && !vacio)) return null;
    return (
        <section className="mb-8">
            <h2 className="text-sm uppercase tracking-[0.15em] font-bold text-gray-500 mb-3">{titulo}</h2>
            {filas.length === 0 ? (
                <p className="text-base text-gray-500">{vacio}</p>
            ) : (
                <ul className="space-y-4">
                    {filas.map((f) => <li key={f.booking_id}><FilaReserva fila={f} {...resto} /></li>)}
                </ul>
            )}
        </section>
    );
};

const FilaReserva = ({
    fila, ir, hoy, contactos, ocupado, preparados, destacada, refDestacada,
    mandarParte, confirmarMandado, verDocumento,
}) => {
    const s = semaforoDe(fila, hoy);
    const contacto = contactos[fila.booking_id] || {};
    const tel = telefonoParaWhatsapp(contacto.guest_phone);
    const correo = contacto.guest_email;
    const enMarcha = ocupado === fila.booking_id;
    const esDestacada = destacada === fila.booking_id;
    const esperandoConfirmar = !!preparados[fila.booking_id];

    const abrirWhatsapp = () => {
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(textoRecordatorio(fila))}`,
            '_blank', 'noopener');
    };
    const abrirCorreo = () => {
        const asunto = 'Los datos que nos piden antes de tu llegada';
        window.location.href =
            `mailto:${encodeURIComponent(correo)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(textoRecordatorio(fila))}`;
    };

    return (
        <div
            ref={esDestacada ? refDestacada : null}
            className={`bg-white rounded-3xl border p-5 shadow-sm ${esDestacada ? 'border-rural-500 ring-4 ring-rural-600/15' : 'border-gray-200'}`}
        >
            {/* Quién y cuándo */}
            <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-4 w-4 rounded-full shrink-0 ${s.color}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-lg text-text-primary leading-snug break-words">
                        {fila.guest_name || 'Sin nombre'}
                    </p>
                    <p className="text-base text-gray-600">
                        {fila.apartment_name} · {s.total} {s.total === 1 ? 'persona' : 'personas'}
                    </p>
                    <p className="text-base text-gray-600">
                        {fila.check_in <= hoy ? 'Está dentro desde el' : 'Llega el'}{' '}
                        {fechaEnPalabras(fila.check_in)}
                    </p>
                </div>
            </div>

            {/* Semáforo: el color y, al lado, la palabra. Un vistazo basta. */}
            <div className="mt-3">
                <Chip tono={s.tono}>{s.etiqueta}</Chip>
            </div>
            <p className={`mt-2 text-base font-bold ${
                s.tono === 'verde' ? 'text-rural-700'
                : s.tono === 'ambar' ? 'text-amber-800'
                : s.tono === 'rojo' ? 'text-red-700' : 'text-gray-500'
            }`}>
                {s.texto}
            </p>
            {!s.mandado && !s.noTocaAun && s.rellenos > 0 && s.faltan > 0 && (
                <p className="text-sm text-gray-500 mt-0.5">
                    Han rellenado {s.rellenos} de {s.total}.
                </p>
            )}
            {s.noTocaAun && (
                <p className="text-sm text-gray-500 mt-0.5">
                    Se les pide una semana antes de llegar. Se lo mandamos nosotros por correo.
                </p>
            )}

            {/* Lo primero: hacer el check-in con el huésped delante */}
            {!s.mandado && (
                <div className="mt-4">
                    <Boton
                        icono={QrCode}
                        tamano="grande"
                        ancho
                        onClick={() => ir?.('checkin', { reservaId: fila.booking_id })}
                    >
                        Hacer el check-in
                    </Boton>
                    <p className="mt-1.5 text-sm text-gray-600 leading-snug">
                        Enséñale el código para que rellene en su móvil y comprueba su documento.
                    </p>
                </div>
            )}

            {/* Botones */}
            <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
                {!s.listo && !s.noTocaAun && (
                    <>
                        {tel && (
                            <Boton variante="secundario" icono={MessageCircle} onClick={abrirWhatsapp} ancho>
                                Recordárselo
                            </Boton>
                        )}
                        {correo && (
                            <Boton variante={tel ? 'suave' : 'secundario'} icono={Mail} onClick={abrirCorreo} ancho>
                                {tel ? 'Por correo' : 'Recordárselo por correo'}
                            </Boton>
                        )}
                        {!tel && !correo && (
                            <p className="text-sm text-gray-500">
                                No tenemos ni teléfono ni correo de esta reserva para avisarle.
                            </p>
                        )}
                    </>
                )}

                {esperandoConfirmar ? (
                    <Boton icono={Check} onClick={() => confirmarMandado(fila)} cargando={enMarcha} ancho>
                        Ya lo he mandado
                    </Boton>
                ) : s.mandado ? (
                    <Boton variante="suave" icono={FileDown} onClick={() => verDocumento(fila)} cargando={enMarcha} ancho>
                        Ver el papel
                    </Boton>
                ) : s.listo || s.rellenos > 0 ? (
                    <Boton icono={Send} onClick={() => mandarParte(fila)} cargando={enMarcha} ancho>
                        Mandar el parte
                    </Boton>
                ) : null}
            </div>

            {esperandoConfirmar && (
                <p className="mt-3 text-sm text-gray-600 flex items-start gap-1.5">
                    <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <span>Se te ha descargado la hoja. Mándala como siempre y luego dale al botón.</span>
                </p>
            )}

            {!s.mandado && s.listo && !esperandoConfirmar && (
                <p className="mt-3 text-sm text-gray-500">
                    Están todos. Ya se puede mandar el parte.
                </p>
            )}
        </div>
    );
};

export default ParteViajerosPanel;

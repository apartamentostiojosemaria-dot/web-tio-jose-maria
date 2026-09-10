// Edge function: submit-ses-hospedajes
// ====================================
// Las TRES comunicaciones del RD 933/2021, en una sola puerta:
//   · al RESERVAR → «reserva de hospedaje» (RH), art. 6.3.a, 24 h
//   · al ANULAR   → anulación (operación B), art. 6.3.a, 24 h
//   · al ENTRAR   → «parte de viajeros» (PV), art. 6.3.b, 24 h
//
// Acciones:
//   { }  ó  { accion: "tanda" }             → partes de viajeros pendientes
//   { accion: "barrido-reservas" }          → reservas y anulaciones pendientes
//   { accion: "reserva",   booking_id }     → comunica UNA reserva
//   { accion: "anulacion", booking_id }     → comunica UNA anulación
//   { accion: "mandar",    booking_id }     → manda el parte de una reserva
//   { accion: "documento", booking_id }     → hoja de registro en PDF
//   { accion: "ya-lo-he-mandado", booking_id }
//   { accion: "comprobar", booking_id }     → pregunta cómo quedó el lote
//   { accion: "estado",    booking_id }     → detalle técnico (panel de Jesús)
//   { accion: "libro", desde, hasta }       → libro-registro por fechas
//
// CON credenciales → arma el XML, lo comprime, lo manda, guarda el lote.
// SIN credenciales → MODO PREPARADO: genera el XML y el PDF, los guarda y deja
// el estado en «pendiente de alta». No marca nada como mandado.
// Nunca revienta por falta de secretos y nunca dice que ha mandado algo que no
// ha mandado. Secretos y detalle: `config.ts` y `docs/PARTE-VIAJEROS.md`.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
    ALTA_MINISTERIO, CUBO_LIBRO_REGISTRO, ESPERA_BARRIDO_MIN, ESTADO, ESTADO_SES,
    SECRETOS, hayCredenciales, secretosQueFaltan,
} from "./config.ts";
import {
    consultarLote, mandarAnulacion, mandarParte, mandarReserva,
    xmlAnulacion, xmlParteViajeros, xmlReservaHospedaje,
} from "./mir.ts";
import { renderHojaRegistro } from "./hoja-registro.ts";
import {
    aContrato, aViajero, enderezaParentescos, pegasDelParte,
    type ContratoParte, type FilaReserva, type FilaViajero, type ViajeroParte,
} from "./parte-modelo.ts";
import { aBase64 } from "./zip.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const ahora = () => new Date().toISOString();
const hoy = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Autorización
// ---------------------------------------------------------------------------
// Aquí se manejan documentos de identidad: sólo entra la propia
// infraestructura o alguien del equipo con sesión iniciada.
//
// ⚠️ Se despliega con `verify_jwt = false` (la pasarela no comprueba la firma,
// para que el cron pueda llamar con una llave que no es un JWT). Eso obliga a
// que la comprobación de aquí sea infalsificable: los dos caminos de «sistema»
// son comparaciones EXACTAS con secretos. Leer el claim `role` de un JWT sin
// verificar la firma sería un coladero.

type Quien = { ok: true; quien: string } | { ok: false; status: number; error: string };

/** Comparación en tiempo constante, para no filtrar la llave por el reloj. */
function igualSinPrisa(a: string, b: string): boolean {
    if (!a || !b || a.length !== b.length) return false;
    let dif = 0;
    for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return dif === 0;
}

async function autorizar(req: Request): Promise<Quien> {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return { ok: false, status: 401, error: "falta_token" };
    if (SERVICE_KEY && igualSinPrisa(token, SERVICE_KEY)) return { ok: true, quien: "sistema" };
    if (SECRETOS.llaveDeCron && igualSinPrisa(token, SECRETOS.llaveDeCron)) return { ok: true, quien: "cron" };

    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return { ok: false, status: 401, error: "token_no_valido" };
    const { data: perfil } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    const rol = (perfil as { role?: string } | null)?.role;
    if (!rol || !["admin", "staff"].includes(rol)) return { ok: false, status: 403, error: "sin_permiso" };
    return { ok: true, quien: `${rol}:${data.user.id}` };
}

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------

const CAMPOS_RESERVA = `id, booking_code, contract_reference, check_in, check_out,
    checkin_at, checkout_at, pax_count, created_at,
    payment_method, payment_type, payment_instrument, payment_holder,
    payment_expiry, payment_date,
    channel, guest_name, guest_email, guest_phone, status, apartment_id,
    reserva_comunicada_at, anulacion_comunicada_at,
    libro_registro_path, libro_registro_archivado_at,
    apartments(name, num_habitaciones, tiene_internet)`;

const CAMPOS_VIAJERO = `id, booking_id, is_titular, nombre, apellido_primero, apellido_segundo,
    sexo, tipo_documento, numero_documento, soporte_documento, nacionalidad, fecha_nacimiento,
    direccion_via, direccion_municipio, direccion_cp, direccion_pais,
    telefono_fijo, telefono_movil, email, parentesco, parentesco_menor_id, firma_base64,
    submitted_at, updated_at, mir_reference, mir_response_status, mir_response_payload`;

interface Grupo {
    reserva: FilaReserva & {
        status: string;
        reserva_comunicada_at: string | null;
        anulacion_comunicada_at: string | null;
        libro_registro_path: string | null;
        libro_registro_archivado_at: string | null;
    };
    filas: Array<FilaViajero & {
        submitted_at: string | null; updated_at: string | null;
        mir_response_status: string | null; mir_response_payload: Record<string, unknown> | null;
    }>;
    contrato: ContratoParte;
    viajeros: ViajeroParte[];
}

async function cargarGrupo(bookingId: number): Promise<Grupo | null> {
    const { data: reserva } = await sb
        .from("guest_bookings").select(CAMPOS_RESERVA).eq("id", bookingId).maybeSingle();
    if (!reserva) return null;

    const { data: filas } = await sb
        .from("traveler_records").select(CAMPOS_VIAJERO)
        .eq("booking_id", bookingId)
        .order("is_titular", { ascending: false })
        .order("created_at", { ascending: true });

    const lista = (filas || []) as unknown as Grupo["filas"];
    const r = reserva as unknown as Grupo["reserva"];
    // `enderezaParentescos` es la tercera red por si alguna fila entró por otra
    // puerta con el parentesco en la ficha del menor. No toca la base.
    const viajeros = enderezaParentescos(lista.map((f) => aViajero(f, r.check_in)));
    return { reserva: r, filas: lista, contrato: aContrato(r, viajeros.length), viajeros };
}

/** Reservas con viajeros que todavía no se han comunicado y ya han entrado. */
async function reservasPendientes(): Promise<number[]> {
    const { data } = await sb
        .from("traveler_records")
        .select("booking_id, guest_bookings!inner(id, check_in, status)")
        .is("submitted_at", null)
        .lte("guest_bookings.check_in", hoy())
        .in("guest_bookings.status", ["confirmed", "completed"]);
    const ids = new Set<number>();
    (data || []).forEach((f) => ids.add((f as { booking_id: number }).booking_id));
    return [...ids];
}

// ---------------------------------------------------------------------------
// Estado del PARTE (traveler_records)
// ---------------------------------------------------------------------------

function conHistorial(
    anterior: Record<string, unknown> | null | undefined,
    entrada: Record<string, unknown>,
): Record<string, unknown>[] {
    const previo = Array.isArray(anterior?.historial) ? anterior!.historial as Record<string, unknown>[] : [];
    return [...previo.slice(-19), { cuando: ahora(), ...entrada }];
}

async function anotar(grupo: Grupo, cambios: {
    estado: string;
    referencia?: string | null;
    enviado?: boolean;
    payload: Record<string, unknown>;
}) {
    const ids = grupo.filas.map((f) => f.id);
    if (ids.length === 0) return;
    const base = grupo.filas[0]?.mir_response_payload ?? null;

    // Lo que se mandó (`xml`) y lo que contestó el MIR (`lote`, `acuse`) son
    // la trazabilidad del parte y no se pueden perder al cambiar de estado.
    // El resto describe la situación de ahora y sí se renueva.
    const previo = (base ?? {}) as Record<string, unknown>;
    const pegajosos: Record<string, unknown> = {};
    for (const clave of ["xml", "preparado_en", "lote", "acuse", "libro_registro"]) {
        if (previo[clave] !== undefined && cambios.payload[clave] === undefined) {
            pegajosos[clave] = previo[clave];
        }
    }

    const fila: Record<string, unknown> = {
        mir_response_status: cambios.estado,
        mir_response_payload: {
            ...pegajosos, ...cambios.payload,
            historial: conHistorial(base, { estado: cambios.estado, nota: cambios.payload.mensaje ?? null }),
        },
        updated_at: ahora(),
    };
    if (cambios.referencia !== undefined) fila.mir_reference = cambios.referencia;
    if (cambios.enviado === true) fila.submitted_at = ahora();
    if (cambios.enviado === false) fila.submitted_at = null;
    await sb.from("traveler_records").update(fila).in("id", ids);
}

// ---------------------------------------------------------------------------
// Estado de la RESERVA / ANULACIÓN (ses_comunicaciones)
// ---------------------------------------------------------------------------

interface FilaComunicacion {
    id: string;
    booking_id: number;
    tipo: string;
    estado: string;
    intentos: number;
    proximo_intento_at: string | null;
    lote: string | null;
    codigos_comunicacion: string[] | null;
    mensaje: string | null;
}

async function leerComunicacion(bookingId: number, tipo: "reserva" | "anulacion"): Promise<FilaComunicacion | null> {
    const { data } = await sb
        .from("ses_comunicaciones")
        .select("id, booking_id, tipo, estado, intentos, proximo_intento_at, lote, codigos_comunicacion, mensaje")
        .eq("booking_id", bookingId).eq("tipo", tipo).maybeSingle();
    return (data as unknown as FilaComunicacion) ?? null;
}

/**
 * Apunta cómo ha ido un intento y cuándo toca el siguiente. La espera crece
 * con los fallos para no machacar un servicio caído, sin salirse de las 24 h
 * de plazo porque el barrido corre cada hora.
 */
async function anotarComunicacion(
    bookingId: number,
    tipo: "reserva" | "anulacion",
    cambios: {
        estado: string; mensaje: string; intentos: number;
        lote?: string | null; codigos?: string[]; xml?: string;
        acuse?: string | null; reintentar?: boolean;
    },
) {
    const minutos = ESPERA_BARRIDO_MIN[
        Math.min(Math.max(cambios.intentos - 1, 0), ESPERA_BARRIDO_MIN.length - 1)
    ];
    const fila: Record<string, unknown> = {
        booking_id: bookingId,
        tipo,
        estado: cambios.estado,
        intentos: cambios.intentos,
        ultimo_intento_at: ahora(),
        proximo_intento_at: cambios.reintentar
            ? new Date(Date.now() + minutos * 60_000).toISOString()
            : null,
        mensaje: cambios.mensaje,
        updated_at: ahora(),
    };
    if (cambios.lote !== undefined) fila.lote = cambios.lote;
    if (cambios.codigos !== undefined) fila.codigos_comunicacion = cambios.codigos;
    if (cambios.xml !== undefined) fila.xml = cambios.xml;
    if (cambios.acuse !== undefined) fila.acuse = cambios.acuse;

    await sb.from("ses_comunicaciones").upsert(fila, { onConflict: "booking_id,tipo" });
}

// ---------------------------------------------------------------------------
// El libro-registro: archivar el PDF firmado
// ---------------------------------------------------------------------------
// La Orden INT/1922/2003 obliga a CONFECCIONARLO y a EXHIBIRLO. Un PDF que se
// regenera bajo demanda no cumple: si el día que lo piden la función está
// caída o la maqueta ha cambiado, lo que se enseña no es lo que se firmó.
// Se guarda con `upsert` a propósito: el libro tiene que reflejar lo ÚLTIMO
// que se comunicó, no el primer intento.

async function archivarLibroRegistro(grupo: Grupo): Promise<{ ok: boolean; ruta?: string; error?: string }> {
    try {
        // Si ya está archivado y ninguna ficha se ha tocado desde entonces, no
        // se vuelve a subir: el fichero no cambiaría y su fecha es la que
        // cuenta los tres años de conservación.
        const archivado = grupo.reserva.libro_registro_archivado_at;
        if (archivado && grupo.reserva.libro_registro_path) {
            const tocadoDespues = grupo.filas.some(
                (f) => f.updated_at && new Date(f.updated_at) > new Date(archivado));
            if (!tocadoDespues) return { ok: true, ruta: grupo.reserva.libro_registro_path };
        }

        const fecha = String(grupo.reserva.check_in).slice(0, 10);
        const ruta = `${fecha.slice(0, 4)}/${fecha}-${grupo.reserva.booking_code}.pdf`;
        const bytes = await renderHojaRegistro({
            contrato: grupo.contrato,
            viajeros: grupo.viajeros,
            nota: `Libro-registro archivado el ${hoy()} · Orden INT/1922/2003, apartado segundo.`,
        });

        const { error } = await sb.storage
            .from(CUBO_LIBRO_REGISTRO)
            .upload(ruta, bytes, { contentType: "application/pdf", upsert: true });
        if (error) return { ok: false, error: error.message };

        await sb.from("guest_bookings").update({
            libro_registro_path: ruta,
            libro_registro_archivado_at: ahora(),
            updated_at: ahora(),
        }).eq("id", grupo.reserva.id);

        return { ok: true, ruta };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}

// ---------------------------------------------------------------------------
// Acciones — parte de viajeros
// ---------------------------------------------------------------------------

interface Salida {
    estado: "mandado" | "preparado" | "faltan" | "error" | "sin_datos" | "no_procede";
    mensaje: string;
    documento?: { nombre: string; tipo: string; base64: string };
    detalle?: Record<string, unknown>;
}

async function pdfDe(grupo: Grupo, nota: string | null) {
    const bytes = await renderHojaRegistro({ contrato: grupo.contrato, viajeros: grupo.viajeros, nota });
    return {
        nombre: `hoja-de-registro-${grupo.reserva.booking_code}.pdf`,
        tipo: "application/pdf",
        base64: aBase64(bytes),
    };
}

/**
 * Manda (o prepara) el parte de una reserva. `conDocumento` sólo cuando lo ha
 * pedido alguien desde una pantalla; el libro-registro se archiva siempre.
 */
async function accionMandar(grupo: Grupo, conDocumento = true): Promise<Salida> {
    if (grupo.viajeros.length === 0) {
        return { estado: "sin_datos", mensaje: "Todavía no ha rellenado sus datos nadie de esta reserva." };
    }

    const yaComunicado = grupo.filas.some((f) => f.submitted_at);
    const pegas = pegasDelParte(grupo.viajeros);
    if (pegas.length > 0) {
        const resumen = pegas.slice(0, 4).map((p) => `${p.viajero}: falta ${p.falta}`).join(" · ");
        // Un parte ya comunicado no vuelve atrás: se avisa y punto.
        if (!yaComunicado) {
            await anotar(grupo, { estado: "faltan_datos", payload: { mensaje: resumen, pegas } });
        }
        return { estado: "faltan", mensaje: `No se puede mandar todavía. ${resumen}.`, detalle: { pegas } };
    }

    // El libro se archiva en cuanto el parte está completo y firmado, haya o no
    // credenciales: confeccionarlo es obligación del alojamiento y no depende
    // de que el Ministerio conteste.
    const libro = await archivarLibroRegistro(grupo);
    const rastroLibro = libro.ok ? libro.ruta : `no se pudo archivar: ${libro.error}`;

    if (!hayCredenciales()) {
        const xml = xmlParteViajeros({
            codigoEstablecimiento: SECRETOS.establecimiento || "PENDIENTE-DE-ALTA",
            contrato: grupo.contrato,
            viajeros: grupo.viajeros,
        });
        const documento = conDocumento
            ? await pdfDe(grupo, "Documento generado por el sistema del alojamiento. Pendiente de comunicación por el servicio web del Ministerio del Interior.")
            : undefined;
        await anotar(grupo, {
            estado: ESTADO.PENDIENTE_DE_ALTA,
            enviado: false,
            payload: {
                mensaje: "Documento preparado. Faltan credenciales del servicio web.",
                faltan_secretos: secretosQueFaltan(),
                xml, preparado_en: ahora(), libro_registro: rastroLibro,
            },
        });
        return {
            estado: "preparado",
            mensaje: "Te he preparado la hoja de registro para que la mandes como siempre.",
            documento,
            detalle: { libro_registro: libro.ok ? libro.ruta : null },
        };
    }

    const resultado = await mandarParte({
        codigoEstablecimiento: SECRETOS.establecimiento,
        contrato: grupo.contrato,
        viajeros: grupo.viajeros,
    });

    if (resultado.ok) {
        await anotar(grupo, {
            estado: ESTADO.EN_CURSO,
            enviado: true,
            referencia: resultado.respuesta?.lote ?? null,
            payload: {
                mensaje: resultado.mensaje,
                lote: resultado.respuesta?.lote ?? null,
                codigo: resultado.respuesta?.codigo ?? null,
                acuse: resultado.respuesta?.crudo ?? null,
                intentos: resultado.intentos,
                xml: resultado.xmlEnviado,
                libro_registro: rastroLibro,
            },
        });
        return { estado: "mandado", mensaje: "Parte mandado." };
    }

    await anotar(grupo, {
        estado: resultado.definitivo ? ESTADO.RECHAZADO : ESTADO.REINTENTAR,
        enviado: false,
        payload: {
            mensaje: resultado.mensaje,
            resultado: resultado.definitivo ? "rechazado" : "sin_respuesta",
            codigo: resultado.respuesta?.codigo ?? null,
            acuse: resultado.respuesta?.crudo ?? null,
            intentos: resultado.intentos,
            xml: resultado.xmlEnviado,
            libro_registro: rastroLibro,
        },
    });
    return { estado: "error", mensaje: resultado.mensaje };
}

async function accionYaLoHeMandado(grupo: Grupo, quien: string): Promise<Salida> {
    if (grupo.filas.length === 0) {
        return { estado: "sin_datos", mensaje: "No hay datos de viajeros en esta reserva." };
    }
    await anotar(grupo, {
        estado: ESTADO.MANDADO_A_MANO,
        enviado: true,
        payload: { mensaje: "Mandado por el alojamiento por su vía habitual", por: quien },
    });
    return { estado: "mandado", mensaje: "Queda apuntado como mandado." };
}

async function accionComprobar(grupo: Grupo): Promise<Salida> {
    const lote = grupo.filas[0]?.mir_reference;
    if (!lote) return { estado: "sin_datos", mensaje: "Esta reserva no tiene ningún lote que comprobar." };
    if (!hayCredenciales()) return { estado: "error", mensaje: "Sin credenciales no se puede comprobar." };

    const r = await consultarLote(String(lote));
    if (!r.consultado) {
        return { estado: "error", mensaje: "No se ha podido consultar el lote.", detalle: { errores: r.errores } };
    }
    if (r.aceptado === true) {
        await anotar(grupo, {
            estado: ESTADO.ACEPTADO, enviado: true,
            payload: { mensaje: "Aceptado", lote, comunicaciones: r.codigosComunicacion, acuse: r.crudo },
        });
        return { estado: "mandado", mensaje: "El Ministerio lo ha aceptado.", detalle: { comunicaciones: r.codigosComunicacion } };
    }
    if (r.aceptado === false) {
        await anotar(grupo, {
            estado: ESTADO.RECHAZADO, enviado: false,
            payload: { mensaje: r.errores.join(" · "), resultado: "rechazado", lote, acuse: r.crudo },
        });
        return { estado: "error", mensaje: `Rechazado: ${r.errores.join(" · ")}` };
    }
    return { estado: "mandado", mensaje: "El lote sigue en proceso. Vuelve a comprobarlo más tarde." };
}

// ---------------------------------------------------------------------------
// Acciones — RESERVA y ANULACIÓN (art. 6.3.a)
// ---------------------------------------------------------------------------

async function accionReserva(grupo: Grupo): Promise<Salida> {
    const r = grupo.reserva;
    if (r.reserva_comunicada_at) return { estado: "mandado", mensaje: "Esta reserva ya estaba comunicada." };
    if (!["confirmed", "completed"].includes(r.status)) {
        return { estado: "no_procede", mensaje: `La reserva está en «${r.status}»: sólo se comunican las confirmadas.` };
    }

    const previo = await leerComunicacion(r.id, "reserva");
    const intentos = (previo?.intentos ?? 0) + 1;

    // El titular del contrato es el único bloque `persona` obligatorio de la
    // plantilla de reserva y necesita nombre y primer apellido. Si `guest_name`
    // no da para separarlos NO se inventa un apellido en una comunicación
    // policial: se dice qué falta.
    if (!grupo.contrato.titularContrato.completo) {
        const mensaje = "Falta el apellido del titular de la reserva: sólo hay una palabra en el nombre.";
        await anotarComunicacion(r.id, "reserva", {
            estado: ESTADO_SES.REINTENTAR, mensaje, intentos, reintentar: false,
        });
        return { estado: "faltan", mensaje };
    }

    if (!hayCredenciales()) {
        const xml = xmlReservaHospedaje({
            codigoEstablecimiento: SECRETOS.establecimiento || "PENDIENTE-DE-ALTA",
            contrato: grupo.contrato,
        });
        await anotarComunicacion(r.id, "reserva", {
            estado: ESTADO_SES.PENDIENTE_DE_ALTA,
            mensaje: `Documento preparado. Faltan credenciales: ${secretosQueFaltan().join(", ")}.`,
            intentos, xml, reintentar: false,      // esperar no trae credenciales
        });
        return {
            estado: "preparado",
            mensaje: "Comunicación de reserva preparada. Falta el alta en el Ministerio para poder mandarla.",
        };
    }

    const envio = await mandarReserva({
        codigoEstablecimiento: SECRETOS.establecimiento,
        contrato: grupo.contrato,
    });

    if (envio.ok) {
        await anotarComunicacion(r.id, "reserva", {
            estado: ESTADO_SES.EN_CURSO, mensaje: envio.mensaje, intentos,
            lote: envio.respuesta?.lote ?? null, xml: envio.xmlEnviado,
            acuse: envio.respuesta?.crudo ?? null, reintentar: false,
        });
        await sb.from("guest_bookings")
            .update({ reserva_comunicada_at: ahora(), updated_at: ahora() }).eq("id", r.id);
        return { estado: "mandado", mensaje: `Reserva comunicada. ${envio.mensaje}` };
    }

    await anotarComunicacion(r.id, "reserva", {
        estado: envio.definitivo ? ESTADO_SES.RECHAZADO : ESTADO_SES.REINTENTAR,
        mensaje: envio.mensaje, intentos, xml: envio.xmlEnviado,
        acuse: envio.respuesta?.crudo ?? null, reintentar: !envio.definitivo,
    });
    return { estado: "error", mensaje: envio.mensaje };
}

async function accionAnulacion(grupo: Grupo): Promise<Salida> {
    const r = grupo.reserva;
    if (r.anulacion_comunicada_at) return { estado: "mandado", mensaje: "Esta anulación ya estaba comunicada." };
    if (r.status !== "cancelled") return { estado: "no_procede", mensaje: "La reserva no está cancelada." };

    // Si el Ministerio nunca vio la reserva no hay nada que anular. Mandar la
    // baja de algo inexistente sólo gana un rechazo y ensucia el historial.
    if (!r.reserva_comunicada_at) {
        await anotarComunicacion(r.id, "anulacion", {
            estado: ESTADO_SES.NO_PROCEDE,
            mensaje: "La reserva nunca llegó a comunicarse al Ministerio: no hay nada que anular.",
            intentos: 0, reintentar: false,
        });
        await sb.from("guest_bookings")
            .update({ anulacion_comunicada_at: ahora(), updated_at: ahora() }).eq("id", r.id);
        return { estado: "no_procede", mensaje: "No procede: la reserva nunca se comunicó." };
    }

    const dela = await leerComunicacion(r.id, "reserva");
    const previo = await leerComunicacion(r.id, "anulacion");
    const intentos = (previo?.intentos ?? 0) + 1;

    if (!hayCredenciales()) {
        await anotarComunicacion(r.id, "anulacion", {
            estado: ESTADO_SES.PENDIENTE_DE_ALTA,
            mensaje: `Anulación preparada. Faltan credenciales: ${secretosQueFaltan().join(", ")}.`,
            intentos, xml: xmlAnulacion(dela?.codigos_comunicacion ?? ["PENDIENTE-DE-ALTA"]),
            reintentar: false,
        });
        return { estado: "preparado", mensaje: "Anulación preparada. Falta el alta en el Ministerio." };
    }

    // Para anular hacen falta los códigos de comunicación de la reserva. Si no
    // se guardaron, se piden ahora consultando su lote: es la única vía.
    let codigos = dela?.codigos_comunicacion ?? [];
    if (codigos.length === 0 && dela?.lote) {
        const consulta = await consultarLote(String(dela.lote));
        if (consulta.consultado && consulta.codigosComunicacion.length > 0) {
            codigos = consulta.codigosComunicacion;
            await sb.from("ses_comunicaciones")
                .update({ codigos_comunicacion: codigos, updated_at: ahora() })
                .eq("booking_id", r.id).eq("tipo", "reserva");
        }
    }
    if (codigos.length === 0) {
        const mensaje = "No hay códigos de comunicación de la reserva: sin ellos el Ministerio no sabe qué anular. "
            + "El lote todavía puede estar en proceso; se reintenta.";
        await anotarComunicacion(r.id, "anulacion", {
            estado: ESTADO_SES.REINTENTAR, mensaje, intentos, reintentar: true,
        });
        return { estado: "error", mensaje };
    }

    const envio = await mandarAnulacion(codigos);
    if (envio.ok) {
        await anotarComunicacion(r.id, "anulacion", {
            estado: ESTADO_SES.EN_CURSO, mensaje: envio.mensaje, intentos,
            lote: envio.respuesta?.lote ?? null, codigos, xml: envio.xmlEnviado,
            acuse: envio.respuesta?.crudo ?? null, reintentar: false,
        });
        await sb.from("guest_bookings")
            .update({ anulacion_comunicada_at: ahora(), updated_at: ahora() }).eq("id", r.id);
        return { estado: "mandado", mensaje: `Anulación comunicada. ${envio.mensaje}` };
    }

    await anotarComunicacion(r.id, "anulacion", {
        estado: envio.definitivo ? ESTADO_SES.RECHAZADO : ESTADO_SES.REINTENTAR,
        mensaje: envio.mensaje, intentos, codigos, xml: envio.xmlEnviado,
        acuse: envio.respuesta?.crudo ?? null, reintentar: !envio.definitivo,
    });
    return { estado: "error", mensaje: envio.mensaje };
}

// ---------------------------------------------------------------------------
// Barrido de reservas y anulaciones
// ---------------------------------------------------------------------------
// Lee `tjm_ses_pendientes()` (migración 0010), que es la ÚNICA definición de
// «qué está sin comunicar». El panel lee la misma. Si se dedujera aquí dentro
// y allí en SQL, acabarían discrepando.

async function barridoReservas(): Promise<Record<string, unknown>> {
    const { data, error } = await sb.rpc("tjm_ses_pendientes");
    if (error) return { error: error.message, pendientes: 0 };

    const pendientes = (data || []) as Array<{
        booking_id: number; booking_code: string; tipo: string;
        estado: string; intentos: number; fuera_de_plazo: boolean;
    }>;

    const detalles: Array<Record<string, unknown>> = [];
    let mandadas = 0, preparadas = 0, fallos = 0, saltadas = 0;

    for (const p of pendientes) {
        const fila = await leerComunicacion(p.booking_id, p.tipo as "reserva" | "anulacion");

        // Respeta la espera creciente: lo que acaba de fallar no se reintenta
        // en la pasada siguiente.
        if (fila?.proximo_intento_at && new Date(fila.proximo_intento_at) > new Date()) {
            saltadas++; continue;
        }
        // Sin credenciales el documento ya está preparado, y volver a
        // prepararlo cada hora no lo acerca al Ministerio: lo que falta no es
        // un reintento, es un trámite.
        if (fila?.estado === ESTADO_SES.PENDIENTE_DE_ALTA && !hayCredenciales()) {
            saltadas++; continue;
        }

        const grupo = await cargarGrupo(p.booking_id);
        if (!grupo) continue;

        try {
            const r = p.tipo === "anulacion" ? await accionAnulacion(grupo) : await accionReserva(grupo);
            if (r.estado === "mandado") mandadas++;
            else if (r.estado === "preparado") preparadas++;
            else if (r.estado === "no_procede") saltadas++;
            else fallos++;
            detalles.push({
                reserva: p.booking_code, tipo: p.tipo, estado: r.estado,
                mensaje: r.mensaje, fuera_de_plazo: p.fuera_de_plazo,
            });
        } catch (e) {
            fallos++;
            const msg = e instanceof Error ? e.message : String(e);
            await anotarComunicacion(p.booking_id, p.tipo as "reserva" | "anulacion", {
                estado: ESTADO_SES.REINTENTAR, mensaje: msg,
                intentos: (fila?.intentos ?? 0) + 1, reintentar: true,
            });
            detalles.push({ reserva: p.booking_code, tipo: p.tipo, estado: "error", mensaje: msg });
        }
    }

    return {
        pendientes: pendientes.length, mandadas, preparadas, fallos, saltadas,
        fuera_de_plazo: pendientes.filter((p) => p.fuera_de_plazo).length,
        credenciales: hayCredenciales(),
        faltan_secretos: secretosQueFaltan(),
        detalles: detalles.slice(0, 30),
    };
}

// ---------------------------------------------------------------------------
// Puerta
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return json(405, { error: "metodo_no_permitido" });

    const permiso = await autorizar(req);
    if (!permiso.ok) return json(permiso.status, { error: permiso.error, mensaje: "No tienes permiso para esto." });

    let cuerpo: Record<string, unknown> = {};
    try { cuerpo = await req.json(); } catch { cuerpo = {}; }

    const accion = String(cuerpo.accion ?? cuerpo.action ?? "").trim() || "tanda";
    const bookingId = Number(cuerpo.booking_id ?? cuerpo.bookingId ?? 0) || 0;

    // ---- Tanda del PARTE (cron `tjm-parte-viajeros`) ----------------------
    if (accion === "tanda") {
        const ids = await reservasPendientes();
        const detalles: Array<{ reserva: string; estado: string; mensaje: string }> = [];
        let mandados = 0, preparados = 0, fallos = 0;

        for (const id of ids) {
            const grupo = await cargarGrupo(id);
            if (!grupo) continue;
            try {
                const r = await accionMandar(grupo, false);
                if (r.estado === "mandado") mandados++;
                else if (r.estado === "preparado") preparados++;
                else fallos++;
                detalles.push({ reserva: grupo.reserva.booking_code, estado: r.estado, mensaje: r.mensaje });
            } catch (e) {
                fallos++;
                const msg = e instanceof Error ? e.message : String(e);
                await anotar(grupo, { estado: ESTADO.REINTENTAR, enviado: false, payload: { mensaje: msg } });
                detalles.push({ reserva: grupo.reserva.booking_code, estado: "error", mensaje: msg });
            }
        }
        return json(200, {
            reservas: ids.length, mandados, preparados, fallos,
            credenciales: hayCredenciales(),
            faltan_secretos: secretosQueFaltan(),
            detalles: detalles.slice(0, 30),
        });
    }

    // ---- Barrido de reservas y anulaciones (cron `tjm-ses-reservas`) ------
    if (accion === "barrido-reservas") return json(200, await barridoReservas());

    // ---- Libro-registro por rango de fechas -------------------------------
    // Lo que se pide en una inspección: «enséñeme el libro de agosto».
    if (accion === "libro") {
        const desde = String(cuerpo.desde ?? "").slice(0, 10) || `${hoy().slice(0, 4)}-01-01`;
        const hasta = String(cuerpo.hasta ?? "").slice(0, 10) || hoy();
        const { data, error } = await sb.rpc("tjm_libro_registro", { p_desde: desde, p_hasta: hasta });
        if (error) return json(500, { error: "fallo_interno", mensaje: error.message });

        // URL firmadas de una hora, como en las facturas. El cubo es privado y
        // lo seguirá siendo: dentro hay documentos de identidad y firmas.
        const conUrl = await Promise.all(((data || []) as Array<Record<string, unknown>>).map(async (f) => {
            if (!f.ruta) return { ...f, url: null };
            const { data: firma } = await sb.storage
                .from(CUBO_LIBRO_REGISTRO).createSignedUrl(String(f.ruta), 3600);
            return { ...f, url: firma?.signedUrl ?? null };
        }));
        return json(200, {
            ok: true, desde, hasta,
            estancias: conUrl.length,
            sin_archivar: conUrl.filter((f) => !f.ruta).length,
            libro: conUrl,
        });
    }

    // ---- El resto son acciones sobre una reserva concreta ------------------
    if (!bookingId) return json(400, { error: "falta_booking_id", mensaje: "No sé de qué reserva hablas." });

    const grupo = await cargarGrupo(bookingId);
    if (!grupo) return json(404, { error: "reserva_no_encontrada", mensaje: "No encuentro esa reserva." });

    try {
        switch (accion) {
            case "mandar": return json(200, await accionMandar(grupo));
            case "reserva": return json(200, await accionReserva(grupo));
            case "anulacion": return json(200, await accionAnulacion(grupo));
            case "ya-lo-he-mandado": return json(200, await accionYaLoHeMandado(grupo, permiso.quien));
            case "comprobar": return json(200, await accionComprobar(grupo));

            case "documento": {
                if (grupo.viajeros.length === 0) {
                    return json(200, { estado: "sin_datos", mensaje: "Todavía no hay datos de viajeros." });
                }
                const enviado = grupo.filas.some((f) => f.submitted_at);
                const documento = await pdfDe(grupo, enviado
                    ? `Comunicado el ${String(grupo.filas.find((f) => f.submitted_at)?.submitted_at ?? "").slice(0, 10)}.`
                    : "Documento generado por el sistema del alojamiento. Pendiente de comunicación.");
                return json(200, { estado: "preparado", mensaje: "Documento listo.", documento });
            }

            case "estado": {
                const f = grupo.filas[0];
                const reserva = await leerComunicacion(bookingId, "reserva");
                const anulacion = await leerComunicacion(bookingId, "anulacion");
                return json(200, {
                    ok: true,
                    detalle: {
                        booking_code: grupo.reserva.booking_code,
                        viajeros: grupo.viajeros.length,
                        pax: grupo.reserva.pax_count,
                        pegas: pegasDelParte(grupo.viajeros),
                        // Parte de viajeros (art. 6.3.b)
                        mir_response_status: f?.mir_response_status ?? null,
                        submitted_at: f?.submitted_at ?? null,
                        lote: f?.mir_reference ?? null,
                        payload: f?.mir_response_payload ?? null,
                        // Reserva y anulación (art. 6.3.a)
                        reserva_comunicada_at: grupo.reserva.reserva_comunicada_at,
                        anulacion_comunicada_at: grupo.reserva.anulacion_comunicada_at,
                        comunicacion_reserva: reserva,
                        comunicacion_anulacion: anulacion,
                        // Libro-registro (Orden INT/1922/2003)
                        libro_registro: grupo.reserva.libro_registro_path,
                        // El contrato tal y como va a viajar, para verlo sin
                        // descifrar el XML.
                        contrato: {
                            referencia: grupo.contrato.referencia,
                            entrada: grupo.contrato.fechaEntrada,
                            salida: grupo.contrato.fechaSalida,
                            hora_entrada_conocida: grupo.contrato.horaEntradaConocida,
                            hora_salida_conocida: grupo.contrato.horaSalidaConocida,
                            habitaciones: grupo.contrato.numHabitaciones,
                            internet: grupo.contrato.conexionInternet,
                            pago: {
                                tipo: grupo.contrato.medioPago,
                                fecha: grupo.contrato.fechaPago,
                                medio: grupo.contrato.identificacionMedioPago,
                                titular: grupo.contrato.titularPago,
                                caducidad: grupo.contrato.caducidadTarjeta,
                            },
                        },
                        // Lo declarado en el alta previa (art. 6.1 y 6.2): se
                        // devuelve para que se vea y se note si deja de ser verdad.
                        alta_ministerio: ALTA_MINISTERIO,
                        credenciales: hayCredenciales(),
                        faltan_secretos: secretosQueFaltan(),
                    },
                });
            }

            default:
                return json(400, { error: "accion_desconocida", mensaje: `No sé hacer «${accion}».` });
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json(500, { estado: "error", error: "fallo_interno", mensaje: msg });
    }
});

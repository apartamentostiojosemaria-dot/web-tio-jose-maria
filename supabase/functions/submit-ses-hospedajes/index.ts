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
//   { accion: "acuses" }                    → pregunta por TODOS los lotes en espera
//   { accion: "prueba-aviso" }              → manda un aviso de prueba (móvil + buzón)
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
    SECRETOS, ZONA, cargarLlaveDeCron, cargarSecretos, hayCredenciales, secretosQueFaltan,
} from "./config.ts";
import {
    consultarLote, mandarAnulacion, mandarParte, mandarReserva,
    xmlAnulacion, xmlParteViajeros, xmlReservaHospedaje,
} from "./mir.ts";
import { renderHojaRegistro } from "./hoja-registro.ts";
import {
    aContrato, aViajero, completaTitularDesdeFicha, enderezaParentescos, heredaContactoMenores, pegasDelParte,
    type ContratoParte, type FilaReserva, type FilaViajero, type ViajeroParte,
} from "./parte-modelo.ts";
import { aBase64 } from "./zip.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Llave de los crones de la base: de Vault, una vez por arranque (ver config.ts).
await cargarSecretos(sb);                 // los cinco del MIR, de Vault si faltan
const LLAVE_CRON = await cargarLlaveDeCron(sb);

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
// Avisos: lo que el Ministerio rechaza o lo que falta para mandar NO se queda
// en un estado de la base que nadie mira. Va al móvil (push, migración 0041)
// y al buzón del negocio (Resend, el mismo remitente que los correos de la
// reserva). El 19-sep-2026 un rechazo se supo por el correo del MIR, un día
// después y de rebote; esto existe para que no vuelva a pasar.
// ---------------------------------------------------------------------------
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const BUZON_NEGOCIO = Deno.env.get("OPERATOR_NOTIFY_EMAIL") || "apartamentostiojosemaria@gmail.com";
const REMITENTE = "Tío José María <hola@tiojosemaria.com>";
const PANEL_URL = "https://tiojosemaria.com/panel";

const escHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function avisar(aviso: { titulo: string; texto: string; detalle?: string[]; url?: string }) {
    const url = aviso.url ?? PANEL_URL;
    const salida = { push: "no", correo: "no" };
    // Un aviso que falla no puede tumbar la comunicación al Ministerio.
    try {
        const ruta = url.replace(/^https?:\/\/[^/]+/, "") || "/panel";
        const { error } = await sb.rpc("tjm_notificar_push", { p_titulo: aviso.titulo, p_texto: aviso.texto, p_url: ruta });
        salida.push = error ? `error: ${error.message}` : "ok";
    } catch (e) {
        salida.push = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (!RESEND_API_KEY) { salida.correo = "sin RESEND_API_KEY"; return salida; }
    try {
        const lista = (aviso.detalle ?? []).map((d) => `<li>${escHtml(d)}</li>`).join("");
        const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2C3319;line-height:1.5">
<h2 style="font-weight:700;font-size:20px;margin:0 0 12px">${escHtml(aviso.titulo)}</h2>
<p>${escHtml(aviso.texto)}</p>
${lista ? `<ul style="padding-left:20px">${lista}</ul>` : ""}
<p><a href="${url}" style="color:#556B2F;font-weight:700">Abrir el panel</a></p>
<p style="font-size:12px;color:#8C8468">Aviso automático del sistema de Apartamentos Rurales Tío José María.</p></div>`;
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "content-type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({ from: REMITENTE, to: BUZON_NEGOCIO, subject: aviso.titulo, html }),
        });
        const cuerpo = (await res.text()).slice(0, 300);
        salida.correo = res.ok ? `ok ${cuerpo}` : `error ${res.status}: ${cuerpo}`;
        if (!res.ok) {
            await sb.from("envios").insert({
                canal: "correo", tipo: "aviso", destinatario: BUZON_NEGOCIO, asunto: aviso.titulo,
                estado: "error_api", detalle: `${res.status}: ${cuerpo}`,
            });
        }
    } catch (e) {
        salida.correo = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (salida.push !== "ok" || !salida.correo.startsWith("ok")) console.error("aviso:", JSON.stringify(salida));
    return salida;
}

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
//
// Los crones de la base (`tjm_disparar_ses`) llaman con `ses_cron_token`, que
// la función lee de Vault al arrancar (LLAVE_CRON). No dependen de la clave
// de servicio ni de ningún secreto copiado a mano.

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
    if (LLAVE_CRON && igualSinPrisa(token, LLAVE_CRON)) return { ok: true, quien: "cron" };

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
    channel, external_locator, guest_name, guest_email, guest_phone, status, apartment_id,
    reserva_comunicada_at, anulacion_comunicada_at, modificacion_pendiente_at, modificaciones_comunicadas,
    libro_registro_path, libro_registro_archivado_at,
    apartments(name, num_habitaciones, tiene_internet)`;

const CAMPOS_VIAJERO = `id, booking_id, is_titular, nombre, apellido_primero, apellido_segundo,
    sexo, tipo_documento, numero_documento, soporte_documento, nacionalidad, fecha_nacimiento,
    direccion_via, direccion_municipio, direccion_municipio_ine, direccion_cp, direccion_pais,
    telefono_fijo, telefono_movil, email, parentesco, parentesco_menor_id, firma_base64,
    submitted_at, updated_at, mir_reference, mir_response_status, mir_response_payload`;

interface Grupo {
    reserva: FilaReserva & {
        status: string;
        reserva_comunicada_at: string | null;
        anulacion_comunicada_at: string | null;
        libro_registro_path: string | null;
        libro_registro_archivado_at: string | null;
        external_locator?: string | null;
        modificacion_pendiente_at?: string | null;
        modificaciones_comunicadas?: number | null;
    };
    filas: Array<FilaViajero & {
        submitted_at: string | null; updated_at: string | null; mir_reference: string | null;
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
    const contrato = completaTitularDesdeFicha(aContrato(r, viajeros.length), viajeros);
    heredaContactoMenores(viajeros, contrato);
    return { reserva: r, filas: lista, contrato, viajeros };
}

/** Reservas con viajeros que todavía no se han comunicado y ya han entrado. */
async function reservasPendientes(): Promise<number[]> {
    const { data } = await sb
        .from("traveler_records")
        .select("booking_id, guest_bookings!inner(id, check_in, status, source)")
        .is("submitted_at", null)
        .lte("guest_bookings.check_in", hoy())
        .in("guest_bookings.status", ["confirmed", "completed"])
        // Una reserva de prueba nunca va al MIR (migración 0031).
        .neq("guest_bookings.source", "test");
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
    const pegas = pegasDelParte(grupo.viajeros, Number(grupo.reserva.pax_count) || 0);
    if (pegas.length > 0) {
        const resumen = pegas.slice(0, 4).map((p) => `${p.viajero}: falta ${p.falta}`).join(" · ");
        // Un parte ya comunicado no vuelve atrás: se avisa y punto.
        if (!yaComunicado) {
            const yaEstaba = grupo.filas.every((f) => f.mir_response_status === "faltan_datos");
            await anotar(grupo, { estado: "faltan_datos", payload: { mensaje: resumen, pegas } });
            // Once they are in, the 24 h clock is running: a stuck report has to
            // reach a person: the first time, and again on each daily batch run
            // (the batch is the call without document). Until 10-oct-2026 this
            // only went to the panel, painted green.
            const hoyMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
            // Hourly batch since 16-oct-2026 (F3): here only the first time; the batch
            // insists on its own schedule (`tocaAvisar`) so it is not noise every hour.
            if (String(grupo.reserva.check_in) <= hoyMadrid && !yaEstaba) {
                await avisar({
                    titulo: `El parte de ${grupo.reserva.booking_code} no puede salir`,
                    texto: `Ya han entrado y falta: ${resumen}. El plazo legal es de 24 h desde la entrada.`,
                    detalle: [`Entrada: ${grupo.reserva.check_in}`],
                });
            }
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

/**
 * Comprueba el acuse de una RESERVA o ANULACION, cuyo lote vive en
 * `ses_comunicaciones` y NO en `traveler_records`.
 *
 * Por que existe: hasta el 17-sep-2026 `accionComprobar` solo miraba
 * `grupo.filas[0].mir_reference`, que son filas de VIAJEROS. Con el parte aun
 * sin datos, esas filas estan vacias, asi que el lote de la reserva —guardado
 * y visible en la base— nunca se encontraba y la respuesta era «no tiene
 * ningun lote que comprobar». Se descubrio al mandar la primera comunicacion
 * real de la historia del alojamiento. Sin esto no hay forma de pasar de
 * «Recibido» a «Aceptado», que es la unica diferencia que cuenta: el MIR
 * responde codigo 0 al encolar, no al aceptar.
 */
async function comprobarComunicacion(
    bookingId: number, tipo: "reserva" | "anulacion",
): Promise<Salida | null> {
    const com = await leerComunicacion(bookingId, tipo);
    if (!com?.lote) return null;
    if (com.estado === ESTADO_SES.ACEPTADO) {
        return { estado: "mandado", mensaje: `La ${tipo} ya estaba aceptada por el Ministerio.` };
    }

    const r = await consultarLote(String(com.lote));
    if (!r.consultado) {
        return { estado: "error", mensaje: `No se ha podido consultar el lote de la ${tipo}.`, detalle: { errores: r.errores } };
    }
    if (r.aceptado === true) {
        await anotarComunicacion(bookingId, tipo, {
            estado: ESTADO_SES.ACEPTADO,
            mensaje: `Aceptado por el Ministerio. Lote ${com.lote}`,
            intentos: com.intentos, lote: com.lote,
            codigos: r.codigosComunicacion, acuse: r.crudo, reintentar: false,
        });
        return {
            estado: "mandado", mensaje: `El Ministerio ha aceptado la ${tipo}.`,
            detalle: { lote: com.lote, comunicaciones: r.codigosComunicacion },
        };
    }
    if (r.aceptado === false) {
        await anotarComunicacion(bookingId, tipo, {
            estado: ESTADO_SES.RECHAZADO,
            mensaje: `Rechazado: ${r.errores.join(" · ")}`,
            intentos: com.intentos, lote: com.lote,
            acuse: r.crudo, reintentar: false,
        });
        // A rejected booking never reached the Ministry: it must not count as
        // communicated. Otherwise it is never resent and, if later cancelled,
        // its annulment retries forever with nothing to annul (TJM-69BB85,
        // 10-oct-2026: Booking's masked e-mail «m***@***.com»).
        if (tipo === "reserva") {
            await sb.from("guest_bookings")
                .update({ reserva_comunicada_at: null, updated_at: ahora() }).eq("id", bookingId);
        }
        await avisar({
            titulo: `El Ministerio ha rechazado la ${tipo} de la reserva ${bookingId}`,
            texto: `Motivo: ${r.errores.join(" · ")}. Hay que corregir el dato en el panel; el sistema la vuelve a mandar en la pasada siguiente.`,
            detalle: [`Lote: ${com.lote}`],
        });
        return { estado: "error", mensaje: `El Ministerio ha RECHAZADO la ${tipo}: ${r.errores.join(" · ")}` };
    }
    return { estado: "mandado", mensaje: `El lote de la ${tipo} sigue en proceso${r.descEstado ? ` (${r.descEstado})` : ""}. Vuelve a comprobarlo mas tarde.` };
}

async function accionComprobar(grupo: Grupo): Promise<Salida> {
    if (!hayCredenciales()) return { estado: "error", mensaje: "Sin credenciales no se puede comprobar." };

    // La reserva y la anulacion van por su propia tabla. Se miran primero
    // porque son lo unico que existe mientras no haya datos de viajeros.
    for (const tipo of ["anulacion", "reserva"] as const) {
        const r = await comprobarComunicacion(grupo.reserva.id, tipo);
        if (r) return r;
    }

    return await comprobarParte(grupo);
}

/**
 * Pregunta al Ministerio cómo quedó el lote del PARTE. Un rechazo deja la
 * reserva sin `submitted_at` (vuelve a la tanda) y AVISA: el 19-sep-2026 el
 * primer rechazo real se quedó en «esperando validación» y se supo por el
 * correo del MIR, al día siguiente.
 */
async function comprobarParte(grupo: Grupo): Promise<Salida> {
    const lote = grupo.filas[0]?.mir_reference;
    if (!lote) return { estado: "sin_datos", mensaje: "Esta reserva no tiene ningún lote que comprobar." };

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
        const motivo = r.errores.join(" · ");
        await anotar(grupo, {
            estado: ESTADO.RECHAZADO, enviado: false,
            payload: { mensaje: motivo, resultado: "rechazado", lote, acuse: r.crudo },
        });
        await avisar({
            titulo: `La policía ha rechazado el parte de ${grupo.reserva.booking_code}`,
            texto: `El Ministerio no ha aceptado el parte de viajeros de ${grupo.reserva.guest_name || grupo.reserva.booking_code} (entrada ${grupo.reserva.check_in}). Motivo: ${motivo}. Si el motivo habla de datos del huésped, hay que corregirlos en el panel; el sistema lo vuelve a mandar en la tanda siguiente.`,
            detalle: [`Lote ${lote}`],
        });
        return { estado: "error", mensaje: `Rechazado: ${motivo}` };
    }
    return { estado: "mandado", mensaje: `El lote sigue en proceso${r.descEstado ? ` (${r.descEstado})` : ""}. Vuelve a comprobarlo más tarde.` };
}

/**
 * Pasada de acuses (cron `tjm-parte-acuses`, y al empezar cada tanda): todo
 * lo que está «enviado, esperando validación» —partes, reservas y
 * anulaciones— se pregunta al Ministerio. Sin esto un rechazo es invisible.
 */
async function pasadaDeAcuses(): Promise<Record<string, unknown>> {
    const detalles: Array<{ reserva: string; tipo: string; estado: string; mensaje: string }> = [];
    let aceptados = 0, rechazados = 0, enProceso = 0, fallos = 0;
    const cuenta = (r: Salida) => {
        if (r.estado === "error" && /^Rechazado/.test(r.mensaje)) rechazados++;
        else if (r.estado === "error") fallos++;
        else if (/acepta/i.test(r.mensaje)) aceptados++;
        else enProceso++;
    };

    if (!hayCredenciales()) return { credenciales: false, comprobados: 0, aceptados, rechazados, enProceso, fallos, detalles };

    // Partes de viajeros
    const { data: filas } = await sb
        .from("traveler_records").select("booking_id")
        .eq("mir_response_status", ESTADO.EN_CURSO).not("mir_reference", "is", null);
    const ids = [...new Set(((filas || []) as Array<{ booking_id: number }>).map((f) => f.booking_id))];
    for (const id of ids) {
        const grupo = await cargarGrupo(id);
        if (!grupo) continue;
        try {
            const r = await comprobarParte(grupo);
            cuenta(r);
            detalles.push({ reserva: grupo.reserva.booking_code, tipo: "parte", estado: r.estado, mensaje: r.mensaje });
        } catch (e) {
            fallos++;
            detalles.push({ reserva: grupo.reserva.booking_code, tipo: "parte", estado: "error", mensaje: e instanceof Error ? e.message : String(e) });
        }
    }

    // Reservas y anulaciones
    type ComEnEspera = { booking_id: number; tipo: string; guest_bookings: { booking_code: string; guest_name: string | null; check_in: string } };
    const { data: coms } = await sb
        .from("ses_comunicaciones").select("booking_id, tipo, guest_bookings!inner(booking_code, guest_name, check_in)")
        .eq("estado", ESTADO_SES.EN_CURSO).not("lote", "is", null);
    for (const c of (coms || []) as unknown as ComEnEspera[]) {
        const tipo = c.tipo as "reserva" | "anulacion";
        try {
            const r = await comprobarComunicacion(c.booking_id, tipo);
            if (!r) continue;
            if (r.estado === "error" && /RECHAZADO/.test(r.mensaje)) {
                rechazados++;
                await avisar({
                    titulo: `La policía ha rechazado la ${tipo} de ${c.guest_bookings.booking_code}`,
                    texto: `${r.mensaje} (${c.guest_bookings.guest_name || ""}, entrada ${c.guest_bookings.check_in}). El motivo completo está en el panel de Jesús.`,
                });
            } else cuenta(r);
            detalles.push({ reserva: c.guest_bookings.booking_code, tipo, estado: r.estado, mensaje: r.mensaje });
        } catch (e) {
            fallos++;
            detalles.push({ reserva: c.guest_bookings.booking_code, tipo, estado: "error", mensaje: e instanceof Error ? e.message : String(e) });
        }
    }

    return {
        credenciales: true, comprobados: ids.length + (coms || []).length,
        aceptados, rechazados, enProceso, fallos, detalles: detalles.slice(0, 30),
    };
}

/** F1: every form rejected and none touched since the last attempt. */
function rechazoSinCambios(grupo: Grupo): boolean {
    if (grupo.filas.length === 0) return false;
    if (!grupo.filas.every((f) => f.mir_response_status === ESTADO.RECHAZADO)) return false;
    const historial = (grupo.filas[0].mir_response_payload?.historial ?? []) as Array<{ cuando?: string }>;
    const ultimo = historial.length ? Date.parse(String(historial[historial.length - 1].cuando)) : NaN;
    if (Number.isNaN(ultimo)) return false;
    return grupo.filas.every((f) => !f.updated_at || Date.parse(f.updated_at) <= ultimo + 5_000);
}

/**
 * F4: guests who arrived (yesterday or before) and are still in, without a single
 * form. Nothing reached anyone before: the report did not even exist.
 */
async function dentroSinFichas(): Promise<number> {
    const hoyMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
    const { data } = await sb
        .from("guest_bookings")
        .select("id, booking_code, guest_name, check_in, check_out, channel, external_locator, traveler_records(id)")
        .eq("status", "confirmed").lt("check_in", hoyMadrid).gte("check_out", hoyMadrid)
        .neq("source", "test");
    const sin = ((data || []) as Array<{ booking_code: string; guest_name: string | null; check_in: string; traveler_records: unknown[] }>)
        .filter((b) => (b.traveler_records || []).length === 0);
    for (const b of sin) {
        if (!tocaAvisar(2, b.check_in)) continue;
        await avisar({
            titulo: `${b.booking_code}: ya están dentro y no hay parte`,
            texto: `${b.guest_name || b.booking_code} entró el ${b.check_in} y nadie ha rellenado sus datos. El plazo legal es de 24 h desde la entrada: pídeles que rellenen el formulario o apúntalos en el panel.`,
        });
    }
    return sin.length;
}

// ---------------------------------------------------------------------------
// Missing data for the Ministry: who can get it and how often to insist
// ---------------------------------------------------------------------------

/** Where the family finds the data the platform hid (16-oct-2026). */
function dondeMirar(r: Grupo["reserva"], que: string): string {
    const canal = String(r.channel || "").toLowerCase();
    const loc = r.external_locator ? ` (localizador ${r.external_locator})` : "";
    if (canal === "booking") return `Míralo en la extranet de Booking, en la reserva${loc}, o en MisterPlan, y apúntalo en el panel.`;
    if (canal === "airbnb") return `Míralo en la reserva de Airbnb${loc} y apúntalo en el panel.`;
    if (canal) return `Míralo en la reserva de ${r.channel}${loc} y apúntalo en el panel.`;
    return `Pídeselo al huésped y apúntalo en el panel (${que}).`;
}

/**
 * The hourly sweep must reach a person without becoming noise: first time, then
 * 9 h and 18 h Madrid; and every 3 h (9-21 h) once the arrival is 2 days away or
 * less. Before, it was once a day and TJM-8A9D74 sat 49 tries without anyone acting.
 */
function tocaAvisar(intentos: number, checkIn: string): boolean {
    if (intentos === 1) return true;
    const ahoraMadrid = new Date(new Date().toLocaleString("en-US", { timeZone: ZONA }));
    const hora = ahoraMadrid.getHours();
    const hoyMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
    const dias = Math.round((Date.parse(String(checkIn).slice(0, 10)) - Date.parse(hoyMadrid)) / 86400000);
    if (dias <= 2) return hora >= 9 && hora <= 21 && hora % 3 === 0;
    return hora === 9 || hora === 18;
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
        // This only fixes itself when someone types the surname, so it must reach a
        // person: the first time and then once a day (the sweep runs hourly; 9 h
        // Madrid). Booking 64 sat here 459 hours without anyone knowing (2-oct-2026).
        if (tocaAvisar(intentos, r.check_in)) {
            await avisar({
                titulo: `Falta el apellido del titular de ${r.booking_code}`,
                texto: `La reserva de ${r.guest_name || r.booking_code} (entrada ${r.check_in}) no se puede comunicar al Ministerio: el titular solo tiene una palabra en el nombre. El plazo legal es de 24 h desde la reserva. ${dondeMirar(r, "nombre completo")} El sistema la manda sola en la pasada siguiente; también sale sola si el huésped rellena su ficha.`,
                detalle: [`Intentos: ${intentos}`],
            });
        }
        return { estado: "faltan", mensaje };
    }

    // The Ministry needs a phone or an e-mail for the holder. Placeholders and
    // masked addresses are already dropped by `aContrato`: if nothing real is
    // left, a person has to add it; inventing one is not an option.
    const tit = grupo.contrato.titularContrato;
    if (!tit.telefono && !tit.correo) {
        const mensaje = "Falta un teléfono o un correo de verdad del titular de la reserva.";
        await anotarComunicacion(r.id, "reserva", {
            estado: ESTADO_SES.REINTENTAR, mensaje, intentos, reintentar: false,
        });
        if (tocaAvisar(intentos, r.check_in)) {
            await avisar({
                titulo: `Falta el teléfono del titular de ${r.booking_code}`,
                texto: `La reserva de ${r.guest_name || r.booking_code} (entrada ${r.check_in}) no se puede comunicar al Ministerio: no tiene ni teléfono ni correo reales (la plataforma los tapa). ${dondeMirar(r, "teléfono")} El sistema la manda sola en la pasada siguiente; también sale sola si el huésped rellena su ficha.`,
                detalle: [`Intentos: ${intentos}`],
            });
        }
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

/**
 * F5 (audit 10-oct, migration 0063): something the Ministry already holds changed before
 * arrival (dates, apartment, people). Cancel the communication that is there and send it
 * again with the new data, under a new contract reference (<code>-M<n>) so the second
 * one is never mistaken for the first.
 */
async function accionModificacion(grupo: Grupo): Promise<Salida> {
    const r = grupo.reserva;
    if (!r.modificacion_pendiente_at) return { estado: "no_procede", mensaje: "No hay ningún cambio pendiente." };
    if (!r.reserva_comunicada_at) {
        // Never reached the Ministry: the normal reservation pass sends the current data.
        await sb.from("guest_bookings").update({ modificacion_pendiente_at: null, updated_at: ahora() }).eq("id", r.id);
        return { estado: "no_procede", mensaje: "La reserva no estaba comunicada: sale con los datos nuevos en la pasada normal." };
    }
    if (!hayCredenciales()) return { estado: "preparado", mensaje: "Cambio pendiente. Falta el alta en el Ministerio." };

    const dela = await leerComunicacion(r.id, "reserva");
    let codigos = dela?.codigos_comunicacion ?? [];
    if (codigos.length === 0 && dela?.lote) {
        const consulta = await consultarLote(String(dela.lote));
        if (consulta.consultado && consulta.codigosComunicacion.length > 0) codigos = consulta.codigosComunicacion;
    }
    if (codigos.length === 0) {
        return { estado: "error", mensaje: "Cambio pendiente: todavía no hay códigos de la comunicación anterior (el lote puede seguir en proceso). Se reintenta." };
    }

    const baja = await mandarAnulacion(codigos);
    if (!baja.ok) {
        if (tocaAvisar(2, r.check_in)) {
            await avisar({
                titulo: `No se ha podido comunicar el cambio de ${r.booking_code}`,
                texto: `La reserva cambió y el Ministerio no ha aceptado anular la versión anterior: ${baja.mensaje}. Se reintenta solo.`,
            });
        }
        return { estado: "error", mensaje: `Cambio: la anulación de la versión anterior falló. ${baja.mensaje}` };
    }

    const n = (Number(r.modificaciones_comunicadas) || 0) + 1;
    const referencia = `${r.booking_code}-M${n}`;
    await anotarComunicacion(r.id, "reserva", {
        estado: "pendiente",
        mensaje: `Cambio de reserva: anulada la comunicación anterior (lote de baja ${baja.respuesta?.lote ?? "?"}); se comunica de nuevo como ${referencia}.`,
        intentos: 0, lote: null, codigos: [], reintentar: false,
    });
    await sb.from("guest_bookings").update({
        reserva_comunicada_at: null, modificacion_pendiente_at: null,
        modificaciones_comunicadas: n, contract_reference: referencia, updated_at: ahora(),
    }).eq("id", r.id);

    // Same pass: send the new version now, not in an hour.
    const nuevo = await cargarGrupo(r.id);
    const alta = nuevo ? await accionReserva(nuevo) : { estado: "error" as const, mensaje: "No encuentro la reserva." };
    return { estado: alta.estado, mensaje: `Cambio comunicado: versión anterior anulada; nueva (${referencia}): ${alta.mensaje}` };
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
        const fila = p.tipo === "modificacion" ? null : await leerComunicacion(p.booking_id, p.tipo as "reserva" | "anulacion");

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
            const r = p.tipo === "anulacion" ? await accionAnulacion(grupo)
                : p.tipo === "modificacion" ? await accionModificacion(grupo)
                : await accionReserva(grupo);
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
            if (p.tipo !== "modificacion") await anotarComunicacion(p.booking_id, p.tipo as "reserva" | "anulacion", {
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
        // Primero se pregunta por lo que quedó en espera: un rechazo devuelve
        // la reserva a «pendiente» y sale hoy con los datos arreglados.
        const acuses = await pasadaDeAcuses();

        const ids = await reservasPendientes();
        const detalles: Array<{ reserva: string; estado: string; mensaje: string }> = [];
        let mandados = 0, preparados = 0, fallos = 0;

        for (const id of ids) {
            const grupo = await cargarGrupo(id);
            if (!grupo) continue;
            // F1: a report the Ministry rejected is not resent unchanged every hour; it
            // waits until someone fixes a form (the rejection was already notified).
            if (rechazoSinCambios(grupo)) {
                detalles.push({ reserva: grupo.reserva.booking_code, estado: "rechazado", mensaje: "Esperando a que se corrija la ficha rechazada." });
                continue;
            }
            const insistir = tocaAvisar(2, grupo.reserva.check_in);
            try {
                const r = await accionMandar(grupo, false);
                if (r.estado === "mandado") mandados++;
                else if (r.estado === "preparado") preparados++;
                else fallos++;
                // Ya han entrado y el parte no puede salir: alguien tiene que
                // saberlo hoy, no el día que mire el panel.
                if (r.estado === "faltan" && insistir) {
                    const pegas = (r.detalle?.pegas as Array<{ viajero: string; falta: string }> | undefined) ?? [];
                    await avisar({
                        titulo: `Faltan datos para el parte de ${grupo.reserva.booking_code}`,
                        texto: `El parte de viajeros de ${grupo.reserva.guest_name || grupo.reserva.booking_code} (entrada ${grupo.reserva.check_in}) no puede mandarse a la policía hasta completar esto:`,
                        detalle: pegas.map((p) => `${p.viajero}: falta ${p.falta}`),
                    });
                } else if (r.estado === "error" && insistir) {
                    await avisar({
                        titulo: `No ha salido el parte de ${grupo.reserva.booking_code}`,
                        texto: `${r.mensaje} (${grupo.reserva.guest_name || ""}, entrada ${grupo.reserva.check_in}).`,
                    });
                }
                detalles.push({ reserva: grupo.reserva.booking_code, estado: r.estado, mensaje: r.mensaje });
            } catch (e) {
                fallos++;
                const msg = e instanceof Error ? e.message : String(e);
                await anotar(grupo, { estado: ESTADO.REINTENTAR, enviado: false, payload: { mensaje: msg } });
                detalles.push({ reserva: grupo.reserva.booking_code, estado: "error", mensaje: msg });
            }
        }
        const sinFichas = await dentroSinFichas();
        return json(200, {
            reservas: ids.length, mandados, preparados, fallos, dentro_sin_fichas: sinFichas,
            credenciales: hayCredenciales(),
            faltan_secretos: secretosQueFaltan(),
            detalles: detalles.slice(0, 30),
            acuses,
        });
    }

    // ---- Acuses de todo lo que está en espera (cron `tjm-parte-acuses`) ---
    if (accion === "acuses") return json(200, await pasadaDeAcuses());

    // ---- ¿Llegan los avisos? Manda uno de prueba al móvil y al buzón -------
    if (accion === "prueba-aviso") {
        const r = await avisar({
            titulo: "Prueba de avisos del parte de viajeros",
            texto: "Si lees esto, los avisos de rechazo o de datos que faltan llegan bien. No hay que hacer nada.",
        });
        return json(200, { ok: r.push === "ok" && r.correo.startsWith("ok"), ...r });
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
            if (!f.ruta) return { ...f, url: null as string | null };
            const { data: firma } = await sb.storage
                .from(CUBO_LIBRO_REGISTRO).createSignedUrl(String(f.ruta), 3600);
            return { ...f, url: (firma?.signedUrl ?? null) as string | null };
        }));
        return json(200, {
            ok: true, desde, hasta,
            estancias: conUrl.length,
            sin_archivar: conUrl.filter((f) => !(f as Record<string, unknown>).ruta).length,
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
                        pegas: pegasDelParte(grupo.viajeros, Number(grupo.reserva.pax_count) || 0),
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

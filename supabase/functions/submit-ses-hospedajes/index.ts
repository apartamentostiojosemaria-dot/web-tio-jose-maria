// Edge function: submit-ses-hospedajes
// ====================================
// El parte de viajeros del RD 933/2021, en una sola puerta:
//
//   POST { }                                  → tanda automática (cron diario)
//   POST { accion: "mandar",  booking_id }    → manda el parte de una reserva
//   POST { accion: "documento", booking_id }  → hoja de registro en PDF
//   POST { accion: "ya-lo-he-mandado", booking_id } → lo mandó la persona
//   POST { accion: "comprobar", booking_id? } → pregunta cómo quedó el lote
//   POST { accion: "estado",  booking_id }    → detalle técnico (panel de Jesús)
//
// Cómo se comporta según haya o no credenciales del Ministerio:
//
//   CON credenciales  → arma el XML, lo comprime, lo manda por el servicio
//                       web con usuario y contraseña, guarda el acuse (el
//                       número de lote) y deja el parte «mandado».
//   SIN credenciales  → MODO PREPARADO: genera el mismo XML y además la hoja
//                       de registro en PDF, lo guarda todo, y deja el parte
//                       como «pendiente de alta». No marca nada como mandado:
//                       eso lo hace la persona con «ya-lo-he-mandado» cuando
//                       de verdad lo ha mandado por su vía de siempre.
//
// Nunca revienta por falta de secretos y nunca dice que ha mandado algo que
// no ha mandado.
//
// Secretos (Supabase → Edge Functions → Secrets), ver config.ts:
//   SES_WS_USER · SES_WS_PASSWORD · SES_ARRENDADOR · SES_ESTABLECIMIENTO · SES_ENDPOINT

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ESTADO, SECRETOS, hayCredenciales, secretosQueFaltan } from "./config.ts";
import { consultarLote, mandarParte, xmlParteViajeros } from "./mir.ts";
import { renderHojaRegistro } from "./hoja-registro.ts";
import {
    aContrato, aViajero, pegasDelParte,
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
// Aquí se manejan datos de documento de identidad: sólo entra la propia
// infraestructura (cron) o alguien del equipo con sesión iniciada.
//
// ⚠️ Esta función se despliega con `verify_jwt = false` (la pasarela NO
// comprueba la firma del token, para que el cron pueda llamar con la clave
// de servicio en cualquiera de sus formatos). Eso obliga a que la
// comprobación de aquí sea infalsificable:
//   · el camino de «sistema» es una comparación EXACTA con la clave de
//     servicio, que es un secreto. Leer el claim `role` del JWT sin
//     verificar la firma sería un coladero: cualquiera se fabrica un token
//     con role=service_role y se lleva los documentos de identidad.
//   · el camino de persona pasa por `auth.getUser`, que sí valida la firma
//     contra el servidor de autenticación.

type Quien = { ok: true; quien: string } | { ok: false; status: number; error: string };

async function autorizar(req: Request): Promise<Quien> {
    const cabecera = req.headers.get("authorization") || "";
    const token = cabecera.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { ok: false, status: 401, error: "falta_token" };
    if (SERVICE_KEY && token === SERVICE_KEY) {
        return { ok: true, quien: "sistema" };
    }
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return { ok: false, status: 401, error: "token_no_valido" };
    const { data: perfil } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    const rol = (perfil as { role?: string } | null)?.role;
    if (!rol || !["admin", "staff"].includes(rol)) {
        return { ok: false, status: 403, error: "sin_permiso" };
    }
    return { ok: true, quien: `${rol}:${data.user.id}` };
}

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------

const CAMPOS_RESERVA = `id, booking_code, check_in, check_out, pax_count, created_at,
    payment_method, channel, guest_name, status, apartment_id, apartments(name)`;

const CAMPOS_VIAJERO = `id, booking_id, is_titular, nombre, apellido_primero, apellido_segundo,
    sexo, tipo_documento, numero_documento, soporte_documento, nacionalidad, fecha_nacimiento,
    direccion_via, direccion_municipio, direccion_cp, direccion_pais,
    telefono_fijo, telefono_movil, email, parentesco, firma_base64,
    submitted_at, mir_reference, mir_response_status, mir_response_payload`;

interface Grupo {
    reserva: FilaReserva & { status: string };
    filas: Array<FilaViajero & { submitted_at: string | null; mir_response_status: string | null; mir_response_payload: Record<string, unknown> | null }>;
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
    const viajeros = lista.map((f) => aViajero(f, r.check_in));
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
// Escritura del estado
// ---------------------------------------------------------------------------

/** Añade un renglón al historial sin perder los anteriores. */
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

    // Hay cosas del apunte anterior que NO se pueden perder al cambiar de
    // estado: lo que se mandó (`xml`) y lo que contestó el Ministerio
    // (`lote`, `acuse`) son la trazabilidad del parte. El resto (pegas,
    // secretos que faltaban…) sí se renueva en cada apunte, porque describe
    // la situación de ahora y no la de antes.
    const previo = (base ?? {}) as Record<string, unknown>;
    const pegajosos: Record<string, unknown> = {};
    for (const clave of ["xml", "preparado_en", "lote", "acuse"]) {
        if (previo[clave] !== undefined && cambios.payload[clave] === undefined) {
            pegajosos[clave] = previo[clave];
        }
    }

    const payload = {
        ...pegajosos,
        ...cambios.payload,
        historial: conHistorial(base, { estado: cambios.estado, nota: cambios.payload.mensaje ?? null }),
    };
    const fila: Record<string, unknown> = {
        mir_response_status: cambios.estado,
        mir_response_payload: payload,
        updated_at: ahora(),
    };
    if (cambios.referencia !== undefined) fila.mir_reference = cambios.referencia;
    if (cambios.enviado === true) fila.submitted_at = ahora();
    if (cambios.enviado === false) fila.submitted_at = null;
    await sb.from("traveler_records").update(fila).in("id", ids);
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

interface Salida {
    estado: "mandado" | "preparado" | "faltan" | "error" | "sin_datos";
    mensaje: string;
    documento?: { nombre: string; tipo: string; base64: string };
    detalle?: Record<string, unknown>;
}

async function pdfDe(grupo: Grupo, nota: string | null): Promise<{ nombre: string; tipo: string; base64: string }> {
    const bytes = await renderHojaRegistro({ contrato: grupo.contrato, viajeros: grupo.viajeros, nota });
    return {
        nombre: `hoja-de-registro-${grupo.reserva.booking_code}.pdf`,
        tipo: "application/pdf",
        base64: aBase64(bytes),
    };
}

/**
 * Manda (o prepara) el parte de una reserva.
 * `conDocumento` sólo cuando alguien lo ha pedido desde una pantalla: en la
 * tanda automática no tiene sentido maquetar un PDF que nadie va a abrir.
 */
async function accionMandar(grupo: Grupo, conDocumento = true): Promise<Salida> {
    if (grupo.viajeros.length === 0) {
        return { estado: "sin_datos", mensaje: "Todavía no ha rellenado sus datos nadie de esta reserva." };
    }

    const yaComunicado = grupo.filas.some((f) => f.submitted_at);

    const pegas = pegasDelParte(grupo.viajeros);
    if (pegas.length > 0) {
        const resumen = pegas.slice(0, 4).map((p) => `${p.viajero}: falta ${p.falta}`).join(" · ");
        // Si el parte ya se comunicó, no se degrada su estado por que ahora
        // falte algo: se avisa y punto. Un parte mandado no vuelve atrás.
        if (!yaComunicado) {
            await anotar(grupo, { estado: "faltan_datos", payload: { mensaje: resumen, pegas } });
        }
        return {
            estado: "faltan",
            mensaje: `No se puede mandar todavía. ${resumen}.`,
            detalle: { pegas },
        };
    }

    // ---- Sin credenciales: modo preparado -------------------------------
    if (!hayCredenciales()) {
        const xml = xmlParteViajeros({
            codigoEstablecimiento: SECRETOS.establecimiento || "PENDIENTE-DE-ALTA",
            contrato: grupo.contrato,
            viajeros: grupo.viajeros,
        });
        const documento = conDocumento
            ? await pdfDe(
                grupo,
                "Documento generado por el sistema del alojamiento. Pendiente de comunicación por el servicio web del Ministerio del Interior.",
            )
            : undefined;
        await anotar(grupo, {
            estado: ESTADO.PENDIENTE_DE_ALTA,
            enviado: false,
            payload: {
                mensaje: "Documento preparado. Faltan credenciales del servicio web.",
                faltan_secretos: secretosQueFaltan(),
                xml,
                preparado_en: ahora(),
            },
        });
        return {
            estado: "preparado",
            mensaje: "Te he preparado la hoja de registro para que la mandes como siempre.",
            documento,
        };
    }

    // ---- Con credenciales: envío de verdad -------------------------------
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
        },
    });
    return { estado: "error", mensaje: resultado.mensaje };
}

/** La persona del alojamiento dice que ya lo ha mandado por su vía. */
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

/** Pregunta al Ministerio cómo quedó el lote de una reserva ya mandada. */
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
            estado: ESTADO.ACEPTADO,
            enviado: true,
            payload: { mensaje: "Aceptado", lote, comunicaciones: r.codigosComunicacion, acuse: r.crudo },
        });
        return { estado: "mandado", mensaje: "El Ministerio lo ha aceptado.", detalle: { comunicaciones: r.codigosComunicacion } };
    }
    if (r.aceptado === false) {
        await anotar(grupo, {
            estado: ESTADO.RECHAZADO,
            enviado: false,
            payload: { mensaje: r.errores.join(" · "), resultado: "rechazado", lote, acuse: r.crudo },
        });
        return { estado: "error", mensaje: `Rechazado: ${r.errores.join(" · ")}` };
    }
    return { estado: "mandado", mensaje: "El lote sigue en proceso. Vuelve a comprobarlo más tarde." };
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

    // ---- Tanda automática (el cron diario) --------------------------------
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

    // ---- El resto de acciones son sobre una reserva concreta --------------
    if (!bookingId) return json(400, { error: "falta_booking_id", mensaje: "No sé de qué reserva hablas." });

    const grupo = await cargarGrupo(bookingId);
    if (!grupo) return json(404, { error: "reserva_no_encontrada", mensaje: "No encuentro esa reserva." });

    try {
        switch (accion) {
            case "mandar":
                return json(200, await accionMandar(grupo));

            case "ya-lo-he-mandado":
                return json(200, await accionYaLoHeMandado(grupo, permiso.quien));

            case "comprobar":
                return json(200, await accionComprobar(grupo));

            case "documento": {
                if (grupo.viajeros.length === 0) {
                    return json(200, { estado: "sin_datos", mensaje: "Todavía no hay datos de viajeros." });
                }
                const enviado = grupo.filas.some((f) => f.submitted_at);
                const documento = await pdfDe(
                    grupo,
                    enviado
                        ? `Comunicado el ${String(grupo.filas.find((f) => f.submitted_at)?.submitted_at ?? "").slice(0, 10)}.`
                        : "Documento generado por el sistema del alojamiento. Pendiente de comunicación.",
                );
                return json(200, { estado: "preparado", mensaje: "Documento listo.", documento });
            }

            case "estado": {
                const f = grupo.filas[0];
                return json(200, {
                    ok: true,
                    detalle: {
                        booking_code: grupo.reserva.booking_code,
                        viajeros: grupo.viajeros.length,
                        pax: grupo.reserva.pax_count,
                        pegas: pegasDelParte(grupo.viajeros),
                        mir_response_status: f?.mir_response_status ?? null,
                        submitted_at: f?.submitted_at ?? null,
                        lote: f?.mir_reference ?? null,
                        payload: f?.mir_response_payload ?? null,
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

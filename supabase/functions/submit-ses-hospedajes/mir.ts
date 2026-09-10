// Cliente del servicio web de Hospedajes (Ministerio del Interior)
// ================================================================
// Especificación seguida: «MIR-HOSPE-DSI-WS - Servicio de Hospedajes ·
// Comunicaciones», v3.1.2 / v3.1.3, y los esquemas `tiposGenerales.xsd`,
// `altaParteHospedaje.xsd` y `comunicacion.xsd` que vienen en el paquete que
// el Ministerio entrega junto con las credenciales.
//
// Lo que hay que tener claro antes de tocar nada aquí:
//
//   1. La autenticación es **HTTP Basic** (`Authorization: Basic base64(u:p)`),
//      NO WS-Security. La cabecera SOAP va vacía y `SOAPAction` va vacía.
//      El código anterior daba por supuesto un certificado X.509 de cliente:
//      era falso. El certificado digital sólo hace falta para el alta por
//      navegador, no para hablar máquina a máquina.
//   2. El XML del parte NO viaja en claro: se comprime en un ZIP de verdad y
//      se codifica en Base64 dentro de `<solicitud>`. (Error 10111 si no.)
//   3. `<cabecera>` lleva el **código de arrendador**; el **código de
//      establecimiento** va dentro del XML comprimido. Son cosas distintas y
//      viajan en sitios distintos.
//   4. El orden de los elementos importa: los esquemas son `xsd:sequence`.
//   5. Un `codigo/codigoRetorno = 0` significa «recibido y encolado», NO
//      «aceptado». La validación real es posterior y se consulta con el
//      número de lote. Por eso aquí nada se marca como aceptado con la
//      primera respuesta.
//
// Endpoints (§2.1 de la especificación):
//   pruebas     https://hospedajes.pre-ses.mir.es/hospedajes-web/ws/v1/comunicacion
//   producción  https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion

import { APLICACION, ESPERAS_MS, INTENTOS, SECRETOS, TIMEOUT_MS } from "./config.ts";
import { aBase64, zipDeUnFichero } from "./zip.ts";
import {
    codigoParentesco, type ContratoParte, type ViajeroParte,
} from "./parte-modelo.ts";

const NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/";
const NS_COMUNICACION = "http://www.soap.servicios.hospedajes.mir.es/comunicacion";
const NS_ALTA_PARTE = "http://www.neg.hospedajes.mir.es/altaParteHospedaje";

/** Hora de entrada y de salida del alojamiento (el esquema pide dateTime). */
const HORA_ENTRADA = "16:00:00";
const HORA_SALIDA = "12:00:00";

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

const esc = (s: string | null | undefined): string =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

/** Etiqueta que sólo sale si hay valor (los `minOccurs="0"` del esquema). */
const opt = (etiqueta: string, valor: string | null | undefined): string =>
    valor ? `<${etiqueta}>${esc(valor)}</${etiqueta}>` : "";

const soloFecha = (iso: string): string => String(iso).slice(0, 10);

const conHora = (iso: string, hora: string): string => `${soloFecha(iso)}T${hora}`;

/** Recorta a la longitud máxima que admite el esquema. */
const corta = (s: string | null | undefined, n: number): string =>
    String(s ?? "").trim().slice(0, n);

/**
 * `<persona>` del parte de viajeros. El orden es el del `xsd:sequence` de
 * `personaHospedajeType` y no se puede alterar.
 */
function personaXml(v: ViajeroParte, hayMenores: boolean): string {
    const esMenor = v.edad < 18;
    // El parentesco lo declara el menor respecto de quien lo acompaña y, si
    // hay menores, también al menos un adulto respecto del menor.
    const parentesco = esMenor
        ? codigoParentesco(v.parentesco)
        : (hayMenores && v.esTitular ? codigoParentesco(v.parentesco || "PA") : "");

    const direccion = [
        `<direccion>${esc(corta(v.direccion, 100))}</direccion>`,
        // direccionComplementaria: no se pide en el formulario, no se manda.
        // codigoMunicipio: es el código INE y sólo vale para municipios
        // españoles; no lo pedimos, así que va el nombre.
        opt("nombreMunicipio", corta(v.municipio, 100)),
        `<codigoPostal>${esc(corta(v.codigoPostal, 20))}</codigoPostal>`,
        `<pais>${esc(v.pais || "ESP")}</pais>`,
    ].join("");

    // Un menor sin documento propio no lleva bloque de documento: mandar el
    // tipo sin el numero hace saltar la validacion del Ministerio (para NIF y
    // NIE exige tambien el numero de soporte).
    const conDocumento = Boolean(v.numeroDocumento);

    return [
        "<persona>",
        "<rol>VI</rol>",
        `<nombre>${esc(corta(v.nombre, 50))}</nombre>`,
        `<apellido1>${esc(corta(v.apellido1, 50))}</apellido1>`,
        opt("apellido2", corta(v.apellido2, 50)),
        conDocumento ? opt("tipoDocumento", v.tipoDocumento) : "",
        conDocumento ? opt("numeroDocumento", corta(v.numeroDocumento, 15)) : "",
        conDocumento ? opt("soporteDocumento", corta(v.soporteDocumento, 9)) : "",
        `<fechaNacimiento>${esc(soloFecha(v.fechaNacimiento))}</fechaNacimiento>`,
        opt("nacionalidad", v.nacionalidad),
        opt("sexo", v.sexo),
        `<direccion>${direccion}</direccion>`,
        opt("telefono", corta(v.telefonoMovil, 20)),
        opt("telefono2", corta(v.telefonoFijo, 20)),
        opt("correo", corta(v.correo, 250)),
        opt("parentesco", parentesco),
        "</persona>",
    ].join("");
}

/** `<contrato>` del parte, en el orden de `contratoHospedajeType`. */
function contratoXml(c: ContratoParte): string {
    const pago = [
        "<pago>",
        `<tipoPago>${esc(c.medioPago)}</tipoPago>`,
        opt("fechaPago", c.fechaPago ? soloFecha(c.fechaPago) : ""),
        opt("titular", corta(c.titularPago, 100)),
        "</pago>",
    ].join("");

    return [
        "<contrato>",
        `<referencia>${esc(corta(c.referencia, 50))}</referencia>`,
        `<fechaContrato>${esc(soloFecha(c.fechaContrato))}</fechaContrato>`,
        `<fechaEntrada>${esc(conHora(c.fechaEntrada, HORA_ENTRADA))}</fechaEntrada>`,
        `<fechaSalida>${esc(conHora(c.fechaSalida, HORA_SALIDA))}</fechaSalida>`,
        `<numPersonas>${c.numPersonas}</numPersonas>`,
        "<numHabitaciones>1</numHabitaciones>",
        `<internet>${c.conexionInternet ? "SI" : "NO"}</internet>`,
        pago,
        "</contrato>",
    ].join("");
}

/** XML interior del alta de parte de viajeros. Es el que se comprime. */
export function xmlParteViajeros(opts: {
    codigoEstablecimiento: string;
    contrato: ContratoParte;
    viajeros: ViajeroParte[];
}): string {
    const hayMenores = opts.viajeros.some((v) => v.edad < 18);
    const personas = opts.viajeros.map((v) => personaXml(v, hayMenores)).join("");
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<alt:peticion xmlns:alt="${NS_ALTA_PARTE}">`,
        "<solicitud>",
        `<codigoEstablecimiento>${esc(opts.codigoEstablecimiento)}</codigoEstablecimiento>`,
        "<comunicacion>",
        contratoXml(opts.contrato),
        personas,
        "</comunicacion>",
        "</solicitud>",
        "</alt:peticion>",
    ].join("");
}

/** Sobre SOAP de la operación `comunicacion`. */
function sobreComunicacion(solicitudBase64: string): string {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:com="${NS_COMUNICACION}">`,
        "<soapenv:Header/>",
        "<soapenv:Body>",
        "<com:comunicacionRequest>",
        "<peticion>",
        "<cabecera>",
        `<codigoArrendador>${esc(SECRETOS.arrendador)}</codigoArrendador>`,
        `<aplicacion>${esc(APLICACION)}</aplicacion>`,
        "<tipoOperacion>A</tipoOperacion>",
        "<tipoComunicacion>PV</tipoComunicacion>",
        "</cabecera>",
        `<solicitud>${solicitudBase64}</solicitud>`,
        "</peticion>",
        "</com:comunicacionRequest>",
        "</soapenv:Body>",
        "</soapenv:Envelope>",
    ].join("");
}

/**
 * Sobre SOAP de `consultaLote`.
 *
 * ⚠️ El shape exacto de esta operación NO está confirmado contra el WSDL
 * real: el WSDL sólo se descarga desde dentro de la plataforma, ya
 * autenticado. Está construido por simetría con `comunicacion`. Por eso la
 * consulta es SIEMPRE opcional: si falla, no cambia ningún estado y se anota
 * la incidencia. En cuanto lleguen las credenciales hay que abrir
 * `comunicacion.wsdl` y confirmarlo (ver docs/PARTE-VIAJEROS.md).
 */
function sobreConsultaLote(lote: string): string {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:com="${NS_COMUNICACION}">`,
        "<soapenv:Header/>",
        "<soapenv:Body>",
        "<com:consultaLoteRequest>",
        "<peticion>",
        "<cabecera>",
        `<codigoArrendador>${esc(SECRETOS.arrendador)}</codigoArrendador>`,
        `<aplicacion>${esc(APLICACION)}</aplicacion>`,
        "<tipoOperacion>C</tipoOperacion>",
        "</cabecera>",
        `<lote>${esc(lote)}</lote>`,
        "</peticion>",
        "</com:consultaLoteRequest>",
        "</soapenv:Body>",
        "</soapenv:Envelope>",
    ].join("");
}

// ---------------------------------------------------------------------------
// Lectura de la respuesta
// ---------------------------------------------------------------------------

/** Saca el contenido de una etiqueta, con o sin prefijo de espacio de nombres. */
function etiqueta(xml: string, nombre: string): string | null {
    const re = new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${nombre}>`, "i");
    return xml.match(re)?.[1]?.trim() ?? null;
}

function todasLasEtiquetas(xml: string, nombre: string): string[] {
    const re = new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${nombre}>`, "gi");
    return [...xml.matchAll(re)].map((m) => m[1].trim());
}

export interface RespuestaMir {
    /** Código de retorno. 0 = recibido y encolado. */
    codigo: number | null;
    descripcion: string | null;
    /** Identificador del lote (UUID). Es el acuse que hay que guardar. */
    lote: string | null;
    /** Texto crudo, recortado, para poder auditar después. */
    crudo: string;
    httpStatus: number;
}

function leerRespuesta(texto: string, httpStatus: number): RespuestaMir {
    // La propia documentación del Ministerio se contradice: el anexo usa
    // <codigoRetorno> y la tabla del apartado 3.1.2 usa <codigo>. Se leen
    // los dos.
    const crudoCodigo = etiqueta(texto, "codigoRetorno") ?? etiqueta(texto, "codigo");
    const codigo = crudoCodigo != null && crudoCodigo !== "" ? Number(crudoCodigo) : null;
    return {
        codigo: Number.isFinite(codigo as number) ? (codigo as number) : null,
        descripcion: etiqueta(texto, "descripcion") ?? etiqueta(texto, "faultstring"),
        lote: etiqueta(texto, "lote"),
        crudo: texto.slice(0, 4000),
        httpStatus,
    };
}

/** Mensajes de los códigos de error del apartado 5 de la especificación. */
export const ERRORES_MIR: Record<number, string> = {
    0: "Recibido correctamente",
    10103: "El código de arrendador no existe",
    10107: "Usuario o contraseña incorrectos",
    10111: "El fichero no va como XML en UTF-8, comprimido en zip y en Base64",
    10118: "Error de formato en el XML",
    10119: "El arrendador no puede hacer este tipo de comunicaciones",
    10120: "El arrendador no tiene habilitado el envío por servicio web",
    10121: "Error de validación de los datos",
    10130: "Valor incorrecto en un campo",
    10131: "Falta un campo obligatorio",
    10999: "Error no controlado en el servicio",
};

export const explicaCodigo = (codigo: number | null, descripcion: string | null): string => {
    if (codigo == null) return descripcion || "Respuesta sin código";
    return ERRORES_MIR[codigo] ? `${ERRORES_MIR[codigo]} (${codigo})` : `${descripcion || "Error"} (${codigo})`;
};

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function llamar(sobre: string): Promise<RespuestaMir> {
    const auth = btoa(`${SECRETOS.usuario}:${SECRETOS.contrasena}`);
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(SECRETOS.endpoint, {
            method: "POST",
            headers: {
                "content-type": "text/xml; charset=UTF-8",
                "authorization": `Basic ${auth}`,
                // El WSDL declara soapAction vacía: se manda vacía a propósito.
                "SOAPAction": "",
                "accept": "text/xml",
            },
            body: sobre,
            signal: control.signal,
        });
        const texto = await res.text();
        return leerRespuesta(texto, res.status);
    } finally {
        clearTimeout(reloj);
    }
}

export interface ResultadoEnvio {
    ok: boolean;
    /** Cierto cuando el fallo es de los que no se arreglan reintentando. */
    definitivo: boolean;
    respuesta: RespuestaMir | null;
    /** El XML que se ha mandado, tal cual, para poder auditarlo. */
    xmlEnviado: string;
    intentos: number;
    mensaje: string;
}

/** Códigos que no tiene sentido reintentar: hay que arreglar algo antes. */
const NO_REINTENTAR = new Set([10103, 10107, 10111, 10118, 10119, 10120, 10121, 10130, 10131]);

/**
 * Manda un parte de viajeros. Reintenta las caídas de red y los 5xx; no
 * reintenta lo que el Ministerio rechaza por contenido o por credenciales.
 */
export async function mandarParte(opts: {
    codigoEstablecimiento: string;
    contrato: ContratoParte;
    viajeros: ViajeroParte[];
}): Promise<ResultadoEnvio> {
    const xml = xmlParteViajeros(opts);
    const zip = await zipDeUnFichero("parte-viajeros.xml", new TextEncoder().encode(xml));
    const sobre = sobreComunicacion(aBase64(zip));

    let ultimo: RespuestaMir | null = null;
    let ultimoError = "";

    for (let intento = 1; intento <= INTENTOS; intento++) {
        try {
            const r = await llamar(sobre);
            ultimo = r;

            if (r.httpStatus >= 200 && r.httpStatus < 300 && r.codigo === 0) {
                return {
                    ok: true, definitivo: false, respuesta: r, xmlEnviado: xml,
                    intentos: intento,
                    mensaje: r.lote ? `Recibido. Lote ${r.lote}` : "Recibido por el Ministerio",
                };
            }

            const definitivo = r.codigo != null && NO_REINTENTAR.has(r.codigo);
            ultimoError = explicaCodigo(r.codigo, r.descripcion)
                + (r.httpStatus >= 400 ? ` · HTTP ${r.httpStatus}` : "");
            if (definitivo || r.httpStatus === 401 || r.httpStatus === 403) {
                return {
                    ok: false, definitivo: true, respuesta: r, xmlEnviado: xml,
                    intentos: intento, mensaje: ultimoError,
                };
            }
        } catch (e) {
            ultimoError = e instanceof Error ? e.message : String(e);
        }
        if (intento < INTENTOS) await espera(ESPERAS_MS[intento - 1] ?? 4000);
    }

    return {
        ok: false, definitivo: false, respuesta: ultimo, xmlEnviado: xml,
        intentos: INTENTOS,
        mensaje: ultimoError || "No hubo respuesta del servicio",
    };
}

export interface ResultadoLote {
    consultado: boolean;
    aceptado: boolean | null;
    codigosComunicacion: string[];
    errores: string[];
    crudo: string;
}

/**
 * Pregunta cómo quedó un lote. Nunca lanza: si no se puede consultar,
 * devuelve `consultado: false` y quien llama deja el estado como estaba.
 */
export async function consultarLote(lote: string): Promise<ResultadoLote> {
    try {
        const r = await llamar(sobreConsultaLote(lote));
        if (r.httpStatus < 200 || r.httpStatus >= 300) {
            return { consultado: false, aceptado: null, codigosComunicacion: [], errores: [], crudo: r.crudo };
        }
        const codigos = todasLasEtiquetas(r.crudo, "codigoComunicacion").filter(Boolean);
        const errores = todasLasEtiquetas(r.crudo, "descripcion")
            .filter((d) => d && !/^ok$/i.test(d));
        // Sin ningún código de comunicación no se puede afirmar que esté
        // aceptado: se deja en null (no se sabe) antes que mentir.
        const aceptado = codigos.length > 0 ? true : (errores.length > 0 ? false : null);
        return { consultado: true, aceptado, codigosComunicacion: codigos, errores, crudo: r.crudo };
    } catch (e) {
        return {
            consultado: false, aceptado: null, codigosComunicacion: [],
            errores: [e instanceof Error ? e.message : String(e)], crudo: "",
        };
    }
}

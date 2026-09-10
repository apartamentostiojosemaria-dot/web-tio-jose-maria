// Cliente del servicio web de Hospedajes (Ministerio del Interior)
// ================================================================
// Fuentes: «MIR-HOSPE-DSI-WS — Servicio de Hospedajes · Comunicaciones»
// v3.1.2 e «Instrucciones para el alta masiva» v1.1.0, releídas enteras el
// 10-sep-2026. De ahí salen todos los nombres de elemento y los códigos.
// El detalle está en `docs/PARTE-VIAJEROS.md`; lo imprescindible, aquí:
//
//   1. Autenticación HTTP Basic, NO WS-Security. Cabecera SOAP vacía y
//      `SOAPAction` vacía. El certificado sólo hace falta por navegador.
//   2. El XML no viaja en claro: ZIP de verdad + Base64 (error 10111 si no).
//   3. `codigoArrendador` va en la cabecera SOAP; `codigoEstablecimiento`,
//      dentro del XML comprimido. Son cosas distintas.
//   4. El orden de los elementos importa: los esquemas son `xsd:sequence`.
//   5. `codigo/codigoRetorno = 0` es «recibido y encolado», NO «aceptado».
//   6. Son TRES operaciones y esta función hace las tres:
//        A + PV → parte de viajeros    (al entrar,   art. 6.3.b)
//        A + RH → reserva de hospedaje (al reservar, art. 6.3.a)
//        B      → anulación            (al cancelar, art. 6.3.a). Sin
//        `tipoComunicacion`: viaja una lista de `codigoComunicacion`, los que
//        devolvió la consulta del lote de la reserva. Sin ellos no se anula.
//
// Nombre del elemento del documento: en el SERVICIO WEB es `numeroDocumento`
// (anexo II de la especificación, ejemplo completo); en la plantilla de alta
// masiva la misma cosa se llama `documento` (Instrucciones §3). Son dos
// canales distintos y aquí se habla por el servicio web. Esto cierra el hueco
// 12 de `docs/CHECKIN-LEGAL.md`, que estaba abierto por no tener las dos
// fuentes delante a la vez.
//
// Endpoints (§2.1): pruebas `hospedajes.pre-ses.mir.es`, producción
// `hospedajes.ses.mir.es`, ruta `/hospedajes-web/ws/v1/comunicacion`.
//
// ✅ VERIFICADO CONTRA LOS XSD REALES (10-sep-2026), no sólo contra el PDF:
// `comunicacion.wsdl` v3.1.1 y los esquemas `tiposGenerales.xsd`,
// `altaParteHospedaje.xsd`, `comunicacion.xsd` y `tipoComunicacion.xsd`. De ahí
// salen, ya sin suposiciones:
//   · el orden EXACTO de `contratoHospedajeType`, `personaHospedajeType`,
//     `pagoType` y `direccionType` — el de este fichero coincide campo a campo;
//   · que el elemento del documento es `numeroDocumento` (cierra el hueco 12);
//   · que `internet` es de tipo `siNoType`, y que `siNoType` tiene
//     `base="xsd:boolean"` — o sea `true`/`false`, NO «SI»/«NO». El nombre del
//     tipo engaña; el `base` no;
//   · que `rolPersonaType` admite VI, CP, CS y TI;
//   · que la cabecera es `cabeceraLoteType` = codigoArrendador, aplicacion,
//     tipoOperacion (A/B/C) y tipoComunicacion OPCIONAL — por eso se omite en
//     la anulación;
//   · el shape real de `consultaLote`, que NO era el que se suponía.
//
// Lo único que sigue SIN confirmar es el namespace del XSD de la RESERVA
// (`altaReservaHospedaje`): entre los ficheros que trae el paquete están los
// del parte, los generales y los de comunicación, pero no el de la reserva.
// Ver `NS_ALTA_RESERVA` en `config.ts`.
//
// Nota: el WSDL tiene además una operación `anulacionLote(lote)` que anula un
// LOTE entero de una vez. Aquí se usa la otra vía —`comunicacion` con
// `tipoOperacion` = `B` y la lista de `codigoComunicacion`, la del anexo III—
// porque anula comunicaciones concretas y es la que la especificación
// documenta como anulación. Si algún día conviene, `anulacionLote` está ahí y
// como mandamos una comunicación por lote sería equivalente.

import {
    ALTA_MINISTERIO, APLICACION, ESPERAS_MS, ESTABLECIMIENTO, INTENTOS,
    NS_ALTA_PARTE, NS_ALTA_RESERVA, NS_ANULACION, PARENTESCO_TAMBIEN_EN_EL_MENOR,
    SECRETOS, TIMEOUT_MS,
} from "./config.ts";
import { aBase64, zipDeUnFichero } from "./zip.ts";
import {
    codigoParentesco, codigoParentescoReciproco, esMenorDeEdad,
    type ContratoParte, type ViajeroParte,
} from "./parte-modelo.ts";

const NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/";
const NS_COMUNICACION = "http://www.soap.servicios.hospedajes.mir.es/comunicacion";

const esc = (s: string | null | undefined): string =>
    String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Etiqueta que sólo sale si hay valor (los `minOccurs="0"` del esquema). */
const opt = (etiqueta: string, valor: string | null | undefined): string =>
    valor ? `<${etiqueta}>${esc(valor)}</${etiqueta}>` : "";

const soloFecha = (iso: string): string => String(iso).slice(0, 10);

/** Recorta a la longitud máxima que admite el esquema. */
const corta = (s: string | null | undefined, n: number): string =>
    String(s ?? "").trim().slice(0, n);

/**
 * `<pago>`, común al parte y a la reserva (Instrucciones §7.2). Sólo
 * `tipoPago` es obligatorio. **El titular no se rellena con nada supuesto**:
 * si viene vacío, el elemento no se emite. Un registro incompleto es un
 * problema; uno que afirma algo falso es peor.
 */
function pagoXml(c: ContratoParte): string {
    return [
        "<pago>",
        `<tipoPago>${esc(c.medioPago)}</tipoPago>`,
        opt("fechaPago", c.fechaPago ? soloFecha(c.fechaPago) : ""),
        opt("medioPago", corta(c.identificacionMedioPago, 50)),
        opt("titular", corta(c.titularPago, 100)),
        opt("caducidadTarjeta", corta(c.caducidadTarjeta, 7)),
        "</pago>",
    ].join("");
}

/** `<direccion>` del domicilio de un viajero (Instrucciones §7.1). */
function direccionXml(v: ViajeroParte): string {
    const esEspana = (v.pais || "ESP").toUpperCase() === "ESP";
    return [
        "<direccion>",
        `<direccion>${esc(corta(v.direccion, 100))}</direccion>`,
        // `codigoMunicipio` es el código INE y sólo vale para municipios
        // españoles. No se le pide al huésped —sería una casilla más en un
        // formulario que tiene que hacerse en tres minutos—, así que va el
        // nombre, que el esquema admite.
        opt("nombreMunicipio", corta(v.municipio, 100)),
        `<codigoPostal>${esc(corta(v.codigoPostal, 20))}</codigoPostal>`,
        `<pais>${esc(v.pais || (esEspana ? "ESP" : ""))}</pais>`,
        "</direccion>",
    ].join("");
}

/**
 * `<persona>` del PARTE. Orden del `xsd:sequence` de `personaHospedajeType`.
 * El parentesco va en la ficha del ADULTO; ver
 * `PARENTESCO_TAMBIEN_EN_EL_MENOR` en `config.ts` para el recíproco del menor.
 */
function personaXml(v: ViajeroParte, viajeros: ViajeroParte[]): string {
    let parentesco = "";
    if (!esMenorDeEdad(v.edad) && v.parentesco && v.parentescoMenorId) {
        parentesco = codigoParentesco(v.parentesco);
    } else if (esMenorDeEdad(v.edad) && PARENTESCO_TAMBIEN_EN_EL_MENOR) {
        const adulto = viajeros.find((a) => a.parentescoMenorId === v.id && a.parentesco);
        if (adulto) parentesco = codigoParentescoReciproco(adulto.parentesco);
    }

    // Un menor sin documento propio no lleva bloque de documento: el MIR lo
    // pide sólo «si la persona es mayor de edad», y mandar el tipo sin el
    // número hace saltar su validación.
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
        direccionXml(v),
        opt("telefono", corta(v.telefonoMovil, 20)),
        opt("telefono2", corta(v.telefonoFijo, 20)),
        opt("correo", corta(v.correo, 250)),
        opt("parentesco", parentesco),
        "</persona>",
    ].join("");
}

/** `<contrato>`, en el orden de `contratoHospedajeType`. */
function contratoXml(c: ContratoParte): string {
    return [
        "<contrato>",
        `<referencia>${esc(corta(c.referencia, 50))}</referencia>`,
        `<fechaContrato>${esc(soloFecha(c.fechaContrato))}</fechaContrato>`,
        // Fecha Y hora. Si no se conoce, `c.fechaEntrada` ya trae T00:00:00,
        // que es lo que el MIR pide para ese caso. Antes había un 16:00 fijo
        // que nadie había medido.
        `<fechaEntrada>${esc(c.fechaEntrada)}</fechaEntrada>`,
        `<fechaSalida>${esc(c.fechaSalida)}</fechaSalida>`,
        `<numPersonas>${c.numPersonas}</numPersonas>`,
        // Dormitorios del apartamento concreto, no un 1 para los cuatro.
        `<numHabitaciones>${c.numHabitaciones}</numHabitaciones>`,
        // `internet` es Booleano en el esquema y el ejemplo del anexo II manda
        // `false`. Se mandaba «SI»/«NO», que no es un booleano.
        `<internet>${c.conexionInternet ? "true" : "false"}</internet>`,
        pagoXml(c),
        "</contrato>",
    ].join("");
}

/** XML interior del alta de PARTE DE VIAJEROS. Es el que se comprime. */
export function xmlParteViajeros(opts: {
    codigoEstablecimiento: string;
    contrato: ContratoParte;
    viajeros: ViajeroParte[];
}): string {
    const personas = opts.viajeros.map((v) => personaXml(v, opts.viajeros)).join("");
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

/**
 * XML interior del alta de RESERVA (§3.1.1.2 de la especificación y §4 de las
 * Instrucciones). NO es la misma estructura que la del parte:
 *   · cuelga un `<establecimiento>` de cada `<comunicacion>`, no un
 *     `codigoEstablecimiento` suelto;
 *   · el bloque `persona` obligatorio es el del TITULAR DEL CONTRATO (rol
 *     `TI`), donde sólo `nombre` y `apellido1` son obligatorios más una forma
 *     de contacto;
 *   · el documento es opcional: al reservar no se le ha pedido el DNI a nadie
 *     y no hay que inventarlo.
 */
export function xmlReservaHospedaje(opts: {
    codigoEstablecimiento: string;
    contrato: ContratoParte;
}): string {
    const c = opts.contrato;
    const t = c.titularContrato;

    // El establecimiento se identifica por su código cuando se tiene, que es
    // lo que la especificación exige a las empresas de hospedaje. En modo
    // preparado no hay código: se manda el bloque descriptivo, que es la
    // alternativa del esquema, para que el documento guardado sea completo.
    const establecimiento = opts.codigoEstablecimiento
        && !opts.codigoEstablecimiento.startsWith("PENDIENTE")
        ? `<establecimiento><codigo>${esc(corta(opts.codigoEstablecimiento, 10))}</codigo></establecimiento>`
        : [
            "<establecimiento>",
            "<datosEstablecimiento>",
            `<tipo>${esc(ALTA_MINISTERIO.tipoEstablecimiento)}</tipo>`,
            `<nombre>${esc(corta(ALTA_MINISTERIO.denominacion, 50))}</nombre>`,
            "<direccion>",
            `<direccion>${esc(corta(ESTABLECIMIENTO.direccion, 100))}</direccion>`,
            `<codigoMunicipio>${esc(ESTABLECIMIENTO.codigoMunicipio)}</codigoMunicipio>`,
            `<codigoPostal>${esc(ESTABLECIMIENTO.codigoPostal)}</codigoPostal>`,
            "<pais>ESP</pais>",
            "</direccion>",
            "</datosEstablecimiento>",
            "</establecimiento>",
        ].join("");

    const titular = [
        "<persona>",
        "<rol>TI</rol>",
        `<nombre>${esc(corta(t.nombre, 50))}</nombre>`,
        `<apellido1>${esc(corta(t.apellido1, 50))}</apellido1>`,
        opt("apellido2", corta(t.apellido2, 50)),
        opt("telefono", corta(t.telefono, 20)),
        opt("correo", corta(t.correo, 50)),
        "</persona>",
    ].join("");

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<alt:peticion xmlns:alt="${NS_ALTA_RESERVA}">`,
        "<solicitud>",
        "<comunicacion>",
        establecimiento,
        contratoXml(c),
        titular,
        "</comunicacion>",
        "</solicitud>",
        "</alt:peticion>",
    ].join("");
}

/**
 * XML interior de la ANULACIÓN (anexo III). Es la lista de códigos de
 * comunicación que devolvió la consulta del lote de la reserva.
 */
export function xmlAnulacion(codigos: string[]): string {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<anul:comunicaciones xmlns:anul="${NS_ANULACION}">`,
        ...codigos.map((c) => `<anul:codigoComunicacion>${esc(c)}</anul:codigoComunicacion>`),
        "</anul:comunicaciones>",
    ].join("");
}

/**
 * Sobre SOAP de `comunicacion`. `tipoComunicacion` sólo se manda en las altas:
 * lo dice la especificación y el ejemplo de anulación del anexo III no lo lleva.
 */
function sobreComunicacion(
    solicitudBase64: string,
    tipoOperacion: "A" | "B",
    tipoComunicacion: "PV" | "RH" | null,
): string {
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
        `<tipoOperacion>${tipoOperacion}</tipoOperacion>`,
        tipoComunicacion ? `<tipoComunicacion>${tipoComunicacion}</tipoComunicacion>` : "",
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
 * ✅ **Confirmado contra el XSD real** (`comunicacion.xsd` v3.1.1,
 * 10-sep-2026). Y no era lo que parecía: `consultaLoteRequest` **no lleva
 * `<peticion>` ni `<cabecera>`**, al contrario que `comunicacion`. Es
 * directamente una lista de lotes:
 *
 *     <consultaLoteRequest>
 *       <codigosLote><lote>UUID</lote>…</codigosLote>
 *     </consultaLoteRequest>
 *
 * La versión anterior lo construía «por simetría» con `comunicacion` y habría
 * fallado en la primera consulta. Es exactamente el motivo por el que estaba
 * marcada con un ⚠️ y por el que la consulta nunca cambia un estado si falla.
 */
function sobreConsultaLote(lote: string): string {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:com="${NS_COMUNICACION}">`,
        "<soapenv:Header/>",
        "<soapenv:Body>",
        "<com:consultaLoteRequest>",
        "<codigosLote>",
        `<lote>${esc(lote)}</lote>`,
        "</codigosLote>",
        "</com:consultaLoteRequest>",
        "</soapenv:Body>",
        "</soapenv:Envelope>",
    ].join("");
}

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
    // La documentación del Ministerio se contradice: el anexo usa
    // <codigoRetorno> y la tabla del §3.1.2 usa <codigo>. Se leen los dos.
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

/** Códigos de error del apartado 5 de la especificación. */
export const ERRORES_MIR: Record<number, string> = {
    0: "Recibido correctamente",
    10103: "El código de arrendador no existe",
    10107: "Usuario o contraseña incorrectos",
    10111: "El fichero no va como XML en UTF-8, comprimido en zip y en Base64",
    10118: "Error de formato en el XML",
    10119: "El arrendador no puede hacer este tipo de comunicaciones",
    10120: "El arrendador no tiene habilitado el envío por servicio web",
    10121: "Error de validación de los datos",
    10122: "Tipo de comunicación no válido (sólo PV, RH, AV y RV)",
    10130: "Valor incorrecto en un campo",
    10131: "Falta un campo obligatorio",
    10999: "Error no controlado en el servicio",
};

export const explicaCodigo = (codigo: number | null, descripcion: string | null): string => {
    if (codigo == null) return descripcion || "Respuesta sin código";
    return ERRORES_MIR[codigo] ? `${ERRORES_MIR[codigo]} (${codigo})` : `${descripcion || "Error"} (${codigo})`;
};

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
                "SOAPAction": "",   // el WSDL la declara vacía
                "accept": "text/xml",
            },
            body: sobre,
            signal: control.signal,
        });
        return leerRespuesta(await res.text(), res.status);
    } finally {
        clearTimeout(reloj);
    }
}

export interface ResultadoEnvio {
    ok: boolean;
    /** Cierto cuando el fallo no se arregla reintentando. */
    definitivo: boolean;
    respuesta: RespuestaMir | null;
    /** El XML que se ha mandado, tal cual, para poder auditarlo. */
    xmlEnviado: string;
    intentos: number;
    mensaje: string;
}

/** Códigos que no tiene sentido reintentar: hay que arreglar algo antes. */
const NO_REINTENTAR = new Set([10103, 10107, 10111, 10118, 10119, 10120, 10121, 10122, 10130, 10131]);

/**
 * Manda una comunicación cualquiera de las tres. Reintenta las caídas de red y
 * los 5xx; no reintenta lo que el MIR rechaza por contenido o credenciales.
 */
async function mandar(
    xml: string,
    tipoOperacion: "A" | "B",
    tipoComunicacion: "PV" | "RH" | null,
    nombreFichero: string,
): Promise<ResultadoEnvio> {
    const zip = await zipDeUnFichero(nombreFichero, new TextEncoder().encode(xml));
    const sobre = sobreComunicacion(aBase64(zip), tipoOperacion, tipoComunicacion);

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
        intentos: INTENTOS, mensaje: ultimoError || "No hubo respuesta del servicio",
    };
}

/** Parte de viajeros: alta (A) de tipo PV. Art. 6.3.b, al entrar. */
export function mandarParte(opts: {
    codigoEstablecimiento: string;
    contrato: ContratoParte;
    viajeros: ViajeroParte[];
}): Promise<ResultadoEnvio> {
    return mandar(xmlParteViajeros(opts), "A", "PV", "parte-viajeros.xml");
}

/** Reserva de hospedaje: alta (A) de tipo RH. Art. 6.3.a, al reservar. */
export function mandarReserva(opts: {
    codigoEstablecimiento: string;
    contrato: ContratoParte;
}): Promise<ResultadoEnvio> {
    return mandar(xmlReservaHospedaje(opts), "A", "RH", "reserva-hospedaje.xml");
}

/** Anulación: operación B, sin tipo de comunicación. Art. 6.3.a, al anular. */
export function mandarAnulacion(codigos: string[]): Promise<ResultadoEnvio> {
    return mandar(xmlAnulacion(codigos), "B", null, "anulacion.xml");
}

export interface ResultadoLote {
    consultado: boolean;
    aceptado: boolean | null;
    codigosComunicacion: string[];
    errores: string[];
    crudo: string;
}

/**
 * Pregunta cómo quedó un lote. Nunca lanza: si no se puede consultar devuelve
 * `consultado: false` y quien llama deja el estado como estaba.
 *
 * Los `codigoComunicacion` que devuelve NO son decoración: son lo que hace
 * falta para poder ANULAR esa comunicación después. Por eso se guardan.
 */
export async function consultarLote(lote: string): Promise<ResultadoLote> {
    try {
        const r = await llamar(sobreConsultaLote(lote));
        if (r.httpStatus < 200 || r.httpStatus >= 300) {
            return { consultado: false, aceptado: null, codigosComunicacion: [], errores: [], crudo: r.crudo };
        }
        // `resultadoType` del XSD: cada comunicación del lote vuelve con
        // `codigoComunicacion`, `tipoError` y `error`. El `descripcion` de
        // fuera es el del lote entero.
        const codigos = todasLasEtiquetas(r.crudo, "codigoComunicacion").filter(Boolean);
        const errores = [
            ...todasLasEtiquetas(r.crudo, "error"),
            ...todasLasEtiquetas(r.crudo, "descripcion"),
        ].filter((d) => d && !/^ok$/i.test(d));
        // Sin ningún código no se puede afirmar que esté aceptado: se deja en
        // null (no se sabe) antes que mentir.
        const aceptado = codigos.length > 0 ? true : (errores.length > 0 ? false : null);
        return { consultado: true, aceptado, codigosComunicacion: codigos, errores, crudo: r.crudo };
    } catch (e) {
        return {
            consultado: false, aceptado: null, codigosComunicacion: [],
            errores: [e instanceof Error ? e.message : String(e)], crudo: "",
        };
    }
}

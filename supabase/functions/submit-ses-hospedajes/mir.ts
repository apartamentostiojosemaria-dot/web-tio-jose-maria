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
        // Domicilio en España: `codigoMunicipio` (INE, 5 cifras) y NO el
        // nombre. El esquema admite `nombreMunicipio` para todos, pero la
        // validación del Ministerio lo rechaza si el país es ESP
        // («Código de municipio obligatorio si el país es España»,
        // 19-sep-2026, lote 233e973c…). Fuera de España va el nombre.
        // El código lo pone la base (migración 0042); si falta, el parte ni
        // sale: `pegasDelParte` lo para antes.
        esEspana && v.codigoMunicipio
            ? `<codigoMunicipio>${esc(v.codigoMunicipio)}</codigoMunicipio>`
            : opt("nombreMunicipio", corta(v.municipio, 100)),
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

// Cadena de confianza del MIR — NO es un secreto: son certificados publicos de la FNMT
// ====================================================================================
// `hospedajes.ses.mir.es` presenta SU certificado y NADA MAS: no manda los
// intermedios. Un navegador o curl lo salvan porque descargan el que falta por
// su cuenta (AIA); Deno no hace eso y la conexion muere con
// `invalid peer certificate: UnknownIssuer`. Comprobado el 17-sep-2026: el
// servidor devuelve 1 solo certificado y `openssl` da error 21.
//
// Remedio: llevamos nosotros la cadena. Bajada de las direcciones que declara
// el propio certificado del Ministerio (`CA Issuers` -> www.cert.fnmt.es).
//   · AC Componentes Informaticos (intermedio) caduca el 24-jun-2028
//   · AC RAIZ FNMT-RCM (raiz)                  caduca el  1-ene-2030
const CADENA_FNMT = [
`-----BEGIN CERTIFICATE-----
MIIG1jCCBL6gAwIBAgIQNMarBE42mRJRyCULbJTWwDANBgkqhkiG9w0BAQsFADA7
MQswCQYDVQQGEwJFUzERMA8GA1UECgwIRk5NVC1SQ00xGTAXBgNVBAsMEEFDIFJB
SVogRk5NVC1SQ00wHhcNMTMwNjI0MTA1MjU5WhcNMjgwNjI0MTA1MjU5WjBHMQsw
CQYDVQQGEwJFUzERMA8GA1UECgwIRk5NVC1SQ00xJTAjBgNVBAsMHEFDIENvbXBv
bmVudGVzIEluZm9ybcOhdGljb3MwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
AoIBAQCXVx8rdbF7/xY44CaSqzzGo5BhvzA8knxC/3KJYVzTf+CkOvMxMUDub8b0
h38MDujm/RKZhBNOWbKhxF3U61ZVhcR9xOCciuS/soT80m3BByxAKcZsNka0jCA4
XRkglDaAFxCHEZ06MOnvXsSOZDfPYahbQ3VFCVycJuhlHdAwSpmceQwcRYkR6YgX
wTiyzCNGivMKAmRS3dItqDOmDW/nxiDFq/Jd8VWY7GFkwbbAeqYId8FjN8zfvafu
nsB9SLFkUjPPMeqfmC7Bdh7HMxLpaOXROwH201cmlebiPkn0xSFxXFqwhhr6yN8U
QYZ3O/+xdHLrS6DS9+CJUF6d09ijAgMBAAGjggLIMIICxDASBgNVHRMBAf8ECDAG
AQH/AgEAMA4GA1UdDwEB/wQEAwIBBjAdBgNVHQ4EFgQUGfhYLxTWpsybBJgIDUzX
qwCng2UwgZgGCCsGAQUFBwEBBIGLMIGIMEkGCCsGAQUFBzABhj1odHRwOi8vb2Nz
cGZubXRyY21jYS5jZXJ0LmZubXQuZXMvb2NzcGZubXRyY21jYS9PY3NwUmVzcG9u
ZGVyMDsGCCsGAQUFBzAChi9odHRwOi8vd3d3LmNlcnQuZm5tdC5lcy9jZXJ0cy9B
Q1JBSVpGTk1UUkNNLmNydDAfBgNVHSMEGDAWgBT3fcX9xOiaG3dkp/UdoMy/h2Ca
bTCB6wYDVR0gBIHjMIHgMIHdBgRVHSAAMIHUMCkGCCsGAQUFBwIBFh1odHRwOi8v
d3d3LmNlcnQuZm5tdC5lcy9kcGNzLzCBpgYIKwYBBQUHAgIwgZkMgZZTdWpldG8g
YSBsYXMgY29uZGljaW9uZXMgZGUgdXNvIGV4cHVlc3RhcyBlbiBsYSBEZWNsYXJh
Y2nDs24gZGUgUHLDoWN0aWNhcyBkZSBDZXJ0aWZpY2FjacOzbiBkZSBsYSBGTk1U
LVJDTSAoIEMvIEpvcmdlIEp1YW4sIDEwNi0yODAwOS1NYWRyaWQtRXNwYcOxYSkw
gdQGA1UdHwSBzDCByTCBxqCBw6CBwIaBkGxkYXA6Ly9sZGFwZm5tdC5jZXJ0LmZu
bXQuZXMvQ049Q1JMLE9VPUFDJTIwUkFJWiUyMEZOTVQtUkNNLE89Rk5NVC1SQ00s
Qz1FUz9hdXRob3JpdHlSZXZvY2F0aW9uTGlzdDtiaW5hcnk/YmFzZT9vYmplY3Rj
bGFzcz1jUkxEaXN0cmlidXRpb25Qb2ludIYraHR0cDovL3d3dy5jZXJ0LmZubXQu
ZXMvY3Jscy9BUkxGTk1UUkNNLmNybDANBgkqhkiG9w0BAQsFAAOCAgEAo2bsQ2xL
Dcyodieqjd+uy/lfxDw/MbrAq/ZaNFkIlcypUYamOM4vrm5rz8oLjPCoLkJ48P+n
P08Gkcl5Q6q6VFcZLia+U3gfHXrkyqToQlrtViGCGH3xA4u56XtMHGXSdk9vQ0yD
nW5f7bUEkp+uvcKewrOvNcpbIAgD4eU7gdOS0w7BagcFRBgTKBw2s3z73fRZtouJ
g/atmWYtXbBsfNjph+pCh+h5sbSyZUVzO5AemyjpYYYNMWDQrTXq+7O8zIPuPaNE
SjEexuzn+VjHG90RlUK1LygARi+Ir0opD2w6erb/hK8Eea7MFdKQ2ASqNBGJggNo
5vfPVvjHiL+Antmh7mQSKL+4YwFU64d4KK9k0C1mbJethDQFKcjTK1vMvnXFiups
IuyTqwKauo7u2zMKzY4r3VYOW9TpMyLPFIY8pII5GyNzXlL0F4nscOvduTEPEYqx
eNJfpDDPY/DO8WfxgdRTy2W3D/UoAulb+Y+nuzGGCtFQrsSMQX487R+aY0nWot/h
ajef6BcPuxhDfQrg5IafrISVmcJAplb3tXhh0sz7RbYz6jf1bke4eU5fnrTMtGlV
teUL2vjrfUPHW07kBJuaQ7sxORNV3bpHisOnHj+AriQzCn5vINpSHW6hTm7IfRkb
ltu/aQrsMuUhP7HE/v+uXe5CuboV5ubZhHU=
-----END CERTIFICATE-----`,
`-----BEGIN CERTIFICATE-----
MIIFgzCCA2ugAwIBAgIPXZONMGc2yAYdGsdUhGkHMA0GCSqGSIb3DQEBCwUAMDsx
CzAJBgNVBAYTAkVTMREwDwYDVQQKDAhGTk1ULVJDTTEZMBcGA1UECwwQQUMgUkFJ
WiBGTk1ULVJDTTAeFw0wODEwMjkxNTU5NTZaFw0zMDAxMDEwMDAwMDBaMDsxCzAJ
BgNVBAYTAkVTMREwDwYDVQQKDAhGTk1ULVJDTTEZMBcGA1UECwwQQUMgUkFJWiBG
Tk1ULVJDTTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBALpxgHpMhm5/
yBNtwMZ9HACXjywMI7sQmkCpGreHiPibVmr75nuOi5KOpyVdWRHbNi63URcfqQgf
BBckWKo3Shjf5TnUV/3XwSyRAZHiItQDwFj8d0fsjz50Q7qsNI1NOHZnjrDIbzAz
WHFctPVrbtQBULgTfmxKo0nRIBnuvMApGGWn3v7v3QqQIecaZ5JCEJhfTzC8PhxF
tBDXaEAUwED653cXeuYLj2VbPNmaUtu1vZ5Gzz3rkQUCwJaydkxNEJY7kvqcfw+Z
374jNUUeAlz+taibmSXaXvMiwzn15Cou08YfxGyqxRxqAQVKL9LFwag0Jl1mpdIC
IfkYtwb1TplvqKtMUejPUBjFd8g5CSxJkjKZqLsXF3mwWsXmo8RZZUc1g16p6DUL
mbvkzSDGm0oGObVo/CK67lWMK07q87Hj/LaZmtVC+nFNCM+HHmpxffnTtOmlcYF7
wk5HlqX2doWjKI/pgG6BU6VtX7hI+cL5NqYuSf+4lsKMB7ObiFj86xsc3i1w4peS
MKGJ47xVqCfWS+2QrYv6YyVZLag13cqXM7zlzced0ezvXg5KkAYmY6252TUtB7p2
ZSysV4999AeU14ECll2jB0nVetBX+RvnU0Z1qrB5QstocQjpYL05ac70r8NWQMet
UqIJ5G+GR4of6ygnXYMgrwTJbFaai0b1AgMBAAGjgYMwgYAwDwYDVR0TAQH/BAUw
AwEB/zAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYEFPd9xf3E6Jobd2Sn9R2gzL+H
YJptMD4GA1UdIAQ3MDUwMwYEVR0gADArMCkGCCsGAQUFBwIBFh1odHRwOi8vd3d3
LmNlcnQuZm5tdC5lcy9kcGNzLzANBgkqhkiG9w0BAQsFAAOCAgEAB5BK3/MjTvDD
nFFlm5wioooMhfNzKWtN/gHiqQxjAb8EZ6WdmF/9ARP67Jpi6Yb+tmLSbkyU+8B1
RXxlDPiyN8+sD8+Nb/kZ94/sHvJwnvDKuO+3/3Y3dlv2bojzr2IyIpMNOmqOFGYM
LVN0V2Ue1bLdI4E7pWYjJ2cJj+F3qkPNZVEI7VFY/uY5+ctHhKQV8Xa7pO6kO8Rf
77IzlhEYt8llvhjho6Tc+hj507wTmzl6NLrTQfv6MooqtyuGC2mDOL7Nii4LcK2N
JpLuHvUBKwrZ1pebbuCoGRw6IYsMHkCtA+fdZn71uSANA+iW+YJF1DngoABd15jm
fZ5nc8OaKveri6E6FO80vFIOiZiaBECEHX5FaZNXzuvO+FB8TxxuBEOb+dY7Ixjp
6o7RTUaN8Tvkasq6+yO3m/qZASlaWFot4/nUbQ4mrcFuNLwy+AwF+mWj2zs3gyLp
1txyM/1d8iC9djwj2ij3+RvrWWTV3F9yfiD8zYm1kGdNYno/Tq0dwzn+evQoFt9B
9kiABdcPUXmsEKvU7ANm5mqwujGSQkBqvjrTcuFqN1W8rB2Vt2lh8kORdOag0wok
RqEIr9baRRmW1FMdW4R58MD3R++Lj8UGrp1MYp3/RgT408m2ECVAdf4WqslKYIYv
uu8wd+RU4riEmViAqhOLUTpPSPaLtrM=
-----END CERTIFICATE-----`,
];

/**
 * Cliente con la cadena de la FNMT dentro. Se crea una vez.
 * Si el runtime no soporta `createHttpClient`, se queda en undefined y
 * `fetch` va como siempre: peor, pero nunca peta por esto.
 */
const CLIENTE = (() => {
    try {
        // deno-lint-ignore no-explicit-any
        const crear = (Deno as any).createHttpClient;
        return typeof crear === "function" ? crear({ caCerts: CADENA_FNMT }) : undefined;
    } catch (e) {
        console.error("[mir] no se pudo crear el cliente con la cadena FNMT:", e);
        return undefined;
    }
})();

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
            // La cadena de la FNMT, que el servidor del MIR no manda.
            ...(CLIENTE ? { client: CLIENTE } : {}),
        } as RequestInit);
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

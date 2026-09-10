// Configuración del parte de viajeros — ÚNICA FUENTE DE VERDAD
// ============================================================
// Todo lo que define QUIÉN comunica, A DÓNDE y CON QUÉ credenciales vive
// aquí. Nada de esto se escribe a mano en otro fichero.

/** Datos del alojamiento y de su titular (arrendador, en el lenguaje del MIR). */
export const ESTABLECIMIENTO = {
    nombre: "Apartamentos Rurales Tío José María",
    titular: "Jesús Martínez Sánchez",
    nif: "26433801Q",
    nifDisplay: "26433801-Q",
    direccion: "Calle Baja 1, 23486 Hinojares, Jaén, España",
    municipio: "Hinojares (Jaén)",
    codigoMunicipio: "23044",          // INE: Hinojares, provincia 23 (Jaén)
    codigoPostal: "23486",
    registroTuristico: "VTAR/JA/00044",
    email: "apartamentostiojosemaria@gmail.com",
    telefono: "+34676344675",
    web: "https://tiojosemaria.com",
} as const;

/** Paleta de marca, la misma de la web, los emails y las facturas. */
export const MARCA = {
    verde: { r: 0x55 / 255, g: 0x6b / 255, b: 0x2f / 255 },        // #556B2F
    verdeOscuro: { r: 0x2c / 255, g: 0x33 / 255, b: 0x19 / 255 },  // #2C3319
    arena: { r: 0x8c / 255, g: 0x84 / 255, b: 0x68 / 255 },        // #8C8468
    linea: { r: 0xf0 / 255, g: 0xed / 255, b: 0xe6 / 255 },        // #F0EDE6
} as const;

// ---------------------------------------------------------------------------
// Credenciales del servicio web del Ministerio del Interior
// ---------------------------------------------------------------------------
// El acceso por navegador a la plataforma Hospedajes va con certificado
// digital o Cl@ve. El acceso de MÁQUINA (que es el que usa esta función) va
// con un USUARIO y una CONTRASEÑA propios del servicio web, distintos del
// acceso por navegador, más el código de arrendador y el de establecimiento
// que asigna el Ministerio al dar de alta el alojamiento marcando la casilla
// de comunicación por servicio web.
//
// Se ponen como secretos del proyecto Supabase (Settings → Edge Functions →
// Secrets), NUNCA en el repositorio:
//
//   SES_WS_USER          usuario del servicio web
//   SES_WS_PASSWORD      contraseña del servicio web
//   SES_ARRENDADOR       código de arrendador (10 dígitos)
//   SES_ESTABLECIMIENTO  código de establecimiento del alojamiento
//   SES_ENDPOINT         URL del servicio (pruebas o producción)
//
// Mientras falte cualquiera de los cinco, la función trabaja en MODO
// PREPARADO: genera el documento, lo guarda y deja el parte marcado como
// «pendiente de alta». Nunca revienta y nunca dice que ha mandado algo que
// no ha mandado.

export const SECRETOS = {
    usuario: Deno.env.get("SES_WS_USER") ?? "",
    contrasena: Deno.env.get("SES_WS_PASSWORD") ?? "",
    arrendador: Deno.env.get("SES_ARRENDADOR") ?? "",
    establecimiento: Deno.env.get("SES_ESTABLECIMIENTO") ?? "",
    endpoint: Deno.env.get("SES_ENDPOINT") ?? "",
} as const;

/** Cierto sólo cuando están los cinco secretos y se puede enviar de verdad. */
export function hayCredenciales(): boolean {
    return Boolean(
        SECRETOS.usuario && SECRETOS.contrasena
        && SECRETOS.arrendador && SECRETOS.establecimiento
        && SECRETOS.endpoint,
    );
}

/** Qué secretos faltan, para poder decirlo en el informe sin adivinar. */
export function secretosQueFaltan(): string[] {
    const faltan: string[] = [];
    if (!SECRETOS.usuario) faltan.push("SES_WS_USER");
    if (!SECRETOS.contrasena) faltan.push("SES_WS_PASSWORD");
    if (!SECRETOS.arrendador) faltan.push("SES_ARRENDADOR");
    if (!SECRETOS.establecimiento) faltan.push("SES_ESTABLECIMIENTO");
    if (!SECRETOS.endpoint) faltan.push("SES_ENDPOINT");
    return faltan;
}

// ---------------------------------------------------------------------------
// Envíos: reintentos
// ---------------------------------------------------------------------------
/** Intentos totales por parte (el primero incluido). */
export const INTENTOS = 3;
/** Espera entre intentos, en milisegundos. Crece: 1 s, 4 s. */
export const ESPERAS_MS = [1000, 4000];
/** Tiempo máximo de una llamada al servicio antes de darla por colgada. */
export const TIMEOUT_MS = 25_000;

// ---------------------------------------------------------------------------
// Estados que se guardan en `traveler_records.mir_response_status`
// ---------------------------------------------------------------------------
// Ojo con estos valores: la vista `v_parte_estado` (migración 0008) los lee
// para pintar el semáforo de la pantalla sencilla. Tal y como está hoy:
//   · submitted_at IS NOT NULL                       → «mandado»
//   · mir_response_status IN (error,retry,rechazado) → «no se pudo mandar»
//   · mir_response_status = 'enviado_a_mano'         → columna `mandado_a_mano`
// Por eso un parte RECHAZADO por el Ministerio se guarda como 'error' y se
// le quita `submitted_at`: así el semáforo no dice «mandado» de algo que el
// Ministerio no ha aceptado. El detalle de por qué lo rechazó vive en
// `mir_response_payload`. Desde `0008` la vista cuenta también el literal
// 'rechazado', por si algún día se prefiere guardarlo con su propio nombre.
export const ESTADO = {
    /** Recibido por el Ministerio (hay lote); la validación es posterior. */
    EN_CURSO: "enviado_pendiente_acuse",
    /** Confirmado: el lote se procesó y la comunicación quedó grabada. */
    ACEPTADO: "aceptado",
    /** El Ministerio lo rechazó. Se guarda como error para que salte a la vista. */
    RECHAZADO: "error",
    /** No hay credenciales todavía: documento generado, sin enviar. */
    PENDIENTE_DE_ALTA: "pendiente_de_alta",
    /** Falló la llamada (red, 5xx, tiempo agotado). Se reintenta. */
    REINTENTAR: "retry",
    /** Lo mandó la persona del alojamiento por su vía de siempre. */
    MANDADO_A_MANO: "enviado_a_mano",
} as const;

/** Nombre de la aplicación que se identifica ante el Ministerio (cabecera). */
export const APLICACION = "Apartamentos Tio Jose Maria";

/** Tipo de establecimiento en el catálogo del Ministerio. */
export const TIPO_ESTABLECIMIENTO = "VTAR";

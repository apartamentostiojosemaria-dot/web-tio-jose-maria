// Configuración del parte de viajeros — ÚNICA FUENTE DE VERDAD
// ============================================================
// Quién comunica, a dónde y con qué credenciales. Nada de esto se escribe
// a mano en otro fichero. El porqué de cada decisión está en
// `docs/PARTE-VIAJEROS.md` y en `docs/CHECKIN-LEGAL.md`.

/** Datos del alojamiento y de su titular (arrendador, en el lenguaje del MIR). */
export const ESTABLECIMIENTO = {
    nombre: "Apartamentos Rurales Tío José María",
    titular: "Jesús Martínez Sánchez",
    nif: "26433801Q",
    nifDisplay: "26433801-Q",
    direccion: "Calle Baja 1, 23486 Hinojares, Jaén, España",
    municipio: "Hinojares",
    provincia: "Jaén",
    codigoMunicipio: "23044",          // INE: Hinojares, provincia 23 (Jaén)
    codigoPostal: "23486",
    registroTuristico: "VTAR/JA/00044",
    email: "apartamentostiojosemaria@gmail.com",
    telefono: "+34676344675",
    web: "https://tiojosemaria.com",
} as const;

/**
 * Lo que se declara en el ALTA PREVIA (art. 6.1 y 6.2 RD 933/2021). No viaja
 * en el parte de cada estancia. La acción `estado` de la función lo devuelve,
 * para que se vea en el panel y se note el día que deje de ser verdad.
 */
export const ALTA_MINISTERIO = {
    /**
     * Tabla 8.6 del MIR. `AP_RURAL` = apartamento rural. **`VTAR` no existe
     * en ese catálogo**: es la figura administrativa andaluza, no un código
     * del Ministerio. Hasta el 10-sep-2026 esta constante decía "VTAR" y
     * además no la leía nadie.
     */
    tipoEstablecimiento: "AP_RURAL",
    denominacion: ESTABLECIMIENTO.nombre,
    /**
     * Anexo I A.1.h. La lista real vive en `apartments.anuncio_urls`
     * (migración 0010): cada apartamento se anuncia por separado y las URL
     * cambian. Aquí sólo queda dicho qué canales hay que declarar.
     */
    canalesQueSeAnuncian: [
        "web propia", "Booking", "Airbnb", "Escapada Rural", "CasasRurales.net",
    ],
} as const;

/** Paleta de marca, la misma de la web, los emails y las facturas. */
export const MARCA = {
    verde: { r: 0x55 / 255, g: 0x6b / 255, b: 0x2f / 255 },        // #556B2F
    verdeOscuro: { r: 0x2c / 255, g: 0x33 / 255, b: 0x19 / 255 },  // #2C3319
    arena: { r: 0x8c / 255, g: 0x84 / 255, b: 0x68 / 255 },        // #8C8468
    linea: { r: 0xf0 / 255, g: 0xed / 255, b: 0xe6 / 255 },        // #F0EDE6
} as const;

// ---------------------------------------------------------------------------
// Secretos (Supabase → Edge Functions → Secrets). NUNCA en el repositorio.
// ---------------------------------------------------------------------------
//   SES_WS_USER · SES_WS_PASSWORD   usuario y contraseña del servicio web
//   SES_ARRENDADOR                  código de arrendador (10 dígitos)
//   SES_ESTABLECIMIENTO             código de establecimiento
//   SES_ENDPOINT                    URL del servicio (pruebas o producción)
//   SES_CRON_TOKEN                  llave compartida con los crones (Vault)
//   SES_NS_RESERVA                  (opcional) corrige el namespace de la RH
//
// Mientras falte cualquiera de los cinco primeros, la función trabaja en MODO
// PREPARADO: genera el documento, lo guarda y lo deja «pendiente de alta».
// Nunca revienta y nunca dice que ha mandado algo que no ha mandado.
export const SECRETOS = {
    usuario: Deno.env.get("SES_WS_USER") ?? "",
    contrasena: Deno.env.get("SES_WS_PASSWORD") ?? "",
    arrendador: Deno.env.get("SES_ARRENDADOR") ?? "",
    establecimiento: Deno.env.get("SES_ESTABLECIMIENTO") ?? "",
    endpoint: Deno.env.get("SES_ENDPOINT") ?? "",
    llaveDeCron: Deno.env.get("SES_CRON_TOKEN") ?? "",
} as const;

/** Cierto sólo cuando están los cinco y se puede enviar de verdad. */
export function hayCredenciales(): boolean {
    return Boolean(
        SECRETOS.usuario && SECRETOS.contrasena && SECRETOS.arrendador
        && SECRETOS.establecimiento && SECRETOS.endpoint,
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

/** Intentos por envío (el primero incluido) y esperas entre ellos. */
export const INTENTOS = 3;
export const ESPERAS_MS = [1000, 4000];
/** Tiempo máximo de una llamada al servicio antes de darla por colgada. */
export const TIMEOUT_MS = 25_000;
/**
 * Minutos que espera el barrido antes de reintentar una reserva o anulación
 * fallida, según los intentos ya hechos. El plazo legal es de 24 h y el
 * barrido corre cada hora: hay sitio de sobra para no machacar un servicio
 * caído.
 */
export const ESPERA_BARRIDO_MIN = [5, 15, 60, 180, 360];

/**
 * Estados de `traveler_records.mir_response_status`. Los lee la vista
 * `v_parte_estado` (migración 0008) para pintar el semáforo:
 *   · submitted_at NOT NULL                          → «mandado»
 *   · estado IN (error, retry, rechazado)            → «no se pudo mandar»
 *   · estado = 'enviado_a_mano'                      → `mandado_a_mano`
 * Un parte RECHAZADO se guarda como 'error' y se le quita `submitted_at`,
 * para que el semáforo no diga «mandado» de algo que el MIR no ha aceptado.
 */
export const ESTADO = {
    EN_CURSO: "enviado_pendiente_acuse",   // recibido; la validación es posterior
    ACEPTADO: "aceptado",
    RECHAZADO: "error",
    PENDIENTE_DE_ALTA: "pendiente_de_alta",
    REINTENTAR: "retry",
    MANDADO_A_MANO: "enviado_a_mano",
} as const;

/**
 * Estados de `ses_comunicaciones` (migración 0010), para la reserva y la
 * anulación. Aquí un rechazo sí se llama 'rechazado': esta tabla no la lee el
 * semáforo del parte.
 */
export const ESTADO_SES = {
    PENDIENTE: "pendiente",
    PENDIENTE_DE_ALTA: "pendiente_de_alta",
    EN_CURSO: "enviado_pendiente_acuse",
    ACEPTADO: "aceptado",
    RECHAZADO: "rechazado",
    REINTENTAR: "retry",
    NO_PROCEDE: "no_procede",
    MANDADO_A_MANO: "enviado_a_mano",
} as const;

/** Nombre con el que la aplicación se identifica ante el Ministerio. */
export const APLICACION = "Apartamentos Tio Jose Maria";
/** Cubo privado donde se archiva el libro-registro (migración 0010). */
export const CUBO_LIBRO_REGISTRO = "libro-registro";
/** La base guarda UTC; el MIR quiere la hora del alojamiento. */
export const ZONA = "Europe/Madrid";

// Espacios de nombres de los XML interiores. Los tres primeros están
// confirmados: el del parte, contra el `targetNamespace` de
// `altaParteHospedaje.xsd`; los otros dos, contra los anexos II y III de la
// especificación.
export const NS_ALTA_PARTE = "http://www.neg.hospedajes.mir.es/altaParteHospedaje";
export const NS_ANULACION = "http://www.neg.hospedajes.mir.es/anularComunicacion";
export const NS_CONSULTA = "http://www.neg.hospedajes.mir.es/consultarComunicacion";
/**
 * ⚠️ El de la RESERVA **sigue sin confirmar**, y es lo ÚNICO que queda así.
 * La especificación lo enseña en una figura (§3.1.1.2) que el texto no
 * transcribe, y el paquete de esquemas que se pudo abrir el 10-sep-2026
 * (`comunicacion.wsdl`, `tiposGenerales.xsd`, `altaParteHospedaje.xsd`,
 * `comunicacion.xsd`, `tipoComunicacion.xsd`) **no incluye el de la reserva**.
 * Éste va por simetría con `altaParteHospedaje`.
 *
 * Se corrige **sin desplegar nada** poniendo el secreto `SES_NS_RESERVA`. Si
 * el MIR devuelve 10118 (formato del XML) en la primera reserva, mirar esto
 * antes que nada.
 */
export const NS_ALTA_RESERVA = Deno.env.get("SES_NS_RESERVA")
    ?? "http://www.neg.hospedajes.mir.es/altaReservaHospedaje";

/**
 * ¿Se emite también el parentesco RECÍPROCO en la ficha del menor?
 *
 * Las dos fuentes del MIR no dicen lo mismo: las *Instrucciones* exigen que lo
 * lleve informado un ADULTO, y el ejemplo del anexo II lo pone en la ficha del
 * MENOR (`HJ`). Emitir los dos satisface las dos lecturas y las dos
 * afirmaciones son ciertas. Si el MIR rechazara el del menor, `false` y ya:
 * el del adulto, que es el que exige la norma escrita, se sigue mandando.
 */
export const PARENTESCO_TAMBIEN_EN_EL_MENOR = true;

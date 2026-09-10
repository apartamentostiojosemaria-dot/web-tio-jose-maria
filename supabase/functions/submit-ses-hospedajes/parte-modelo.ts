// Modelo del parte de viajeros
// ============================
// Traduce lo que hay en la base (`traveler_records` + `guest_bookings`) al
// vocabulario del anexo I del RD 933/2021, que es el que entienden tanto la
// hoja de registro en papel como el servicio web del Ministerio.
//
// Aquí NO se habla con nadie: sólo se transforma. Así el mismo modelo sirve
// para el PDF y para el XML, y no puede haber dos verdades.

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ViajeroParte {
    id: string;
    esTitular: boolean;
    nombre: string;
    apellido1: string;
    apellido2: string | null;
    /** 'H' hombre · 'M' mujer · 'O' otro/no consta */
    sexo: string;
    /** Código del anexo: NIF · NIE · PAS · OTRO */
    tipoDocumento: string;
    numeroDocumento: string;
    /** Número de soporte (el de la esquina del DNI / IDESP). */
    soporteDocumento: string | null;
    /** ISO 3166-1 alfa-3. */
    nacionalidad: string;
    /** AAAA-MM-DD */
    fechaNacimiento: string;
    direccion: string;
    municipio: string;
    codigoPostal: string;
    /** ISO 3166-1 alfa-3. */
    pais: string;
    telefonoFijo: string | null;
    telefonoMovil: string | null;
    correo: string | null;
    /** Sólo cuando el viajero es menor de edad. */
    parentesco: string | null;
    firmaBase64: string | null;
    /** Opcional: algunos modelos de hoja en papel la piden. El anexo I no. */
    fechaExpedicion?: string | null;
    /** Años cumplidos el día de la entrada. */
    edad: number;
}

export interface ContratoParte {
    bookingId: number;
    referencia: string;
    alojamiento: string | null;
    /** AAAA-MM-DD */
    fechaContrato: string;
    fechaEntrada: string;
    fechaSalida: string;
    numPersonas: number;
    /** Código del anexo: EFECT · TARJT · TRANS · PLATF · DESTI · MOVIL · OTRO */
    medioPago: string;
    fechaPago: string | null;
    /** Titular del medio de pago, cuando se conoce. */
    titularPago: string | null;
    /** Internet en el alojamiento (dato del inmueble en el anexo I). */
    conexionInternet: boolean;
}

// ---------------------------------------------------------------------------
// Códigos y etiquetas
// ---------------------------------------------------------------------------

/**
 * Tipo de documento. El formulario del huésped guarda las letras cortas que
 * usaba la hoja de la Guardia Civil (D, P, N, C, E, X); el anexo del RD y la
 * plataforma del Ministerio hablan de NIF / NIE / PAS / OTRO.
 */
const DOCUMENTO: Record<string, { codigo: string; etiqueta: string }> = {
    D: { codigo: "NIF", etiqueta: "DNI" },
    NIF: { codigo: "NIF", etiqueta: "DNI" },
    DNI: { codigo: "NIF", etiqueta: "DNI" },
    N: { codigo: "NIE", etiqueta: "NIE / TIE" },
    NIE: { codigo: "NIE", etiqueta: "NIE / TIE" },
    TIE: { codigo: "NIE", etiqueta: "NIE / TIE" },
    P: { codigo: "PAS", etiqueta: "Pasaporte" },
    PAS: { codigo: "PAS", etiqueta: "Pasaporte" },
    C: { codigo: "OTRO", etiqueta: "Permiso de conducir UE" },
    E: { codigo: "OTRO", etiqueta: "Documento de identidad UE" },
    I: { codigo: "OTRO", etiqueta: "Otro documento oficial" },
    X: { codigo: "OTRO", etiqueta: "Otro documento oficial" },
    OTRO: { codigo: "OTRO", etiqueta: "Otro documento oficial" },
};

export const codigoDocumento = (v: string | null | undefined): string =>
    DOCUMENTO[String(v || "").toUpperCase()]?.codigo ?? "OTRO";

export const etiquetaDocumento = (v: string | null | undefined): string =>
    DOCUMENTO[String(v || "").toUpperCase()]?.etiqueta ?? "Otro documento oficial";

/**
 * Sexo. El catálogo del Ministerio es H / M / O; la columna `sexo` de
 * `traveler_records` tiene un CHECK que admite H / M / **X**. Se traduce
 * aquí: la X de la base es la O del Ministerio.
 */
export const codigoSexo = (v: string | null | undefined): string => {
    const s = String(v || "").toUpperCase();
    if (s === "H" || s === "M") return s;
    if (s === "F") return "M";          // por si llega en inglés
    return "O";                         // X (base), O, vacío o cualquier otra cosa
};

export const etiquetaSexo = (v: string | null | undefined): string =>
    ({ H: "Hombre", M: "Mujer" }[codigoSexo(v)] ?? "No consta");

/** Medio de pago, en los códigos del anexo I. */
const PAGO: Record<string, string> = {
    efectivo: "EFECT",
    tarjeta: "TARJT",
    stripe: "TARJT",
    card: "TARJT",
    transferencia: "TRANS",
    bizum: "MOVIL",
    booking: "PLATF",
    airbnb: "PLATF",
    escapada: "PLATF",
    casasrurales: "PLATF",
    plataforma: "PLATF",
    destino: "DESTI",
    treg: "TREG",
    otro: "OTRO",
};

export const codigoPago = (v: string | null | undefined): string =>
    PAGO[String(v || "").toLowerCase()] ?? "OTRO";

const ETIQUETA_PAGO: Record<string, string> = {
    EFECT: "Efectivo",
    TARJT: "Tarjeta",
    TRANS: "Transferencia",
    MOVIL: "Pago por móvil (Bizum)",
    PLATF: "Cobrado por la plataforma de reservas",
    DESTI: "Se paga al llegar",
    TREG: "Tarjeta regalo",
    OTRO: "Otro",
};

export const etiquetaPago = (v: string | null | undefined): string =>
    ETIQUETA_PAGO[codigoPago(v)] ?? "Otro";

/** Catálogo de parentesco del Ministerio (tabla TIPO_PARENTESCO). */
const PARENTESCO: Record<string, string> = {
    AB: "Abuelo/a",
    BA: "Bisabuelo/a",
    BN: "Bisnieto/a",
    CD: "Cuñado/a",
    CY: "Cónyuge",
    HJ: "Hijo/a",
    HR: "Hermano/a",
    NI: "Nieto/a",
    PM: "Padre o madre",
    SB: "Sobrino/a",
    SG: "Suegro/a",
    TI: "Tío/a",
    YN: "Yerno o nuera",
    TU: "Tutor/a",
    OT: "Otro",
};

/**
 * Lo que hoy admite la base y su equivalente en el catálogo del Ministerio.
 *
 * Desde la migración `0008` el CHECK de `traveler_records.parentesco` YA admite
 * el catálogo entero del MIR (AB BA BN CD CY HJ HR NI PM SB SG TI YN TU OT) más
 * el heredado 'PA'. Lo que sigue recortado es el FORMULARIO
 * (`src/pages/PrecheckinPage.jsx`, lista PARENTESCOS), que aún ofrece sólo
 * cuatro opciones; ampliarlo es lo que queda pendiente.
 *
 * Esta tabla traduce los códigos heredados: 'PA' no existe en el catálogo del
 * Ministerio, su equivalente es 'PM'. Los códigos del catálogo pasan tal cual:
 * `codigoParentesco()` devuelve la clave sin tocar si está en `PARENTESCO`.
 */
const PARENTESCO_BD_A_MIR: Record<string, string> = {
    PA: "PM",   // padre o madre
    AB: "AB",   // abuelo o abuela
    TU: "TU",   // tutor o tutora
    OT: "OT",   // otro
};

const ETIQUETA_PARENTESCO_BD: Record<string, string> = {
    PA: "Padre o madre",
    AB: "Abuelo/a",
    TU: "Tutor/a",
    OT: "Otro",
};

export const etiquetaParentesco = (v: string | null | undefined): string => {
    const k = String(v || "").toUpperCase();
    if (ETIQUETA_PARENTESCO_BD[k]) return ETIQUETA_PARENTESCO_BD[k];
    if (PARENTESCO[k]) return PARENTESCO[k];
    return v ? String(v) : "No indicado";
};

export const codigoParentesco = (v: string | null | undefined): string => {
    const k = String(v || "").toUpperCase();
    if (PARENTESCO_BD_A_MIR[k]) return PARENTESCO_BD_A_MIR[k];
    return PARENTESCO[k] ? k : "OT";
};

/** Nombre en castellano de los países que salen de verdad en las reservas. */
const PAISES: Record<string, string> = {
    ESP: "España", PRT: "Portugal", FRA: "Francia", DEU: "Alemania",
    ITA: "Italia", GBR: "Reino Unido", NLD: "Países Bajos", BEL: "Bélgica",
    IRL: "Irlanda", CHE: "Suiza", AUT: "Austria", POL: "Polonia",
    SWE: "Suecia", NOR: "Noruega", DNK: "Dinamarca", FIN: "Finlandia",
    USA: "Estados Unidos", CAN: "Canadá", MEX: "México", ARG: "Argentina",
    BRA: "Brasil", CHL: "Chile", COL: "Colombia", PER: "Perú",
    URY: "Uruguay", VEN: "Venezuela", ECU: "Ecuador", MAR: "Marruecos",
    ROU: "Rumanía", RUS: "Rusia", CHN: "China", JPN: "Japón",
    AUS: "Australia", NZL: "Nueva Zelanda",
};

export const nombrePais = (iso: string | null | undefined): string => {
    const k = String(iso || "").toUpperCase();
    return PAISES[k] ?? (k || "—");
};

/** Deja un código de país en ISO-3 mayúsculas; si viene raro, España por defecto no: OTRO. */
export const codigoPais = (v: string | null | undefined): string => {
    const k = String(v || "").toUpperCase().trim();
    return /^[A-Z]{3}$/.test(k) ? k : "";
};

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

/** Años cumplidos en una fecha dada. */
export function edadEn(fechaNacimiento: string | null | undefined, referencia: string): number {
    if (!fechaNacimiento) return 99;
    const n = new Date(`${String(fechaNacimiento).slice(0, 10)}T00:00:00Z`);
    const r = new Date(`${String(referencia).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(n.getTime()) || Number.isNaN(r.getTime())) return 99;
    let edad = r.getUTCFullYear() - n.getUTCFullYear();
    const mes = r.getUTCMonth() - n.getUTCMonth();
    if (mes < 0 || (mes === 0 && r.getUTCDate() < n.getUTCDate())) edad -= 1;
    return Math.max(edad, 0);
}

/** Mayores de catorce años tienen que firmar el parte (art. 4 RD 933/2021). */
export const debeFirmar = (edad: number): boolean => edad >= 14;

/** Menores de edad: hay que decir su parentesco con quien los acompaña. */
export const necesitaParentesco = (edad: number): boolean => edad < 18;

// ---------------------------------------------------------------------------
// Conversión desde las filas de la base
// ---------------------------------------------------------------------------

export interface FilaViajero {
    id: string;
    is_titular: boolean;
    nombre: string;
    apellido_primero: string;
    apellido_segundo: string | null;
    sexo: string;
    tipo_documento: string;
    numero_documento: string;
    soporte_documento: string | null;
    nacionalidad: string;
    fecha_nacimiento: string;
    direccion_via: string;
    direccion_municipio: string;
    direccion_cp: string;
    direccion_pais: string;
    telefono_fijo: string | null;
    telefono_movil: string | null;
    email: string | null;
    parentesco: string | null;
    firma_base64: string | null;
    fecha_expedicion_documento?: string | null;
}

export interface FilaReserva {
    id: number;
    booking_code: string;
    check_in: string;
    check_out: string;
    pax_count: number | null;
    created_at: string;
    payment_method: string | null;
    channel: string | null;
    guest_name: string | null;
    apartments?: { name?: string | null } | null;
}

export function aViajero(f: FilaViajero, fechaEntrada: string): ViajeroParte {
    return {
        id: f.id,
        esTitular: !!f.is_titular,
        nombre: (f.nombre || "").trim(),
        apellido1: (f.apellido_primero || "").trim(),
        apellido2: (f.apellido_segundo || "").trim() || null,
        sexo: codigoSexo(f.sexo),
        tipoDocumento: codigoDocumento(f.tipo_documento),
        numeroDocumento: (f.numero_documento || "").toUpperCase().trim(),
        soporteDocumento: (f.soporte_documento || "").toUpperCase().trim() || null,
        nacionalidad: codigoPais(f.nacionalidad),
        fechaNacimiento: String(f.fecha_nacimiento || "").slice(0, 10),
        direccion: (f.direccion_via || "").trim(),
        municipio: (f.direccion_municipio || "").trim(),
        codigoPostal: (f.direccion_cp || "").trim(),
        pais: codigoPais(f.direccion_pais),
        telefonoFijo: (f.telefono_fijo || "").trim() || null,
        telefonoMovil: (f.telefono_movil || "").trim() || null,
        correo: (f.email || "").trim() || null,
        parentesco: f.parentesco || null,
        firmaBase64: f.firma_base64 || null,
        fechaExpedicion: f.fecha_expedicion_documento ?? null,
        edad: edadEn(f.fecha_nacimiento, fechaEntrada),
    };
}

export function aContrato(r: FilaReserva, cuantosViajeros: number): ContratoParte {
    // El medio de pago sale de la reserva; si vino de una plataforma, manda
    // la plataforma (es quien cobra), y sólo si no, la forma apuntada a mano.
    const canal = String(r.channel || "").toLowerCase();
    const porPlataforma = ["booking", "airbnb", "escapada", "casasrurales"].includes(canal);
    const medio = porPlataforma ? "PLATF" : codigoPago(r.payment_method || "tarjeta");

    return {
        bookingId: r.id,
        referencia: r.booking_code,
        alojamiento: r.apartments?.name ?? null,
        fechaContrato: String(r.created_at || "").slice(0, 10),
        fechaEntrada: String(r.check_in || "").slice(0, 10),
        fechaSalida: String(r.check_out || "").slice(0, 10),
        numPersonas: Math.max(Number(r.pax_count) || cuantosViajeros || 1, cuantosViajeros || 1),
        medioPago: medio,
        fechaPago: null,
        titularPago: r.guest_name ?? null,
        conexionInternet: true,     // los cuatro apartamentos tienen wifi
    };
}

// ---------------------------------------------------------------------------
// Validación: qué le falta a un parte para poder mandarse
// ---------------------------------------------------------------------------

export interface Pega { viajero: string; falta: string }

export function pegasDelParte(viajeros: ViajeroParte[]): Pega[] {
    const pegas: Pega[] = [];
    const quien = (v: ViajeroParte) =>
        [v.nombre, v.apellido1].filter(Boolean).join(" ") || "un viajero";

    for (const v of viajeros) {
        if (!v.nombre) pegas.push({ viajero: quien(v), falta: "el nombre" });
        if (!v.apellido1) pegas.push({ viajero: quien(v), falta: "el primer apellido" });
        // El documento sólo se exige a los mayores de edad: muchos niños no
        // tienen todavía DNI y sus datos los da quien los acompaña.
        if (v.edad >= 18 && !v.numeroDocumento) {
            pegas.push({ viajero: quien(v), falta: "el número del documento" });
        }
        if (!v.fechaNacimiento) pegas.push({ viajero: quien(v), falta: "la fecha de nacimiento" });
        if (!v.nacionalidad) pegas.push({ viajero: quien(v), falta: "la nacionalidad" });
        if (!v.direccion || !v.municipio || !v.pais) {
            pegas.push({ viajero: quien(v), falta: "la dirección de su casa" });
        }
        // Validaciones de negocio del Ministerio (§3.1.1.1 de su spec): con
        // NIF o NIE son obligatorios el segundo apellido y el numero de
        // soporte. Se comprueban aqui para no mandar algo que va a rebotar.
        const documentoEspanol = v.numeroDocumento
            && (v.tipoDocumento === "NIF" || v.tipoDocumento === "NIE");
        if (documentoEspanol && !v.soporteDocumento) {
            pegas.push({ viajero: quien(v), falta: "el número de soporte del documento" });
        }
        if (documentoEspanol && !v.apellido2) {
            pegas.push({ viajero: quien(v), falta: "el segundo apellido" });
        }
        // Al menos una forma de contacto por viajero.
        if (v.edad >= 18 && !v.telefonoMovil && !v.telefonoFijo && !v.correo) {
            pegas.push({ viajero: quien(v), falta: "un teléfono o un correo" });
        }
        if (debeFirmar(v.edad) && !v.firmaBase64) {
            pegas.push({ viajero: quien(v), falta: "la firma" });
        }
        if (necesitaParentesco(v.edad) && !v.esTitular && !v.parentesco) {
            pegas.push({ viajero: quien(v), falta: "de quién es hijo, nieto o sobrino" });
        }
    }
    return pegas;
}

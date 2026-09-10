// Modelo del parte de viajeros
// ============================
// Traduce `traveler_records` + `guest_bookings` + `apartments` al vocabulario
// del anexo I del RD 933/2021. Aquí NO se habla con nadie: sólo se transforma,
// para que el PDF y el XML no puedan tener dos verdades distintas.

import { ZONA } from "./config.ts";

export interface ViajeroParte {
    id: string;
    esTitular: boolean;
    nombre: string;
    apellido1: string;
    apellido2: string | null;
    /** H hombre · M mujer · O otro/no consta */
    sexo: string;
    /** NIF · NIE · PAS · OTRO */
    tipoDocumento: string;
    numeroDocumento: string;
    /** Número de soporte del DNI/TIE (IDESP). */
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
    /** Qué es esta persona del MENOR al que acompaña. Va en la ficha del ADULTO. */
    parentesco: string | null;
    /** Fila del menor sobre el que se declara ese parentesco. */
    parentescoMenorId: string | null;
    firmaBase64: string | null;
    /** Años cumplidos el día de la entrada. */
    edad: number;
}

export interface ContratoParte {
    bookingId: number;
    referencia: string;
    alojamiento: string | null;
    /** AAAA-MM-DD */
    fechaContrato: string;
    /** AAAA-MM-DDThh:mm:ss, ya resuelto: hora real o T00:00:00. */
    fechaEntrada: string;
    fechaSalida: string;
    /** Falso cuando la hora es un T00:00:00 de «no se sabe». */
    horaEntradaConocida: boolean;
    horaSalidaConocida: boolean;
    numPersonas: number;
    /** Dormitorios del apartamento (anexo I A.4.c), desde `apartments`. */
    numHabitaciones: number;
    /** Internet en el alojamiento (anexo I A.4.c), desde `apartments`. */
    conexionInternet: boolean;
    /** `tipoPago`: EFECT · TARJT · TRANS · PLATF · DESTI · MOVIL · TREG · OTRO */
    medioPago: string;
    /** `fechaPago`, AAAA-MM-DD. */
    fechaPago: string | null;
    /** `medioPago`: «VISA ****4242», un IBAN, un teléfono, un localizador. */
    identificacionMedioPago: string | null;
    /** `titular` del medio de pago. Vacío si no se sabe: NUNCA se supone. */
    titularPago: string | null;
    /** `caducidadTarjeta`, MM/AAAA. */
    caducidadTarjeta: string | null;
    /** Bloque `persona` con rol TI de la comunicación de reserva. */
    titularContrato: TitularContrato;
}

/**
 * Titular del contrato para la plantilla de RESERVA. Al reservar no hay
 * ninguna fila de viajero todavía: sólo `guest_name`, `guest_email` y
 * `guest_phone`.
 */
export interface TitularContrato {
    nombre: string;
    apellido1: string;
    apellido2: string | null;
    correo: string | null;
    telefono: string | null;
    /** Falso cuando `guest_name` no da para separar nombre y apellido. */
    completo: boolean;
}

// ---------------------------------------------------------------------------
// Códigos y etiquetas (tablas 8.3 a 8.7 del Ministerio)
// ---------------------------------------------------------------------------

/** El formulario guarda las letras cortas de la hoja antigua; el MIR usa éstas. */
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

/** El catálogo del MIR es H/M/O; la columna admite H/M/O/X. La X es la O. */
export const codigoSexo = (v: string | null | undefined): string => {
    const s = String(v || "").toUpperCase();
    if (s === "H" || s === "M") return s;
    if (s === "F") return "M";
    return "O";
};

export const etiquetaSexo = (v: string | null | undefined): string =>
    ({ H: "Hombre", M: "Mujer" }[codigoSexo(v)] ?? "No consta");

/** Medio de pago, tabla 8.7. Los códigos del catálogo pasan tal cual. */
const PAGO: Record<string, string> = {
    efectivo: "EFECT", tarjeta: "TARJT", stripe: "TARJT", card: "TARJT",
    transferencia: "TRANS", bizum: "MOVIL", booking: "PLATF", airbnb: "PLATF",
    escapada: "PLATF", casasrurales: "PLATF", plataforma: "PLATF",
    destino: "DESTI", treg: "TREG", otro: "OTRO",
    efect: "EFECT", tarjt: "TARJT", platf: "PLATF", trans: "TRANS",
    movil: "MOVIL", desti: "DESTI",
};

export const codigoPago = (v: string | null | undefined): string =>
    PAGO[String(v || "").toLowerCase()] ?? "OTRO";

const ETIQUETA_PAGO: Record<string, string> = {
    EFECT: "Efectivo", TARJT: "Tarjeta", TRANS: "Transferencia",
    MOVIL: "Pago por móvil (Bizum)", PLATF: "Cobrado por la plataforma",
    DESTI: "Se paga al llegar", TREG: "Tarjeta regalo", OTRO: "Otro",
};

export const etiquetaPago = (v: string | null | undefined): string =>
    ETIQUETA_PAGO[codigoPago(v)] ?? "Otro";

/** Parentesco, tabla 8.3. */
const PARENTESCO: Record<string, string> = {
    AB: "Abuelo/a", BA: "Bisabuelo/a", BN: "Bisnieto/a", CD: "Cuñado/a",
    CY: "Cónyuge", HJ: "Hijo/a", HR: "Hermano/a", NI: "Nieto/a",
    PM: "Padre o madre", SB: "Sobrino/a", SG: "Suegro/a", TI: "Tío/a",
    YN: "Yerno o nuera", TU: "Tutor/a", OT: "Otro",
};

/** 'PA' es heredado del primer formulario y no existe en el catálogo: es 'PM'. */
const PARENTESCO_BD_A_MIR: Record<string, string> = { PA: "PM" };
const ETIQUETA_PARENTESCO_BD: Record<string, string> = { PA: "Padre o madre" };

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

/**
 * El parentesco visto desde el otro lado: si el adulto es el padre (PM), el
 * menor es el hijo (HJ). Lo pide el recíproco del ejemplo del anexo II. Las
 * relaciones sin recíproco claro (tutor/a) caen en OT, que es lo honesto.
 */
const RECIPROCO: Record<string, string> = {
    PM: "HJ", HJ: "PM", AB: "NI", NI: "AB", BA: "BN", BN: "BA",
    TI: "SB", SB: "TI", SG: "YN", YN: "SG",
    HR: "HR", CD: "CD", CY: "CY", TU: "OT", OT: "OT",
};

export const codigoParentescoReciproco = (v: string | null | undefined): string =>
    RECIPROCO[codigoParentesco(v)] ?? "OT";

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

/** Deja un país en ISO-3 mayúsculas; si viene raro, cadena vacía. */
export const codigoPais = (v: string | null | undefined): string => {
    const k = String(v || "").toUpperCase().trim();
    return /^[A-Z]{3}$/.test(k) ? k : "";
};

/**
 * Caducidad en el formato del MIR: MM/AAAA (Instrucciones §7.2). El panel
 * puede guardarla como MM/AA, que es como la enseña la tarjeta.
 */
export const caducidadMir = (v: string | null | undefined): string | null => {
    const m = String(v || "").trim().match(/^(0[1-9]|1[0-2])\/([0-9]{2}|[0-9]{4})$/);
    if (!m) return null;
    return `${m[1]}/${m[2].length === 4 ? m[2] : `20${m[2]}`}`;
};

/**
 * Un `timestamptz` en hora de España y en el formato del esquema
 * (AAAA-MM-DDThh:mm:ss). El servidor va en UTC y en verano hay dos horas.
 */
export function aFechaHoraLocal(iso: string): string | null {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    // 'sv-SE' da «AAAA-MM-DD hh:mm:ss», lo más cerca del ISO sin montarlo a mano.
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: ZONA,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(d).replace(" ", "T");
}

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

/** Mayores de catorce años firman el parte (art. 4.2 RD 933/2021). */
export const debeFirmar = (edad: number): boolean => edad >= 14;
/** Menor de edad: obliga a que un adulto declare su parentesco. */
export const esMenorDeEdad = (edad: number): boolean => edad < 18;

/**
 * Parte `guest_name` en nombre y apellidos con la convención española: la
 * primera palabra es el nombre, la segunda el primer apellido, el resto el
 * segundo. Con una sola palabra devuelve `completo: false` y la reserva NO se
 * manda — antes eso que inventarse un apellido en una comunicación policial.
 */
export function partirNombre(completo: string | null | undefined): TitularContrato {
    const t = String(completo || "").trim().split(/\s+/).filter(Boolean);
    const vacio = { correo: null, telefono: null };
    if (t.length === 0) return { nombre: "", apellido1: "", apellido2: null, ...vacio, completo: false };
    if (t.length === 1) return { nombre: t[0], apellido1: "", apellido2: null, ...vacio, completo: false };
    return {
        nombre: t[0], apellido1: t[1], apellido2: t.slice(2).join(" ") || null,
        ...vacio, completo: true,
    };
}

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
    parentesco_menor_id: string | null;
    firma_base64: string | null;
}

export interface FilaReserva {
    id: number;
    booking_code: string;
    contract_reference: string | null;
    check_in: string;
    check_out: string;
    checkin_at: string | null;
    checkout_at: string | null;
    pax_count: number | null;
    created_at: string;
    payment_method: string | null;
    payment_type: string | null;
    payment_instrument: string | null;
    payment_holder: string | null;
    payment_expiry: string | null;
    payment_date: string | null;
    channel: string | null;
    guest_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
    apartments?: {
        name?: string | null;
        num_habitaciones?: number | null;
        tiene_internet?: boolean | null;
    } | null;
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
        parentescoMenorId: f.parentesco_menor_id || null,
        firmaBase64: f.firma_base64 || null,
        edad: edadEn(f.fecha_nacimiento, fechaEntrada),
    };
}

export function aContrato(r: FilaReserva, cuantosViajeros: number): ContratoParte {
    // Manda lo que haya apuntado una persona o el webhook en `payment_type`
    // (vocabulario del MIR). Si no hay nada se deduce: de una plataforma cobra
    // la plataforma; si no, la forma apuntada a mano.
    const canal = String(r.channel || "").toLowerCase();
    const porPlataforma = ["booking", "airbnb", "escapada", "casasrurales"].includes(canal);
    const medio = r.payment_type
        ? codigoPago(r.payment_type)
        : (porPlataforma ? "PLATF" : codigoPago(r.payment_method || "tarjeta"));

    // Si conocemos el momento real se manda; si no, T00:00:00, que es lo que
    // el MIR pide cuando se desconoce la hora. NO se inventa una hora.
    const entradaReal = r.checkin_at ? aFechaHoraLocal(r.checkin_at) : null;
    const salidaReal = r.checkout_at ? aFechaHoraLocal(r.checkout_at) : null;

    const titular = partirNombre(r.guest_name);
    titular.correo = (r.guest_email || "").trim() || null;
    titular.telefono = (r.guest_phone || "").trim() || null;

    return {
        bookingId: r.id,
        referencia: r.contract_reference || r.booking_code,
        alojamiento: r.apartments?.name ?? null,
        fechaContrato: String(r.created_at || "").slice(0, 10),
        fechaEntrada: entradaReal ?? `${String(r.check_in || "").slice(0, 10)}T00:00:00`,
        fechaSalida: salidaReal ?? `${String(r.check_out || "").slice(0, 10)}T00:00:00`,
        horaEntradaConocida: Boolean(entradaReal),
        horaSalidaConocida: Boolean(salidaReal),
        numPersonas: Math.max(Number(r.pax_count) || cuantosViajeros || 1, cuantosViajeros || 1),
        numHabitaciones: Math.max(Number(r.apartments?.num_habitaciones) || 1, 1),
        conexionInternet: r.apartments?.tiene_internet !== false,
        medioPago: medio,
        fechaPago: r.payment_date ? String(r.payment_date).slice(0, 10) : null,
        identificacionMedioPago: (r.payment_instrument || "").trim() || null,
        // El titular NO se supone: vacío, y el XML omite el elemento.
        titularPago: (r.payment_holder || "").trim() || null,
        caducidadTarjeta: caducidadMir(r.payment_expiry),
        titularContrato: titular,
    };
}

/**
 * Endereza en memoria los parentescos que vengan al revés. La RPC
 * `submit_traveler_records` ya los guarda bien (migración 0011) y la `0010`
 * enderezó la tabla; esto es la tercera red, para filas que entren por otra
 * puerta. No toca la base: sólo lo que se va a mandar.
 */
export function enderezaParentescos(viajeros: ViajeroParte[]): ViajeroParte[] {
    const adultos = viajeros.filter((v) => !esMenorDeEdad(v.edad));
    if (adultos.length === 0) return viajeros;

    for (const menor of viajeros.filter((v) => esMenorDeEdad(v.edad))) {
        if (!menor.parentesco) continue;
        if (adultos.some((a) => a.parentescoMenorId === menor.id)) continue;
        const libre = adultos.find((a) => !a.parentescoMenorId);
        if (!libre) continue;
        libre.parentesco = menor.parentesco;
        libre.parentescoMenorId = menor.id;
        menor.parentesco = null;
    }
    return viajeros;
}

// ---------------------------------------------------------------------------
// Validación: qué le falta a un parte para poder mandarse
// ---------------------------------------------------------------------------

export interface Pega { viajero: string; falta: string }

const quien = (v: ViajeroParte) =>
    [v.nombre, v.apellido1].filter(Boolean).join(" ") || "un viajero";

export function pegasDelParte(viajeros: ViajeroParte[]): Pega[] {
    const pegas: Pega[] = [];

    for (const v of viajeros) {
        if (!v.nombre) pegas.push({ viajero: quien(v), falta: "el nombre" });
        if (!v.apellido1) pegas.push({ viajero: quien(v), falta: "el primer apellido" });
        // El documento sólo se exige a los mayores de edad: muchos niños no
        // tienen DNI y sus datos los da quien los acompaña.
        if (v.edad >= 18 && !v.numeroDocumento) {
            pegas.push({ viajero: quien(v), falta: "el número del documento" });
        }
        if (!v.fechaNacimiento) pegas.push({ viajero: quien(v), falta: "la fecha de nacimiento" });
        if (!v.nacionalidad) pegas.push({ viajero: quien(v), falta: "la nacionalidad" });
        if (!v.direccion || !v.municipio || !v.pais) {
            pegas.push({ viajero: quien(v), falta: "la dirección de su casa" });
        }
        // El soporte del documento es obligatorio con NIF y con NIE; el
        // segundo apellido, SÓLO con NIF. Exigírselo también a un NIE es más
        // estricto que la norma y deja fuera a residentes con un apellido.
        const conNifONie = v.numeroDocumento
            && (v.tipoDocumento === "NIF" || v.tipoDocumento === "NIE");
        if (conNifONie && !v.soporteDocumento) {
            pegas.push({ viajero: quien(v), falta: "el número de soporte del documento" });
        }
        if (v.numeroDocumento && v.tipoDocumento === "NIF" && !v.apellido2) {
            pegas.push({ viajero: quien(v), falta: "el segundo apellido" });
        }
        // El MIR exige una de las tres etiquetas telefono/telefono2/correo.
        if (v.edad >= 18 && !v.telefonoMovil && !v.telefonoFijo && !v.correo) {
            pegas.push({ viajero: quien(v), falta: "un teléfono o un correo" });
        }
        if (debeFirmar(v.edad) && !v.firmaBase64) {
            pegas.push({ viajero: quien(v), falta: "la firma" });
        }
    }

    // El parentesco es una regla del GRUPO, no de cada persona: cada menor
    // tiene que tener a un adulto que se declare pariente suyo.
    for (const menor of viajeros.filter((v) => esMenorDeEdad(v.edad))) {
        const loReclama = viajeros.some((a) =>
            !esMenorDeEdad(a.edad) && a.parentesco && a.parentescoMenorId === menor.id);
        if (!loReclama) {
            pegas.push({
                viajero: quien(menor),
                falta: "decir qué es de él el adulto que le acompaña (padre, abuelo, hermano…)",
            });
        }
    }

    return pegas;
}

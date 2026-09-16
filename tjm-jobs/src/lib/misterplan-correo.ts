// Parser de los correos que MisterPlan (RuralGest) manda al Gmail del negocio.
// ============================================================================
// Módulo puro: texto dentro → objeto fuera. Sin red, sin base. Lo usa el job
// `misterplan-correo` y lo prueba `misterplan-correo.test.ts`.
//
// Medido en el buzón real el 16-sep-2026 (977 correos de ruralgest.net desde
// 2024; 27 reservas, 16 cancelaciones y 2 modificaciones de Booking desde
// abril de 2026, 3 pre-reservas y 2 confirmaciones del motor web):
//
//   «Sistema RuralGest - Reserva [3225-8060298]»   → reserva nueva de un canal
//        Reserva: 1-8060298 / Booking.com | AIRBNB OTA / Localizador: … /
//        nombre / correo / «/ +34…» / país / Observaciones … /
//        Importe Total: 135,00€ / «18/09/2026 - 2 noches - 2 personas» /
//        … «(TOMILLO)» …
//   «Cancelación de reserva desde Booking»          → localizador, entrada, noches, apto
//   «Modificación de reserva desde Booking»         → lo mismo, con fechas nuevas
//   «Pre Reserva - APARTAMENTOS … - 8074291»        → motor web, pendiente de pago
//   «Confirmación de reserva -  - 8074291»          → motor web, pagada
//
// El HTML se aplana antes de parsear (los correos de RuralGest traen HTML en
// la parte de texto). Todo lo que no se reconoce sale como kind 'otro'.

export type Kind =
    | "reserva"
    | "cancelacion_booking"
    | "modificacion_booking"
    | "pre_reserva"
    | "confirmacion_web"
    | "otro";

export interface CorreoParseado {
    kind: Kind;
    /** «1-8060298» (referencia de MisterPlan) cuando el correo la trae. */
    misterplanRef?: string;
    /** Localizador del canal (Booking «5978834073», Airbnb «HM9QHEKSHM»). */
    locator?: string;
    /** booking | airbnb | web | otro */
    channel?: string;
    /** Nombre del canal tal cual lo escribe MisterPlan («Booking.com», «AIRBNB OTA»). */
    channelLabel?: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    country?: string;
    /** Slug del apartamento (albahaca | lavanda | romero | tomillo). */
    apartment?: string;
    checkIn?: string;    // YYYY-MM-DD
    checkOut?: string;   // YYYY-MM-DD
    nights?: number;
    pax?: number;
    total?: number;
    /** Solo motor web: anticipo que consta pagado. */
    paid?: number;
    /** Solo Booking: desde cuándo se puede cargar la tarjeta virtual. */
    vccChargeableFrom?: string;
    /** Hora aproximada de llegada si el huésped la dejó. */
    arrivalTime?: string;
    /** Observaciones del huésped / del canal, recortadas. */
    comments?: string;
    /** Por qué no se pudo sacar algo (para la fila de registro). */
    warnings: string[];
}

const APARTAMENTOS: Record<string, string> = {
    ALBAHACA: "albahaca", LAVANDA: "lavanda", ROMERO: "romero", TOMILLO: "tomillo",
};

const CANALES: Array<[RegExp, string]> = [
    [/booking/i, "booking"],
    [/airbnb/i, "airbnb"],
    [/escapada/i, "escapada"],
    [/casasrurales|casas rurales/i, "casasrurales"],
    [/holidu|clubrural|bookiply/i, "holidu"],
];

// ---------------------------------------------------------------------------
// Aplanar HTML → líneas limpias.
// ---------------------------------------------------------------------------
export function aplanar(html: string): string[] {
    const txt = html
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|tr|li|h\d|td|th)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ").replace(/&euro;/gi, "€").replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/Â | /g, " ");
    return txt.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 0);
}

const fecha = (ddmmyyyy: string): string | undefined => {
    const m = ddmmyyyy.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
};
const sumarDias = (ymd: string, n: number): string => {
    const d = new Date(ymd + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
const importe = (s: string): number | undefined => {
    const m = s.replace(/\s/g, "").match(/(-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|-?\d+(?:\.\d{1,2})?)\s*€?/);
    if (!m) return undefined;
    const raw = m[1].includes(",") ? m[1].replace(/\./g, "").replace(",", ".") : m[1];
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
};
const telefono = (s: string): string | undefined => {
    const m = s.match(/\+?\d[\d\s]{6,}\d/);
    if (!m) return undefined;
    const t = m[0].replace(/\s/g, "");
    return /^\+/.test(t) ? t : (t.length === 9 ? `+34${t}` : t);
};
const apartamentoDe = (s: string): string | undefined => {
    const up = s.toUpperCase();
    for (const [nombre, slug] of Object.entries(APARTAMENTOS)) if (up.includes(nombre)) return slug;
    return undefined;
};
const canalDe = (label: string): string => {
    for (const [re, key] of CANALES) if (re.test(label)) return key;
    return "otro";
};
const buscar = (lineas: string[], re: RegExp, desde = 0): number =>
    lineas.findIndex((l, i) => i >= desde && re.test(l));
const valorTras = (lineas: string[], re: RegExp): string | undefined => {
    for (const l of lineas) {
        const m = l.match(re);
        if (m) return (m[1] ?? "").trim();
    }
    return undefined;
};

// ---------------------------------------------------------------------------
// Clasificar por asunto.
// ---------------------------------------------------------------------------
export function clasificar(asunto: string): Kind {
    const a = (asunto || "").trim();
    if (/^Sistema RuralGest - Reserva \[/i.test(a)) return "reserva";
    if (/^Cancelaci[oó]n de reserva desde Booking/i.test(a)) return "cancelacion_booking";
    if (/^Modificaci[oó]n de reserva desde Booking/i.test(a)) return "modificacion_booking";
    if (/^Pre Reserva - /i.test(a)) return "pre_reserva";
    if (/^Confirmaci[oó]n de reserva - /i.test(a)) return "confirmacion_web";
    return "otro";
}

// ---------------------------------------------------------------------------
// Parser principal.
// ---------------------------------------------------------------------------
export function parsearCorreoMisterPlan(asunto: string, cuerpoHtmlOTexto: string): CorreoParseado {
    const kind = clasificar(asunto);
    const out: CorreoParseado = { kind, warnings: [] };
    if (kind === "otro") return out;

    const L = aplanar(cuerpoHtmlOTexto);

    if (kind === "reserva") {
        // Reserva: 1-8060298
        out.misterplanRef = valorTras(L, /^Reserva:\s*([\d-]+)/i);
        // Canal: la primera línea con texto después de «Reserva:» que no sea «-->»
        const iRes = buscar(L, /^Reserva:\s*[\d-]+/i);
        const iLoc = buscar(L, /^Localizador:/i, iRes < 0 ? 0 : iRes);
        if (iLoc > 0) {
            const entre = L.slice(Math.max(iRes + 1, 0), iLoc).filter((l) => l !== "-->" && !/^-+>?$/.test(l));
            out.channelLabel = entre[entre.length - 1];
            if (out.channelLabel) out.channel = canalDe(out.channelLabel);
            out.locator = valorTras(L, /^Localizador:\s*(\S+)/i);
            // Tras el localizador: nombre, [correo], «/ teléfono», [país], Observaciones:
            const iObs = buscar(L, /^Observaciones:/i, iLoc);
            const bloque = L.slice(iLoc + 1, iObs > 0 ? iObs : iLoc + 6);
            for (const l of bloque) {
                if (!out.guestName && !/@/.test(l) && !/^\/?\s*\+?\d/.test(l)) { out.guestName = l; continue; }
                if (!out.guestEmail && /@/.test(l)) { out.guestEmail = l.match(/\S+@\S+/)?.[0]; continue; }
                if (!out.guestPhone && /^\/?\s*\+?\d/.test(l)) { out.guestPhone = telefono(l); continue; }
                if (out.guestName && !out.country && /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ ]+$/.test(l)) out.country = l;
            }
        } else {
            out.warnings.push("no se encontró «Localizador:»");
        }
        const iTot = buscar(L, /^Importe Total:/i);
        if (iTot >= 0) {
            out.total = importe(L[iTot]);
            // «18/09/2026 - 2 noches - 2 personas»
            const iFe = buscar(L, /^\d{2}\/\d{2}\/\d{4}\s*-\s*\d+\s*noches?/i, iTot);
            if (iFe >= 0) {
                const m = L[iFe].match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d+)\s*noches?\s*-\s*(\d+)\s*personas?/i);
                if (m) {
                    out.checkIn = fecha(m[1]);
                    out.nights = Number(m[2]);
                    out.pax = Number(m[3]);
                    if (out.checkIn) out.checkOut = sumarDias(out.checkIn, out.nights);
                }
                // «(TOMILLO)» en las líneas siguientes
                for (const l of L.slice(iFe, iFe + 12)) { const a = apartamentoDe(l); if (a && /\(/.test(l)) { out.apartment = a; break; } }
                if (!out.apartment) for (const l of L.slice(iFe, iFe + 12)) { const a = apartamentoDe(l); if (a) { out.apartment = a; break; } }
            } else out.warnings.push("no se encontró la línea de fechas/noches/personas");
        } else out.warnings.push("no se encontró «Importe Total»");

        // Observaciones (tarjeta virtual, hora de llegada, comentarios)
        const iObs = buscar(L, /^Observaciones:/i);
        if (iObs >= 0) {
            const fin = buscar(L, /^-{4,}$|^Importe Total:/i, iObs + 1);
            const obs = L.slice(iObs + 1, fin > 0 ? fin : iObs + 8).join(" ");
            out.comments = obs.slice(0, 600);
            out.vccChargeableFrom = obs.match(/cargo a partir del (\d{4}-\d{2}-\d{2})/i)?.[1];
            out.arrivalTime = obs.match(/(?:time of arrival|hora (?:aproximada )?de llegada)[^\d]*(\d{1,2}:\d{2}\s*(?:and|y|-|–)\s*\d{1,2}:\d{2})/i)?.[1];
        }
    }

    if (kind === "cancelacion_booking" || kind === "modificacion_booking") {
        out.channel = "booking";
        out.channelLabel = "Booking.com";
        out.locator = valorTras(L, /^Localizador Booking:\s*(\d+)/i)
            ?? valorTras(L, /desde Booking\s+(\d{6,})/i);
        out.checkIn = fecha(valorTras(L, /^Fecha entrada:\s*(\d{2}\/\d{2}\/\d{4})/i) || "");
        const noches = valorTras(L, /^N[ºo°]\s*noches:\s*(\d+)/i);
        if (noches) out.nights = Number(noches);
        if (out.checkIn && out.nights) out.checkOut = sumarDias(out.checkIn, out.nights);
        const tot = valorTras(L, /^Importe Total:\s*(.+)/i);
        if (tot) out.total = importe(tot);
        const iEl = buscar(L, /^Elementos de la reserva/i);
        if (iEl >= 0) {
            for (const l of L.slice(iEl + 1, iEl + 6)) { const a = apartamentoDe(l); if (a) { out.apartment = a; break; } }
            const pax = L.slice(iEl + 1, iEl + 6).map((l) => l.match(/^(\d+)\s*pax/i)?.[1]).find(Boolean);
            if (pax) out.pax = Number(pax);
        }
        out.guestName = valorTras(L, /^Nombre\s*:\s*(.+)/i);
        out.guestEmail = valorTras(L, /^email\s*:\s*(\S+@\S+)/i);
        const tel = valorTras(L, /^Tel[eé]fono\s*:\s*(.+)/i);
        if (tel) out.guestPhone = telefono(tel);
        const iCom = buscar(L, /^Comentario de la reserva/i);
        if (iCom >= 0) {
            const obs = L.slice(iCom + 1, iCom + 6).join(" ");
            out.comments = obs.slice(0, 600);
            out.vccChargeableFrom = obs.match(/cargo a partir del (\d{4}-\d{2}-\d{2})/i)?.[1];
            out.arrivalTime = obs.match(/(?:time of arrival|hora (?:aproximada )?de llegada)[^\d]*(\d{1,2}:\d{2}\s*(?:and|y|-|–)\s*\d{1,2}:\d{2})/i)?.[1];
        }
        if (!out.locator) out.warnings.push("no se encontró el localizador de Booking");
    }

    if (kind === "pre_reserva" || kind === "confirmacion_web") {
        out.channel = "web";
        out.channelLabel = "Motor web de MisterPlan";
        const refAsunto = asunto.match(/(\d{6,})\s*$/)?.[1];
        const refCuerpo = valorTras(L, /con numero\s+([\d-]+)/i);
        out.misterplanRef = refCuerpo || (refAsunto ? `1-${refAsunto}` : undefined);
        out.guestName = valorTras(L, /^Cliente:\s*(.+)/i);
        const tel = valorTras(L, /^Tel[eé]fono:\s*(.+)/i);
        if (tel) out.guestPhone = telefono(tel);
        out.checkIn = fecha(valorTras(L, /^Fecha entrada:\s*(\d{2}\/\d{2}\/\d{4})/i) || "");
        out.checkOut = fecha(valorTras(L, /^Fecha salida:\s*(\d{2}\/\d{2}\/\d{4})/i) || "");
        if (out.checkIn && out.checkOut) {
            out.nights = Math.round((Date.parse(out.checkOut + "T00:00:00Z") - Date.parse(out.checkIn + "T00:00:00Z")) / 86400_000);
        }
        const pax = valorTras(L, /^N[ºo°]\s*personas:\s*(\d+)/i);
        if (pax) out.pax = Number(pax);
        // «ROMERO (08/10/2026)» dentro de los conceptos
        const iCon = buscar(L, /^Conceptos de la reserva/i);
        for (const l of L.slice(iCon >= 0 ? iCon : 0, (iCon >= 0 ? iCon : 0) + 14)) {
            const a = apartamentoDe(l); if (a) { out.apartment = a; break; }
        }
        // Total / Anticipo Pagado / Pagado
        const iTot = buscar(L, /^Total$/i);
        if (iTot >= 0) out.total = importe(L[iTot + 1] || "");
        const iPag = buscar(L, /^Anticipo Pagado$/i);
        if (iPag >= 0) out.paid = importe(L[iPag + 1] || "");
        else if (kind === "confirmacion_web") {
            const iP2 = buscar(L, /^Pagado$/i);
            if (iP2 >= 0) out.paid = importe(L[iP2 + 1] || "");
        }
        if (!out.checkIn || !out.checkOut) out.warnings.push("faltan fechas de entrada/salida");
    }

    if (["reserva", "modificacion_booking", "confirmacion_web"].includes(kind)) {
        if (!out.apartment) out.warnings.push("no se reconoció el apartamento");
        if (!out.checkIn || !out.checkOut) out.warnings.push("faltan fechas");
        if (!out.guestName) out.warnings.push("falta el nombre del huésped");
    }
    return out;
}

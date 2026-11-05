// Nota de una reserva traída del correo de MisterPlan, escrita para la familia (5-nov-2026).
// Jesús, con una reserva de Booking en el panel: la nota decía «Traída del aviso de MisterPlan del…
// (leído el…)», pegaba el texto de relleno de Booking como «Comentario del Cliente», repetía la tarjeta
// virtual y se cortaba a media palabra. Aquí: lo que importa en llano, y lo que escribió el huésped solo
// si de verdad escribió algo.

export type DatosNota = {
    canal: string;                 // booking | airbnb | web | escapada | ...
    locator?: string;              // localizador del portal
    misterplanRef?: string;        // referencia interna de MisterPlan
    total?: number | null;
    nights?: number | null;
    pax?: number | null;
    paid?: number | null;          // anticipo del motor web
    vccChargeableFrom?: string;    // AAAA-MM-DD
    comision?: number | null;
    arrivalTime?: string;
    comments?: string;
    nota?: string;                 // aviso del importador (p. ej. «modificación de una reserva que no estaba»)
};

const euros = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const ddmm = (iso: string) => { const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}` : iso; };
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const NOMBRE: Record<string, string> = { booking: "Booking", airbnb: "Airbnb", web: "la web de MisterPlan", escapada: "Escapada Rural", casasrurales: "CasasRurales.net", holidu: "Holidu" };

/** Corta por palabras, con «…», sin dejar media palabra. */
export function recortar(t: string, max: number): string {
    const s = t.replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    const corte = s.slice(0, max - 1);
    const ultimo = corte.lastIndexOf(" ");
    return (ultimo > max * 0.6 ? corte.slice(0, ultimo) : corte).replace(/[\s,.;:·—-]+$/, "") + "…";
}

/** Plazo de cancelación gratis que avisa Booking (en inglés): «Do not charge if cancelled before AAAA-MM-DD HH:MM:SS». */
export function gratisHasta(comments?: string): string {
    const m = (comments || "").match(/Do not charge if cancell?ed before (\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/i);
    return m ? `${m[3]}/${m[2]} a las ${m[4]}:${m[5]}` : "";
}

/** Lo que escribió el huésped, sin el relleno que añaden Booking y MisterPlan. Vacío si no escribió nada. */
export function comentarioDelHuesped(comments?: string): string {
    if (!comments) return "";
    let t = comments
        .replace(/<[^>]+>/g, " ")                                                                  // <br> y demás HTML
        .replace(/Reservation has a cancell?ation grace period\.?\s*Do not charge if cancell?ed before [\d-]+[ T][\d:]+\.?/gi, " ")
        .replace(/-{2,}\s*\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(:\d{2})?\s*-{2,}/g, " ")        // ---- 05/11/2026 13:01:06 ----
        .replace(/Comentario del Cliente:\s*/gi, " ")
        .replace(/Has recibido una tarjeta de cr[eé]dito virtual para esta reserva\.?/gi, " ")
        .replace(/Puedes hacer el cargo a partir del \d{4}-\d{2}-\d{2}\.?/gi, " ")
        .replace(/Condiciones para la habitaci[oó]n[\s\S]*$/i, " ")                              // condiciones de la tarifa: hasta el final
        .replace(/Approximate time of arrival:?\s*between (\d{1,2}:\d{2}) and (\d{1,2}:\d{2})/gi, "Llegada aproximada entre las $1 y las $2.")
        .replace(/Approximate time of arrival:?\s*/gi, "Llegada aproximada: ")
        .replace(/\s+/g, " ").trim();
    t = t.replace(/^[.,;:\s-]+/, "").trim();
    return t.length < 3 ? "" : recortar(t, 300);
}

export function notaFamilia(d: DatosNota): string {
    const partes: string[] = [];
    const portal = NOMBRE[d.canal] || d.canal;
    partes.push(`Reserva de ${portal}${d.locator ? ` · localizador ${d.locator}` : ""}.`);
    if (d.total != null) {
        partes.push(euros(d.total) + (d.nights ? ` por ${plural(d.nights, "noche", "noches")}` : "") + (d.pax ? `, ${plural(d.pax, "persona", "personas")}` : "") + ".");
    }
    if (d.canal === "booking") {
        partes.push(`La paga Booking con tarjeta virtual${d.vccChargeableFrom ? `: se puede cobrar desde el ${ddmm(d.vccChargeableFrom)}` : ""}.`
            + (d.comision ? ` Comisión de Booking ≈ ${euros(d.comision)}.` : ""));
    } else if (d.canal === "airbnb") {
        partes.push("La cobra Airbnb: no hay que cobrar nada en persona.");
    } else if (d.canal === "web") {
        partes.push(d.paid != null ? `Ha pagado ${euros(d.paid)} de señal por transferencia.` : "Sin dato de pago.");
        partes.push("Su correo no lo da MisterPlan: la confirmación se la mandó MisterPlan.");
    }
    const gratis = gratisHasta(d.comments);
    if (gratis) partes.push(`Puede cancelar gratis hasta el ${gratis}: no cobrar antes.`);
    if (d.arrivalTime) {
        const r = d.arrivalTime.match(/(\d{1,2}:\d{2})\s*(?:and|y|-|–)\s*(\d{1,2}:\d{2})/i);
        partes.push(r ? `Llegará entre las ${r[1]} y las ${r[2]}.` : `Hora de llegada que ha dicho: ${d.arrivalTime.replace(/^between\s+/i, "")}.`);
    }
    const dice = comentarioDelHuesped(d.comments);
    if (dice) partes.push(`El huésped dice: «${dice}»`);
    if (d.nota) partes.push(`Ojo: ${d.nota}.`);
    if (d.misterplanRef) partes.push(`(En MisterPlan: ${d.misterplanRef})`);
    return partes.join(" ");
}

// Serializador iCal (RFC 5545) del exportador.
// ============================================
// Copia propia de `ical-export` para que lo que hay en el repo sea
// exactamente lo que corre en Supabase (el despliegue aplana las rutas y
// `../_shared/ical.ts` llegaba como `./ical.ts`: el repo y lo desplegado
// decian cosas distintas).

export interface EventoIcal {
    /** Va al UID. Tiene que ser ESTABLE entre pasadas: si cambia, el canal de
     *  destino ve un evento nuevo y borra el viejo cada vez. */
    uid: string;
    inicio: string;        // YYYY-MM-DD
    fin: string;           // YYYY-MM-DD (DTEND, exclusivo)
    estado: string;        // hold | pending | confirmed
    titulo: string;
}

const escapeText = (s: string): string =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const dateStamp = (): string => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
           `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
};

const fmtDate = (iso: string): string => iso.replace(/-/g, "");

/** Plegado a 75 octetos (RFC 5545 §3.1). Se cuenta en BYTES, no en
 *  caracteres: con acentos y "—" un corte por caracteres parte un UTF-8 por
 *  la mitad y hay canales que rechazan el feed entero. */
function fold(line: string): string {
    const bytes = new TextEncoder().encode(line);
    if (bytes.length <= 75) return line;

    const dec = new TextDecoder();
    const trozos: string[] = [];
    let pos = 0;
    let primera = true;
    while (pos < bytes.length) {
        const max = primera ? 75 : 74;
        let corte = Math.min(max, bytes.length - pos);
        // No cortar a mitad de un carácter multibyte.
        while (corte > 1 && (bytes[pos + corte] & 0xc0) === 0x80) corte--;
        trozos.push((primera ? "" : " ") + dec.decode(bytes.slice(pos, pos + corte)));
        pos += corte;
        primera = false;
    }
    return trozos.join("\r\n");
}

export function buildIcalFeed(opts: {
    nombreCalendario: string;
    eventos: EventoIcal[];
}): string {
    const stamp = dateStamp();
    const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Apartamentos Tio Jose Maria//ical-export//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        fold(`X-WR-CALNAME:${escapeText(opts.nombreCalendario)}`),
        // Los eventos son de día completo (VALUE=DATE), que en hospedaje es
        // lo correcto: una noche no tiene hora ni zona horaria. Esta línea
        // solo le dice al lector en qué huso mostrar el calendario.
        "X-WR-TIMEZONE:Europe/Madrid",
    ];

    for (const e of opts.eventos) {
        lines.push("BEGIN:VEVENT");
        lines.push(fold(`UID:${e.uid}@tiojosemaria.com`));
        lines.push(`DTSTAMP:${stamp}`);
        lines.push(`DTSTART;VALUE=DATE:${fmtDate(e.inicio)}`);
        lines.push(`DTEND;VALUE=DATE:${fmtDate(e.fin)}`);
        lines.push(fold(`SUMMARY:${escapeText(e.titulo)}`));
        lines.push(`STATUS:${e.estado === "hold" ? "TENTATIVE" : "CONFIRMED"}`);
        lines.push("TRANSP:OPAQUE");
        lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
}

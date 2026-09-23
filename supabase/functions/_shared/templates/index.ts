// Plantillas HTML transaccionales — escritas como habla Mari Carmen: corto,
// educado, sin gracietas, y solo lo que el huésped necesita saber.
// Reescritas el 18-sep-2026 (antes decían «nos chocamos los cinco»).
// =====================================================================
// CSS inline para máxima compatibilidad. Sin imágenes externas excepto el
// logo (que se puede activar cambiando LOGO_URL). Tablas para estructura
// (Outlook desktop sigue requiriéndolas).
//
// Idiomas (23-sep-2026): los correos AL HUÉSPED salen en su idioma
// (`guest_bookings.idioma`: es | en | de | fr; NULL o desconocido = es).
// El castellano es el de siempre, letra a letra; en/de/fr son traducciones
// (de y fr en registro formal: Sie / vous). Mismo HTML para todos.
// Los avisos internos (operator_*) van siempre en castellano: los dueños
// solo hablan castellano.

interface BookingPayload {
    booking_code: string;
    guest_name: string;
    guest_email: string;
    apartment_name: string;
    apartment_slug: string;
    apartment_image?: string | null;
    customer_warnings?: string[];
    customer_tags?: string[];
    customer_preferences?: string | null;
    check_in: string;
    check_out: string;
    total_price: number;
    /** Idioma del huésped (guest_bookings.idioma): es | en | de | fr. NULL o desconocido = castellano. */
    idioma?: string | null;
    /** Solo booking_changed: cómo estaba antes del cambio (opcional). */
    previous?: { check_in: string; check_out: string; apartment_name: string } | null;
    /** Solo booking_cancelled: lo que se le devuelve y lo que había pagado. */
    refund_amount?: number;
    paid_amount?: number;
    free_cancellation?: boolean;
    /** Solo reminder_24h: cuántos han rellenado los datos de la policía y cuántos se esperan. */
    precheckin?: { rellenos: number; total: number } | null;
    /** Solo operator_precheckin_done: nombres de pila de quienes han rellenado. */
    precheckin_nombres?: string[];
    /** Solo confirmation: si el formulario de la policía ya está abierto (llegada a 7 días o menos).
     *  Si no lo está, la confirmación no lo menciona: lo pide el correo de los 7 días. */
    precheckin_abierto?: boolean;
}

// ---------------------------------------------------------------------------
// Idioma del huésped
// ---------------------------------------------------------------------------
type Idioma = "es" | "en" | "de" | "fr";
const IDIOMAS: Idioma[] = ["es", "en", "de", "fr"];
// Inglés británico: «18 September» y «18/09/2026», como se escribe en Europa.
const LOCALE: Record<Idioma, string> = { es: "es-ES", en: "en-GB", de: "de-DE", fr: "fr-FR" };
/** El idioma de la reserva; lo que no sea es/en/de/fr (o NULL) se trata como castellano. */
const idiomaDe = (b: BookingPayload): Idioma => {
    const v = String(b.idioma ?? "").trim().toLowerCase();
    return (IDIOMAS as string[]).includes(v) ? (v as Idioma) : "es";
};

const SITE_URL = "https://tiojosemaria.com";
const WHATSAPP_E164 = "+34676344675";
const WHATSAPP_URL = "https://wa.me/34676344675";
const EMAIL_FROM = "Tío José María <hola@tiojosemaria.com>";
const GOOGLE_REVIEW_URL = "https://g.page/r/CTDH4snlte-aEBM/review";

// Las fechas llegan como «YYYY-MM-DD». En en/de/fr se formatean con Intl, a
// mediodía UTC y en hora de Madrid: así nunca se corren de día.
const fechaIntl = (s: string, lang: Idioma, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE[lang], { timeZone: "Europe/Madrid", ...opts }).format(new Date(s + "T12:00:00Z"));

const formatDate = (s: string, lang: Idioma = "es") => {
    if (lang !== "es") return fechaIntl(s, lang, { day: "2-digit", month: "2-digit", year: "numeric" });
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
};
const formatPrice = (n: number, lang: Idioma = "es") => new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const firstName = (full: string) => (full.trim().split(/\s+/)[0] || full).trim();
// El formulario lee ?lang=; en castellano no se añade (es lo que sale por defecto).
const precheckinUrl = (b: BookingPayload) => {
    const lang = idiomaDe(b);
    return `${SITE_URL}/precheckin?code=${b.booking_code}${lang === "es" ? "" : `&lang=${lang}`}`;
};
// La ficha del huésped: su reserva, la policía, la casa, la factura. Todo apunta ahí.
const guiaUrl = (b: BookingPayload) => `${SITE_URL}/guia/${b.booking_code}`;
const enlaceGuia = (b: BookingPayload, texto = "tu guía de la casa") =>
    `<a href="${guiaUrl(b)}" style="color:#556B2F;font-weight:700;text-decoration:underline;">${texto}</a>`;

const MAPS_URL = "https://maps.app.goo.gl/EPzh8j2HivLfqUeN8";
const PHONE_HUMAN = "676 34 46 75";

// Fechas como las dice ella: «el 18 de septiembre», no «18/09/2026».
// En los otros idiomas, igual: «18 September», «18. September», «18 septembre».
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const diaMes = (s: string, lang: Idioma = "es") => {
    const [, m, d] = s.split("-");
    if (lang === "es") return `${Number(d)} de ${MESES[Number(m) - 1]}`;
    const txt = fechaIntl(s, lang, { day: "numeric", month: "long" });
    // En francés el día 1 se escribe «1er octobre».
    return lang === "fr" && Number(d) === 1 ? txt.replace(/^1(?=\D)/, "1er") : txt;
};

// Lo que se repite en todas las plantillas: marco, firma, resumen, policía.
interface TextosComunes {
    rurales: string; necesiteis: string; correo: string; privacidad: string;
    saludo: string; firmantes: string;
    tuReserva: string; codigo: string; apartamento: string; entrada: string; salida: string; total: string;
    policiaTitulo: string; policiaComo: string; rellenar: string;
    /** El enlace a la ficha dentro de una frase («lo tienes siempre en …»). */
    guiaEn: string;
    /** El botón de la ficha. */
    guiaCta: string;
}
const UI: Record<Idioma, TextosComunes> = {
    es: {
        rurales: "Apartamentos Rurales", necesiteis: "Para lo que necesitéis:", correo: "correo", privacidad: "Privacidad",
        saludo: "Un saludo,", firmantes: "Mari Carmen y Jesús",
        tuReserva: "Tu reserva", codigo: "Código", apartamento: "Apartamento", entrada: "Entrada", salida: "Salida", total: "Total",
        policiaTitulo: "Datos para la policía",
        policiaComo: "Se rellena desde el móvil, una persona por pantalla, y no hay que mandar foto de ningún documento.",
        rellenar: "Rellenar los datos",
        guiaEn: "tu guía de la casa", guiaCta: "Tu guía de la casa",
    },
    en: {
        rurales: "Rural Apartments", necesiteis: "For anything you need:", correo: "email", privacidad: "Privacy",
        saludo: "Kind regards,", firmantes: "Mari Carmen and Jesús",
        tuReserva: "Your booking", codigo: "Code", apartamento: "Apartment", entrada: "Check-in", salida: "Check-out", total: "Total",
        policiaTitulo: "Guest details for the police",
        policiaComo: "It is filled in from your phone, one person per screen, and there is no need to send a photo of any document.",
        rellenar: "Fill in the details",
        guiaEn: "your house guide", guiaCta: "Your house guide",
    },
    de: {
        rurales: "Ferienwohnungen auf dem Land", necesiteis: "Für alles, was Sie brauchen:", correo: "E-Mail", privacidad: "Datenschutz",
        saludo: "Mit freundlichen Grüßen", firmantes: "Mari Carmen und Jesús",
        tuReserva: "Ihre Buchung", codigo: "Buchungscode", apartamento: "Ferienwohnung", entrada: "Anreise", salida: "Abreise", total: "Gesamt",
        policiaTitulo: "Angaben für die Polizei",
        policiaComo: "Das Formular wird am Handy ausgefüllt, eine Person pro Seite, und Sie müssen kein Foto eines Ausweises schicken.",
        rellenar: "Angaben ausfüllen",
        guiaEn: "Ihrer Gästemappe", guiaCta: "Ihre Gästemappe",
    },
    fr: {
        rurales: "Appartements ruraux", necesiteis: "Pour tout ce dont vous avez besoin :", correo: "e-mail", privacidad: "Confidentialité",
        saludo: "Bien cordialement,", firmantes: "Mari Carmen et Jesús",
        tuReserva: "Votre réservation", codigo: "Référence", apartamento: "Appartement", entrada: "Arrivée", salida: "Départ", total: "Total",
        policiaTitulo: "Informations pour la police",
        policiaComo: "Cela se remplit depuis votre téléphone, une personne par écran, et il n'est pas nécessaire d'envoyer la photo d'un document.",
        rellenar: "Remplir les informations",
        guiaEn: "votre livret d'accueil", guiaCta: "Votre livret d'accueil",
    },
};

// Política de cancelación (condiciones, punto 8): gratis hasta 7 días antes.
// La confirmación la dice con la FECHA, que es lo que pide «detallada y
// publicitada» y lo que evita discusiones (estudio 18-sep-2026).
const DIAS_CANCELACION_GRATIS = 7;
const limiteCancelacionGratis = (checkIn: string) => {
    const d = new Date(checkIn + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - DIAS_CANCELACION_GRATIS);
    return d.toISOString().slice(0, 10);
};
const politicaCancelacion = (b: BookingPayload) => {
    const lang = idiomaDe(b);
    const limite = limiteCancelacionGratis(b.check_in);
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const gratis = limite >= hoy;
    const dm = diaMes(limite, lang);
    switch (lang) {
        case "en": return gratis
            ? `<p><strong>Cancellation:</strong> free until ${dm} (we refund 100%). After that the amount is not refundable, but you can change your dates once, at no cost, within the following 12 months.</p>`
            : `<p><strong>Cancellation:</strong> as you arrive in less than 7 days, this booking can no longer be cancelled free of charge. If in the end you cannot come, you will be able to change your dates once, at no cost, within the following 12 months.</p>`;
        case "de": return gratis
            ? `<p><strong>Stornierung:</strong> kostenlos bis zum ${dm} (Sie erhalten 100 % zurück). Danach wird der Betrag nicht erstattet, Sie können Ihre Reisedaten aber einmal kostenlos innerhalb der folgenden 12 Monate ändern.</p>`
            : `<p><strong>Stornierung:</strong> Da Sie in weniger als 7 Tagen anreisen, kann diese Buchung nicht mehr kostenlos storniert werden. Sollten Sie doch nicht kommen können, können Sie Ihre Reisedaten einmal kostenlos innerhalb der folgenden 12 Monate ändern.</p>`;
        case "fr": return gratis
            ? `<p><strong>Annulation :</strong> gratuite jusqu'au ${dm} (nous vous remboursons 100 %). Au-delà, le montant n'est pas remboursé, mais vous pouvez changer de dates une fois, sans frais, dans les 12 mois qui suivent.</p>`
            : `<p><strong>Annulation :</strong> comme vous arrivez dans moins de 7 jours, cette réservation ne peut plus être annulée gratuitement. Si finalement vous ne pouvez pas venir, vous pourrez changer de dates une fois, sans frais, dans les 12 mois qui suivent.</p>`;
        default: return gratis
            ? `<p><strong>Cancelación:</strong> gratis hasta el ${diaMes(limite)} (te devolvemos el 100 %). Después no se devuelve el importe, pero puedes cambiar de fechas una vez, sin coste, dentro de los 12 meses siguientes.</p>`
            : `<p><strong>Cancelación:</strong> como llegas en menos de 7 días, esta reserva ya no se puede cancelar gratis. Si al final no puedes venir, podrás cambiar de fechas una vez, sin coste, dentro de los 12 meses siguientes.</p>`;
    }
};

// El recuadro de los datos de la policía. Una frase de por qué, una de cómo,
// y el enlace. Se abre 7 días antes de la llegada (migración 0018).
const precheckinBlock = (b: BookingPayload, intro: string) => {
    const t = UI[idiomaDe(b)];
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6EC;border:1px solid #D9DFC6;border-radius:12px;margin:16px 0;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#556B2F;font-weight:700;">${t.policiaTitulo}</p>
    <p style="margin:0;font-size:14px;color:#2C3319;">${intro} ${t.policiaComo}</p>
    <p style="margin:10px 0 0;font-size:14px;"><a href="${precheckinUrl(b)}" style="color:#556B2F;font-weight:700;text-decoration:underline;">${t.rellenar}</a></p>
  </td></tr>
</table>`;
};

const shell = (heading: string, body: string, ctaLabel?: string, ctaUrl?: string, lang: Idioma = "es") => {
    const t = UI[lang];
    return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${heading}</title></head>
<body style="margin:0;background:#FCFBF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2C3319;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FCFBF9;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #F0EDE6;border-radius:18px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#556B2F,#4A5D28);padding:28px 32px;color:#ffffff;">
        <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">${t.rurales}</p>
        <h1 style="margin:6px 0 0;font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:700;">Tío José María</h1>
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <h2 style="margin:0 0 12px;font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#2C3319;">${heading}</h2>
        ${body}
        ${ctaLabel && ctaUrl ? `<p style="margin:28px 0 0;text-align:center;">
          <a href="${ctaUrl}" style="display:inline-block;background:#556B2F;color:#ffffff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;text-decoration:none;">${ctaLabel}</a>
        </p>` : ""}
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #F0EDE6;background:#FCFBF9;font-size:12px;color:#8C8468;">
        <p style="margin:0 0 8px;">${t.necesiteis} <a href="${WHATSAPP_URL}" style="color:#556B2F;text-decoration:underline;">WhatsApp</a> · <a href="tel:${WHATSAPP_E164}" style="color:#556B2F;text-decoration:underline;">${PHONE_HUMAN}</a> · <a href="mailto:apartamentostiojosemaria@gmail.com" style="color:#556B2F;text-decoration:underline;">${t.correo}</a></p>
        <p style="margin:0;">Calle Baja 1, 23486 Hinojares (Jaén) · A/JA/00060 · <a href="${SITE_URL}/privacidad" style="color:#8C8468;">${t.privacidad}</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
};

// Foto del apartamento como imagen ancho completo (max 560px) con esquinas redondeadas.
// Si no hay URL, no se renderiza nada (ningún hueco).
const apartmentPhoto = (b: BookingPayload) => {
    if (!b.apartment_image) return "";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
      <tr><td>
        <img src="${b.apartment_image}" alt="${UI[idiomaDe(b)].apartamento} ${b.apartment_name}"
             width="496" style="display:block;width:100%;max-width:496px;height:auto;border-radius:12px;border:1px solid #F0EDE6;">
      </td></tr>
    </table>`;
};

// Firma: como firma ella. Sin abrazos a desconocidos.
const firma = (lang: Idioma = "es") => {
    const t = UI[lang];
    return `<p style="margin:24px 0 0;color:#2C3319;">${t.saludo}<br><strong style="font-family:'Playfair Display',Georgia,serif;font-size:17px;color:#556B2F;">${t.firmantes}</strong><br><span style="font-size:12px;color:#8C8468;">${t.rurales} Tío José María · ${PHONE_HUMAN}</span></p>`;
};

// El resumen sale en el idioma del huésped; en los avisos internos
// (operator_*) se llama con "es" a la fuerza.
const bookingSummary = (b: BookingPayload, lang: Idioma = idiomaDe(b)) => {
    const t = UI[lang];
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FCFBF9;border:1px solid #F0EDE6;border-radius:12px;margin:16px 0;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#556B2F;font-weight:700;">${t.tuReserva}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;font-size:14px;">
      <tr><td style="padding:4px 0;color:#8C8468;">${t.codigo}</td><td style="padding:4px 0;text-align:right;font-family:'SF Mono',Menlo,monospace;font-weight:700;color:#556B2F;">${b.booking_code}</td></tr>
      <tr><td style="padding:4px 0;color:#8C8468;">${t.apartamento}</td><td style="padding:4px 0;text-align:right;font-weight:700;">${b.apartment_name}</td></tr>
      <tr><td style="padding:4px 0;color:#8C8468;">${t.entrada}</td><td style="padding:4px 0;text-align:right;">${formatDate(b.check_in, lang)}</td></tr>
      <tr><td style="padding:4px 0;color:#8C8468;">${t.salida}</td><td style="padding:4px 0;text-align:right;">${formatDate(b.check_out, lang)}</td></tr>
      <tr><td style="padding:4px 0;color:#8C8468;">${t.total}</td><td style="padding:4px 0;text-align:right;font-weight:700;">${formatPrice(b.total_price, lang)}</td></tr>
    </table>
  </td></tr>
</table>`;
};

// Lo que ella dice siempre al que llega. Un solo sitio, para que los correos
// no se contradigan entre sí. Fuente: la guía del huésped (apartment_instructions).
const LLEGADA: Record<Idioma, string> = {
    es: `<p><strong>Cómo llegar:</strong> Calle Baja 1, Hinojares. Se aparca gratis justo enfrente. Con este enlace el móvil te lleva a la puerta:<br><a href="${MAPS_URL}" style="display:inline-block;margin-top:6px;color:#556B2F;font-weight:700;text-decoration:underline;">Abrir en Google Maps</a></p>
<p><strong>Entrada:</strong> a partir de las 16:00. Las llaves te las damos en mano. Si vas a llegar después de las 21:00, avísanos por WhatsApp y te decimos cómo lo hacemos.</p>`,
    en: `<p><strong>Getting here:</strong> Calle Baja 1, Hinojares. There is free parking right in front. With this link your phone will take you to the door:<br><a href="${MAPS_URL}" style="display:inline-block;margin-top:6px;color:#556B2F;font-weight:700;text-decoration:underline;">Open in Google Maps</a></p>
<p><strong>Check-in:</strong> from 16:00. We hand you the keys in person. If you are going to arrive after 21:00, let us know on WhatsApp and we will tell you how we will do it.</p>`,
    de: `<p><strong>Anfahrt:</strong> Calle Baja 1, Hinojares. Direkt gegenüber können Sie kostenlos parken. Mit diesem Link führt Sie Ihr Handy bis vor die Tür:<br><a href="${MAPS_URL}" style="display:inline-block;margin-top:6px;color:#556B2F;font-weight:700;text-decoration:underline;">In Google Maps öffnen</a></p>
<p><strong>Anreise:</strong> ab 16:00 Uhr. Die Schlüssel übergeben wir Ihnen persönlich. Wenn Sie nach 21:00 Uhr ankommen, geben Sie uns bitte per WhatsApp Bescheid, dann sagen wir Ihnen, wie wir es machen.</p>`,
    fr: `<p><strong>Comment venir :</strong> Calle Baja 1, Hinojares. Vous pouvez vous garer gratuitement juste en face. Avec ce lien, votre téléphone vous guide jusqu'à la porte :<br><a href="${MAPS_URL}" style="display:inline-block;margin-top:6px;color:#556B2F;font-weight:700;text-decoration:underline;">Ouvrir dans Google Maps</a></p>
<p><strong>Arrivée :</strong> à partir de 16h00. Nous vous remettons les clés en main propre. Si vous arrivez après 21h00, prévenez-nous par WhatsApp et nous vous dirons comment faire.</p>`,
};

type TemplateKey = "confirmation" | "reminder_7d" | "reminder_24h" | "review_request" | "reactivation" | "operator_new_booking" | "operator_precheckin_done" | "booking_changed" | "booking_cancelled" | "guide_link";

interface RenderedEmail { subject: string; html: string; from: string; }

// 1. Al reservar en la web (solo reservas directas).
// Con tiempo: corto, y el de «cómo llegar» ya vendrá. A menos de 7 días: un
// solo correo con todo (llegar, casa, policía) y send-booking-email apunta el
// de los 7 días como enviado para no repetirlo (Jesús, 18-sep).
// Sin chimenea (desde el invierno de 2026 no se sube leña; Jesús, 18-sep) y sin
// enlace a la guía de la zona hasta que esté terminada.
const CASA: Record<Idioma, string> = {
    es: `<p><strong>Lo que hay en la casa:</strong> sábanas, toallas y mantas, y la cocina completa con lo básico para cocinar. No hace falta que traigas nada de eso.</p>`,
    en: `<p><strong>What the house has:</strong> sheets, towels and blankets, and a fully equipped kitchen with the basics for cooking. There is no need to bring any of that.</p>`,
    de: `<p><strong>Was es im Haus gibt:</strong> Bettwäsche, Handtücher und Decken sowie eine voll ausgestattete Küche mit allem Nötigen zum Kochen. Nichts davon müssen Sie mitbringen.</p>`,
    fr: `<p><strong>Ce qu'il y a dans la maison :</strong> draps, serviettes et couvertures, ainsi qu'une cuisine complète avec l'essentiel pour cuisiner. Inutile d'apporter tout cela.</p>`,
};

// Frases sueltas que comparten la confirmación y el correo de los 7 días.
const SALIDA: Record<Idioma, string> = {
    es: `<p><strong>Salida:</strong> antes de las 12:00.</p>`,
    en: `<p><strong>Check-out:</strong> before 12:00.</p>`,
    de: `<p><strong>Abreise:</strong> bis 12:00 Uhr.</p>`,
    fr: `<p><strong>Départ :</strong> avant 12h00.</p>`,
};
const guardaLaGuia = (b: BookingPayload, lang: Idioma) => {
    const g = enlaceGuia(b, UI[lang].guiaEn);
    switch (lang) {
        case "en": return `<p>All of this, and the information about the house, is always available in ${g}: save it on your phone.</p>`;
        case "de": return `<p>All das und die Informationen zum Haus finden Sie jederzeit in ${g}: Speichern Sie sie am besten auf Ihrem Handy.</p>`;
        case "fr": return `<p>Tout cela, ainsi que les informations sur la maison, se trouve toujours dans ${g} : gardez-le sur votre téléphone.</p>`;
        default: return `<p>Todo esto, y lo de la casa, lo tienes siempre en ${enlaceGuia(b)}: guárdala en el móvil.</p>`;
    }
};
const ALERGIAS: Record<Idioma, string> = {
    es: `<p>Si alguien tiene alergia o necesitáis algo en especial, decídnoslo y lo preparamos.</p>`,
    en: `<p>If anyone has an allergy or you need anything special, let us know and we will have it ready.</p>`,
    de: `<p>Wenn jemand eine Allergie hat oder Sie etwas Besonderes benötigen, sagen Sie uns bitte Bescheid, dann bereiten wir es vor.</p>`,
    fr: `<p>Si quelqu'un a une allergie ou si vous avez besoin de quelque chose de particulier, dites-le-nous et nous le préparerons.</p>`,
};

const renderConfirmation = (b: BookingPayload): RenderedEmail => {
    const lang = idiomaDe(b);
    const t = UI[lang];
    const fn = firstName(b.guest_name);
    const ci = diaMes(b.check_in, lang), co = diaMes(b.check_out, lang);
    const T = {
        es: {
            subject: `Reserva confirmada en Tío José María — ${b.booking_code}`,
            heading: `Hola ${fn}, tu reserva está hecha`,
            reservado: `<p>Tienes reservado el apartamento <strong>${b.apartment_name}</strong> del ${ci} al ${co}. Gracias por reservar con nosotros.`,
            quedaPoco: ` Como ya queda poco, te dejo aquí todo lo que hace falta saber.`,
            policia: "Por ley tenemos que comunicar a la policía los datos de cada persona que se aloja. Con este enlace los rellenáis vosotros mismos antes de llegar (nombre, documento y poco más).",
            horario: `<p>La entrada es a partir de las 16:00 y la salida antes de las 12:00. Las llaves te las damos en mano cuando llegues.</p>`,
            guiaLuego: `<p>Tu reserva, cómo llegar y lo de la casa lo tienes siempre en ${enlaceGuia(b)}. Unos días antes de venir te vuelvo a escribir. Si mientras tanto necesitas algo, llámanos o escríbenos.</p>`,
        },
        en: {
            subject: `Booking confirmed at Tío José María — ${b.booking_code}`,
            heading: `Hello ${fn}, your booking is confirmed`,
            reservado: `<p>You have booked the <strong>${b.apartment_name}</strong> apartment from ${ci} to ${co}. Thank you for booking with us.`,
            quedaPoco: ` As your stay is coming up soon, here is everything you need to know.`,
            policia: "By law we have to report to the police the details of every person staying with us. With this link you fill them in yourselves before arriving (name, ID document and little else).",
            horario: `<p>Check-in is from 16:00 and check-out before 12:00. We will hand you the keys in person when you arrive.</p>`,
            guiaLuego: `<p>Your booking, directions and the information about the house are always available in ${enlaceGuia(b, t.guiaEn)}. A few days before you come I will write to you again. If you need anything in the meantime, call or write to us.</p>`,
        },
        de: {
            subject: `Buchung bestätigt bei Tío José María — ${b.booking_code}`,
            heading: `Hallo ${fn}, Ihre Buchung ist bestätigt`,
            reservado: `<p>Sie haben die Ferienwohnung <strong>${b.apartment_name}</strong> vom ${ci} bis zum ${co} gebucht. Vielen Dank für Ihre Buchung.`,
            quedaPoco: ` Da es bald so weit ist, finden Sie hier alles, was Sie wissen müssen.`,
            policia: "Gesetzlich sind wir verpflichtet, der Polizei die Angaben jeder Person zu melden, die bei uns übernachtet. Über diesen Link tragen Sie sie vor der Anreise selbst ein (Name, Ausweisdokument und nur wenig mehr).",
            horario: `<p>Die Anreise ist ab 16:00 Uhr möglich, die Abreise bis 12:00 Uhr. Die Schlüssel übergeben wir Ihnen bei Ihrer Ankunft persönlich.</p>`,
            guiaLuego: `<p>Ihre Buchung, die Anfahrt und die Informationen zum Haus finden Sie jederzeit in ${enlaceGuia(b, t.guiaEn)}. Ein paar Tage vor Ihrer Anreise schreibe ich Ihnen noch einmal. Wenn Sie in der Zwischenzeit etwas brauchen, rufen Sie uns an oder schreiben Sie uns.</p>`,
        },
        fr: {
            subject: `Réservation confirmée chez Tío José María — ${b.booking_code}`,
            heading: `Bonjour ${fn}, votre réservation est confirmée`,
            reservado: `<p>Vous avez réservé l'appartement <strong>${b.apartment_name}</strong> du ${ci} au ${co}. Merci d'avoir réservé chez nous.`,
            quedaPoco: ` Comme votre séjour approche, voici tout ce qu'il faut savoir.`,
            policia: "La loi nous oblige à communiquer à la police les informations de chaque personne hébergée. Avec ce lien, vous les remplissez vous-mêmes avant votre arrivée (nom, pièce d'identité et peu de choses de plus).",
            horario: `<p>L'arrivée se fait à partir de 16h00 et le départ avant 12h00. Nous vous remettons les clés en main propre à votre arrivée.</p>`,
            guiaLuego: `<p>Votre réservation, l'itinéraire et les informations sur la maison se trouvent toujours dans ${enlaceGuia(b, t.guiaEn)}. Quelques jours avant votre venue, je vous écrirai de nouveau. Si vous avez besoin de quoi que ce soit d'ici là, appelez-nous ou écrivez-nous.</p>`,
        },
    }[lang];
    return {
        from: EMAIL_FROM,
        subject: T.subject,
        html: shell(
            T.heading,
            b.precheckin_abierto
                ? `${T.reservado}${T.quedaPoco}</p>
        ${apartmentPhoto(b)}
        ${bookingSummary(b)}
        ${politicaCancelacion(b)}
        ${LLEGADA[lang]}
        ${SALIDA[lang]}
        ${CASA[lang]}
        ${precheckinBlock(b, T.policia)}
        ${guardaLaGuia(b, lang)}
        ${ALERGIAS[lang]}
        ${firma(lang)}`
                : `${T.reservado}</p>
        ${apartmentPhoto(b)}
        ${bookingSummary(b)}
        ${politicaCancelacion(b)}
        ${T.horario}
        ${T.guiaLuego}
        ${firma(lang)}`,
            b.precheckin_abierto ? t.rellenar : t.guiaCta,
            b.precheckin_abierto ? precheckinUrl(b) : guiaUrl(b),
            lang
        ),
    };
};

// 2. Entre 7 y 2 días antes (directos y canales). No siempre son 7 justos:
// una reserva hecha tarde lo recibe al día siguiente, por eso el asunto
// dice la fecha y no «la semana que viene».
const renderReminder7d = (b: BookingPayload): RenderedEmail => {
    const lang = idiomaDe(b);
    const fn = firstName(b.guest_name);
    const ci = diaMes(b.check_in, lang);
    const T = {
        es: {
            subject: `Os esperamos el ${ci} en Hinojares`,
            heading: `Hola ${fn}, ya queda poco`,
            intro: `<p>El ${ci} te esperamos en el apartamento <strong>${b.apartment_name}</strong>. Te cuento lo que hace falta saber para venir tranquilo.</p>`,
            policia: "Ya se puede rellenar el formulario con los datos de cada persona que viene (nombre, documento y poco más). Nos lo pide la ley y lo necesitamos antes de que lleguéis.",
        },
        en: {
            subject: `We look forward to seeing you on ${ci} in Hinojares`,
            heading: `Hello ${fn}, not long to go now`,
            intro: `<p>On ${ci} we look forward to welcoming you to the <strong>${b.apartment_name}</strong> apartment. Here is what you need to know so you can travel with peace of mind.</p>`,
            policia: "The form with the details of each person coming (name, ID document and little else) can now be filled in. It is required by law and we need it before you arrive.",
        },
        de: {
            subject: `Wir erwarten Sie am ${ci} in Hinojares`,
            heading: `Hallo ${fn}, bald ist es so weit`,
            intro: `<p>Am ${ci} erwarten wir Sie in der Ferienwohnung <strong>${b.apartment_name}</strong>. Hier ist alles, was Sie für eine entspannte Anreise wissen müssen.</p>`,
            policia: "Ab sofort können Sie das Formular mit den Angaben jeder mitreisenden Person ausfüllen (Name, Ausweisdokument und nur wenig mehr). Das schreibt das Gesetz vor, und wir benötigen es vor Ihrer Ankunft.",
        },
        fr: {
            subject: `Nous vous attendons le ${ci} à Hinojares`,
            heading: `Bonjour ${fn}, c'est bientôt`,
            intro: `<p>Le ${ci}, nous vous attendons dans l'appartement <strong>${b.apartment_name}</strong>. Voici ce qu'il faut savoir pour venir en toute tranquillité.</p>`,
            policia: "Le formulaire avec les informations de chaque personne qui vient (nom, pièce d'identité et peu de choses de plus) peut déjà être rempli. C'est une obligation légale et nous en avons besoin avant votre arrivée.",
        },
    }[lang];
    return {
        from: EMAIL_FROM,
        subject: T.subject,
        html: shell(
            T.heading,
            `${T.intro}
        ${apartmentPhoto(b)}
        ${LLEGADA[lang]}
        ${CASA[lang]}
        ${precheckinBlock(b, T.policia)}
        ${bookingSummary(b)}
        ${guardaLaGuia(b, lang)}
        ${ALERGIAS[lang]}
        ${firma(lang)}`,
            UI[lang].rellenar,
            precheckinUrl(b),
            lang
        ),
    };
};

// 3. La víspera. Solo sale si faltan datos de la policía (lo decide
// send-booking-email); por eso dice cuántos faltan.
const faltanEnPalabras = (p: { rellenos: number; total: number } | null | undefined, lang: Idioma = "es") => {
    const faltan = p ? Math.max(p.total - p.rellenos, 0) : 0;
    switch (lang) {
        case "en":
            if (!p) return "We are still missing the form with the details of each person coming.";
            if (p.rellenos === 0) {
                return p.total === 1
                    ? "We do not have your details for the police yet."
                    : `We do not yet have the police details for any of the ${p.total} people coming.`;
            }
            return faltan === 1
                ? `We already have the details of ${p.rellenos} of ${p.total}: 1 person is still missing.`
                : `We already have the details of ${p.rellenos} of ${p.total}: ${faltan} people are still missing.`;
        case "de":
            if (!p) return "Uns fehlt noch das Formular mit den Angaben jeder mitreisenden Person.";
            if (p.rellenos === 0) {
                return p.total === 1
                    ? "Wir haben Ihre Angaben für die Polizei noch nicht erhalten."
                    : `Wir haben noch von keiner der ${p.total} mitreisenden Personen die Angaben für die Polizei.`;
            }
            return faltan === 1
                ? `Wir haben bereits die Angaben von ${p.rellenos} von ${p.total} Personen: Es fehlt noch 1 Person.`
                : `Wir haben bereits die Angaben von ${p.rellenos} von ${p.total} Personen: Es fehlen noch ${faltan} Personen.`;
        case "fr":
            if (!p) return "Il nous manque le formulaire avec les informations de chaque personne qui vient.";
            if (p.rellenos === 0) {
                return p.total === 1
                    ? "Nous n'avons pas encore vos informations pour la police."
                    : `Nous n'avons encore les informations pour la police d'aucune des ${p.total} personnes qui viennent.`;
            }
            return faltan === 1
                ? `Nous avons déjà les informations de ${p.rellenos} personnes sur ${p.total} : il manque encore 1 personne.`
                : `Nous avons déjà les informations de ${p.rellenos} personnes sur ${p.total} : il manque encore ${faltan} personnes.`;
        default:
            if (!p) return "Nos falta el formulario con los datos de cada persona que viene.";
            if (p.rellenos === 0) {
                return p.total === 1
                    ? "Todavía no tenemos tus datos para la policía."
                    : `Todavía no tenemos los datos para la policía de ninguna de las ${p.total} personas que venís.`;
            }
            return faltan === 1
                ? `Ya tenemos los datos de ${p.rellenos} de ${p.total}: falta 1 persona.`
                : `Ya tenemos los datos de ${p.rellenos} de ${p.total}: faltan ${faltan} personas.`;
    }
};

const renderReminder24h = (b: BookingPayload): RenderedEmail => {
    const lang = idiomaDe(b);
    const fn = firstName(b.guest_name);
    const faltan = faltanEnPalabras(b.precheckin, lang);
    const T = {
        es: {
            subject: `Mañana os esperamos — nos faltan los datos para la policía`,
            heading: `Hola ${fn}, mañana os esperamos`,
            policia: `${faltan} Nos lo pide la ley y tiene que estar hecho antes de entrar. Si lo hacéis hoy desde el móvil, mañana os damos las llaves y ya está.`,
            cta: "Rellenar los datos que faltan",
        },
        en: {
            subject: `See you tomorrow — we still need the details for the police`,
            heading: `Hello ${fn}, see you tomorrow`,
            policia: `${faltan} It is required by law and must be done before check-in. If you do it today from your phone, tomorrow we simply hand you the keys.`,
            cta: "Fill in the missing details",
        },
        de: {
            subject: `Morgen erwarten wir Sie — uns fehlen noch die Angaben für die Polizei`,
            heading: `Hallo ${fn}, morgen erwarten wir Sie`,
            policia: `${faltan} Das schreibt das Gesetz vor, und es muss vor dem Einchecken erledigt sein. Wenn Sie es heute am Handy ausfüllen, übergeben wir Ihnen morgen einfach die Schlüssel.`,
            cta: "Fehlende Angaben ausfüllen",
        },
        fr: {
            subject: `Nous vous attendons demain — il nous manque les informations pour la police`,
            heading: `Bonjour ${fn}, nous vous attendons demain`,
            policia: `${faltan} C'est une obligation légale et cela doit être fait avant l'entrée dans le logement. Si vous le faites aujourd'hui depuis votre téléphone, demain nous vous remettons simplement les clés.`,
            cta: "Remplir les informations manquantes",
        },
    }[lang];
    return {
        from: EMAIL_FROM,
        subject: T.subject,
        html: shell(
            T.heading,
            `${precheckinBlock(b, T.policia)}
        ${LLEGADA[lang]}
        ${bookingSummary(b)}
        ${firma(lang)}`,
            T.cta,
            precheckinUrl(b),
            lang
        ),
    };
};

// (Los antiguos correos del día de llegada y del día de salida se quitaron el
// 18-sep-2026: Mari Carmen lo explica al dar las llaves y la ficha del huésped
// /guia/<código> lo tendrá por escrito.)

// 6. Pedir opinión, unos días después.
const renderReviewRequest = (b: BookingPayload): RenderedEmail => {
    const lang = idiomaDe(b);
    const fn = firstName(b.guest_name);
    const T = {
        es: {
            subject: `¿Qué tal en Tío José María?`,
            heading: `Hola ${fn}, ¿qué tal ha ido?`,
            body: `<p>Esperamos que hayáis descansado. Si tenéis un momento, nos gustaría que dejarais vuestra opinión en Google: para una casa pequeña como la nuestra, lo que cuentan los que ya han venido es lo que más nos ayuda.</p>
        <p>Y si hay algo que no os ha gustado, decídnoslo a nosotros también, que es como se arregla.</p>
        <p>Si vinisteis por Booking o Airbnb, allí también podéis dejarla.</p>`,
            cta: "Dejar una opinión en Google",
        },
        en: {
            subject: `How was your stay at Tío José María?`,
            heading: `Hello ${fn}, how did it go?`,
            body: `<p>We hope you had a good rest. If you have a moment, we would love you to leave a review on Google: for a small house like ours, what past guests say is what helps us most.</p>
        <p>And if there was anything you did not like, please tell us too — that is how things get fixed.</p>
        <p>If you came through Booking or Airbnb, you can leave one there as well.</p>`,
            cta: "Leave a review on Google",
        },
        de: {
            subject: `Wie war es bei Tío José María?`,
            heading: `Hallo ${fn}, wie war Ihr Aufenthalt?`,
            body: `<p>Wir hoffen, Sie konnten sich gut erholen. Wenn Sie einen Moment Zeit haben, würden wir uns sehr über eine Bewertung auf Google freuen: Für ein kleines Haus wie unseres hilft nichts so sehr wie das, was frühere Gäste erzählen.</p>
        <p>Und wenn Ihnen etwas nicht gefallen hat, sagen Sie es bitte auch uns – nur so können wir es verbessern.</p>
        <p>Falls Sie über Booking oder Airbnb gebucht haben, können Sie auch dort eine Bewertung hinterlassen.</p>`,
            cta: "Bewertung auf Google schreiben",
        },
        fr: {
            subject: `Comment s'est passé votre séjour chez Tío José María ?`,
            heading: `Bonjour ${fn}, comment cela s'est-il passé ?`,
            body: `<p>Nous espérons que vous avez pu vous reposer. Si vous avez un instant, nous serions ravis que vous laissiez votre avis sur Google : pour une petite maison comme la nôtre, ce que racontent ceux qui sont déjà venus est ce qui nous aide le plus.</p>
        <p>Et s'il y a quelque chose qui ne vous a pas plu, dites-le-nous aussi : c'est ainsi que l'on s'améliore.</p>
        <p>Si vous êtes passés par Booking ou Airbnb, vous pouvez aussi y laisser un avis.</p>`,
            cta: "Laisser un avis sur Google",
        },
    }[lang];
    return {
        from: EMAIL_FROM,
        subject: T.subject,
        html: shell(
            T.heading,
            `${T.body}
        ${firma(lang)}`,
            T.cta,
            GOOGLE_REVIEW_URL,
            lang
        ),
    };
};

// 7. Un mes después, solo directos. Sin código de descuento: no existe
// ninguno en la base (discount_codes vacía); si Jesús decide uno, se añade aquí.
const renderReactivation = (b: BookingPayload): RenderedEmail => {
    const lang = idiomaDe(b);
    const fn = firstName(b.guest_name);
    const ci = diaMes(b.check_in, lang), co = diaMes(b.check_out, lang);
    const T = {
        es: {
            subject: `${fn}, un mes ya desde que estuvisteis en ${b.apartment_name}`,
            heading: `Hola ${fn}`,
            body: `<p>Hace un mes que os fuisteis de <strong>${b.apartment_name}</strong>, donde estuvisteis del ${ci} al ${co}. Preparando el apartamento para los siguientes me he acordado de vosotros, y por eso os escribo.</p>
        <p>Espero que os llevarais buen recuerdo de Hinojares. Cada época tiene aquí lo suyo, y a quien ya conoce la casa le gusta verla en otra estación.</p>
        <p>Si os apetece volver, nos encantaría teneros otra vez en casa.</p>`,
            cta: "Ver los días libres",
        },
        en: {
            subject: `${fn}, a month already since your stay at ${b.apartment_name}`,
            heading: `Hello ${fn}`,
            body: `<p>It has been a month since you left <strong>${b.apartment_name}</strong>, where you stayed from ${ci} to ${co}. While getting the apartment ready for the next guests I thought of you, and that is why I am writing.</p>
        <p>I hope you took home good memories of Hinojares. Every season has something of its own here, and those who already know the house like to see it at another time of year.</p>
        <p>If you feel like coming back, we would love to have you with us again.</p>`,
            cta: "See available dates",
        },
        de: {
            subject: `${fn}, schon ein Monat seit Ihrem Aufenthalt in ${b.apartment_name}`,
            heading: `Hallo ${fn}`,
            body: `<p>Vor einem Monat sind Sie aus <strong>${b.apartment_name}</strong> abgereist, wo Sie vom ${ci} bis zum ${co} gewohnt haben. Als ich die Ferienwohnung für die nächsten Gäste vorbereitet habe, musste ich an Sie denken, und deshalb schreibe ich Ihnen.</p>
        <p>Ich hoffe, Sie haben Hinojares in guter Erinnerung. Jede Jahreszeit hat hier ihren eigenen Reiz, und wer das Haus schon kennt, erlebt es gern einmal zu einer anderen Jahreszeit.</p>
        <p>Wenn Sie Lust haben wiederzukommen, würden wir uns sehr freuen, Sie wieder bei uns begrüßen zu dürfen.</p>`,
            cta: "Freie Termine ansehen",
        },
        fr: {
            subject: `${fn}, déjà un mois depuis votre séjour à ${b.apartment_name}`,
            heading: `Bonjour ${fn}`,
            body: `<p>Cela fait un mois que vous avez quitté <strong>${b.apartment_name}</strong>, où vous avez séjourné du ${ci} au ${co}. En préparant l'appartement pour les prochains hôtes, j'ai pensé à vous, et c'est pour cela que je vous écris.</p>
        <p>J'espère que vous gardez un bon souvenir d'Hinojares. Chaque saison a ici son charme, et ceux qui connaissent déjà la maison aiment la redécouvrir à une autre époque de l'année.</p>
        <p>Si l'envie vous prend de revenir, nous serions ravis de vous accueillir à nouveau.</p>`,
            cta: "Voir les dates disponibles",
        },
    }[lang];
    return {
        from: EMAIL_FROM,
        subject: T.subject,
        html: shell(
            T.heading,
            `${T.body}
        ${firma(lang)}`,
            T.cta,
            `${SITE_URL}/reservar`,
            lang
        ),
    };
};

// El enlace a la ficha, otra vez. La manda la función enlace-guia cuando el
// huésped escribe su correo en /guia («he perdido el enlace»). Solo llega al
// correo de la reserva: nunca al que se escribe en pantalla.
const renderGuideLink = (b: BookingPayload): RenderedEmail => {
    const lang = idiomaDe(b);
    const fn = firstName(b.guest_name);
    const ci = diaMes(b.check_in, lang), co = diaMes(b.check_out, lang);
    const T = {
        es: {
            subject: `Tu guía de la casa — ${b.apartment_name}, ${ci}`,
            heading: `Hola ${fn}, aquí tienes el enlace`,
            intro: `<p>Nos has pedido el enlace de tu guía de la casa para la reserva en <strong>${b.apartment_name}</strong> del ${ci} al ${co}. Aquí lo tienes otra vez.</p>`,
            guardalo: `<p>Guárdalo en el móvil: ahí está tu reserva, cómo llegar, los datos para la policía y lo de la casa.</p>`,
        },
        en: {
            subject: `Your house guide — ${b.apartment_name}, ${ci}`,
            heading: `Hello ${fn}, here is the link`,
            intro: `<p>You asked us for the link to your house guide for your booking at <strong>${b.apartment_name}</strong> from ${ci} to ${co}. Here it is again.</p>`,
            guardalo: `<p>Save it on your phone: it has your booking, directions, the details for the police and the information about the house.</p>`,
        },
        de: {
            subject: `Ihre Gästemappe — ${b.apartment_name}, ${ci}`,
            heading: `Hallo ${fn}, hier ist Ihr Link`,
            intro: `<p>Sie haben uns um den Link zu Ihrer Gästemappe für Ihre Buchung in <strong>${b.apartment_name}</strong> vom ${ci} bis zum ${co} gebeten. Hier ist er noch einmal.</p>`,
            guardalo: `<p>Speichern Sie ihn am besten auf Ihrem Handy: Dort finden Sie Ihre Buchung, die Anfahrt, die Angaben für die Polizei und die Informationen zum Haus.</p>`,
        },
        fr: {
            subject: `Votre livret d'accueil — ${b.apartment_name}, ${ci}`,
            heading: `Bonjour ${fn}, voici le lien`,
            intro: `<p>Vous nous avez demandé le lien vers votre livret d'accueil pour votre réservation à <strong>${b.apartment_name}</strong> du ${ci} au ${co}. Le voici de nouveau.</p>`,
            guardalo: `<p>Gardez-le sur votre téléphone : vous y trouverez votre réservation, l'itinéraire, les informations pour la police et tout ce qui concerne la maison.</p>`,
        },
    }[lang];
    return {
        from: EMAIL_FROM,
        subject: T.subject,
        html: shell(
            T.heading,
            `${T.intro}
        ${bookingSummary(b)}
        ${T.guardalo}
        ${firma(lang)}`,
            UI[lang].guiaCta,
            guiaUrl(b),
            lang
        ),
    };
};

// Bloque destacado en rojo cuando el cliente tiene historial relevante en su ficha CRM.
const customerAlertsBlock = (b: BookingPayload): string => {
    const warnings = b.customer_warnings || [];
    const tags = b.customer_tags || [];
    const prefs = b.customer_preferences;
    if (warnings.length === 0 && tags.length === 0 && !prefs) return "";
    const warningsHtml = warnings.length > 0
        ? `<p style="margin:0 0 8px;font-weight:700;color:#991B1B;">⚠️ Avisos en su ficha:</p><ul style="margin:0 0 12px;padding-left:20px;color:#7F1D1D;">${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`
        : "";
    const tagsHtml = tags.length > 0
        ? `<p style="margin:0 0 4px;font-size:12px;color:#7F1D1D;"><strong>Etiquetas:</strong> ${tags.map(t => escapeHtml(t)).join(" · ")}</p>`
        : "";
    const prefsHtml = prefs
        ? `<p style="margin:8px 0 0;font-size:13px;color:#7F1D1D;"><strong>Preferencias permanentes:</strong> ${escapeHtml(prefs)}</p>`
        : "";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;margin:16px 0;"><tr><td style="padding:14px 18px;">${warningsHtml}${tagsHtml}${prefsHtml}</td></tr></table>`;
};

// 11. Aviso interno: ya han rellenado los datos de la policía. Lo dispara la
// base (trigger de la migración 0040) cuando entra la última ficha. Al buzón
// del negocio, no al huésped. Lo que ella tiene que hacer: darles la llave y
// «Terminar el check-in» en el panel. Siempre en castellano.
const renderOperatorPrecheckinDone = (b: BookingPayload): RenderedEmail => {
    const nombres = (b.precheckin_nombres || []).filter(Boolean);
    const quienes = nombres.length === 0 ? "Los huéspedes" : nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
    const hoyMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const cuando = b.check_in === hoyMadrid ? "hoy" : `el ${diaMes(b.check_in)}`;
    return {
        from: EMAIL_FROM,
        subject: `${quienes} ya ${nombres.length === 1 ? "ha" : "han"} rellenado los datos de la policía — ${b.apartment_name}, ${cuando}`,
        html: shell(
            `Datos de la policía: ya están todos`,
            `<p><strong>${quienes}</strong> ${nombres.length === 1 ? "ha" : "han"} rellenado sus datos para la reserva de <strong>${b.apartment_name}</strong> (entra ${cuando}). En el panel el semáforo está en verde.</p>
            ${bookingSummary(b, "es")}
            <p>Lo que queda: darles la llave y pulsar <strong>«Terminar el check-in»</strong> en su reserva, para que quede la hora de entrada. El parte a la policía sale solo.</p>`,
            "Abrir la reserva en el panel",
            `${SITE_URL}/panel`
        ),
    };
};

// 10. Aviso interno: va al buzón del negocio (la cuenta de Mari Carmen), no al
// huésped. Siempre en castellano.
const renderOperatorNewBooking = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `${(b.customer_warnings || []).length > 0 ? "⚠️ " : ""}Reserva nueva ${b.booking_code} — ${b.apartment_name}, ${diaMes(b.check_in)}`,
    html: shell(
        `Ha entrado una reserva nueva`,
        `<p>${escapeHtml(b.guest_name)} ha reservado <strong>${b.apartment_name}</strong> del ${diaMes(b.check_in)} al ${diaMes(b.check_out)}.</p>
        ${customerAlertsBlock(b)}
        ${bookingSummary(b, "es")}
        <p><strong>Correo del huésped:</strong> <a href="mailto:${b.guest_email}">${b.guest_email}</a></p>
        <p>No hay que hacer nada: el huésped ya tiene su confirmación. En el panel la ves con el resto.</p>`,
        "Abrir el panel",
        `${SITE_URL}/panel`
    ),
});

// Pequeño helper porque la plantilla interpola guest_name en texto
function escapeHtml(s: string | null | undefined): string {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// 8 y 9. Cambios y cancelaciones hechos desde el panel (los dispara Mari
// Carmen, un toque por reserva; solo a quien reservó directo — a los de
// Booking/Airbnb les avisa el canal).
// ---------------------------------------------------------------------------
const nightsBetween = (a: string, b: string) =>
    Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400_000);

const renderBookingChanged = (b: BookingPayload): RenderedEmail => {
    const lang = idiomaDe(b);
    const fn = firstName(b.guest_name);
    const p = b.previous;
    const noches = nightsBetween(b.check_in, b.check_out);
    const ci = diaMes(b.check_in, lang), co = diaMes(b.check_out, lang);
    const T = {
        es: {
            antes: p ? `Antes era: ${p.apartment_name}, del ${diaMes(p.check_in)} al ${diaMes(p.check_out)}.` : "",
            subject: `Tu reserva ha cambiado — ${b.booking_code}`,
            heading: `Hola ${fn}, te confirmo el cambio`,
            queda: `<p>Como hemos hablado, tu reserva queda así: ${noches === 1 ? "una noche" : `${noches} noches`} en <strong>${b.apartment_name}</strong>, entrando el ${ci} y saliendo el ${co}.</p>`,
            total: `<p>El total de arriba es el precio de la reserva tal y como queda ahora. Si algo no es como lo habíamos hablado, contéstame a este correo o escríbeme por WhatsApp y lo arreglamos.</p>`,
        },
        en: {
            antes: p ? `Before it was: ${p.apartment_name}, from ${diaMes(p.check_in, lang)} to ${diaMes(p.check_out, lang)}.` : "",
            subject: `Your booking has changed — ${b.booking_code}`,
            heading: `Hello ${fn}, I am confirming the change`,
            queda: `<p>As we discussed, your booking is now: ${noches === 1 ? "one night" : `${noches} nights`} at <strong>${b.apartment_name}</strong>, arriving on ${ci} and leaving on ${co}.</p>`,
            total: `<p>The total above is the price of the booking as it stands now. If anything is not as we agreed, reply to this email or message me on WhatsApp and we will sort it out.</p>`,
        },
        de: {
            antes: p ? `Vorher: ${p.apartment_name}, vom ${diaMes(p.check_in, lang)} bis zum ${diaMes(p.check_out, lang)}.` : "",
            subject: `Ihre Buchung wurde geändert — ${b.booking_code}`,
            heading: `Hallo ${fn}, hiermit bestätige ich die Änderung`,
            queda: `<p>Wie besprochen sieht Ihre Buchung jetzt so aus: ${noches === 1 ? "eine Nacht" : `${noches} Nächte`} in <strong>${b.apartment_name}</strong>, Anreise am ${ci} und Abreise am ${co}.</p>`,
            total: `<p>Der oben angegebene Gesamtbetrag ist der Preis der Buchung in ihrer jetzigen Form. Falls etwas nicht so ist, wie wir es besprochen hatten, antworten Sie einfach auf diese E-Mail oder schreiben Sie mir per WhatsApp, dann klären wir das.</p>`,
        },
        fr: {
            antes: p ? `Avant : ${p.apartment_name}, du ${diaMes(p.check_in, lang)} au ${diaMes(p.check_out, lang)}.` : "",
            subject: `Votre réservation a été modifiée — ${b.booking_code}`,
            heading: `Bonjour ${fn}, je vous confirme la modification`,
            queda: `<p>Comme convenu, votre réservation est désormais la suivante : ${noches === 1 ? "une nuit" : `${noches} nuits`} à <strong>${b.apartment_name}</strong>, arrivée le ${ci} et départ le ${co}.</p>`,
            total: `<p>Le total ci-dessus correspond au prix de la réservation telle qu'elle est maintenant. Si quelque chose ne correspond pas à ce que nous avions convenu, répondez à cet e-mail ou écrivez-moi sur WhatsApp et nous arrangerons cela.</p>`,
        },
    }[lang];
    const antes = p
        ? `<p style="font-size:14px;color:#8C8468;margin:0 0 4px;">${T.antes}</p>`
        : "";
    return {
        from: EMAIL_FROM,
        subject: T.subject,
        html: shell(
            T.heading,
            `${T.queda}
            ${antes}
            ${bookingSummary(b)}
            ${T.total}
            ${firma(lang)}`,
            UI[lang].guiaCta,
            guiaUrl(b),
            lang
        ),
    };
};

const renderBookingCancelled = (b: BookingPayload): RenderedEmail => {
    const lang = idiomaDe(b);
    const fn = firstName(b.guest_name);
    const pagado = Number(b.paid_amount || 0);
    const devolver = Number(b.refund_amount || 0);
    const ci = diaMes(b.check_in, lang), co = diaMes(b.check_out, lang);
    const T = {
        es: {
            devolver: `<p><strong>Te devolvemos ${formatPrice(devolver)}.</strong> Si pagaste con tarjeta en la web, te llega sola a la misma tarjeta en unos días. Si fue por transferencia o Bizum, te lo ingresamos nosotros; si en una semana no lo ves, escríbenos.</p>`,
            noDevolver: `<p>Según las condiciones de cancelación (gratis hasta 7 días antes de la llegada), lo pagado (${formatPrice(pagado)}) no se devuelve. <strong>Pero podéis cambiar de fechas una vez, sin coste, dentro de los 12 meses siguientes</strong>: escribidnos y lo miramos. Si creéis que hay un error, decídnoslo también.</p>`,
            subject: `Reserva cancelada — ${b.booking_code}`,
            heading: `Hola ${fn}, tu reserva queda cancelada`,
            cancelada: `<p>He cancelado tu reserva en <strong>${b.apartment_name}</strong> del ${ci} al ${co} (código ${b.booking_code}). Esos días quedan libres.</p>`,
            despedida: `<p>Sentimos que no podáis venir esta vez. Cuando queráis, aquí estamos.</p>`,
        },
        en: {
            devolver: `<p><strong>We are refunding you ${formatPrice(devolver, lang)}.</strong> If you paid by card on the website, it will go back to the same card automatically within a few days. If you paid by bank transfer or Bizum, we will send it to you ourselves; if you do not see it within a week, write to us.</p>`,
            noDevolver: `<p>Under the cancellation terms (free up to 7 days before arrival), the amount paid (${formatPrice(pagado, lang)}) is not refundable. <strong>But you can change your dates once, at no cost, within the following 12 months</strong>: write to us and we will look into it. If you think there is a mistake, please let us know as well.</p>`,
            subject: `Booking cancelled — ${b.booking_code}`,
            heading: `Hello ${fn}, your booking has been cancelled`,
            cancelada: `<p>I have cancelled your booking at <strong>${b.apartment_name}</strong> from ${ci} to ${co} (code ${b.booking_code}). Those days are now free.</p>`,
            despedida: `<p>We are sorry you cannot come this time. Whenever you like, we are here.</p>`,
        },
        de: {
            devolver: `<p><strong>Wir erstatten Ihnen ${formatPrice(devolver, lang)}.</strong> Wenn Sie auf der Website mit Karte bezahlt haben, geht der Betrag in einigen Tagen automatisch auf dieselbe Karte zurück. Bei Zahlung per Überweisung oder Bizum überweisen wir ihn Ihnen selbst; sollten Sie ihn nach einer Woche nicht sehen, schreiben Sie uns bitte.</p>`,
            noDevolver: `<p>Gemäß den Stornierungsbedingungen (kostenlos bis 7 Tage vor der Anreise) wird der gezahlte Betrag (${formatPrice(pagado, lang)}) nicht erstattet. <strong>Sie können Ihre Reisedaten aber einmal kostenlos innerhalb der folgenden 12 Monate ändern</strong>: Schreiben Sie uns, dann schauen wir es uns an. Wenn Sie glauben, dass ein Fehler vorliegt, sagen Sie uns bitte ebenfalls Bescheid.</p>`,
            subject: `Buchung storniert — ${b.booking_code}`,
            heading: `Hallo ${fn}, Ihre Buchung ist storniert`,
            cancelada: `<p>Ich habe Ihre Buchung in <strong>${b.apartment_name}</strong> vom ${ci} bis zum ${co} (Buchungscode ${b.booking_code}) storniert. Diese Tage sind nun wieder frei.</p>`,
            despedida: `<p>Es tut uns leid, dass Sie dieses Mal nicht kommen können. Wann immer Sie möchten, sind wir für Sie da.</p>`,
        },
        fr: {
            devolver: `<p><strong>Nous vous remboursons ${formatPrice(devolver, lang)}.</strong> Si vous avez payé par carte sur le site, le remboursement arrivera automatiquement sur la même carte d'ici quelques jours. Si vous avez payé par virement ou Bizum, nous vous le versons nous-mêmes ; si vous ne le voyez pas d'ici une semaine, écrivez-nous.</p>`,
            noDevolver: `<p>Selon les conditions d'annulation (gratuite jusqu'à 7 jours avant l'arrivée), le montant payé (${formatPrice(pagado, lang)}) n'est pas remboursé. <strong>Mais vous pouvez changer de dates une fois, sans frais, dans les 12 mois qui suivent</strong> : écrivez-nous et nous regarderons cela. Si vous pensez qu'il y a une erreur, dites-le-nous également.</p>`,
            subject: `Réservation annulée — ${b.booking_code}`,
            heading: `Bonjour ${fn}, votre réservation est annulée`,
            cancelada: `<p>J'ai annulé votre réservation à <strong>${b.apartment_name}</strong> du ${ci} au ${co} (référence ${b.booking_code}). Ces dates sont de nouveau libres.</p>`,
            despedida: `<p>Nous regrettons que vous ne puissiez pas venir cette fois-ci. Quand vous le souhaiterez, nous serons là.</p>`,
        },
    }[lang];
    let dinero = "";
    if (devolver > 0) {
        dinero = T.devolver;
    } else if (pagado > 0) {
        dinero = T.noDevolver;
    }
    return {
        from: EMAIL_FROM,
        subject: T.subject,
        html: shell(
            T.heading,
            `${T.cancelada}
            ${dinero}
            ${T.despedida}
            ${firma(lang)}`,
            undefined,
            undefined,
            lang
        ),
    };
};

export const render = (key: TemplateKey, b: BookingPayload): RenderedEmail => {
    switch (key) {
        case "confirmation":            return renderConfirmation(b);
        case "reminder_7d":             return renderReminder7d(b);
        case "reminder_24h":            return renderReminder24h(b);
        case "review_request":          return renderReviewRequest(b);
        case "reactivation":            return renderReactivation(b);
        case "operator_new_booking":    return renderOperatorNewBooking(b);
        case "operator_precheckin_done": return renderOperatorPrecheckinDone(b);
        case "booking_changed":         return renderBookingChanged(b);
        case "booking_cancelled":       return renderBookingCancelled(b);
        case "guide_link":              return renderGuideLink(b);
    }
};

export const TEMPLATE_TO_FLAG: Record<TemplateKey, string> = {
    confirmation:           "confirmation_email_sent_at",
    reminder_7d:            "reminder_7d_email_sent_at",
    reminder_24h:           "reminder_24h_email_sent_at",
    review_request:         "review_request_email_sent_at",
    reactivation:           "reactivation_email_sent_at",
    operator_new_booking:   "operator_notified_at",       // anotamos pero no bloqueamos reenvíos
    operator_precheckin_done: "precheckin_completo_avisado_at",
    booking_changed:        "change_email_sent_at",       // se anota la última vez; NO bloquea reenvíos
    booking_cancelled:      "cancellation_email_sent_at",
    guide_link:             "",                            // no se apunta: se puede pedir las veces que haga falta
};

/** Plantillas que se pueden mandar más de una vez por reserva. */
export const REPEATABLE_TEMPLATES: TemplateKey[] = ["booking_changed"];

export type { BookingPayload, TemplateKey, RenderedEmail, Idioma };

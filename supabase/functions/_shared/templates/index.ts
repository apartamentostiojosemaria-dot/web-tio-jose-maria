// Plantillas HTML transaccionales — escritas como habla Mari Carmen: corto,
// educado, sin gracietas, y solo lo que el huésped necesita saber.
// Reescritas el 18-sep-2026 (antes decían «nos chocamos los cinco»).
// =====================================================================
// CSS inline para máxima compatibilidad. Sin imágenes externas excepto el
// logo (que se puede activar cambiando LOGO_URL). Tablas para estructura
// (Outlook desktop sigue requiriéndolas).

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
    /** Solo booking_changed: cómo estaba antes del cambio (opcional). */
    previous?: { check_in: string; check_out: string; apartment_name: string } | null;
    /** Solo booking_cancelled: lo que se le devuelve y lo que había pagado. */
    refund_amount?: number;
    paid_amount?: number;
    free_cancellation?: boolean;
    /** Solo reminder_24h: cuántos han rellenado los datos de la policía y cuántos se esperan. */
    precheckin?: { rellenos: number; total: number } | null;
    /** Solo confirmation: si el formulario de la policía ya está abierto (llegada a 7 días o menos).
     *  Si no lo está, la confirmación no lo menciona: lo pide el correo de los 7 días. */
    precheckin_abierto?: boolean;
}

const SITE_URL = "https://tiojosemaria.com";
const WHATSAPP_E164 = "+34676344675";
const WHATSAPP_URL = "https://wa.me/34676344675";
const EMAIL_FROM = "Tío José María <hola@tiojosemaria.com>";
const GOOGLE_REVIEW_URL = "https://g.page/r/CTDH4snlte-aEBM/review";

const formatDate = (s: string) => {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
};
const formatPrice = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const firstName = (full: string) => (full.trim().split(/\s+/)[0] || full).trim();
const precheckinUrl = (b: BookingPayload) => `${SITE_URL}/precheckin?code=${b.booking_code}`;

const MAPS_URL = "https://maps.app.goo.gl/EPzh8j2HivLfqUeN8";
const PHONE_HUMAN = "676 34 46 75";

// Fechas como las dice ella: «el 18 de septiembre», no «18/09/2026».
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const diaMes = (s: string) => {
    const [, m, d] = s.split("-");
    return `${Number(d)} de ${MESES[Number(m) - 1]}`;
};

// El recuadro de los datos de la policía. Una frase de por qué, una de cómo,
// y el enlace. Se abre 7 días antes de la llegada (migración 0018).
const precheckinBlock = (b: BookingPayload, intro: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6EC;border:1px solid #D9DFC6;border-radius:12px;margin:16px 0;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#556B2F;font-weight:700;">Datos para la policía</p>
    <p style="margin:0;font-size:14px;color:#2C3319;">${intro} Se rellena desde el móvil, una persona por pantalla, y no hay que mandar foto de ningún documento.</p>
    <p style="margin:10px 0 0;font-size:14px;"><a href="${precheckinUrl(b)}" style="color:#556B2F;font-weight:700;text-decoration:underline;">Rellenar los datos</a></p>
  </td></tr>
</table>`;

const shell = (heading: string, body: string, ctaLabel?: string, ctaUrl?: string) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${heading}</title></head>
<body style="margin:0;background:#FCFBF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2C3319;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FCFBF9;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #F0EDE6;border-radius:18px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#556B2F,#4A5D28);padding:28px 32px;color:#ffffff;">
        <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">Apartamentos Rurales</p>
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
        <p style="margin:0 0 8px;">Para lo que necesitéis: <a href="${WHATSAPP_URL}" style="color:#556B2F;text-decoration:underline;">WhatsApp</a> · <a href="tel:${WHATSAPP_E164}" style="color:#556B2F;text-decoration:underline;">${PHONE_HUMAN}</a> · <a href="mailto:apartamentostiojosemaria@gmail.com" style="color:#556B2F;text-decoration:underline;">correo</a></p>
        <p style="margin:0;">Calle Baja 1, 23486 Hinojares (Jaén) · A/JA/00060 · <a href="${SITE_URL}/privacidad" style="color:#8C8468;">Privacidad</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

// Foto del apartamento como imagen ancho completo (max 560px) con esquinas redondeadas.
// Si no hay URL, no se renderiza nada (ningún hueco).
const apartmentPhoto = (b: BookingPayload) => {
    if (!b.apartment_image) return "";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
      <tr><td>
        <img src="${b.apartment_image}" alt="Apartamento ${b.apartment_name}"
             width="496" style="display:block;width:100%;max-width:496px;height:auto;border-radius:12px;border:1px solid #F0EDE6;">
      </td></tr>
    </table>`;
};

// Firma: como firma ella. Sin abrazos a desconocidos.
const SIGNATURE = `<p style="margin:24px 0 0;color:#2C3319;">Un saludo,<br><strong style="font-family:'Playfair Display',Georgia,serif;font-size:17px;color:#556B2F;">Mari Carmen y Jesús</strong><br><span style="font-size:12px;color:#8C8468;">Apartamentos Rurales Tío José María · ${PHONE_HUMAN}</span></p>`;

const bookingSummary = (b: BookingPayload) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FCFBF9;border:1px solid #F0EDE6;border-radius:12px;margin:16px 0;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#556B2F;font-weight:700;">Tu reserva</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;font-size:14px;">
      <tr><td style="padding:4px 0;color:#8C8468;">Código</td><td style="padding:4px 0;text-align:right;font-family:'SF Mono',Menlo,monospace;font-weight:700;color:#556B2F;">${b.booking_code}</td></tr>
      <tr><td style="padding:4px 0;color:#8C8468;">Apartamento</td><td style="padding:4px 0;text-align:right;font-weight:700;">${b.apartment_name}</td></tr>
      <tr><td style="padding:4px 0;color:#8C8468;">Entrada</td><td style="padding:4px 0;text-align:right;">${formatDate(b.check_in)}</td></tr>
      <tr><td style="padding:4px 0;color:#8C8468;">Salida</td><td style="padding:4px 0;text-align:right;">${formatDate(b.check_out)}</td></tr>
      <tr><td style="padding:4px 0;color:#8C8468;">Total</td><td style="padding:4px 0;text-align:right;font-weight:700;">${formatPrice(b.total_price)}</td></tr>
    </table>
  </td></tr>
</table>`;

// Lo que ella dice siempre al que llega. Un solo sitio, para que los correos
// no se contradigan entre sí. Fuente: la guía del huésped (apartment_instructions).
const LLEGADA = `<p><strong>Cómo llegar:</strong> Calle Baja 1, Hinojares. Se aparca gratis justo enfrente. Con este enlace el móvil te lleva a la puerta:<br><a href="${MAPS_URL}" style="display:inline-block;margin-top:6px;color:#556B2F;font-weight:700;text-decoration:underline;">Abrir en Google Maps</a></p>
<p><strong>Entrada:</strong> a partir de las 16:00. Las llaves te las damos en mano. Si vas a llegar después de las 21:00, avísanos por WhatsApp y te decimos cómo lo hacemos.</p>`;

type TemplateKey = "confirmation" | "reminder_7d" | "reminder_24h" | "review_request" | "reactivation" | "operator_new_booking" | "booking_changed" | "booking_cancelled";

interface RenderedEmail { subject: string; html: string; from: string; }

// 1. Al reservar en la web (solo reservas directas).
// Con tiempo: corto, y el de «cómo llegar» ya vendrá. A menos de 7 días: un
// solo correo con todo (llegar, casa, policía) y send-booking-email apunta el
// de los 7 días como enviado para no repetirlo (Jesús, 18-sep).
// Sin chimenea (desde el invierno de 2026 no se sube leña; Jesús, 18-sep) y sin
// enlace a la guía de la zona hasta que esté terminada.
const CASA = `<p><strong>Lo que hay en la casa:</strong> sábanas, toallas y mantas, y la cocina completa con lo básico para cocinar. No hace falta que traigas nada de eso.</p>`;

const renderConfirmation = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `Reserva confirmada en Tío José María — ${b.booking_code}`,
    html: shell(
        `Hola ${firstName(b.guest_name)}, tu reserva está hecha`,
        b.precheckin_abierto
            ? `<p>Tienes reservado el apartamento <strong>${b.apartment_name}</strong> del ${diaMes(b.check_in)} al ${diaMes(b.check_out)}. Gracias por reservar con nosotros. Como ya queda poco, te dejo aquí todo lo que hace falta saber.</p>
        ${apartmentPhoto(b)}
        ${bookingSummary(b)}
        ${LLEGADA}
        <p><strong>Salida:</strong> antes de las 12:00.</p>
        ${CASA}
        ${precheckinBlock(b, "Por ley tenemos que comunicar a la policía los datos de cada persona que se aloja. Con este enlace los rellenáis vosotros mismos antes de llegar (nombre, documento y poco más).")}
        <p>Si alguien tiene alergia o necesitáis algo en especial, decídnoslo y lo preparamos.</p>
        ${SIGNATURE}`
            : `<p>Tienes reservado el apartamento <strong>${b.apartment_name}</strong> del ${diaMes(b.check_in)} al ${diaMes(b.check_out)}. Gracias por reservar con nosotros.</p>
        ${apartmentPhoto(b)}
        ${bookingSummary(b)}
        <p>La entrada es a partir de las 16:00 y la salida antes de las 12:00. Las llaves te las damos en mano cuando llegues.</p>
        <p>Unos días antes de venir te vuelvo a escribir con cómo llegar y lo que hay en la casa. Si mientras tanto necesitas algo, llámanos o escríbenos.</p>
        ${SIGNATURE}`,
        b.precheckin_abierto ? "Rellenar los datos" : "Ver mi reserva",
        b.precheckin_abierto ? precheckinUrl(b) : `${SITE_URL}/reservar/confirmada?code=${b.booking_code}`
    ),
});

// 2. Entre 7 y 2 días antes (directos y canales). No siempre son 7 justos:
// una reserva hecha tarde lo recibe al día siguiente, por eso el asunto
// dice la fecha y no «la semana que viene».
const renderReminder7d = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `Os esperamos el ${diaMes(b.check_in)} en Hinojares`,
    html: shell(
        `Hola ${firstName(b.guest_name)}, ya queda poco`,
        `<p>El ${diaMes(b.check_in)} te esperamos en el apartamento <strong>${b.apartment_name}</strong>. Te cuento lo que hace falta saber para venir tranquilo.</p>
        ${apartmentPhoto(b)}
        ${LLEGADA}
        ${CASA}
        ${precheckinBlock(b, "Ya se puede rellenar el formulario con los datos de cada persona que viene (nombre, documento y poco más). Nos lo pide la ley y lo necesitamos antes de que lleguéis.")}
        ${bookingSummary(b)}
        <p>Si alguien tiene alergia o necesitáis algo en especial, decídnoslo y lo preparamos.</p>
        ${SIGNATURE}`,
        "Rellenar los datos",
        precheckinUrl(b)
    ),
});

// 3. La víspera. Solo sale si faltan datos de la policía (lo decide
// send-booking-email); por eso dice cuántos faltan.
const faltanEnPalabras = (p: { rellenos: number; total: number } | null | undefined) => {
    if (!p) return "Nos falta el formulario con los datos de cada persona que viene.";
    const faltan = Math.max(p.total - p.rellenos, 0);
    if (p.rellenos === 0) {
        return p.total === 1
            ? "Todavía no tenemos tus datos para la policía."
            : `Todavía no tenemos los datos para la policía de ninguna de las ${p.total} personas que venís.`;
    }
    return faltan === 1
        ? `Ya tenemos los datos de ${p.rellenos} de ${p.total}: falta 1 persona.`
        : `Ya tenemos los datos de ${p.rellenos} de ${p.total}: faltan ${faltan} personas.`;
};

const renderReminder24h = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `Mañana os esperamos — nos faltan los datos para la policía`,
    html: shell(
        `Hola ${firstName(b.guest_name)}, mañana os esperamos`,
        `${precheckinBlock(b, `${faltanEnPalabras(b.precheckin)} Nos lo pide la ley y tiene que estar hecho antes de entrar. Si lo hacéis hoy desde el móvil, mañana os damos las llaves y ya está.`)}
        ${LLEGADA}
        ${bookingSummary(b)}
        ${SIGNATURE}`,
        "Rellenar los datos que faltan",
        precheckinUrl(b)
    ),
});

// (Los antiguos correos del día de llegada y del día de salida se quitaron el
// 18-sep-2026: Mari Carmen lo explica al dar las llaves y la ficha del huésped
// /guia/<código> lo tendrá por escrito.)

// 6. Pedir opinión, unos días después.
const renderReviewRequest = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `¿Qué tal en Tío José María?`,
    html: shell(
        `Hola ${firstName(b.guest_name)}, ¿qué tal ha ido?`,
        `<p>Esperamos que hayáis descansado. Si tenéis un momento, nos gustaría que dejarais vuestra opinión en Google: para una casa pequeña como la nuestra, lo que cuentan los que ya han venido es lo que más nos ayuda.</p>
        <p>Y si hay algo que no os ha gustado, decídnoslo a nosotros también, que es como se arregla.</p>
        <p>Si vinisteis por Booking o Airbnb, allí también podéis dejarla.</p>
        ${SIGNATURE}`,
        "Dejar una opinión en Google",
        GOOGLE_REVIEW_URL
    ),
});

// 7. Un mes después, solo directos. Sin código de descuento: no existe
// ninguno en la base (discount_codes vacía); si Jesús decide uno, se añade aquí.
const renderReactivation = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `Cuando queráis volver a Hinojares`,
    html: shell(
        `Hola ${firstName(b.guest_name)}`,
        `<p>Hace un mes que estuvisteis en casa. Solo quería deciros que, cuando os apetezca volver, aquí estamos.</p>
        <p>Si es en otra época del año, escribidnos y os contamos qué hay por aquí en esas fechas. Y reservando con nosotros directamente os atendemos igual que esta vez.</p>
        ${SIGNATURE}`,
        "Ver fechas libres",
        `${SITE_URL}/reservar`
    ),
});

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

// 10. Aviso interno: va al buzón del negocio (la cuenta de Mari Carmen), no al huésped.
const renderOperatorNewBooking = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `${(b.customer_warnings || []).length > 0 ? "⚠️ " : ""}Reserva nueva ${b.booking_code} — ${b.apartment_name}, ${diaMes(b.check_in)}`,
    html: shell(
        `Ha entrado una reserva nueva`,
        `<p>${escapeHtml(b.guest_name)} ha reservado <strong>${b.apartment_name}</strong> del ${diaMes(b.check_in)} al ${diaMes(b.check_out)}.</p>
        ${customerAlertsBlock(b)}
        ${bookingSummary(b)}
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
    const p = b.previous;
    const antes = p
        ? `<p style="font-size:14px;color:#8C8468;margin:0 0 4px;">Antes era: ${p.apartment_name}, del ${diaMes(p.check_in)} al ${diaMes(p.check_out)}.</p>`
        : "";
    const noches = nightsBetween(b.check_in, b.check_out);
    return {
        from: EMAIL_FROM,
        subject: `Tu reserva ha cambiado — ${b.booking_code}`,
        html: shell(
            `Hola ${firstName(b.guest_name)}, te confirmo el cambio`,
            `<p>Como hemos hablado, tu reserva queda así: ${noches === 1 ? "una noche" : `${noches} noches`} en <strong>${b.apartment_name}</strong>, entrando el ${diaMes(b.check_in)} y saliendo el ${diaMes(b.check_out)}.</p>
            ${antes}
            ${bookingSummary(b)}
            <p>El total de arriba es el precio de la reserva tal y como queda ahora. Si algo no es como lo habíamos hablado, contéstame a este correo o escríbeme por WhatsApp y lo arreglamos.</p>
            ${SIGNATURE}`,
            "Ver mi reserva",
            `${SITE_URL}/reservar/confirmada?code=${b.booking_code}`
        ),
    };
};

const renderBookingCancelled = (b: BookingPayload): RenderedEmail => {
    const pagado = Number(b.paid_amount || 0);
    const devolver = Number(b.refund_amount || 0);
    let dinero = "";
    if (devolver > 0) {
        dinero = `<p><strong>Te devolvemos ${formatPrice(devolver)}.</strong> Si pagaste con tarjeta en la web, te llega sola a la misma tarjeta en unos días. Si fue por transferencia o Bizum, te lo ingresamos nosotros; si en una semana no lo ves, escríbenos.</p>`;
    } else if (pagado > 0) {
        dinero = `<p>Según las condiciones de cancelación (gratis hasta 7 días antes de la llegada), lo pagado (${formatPrice(pagado)}) no se devuelve. Si crees que hay un error, escríbenos y lo miramos.</p>`;
    }
    return {
        from: EMAIL_FROM,
        subject: `Reserva cancelada — ${b.booking_code}`,
        html: shell(
            `Hola ${firstName(b.guest_name)}, tu reserva queda cancelada`,
            `<p>He cancelado tu reserva en <strong>${b.apartment_name}</strong> del ${diaMes(b.check_in)} al ${diaMes(b.check_out)} (código ${b.booking_code}). Esos días quedan libres.</p>
            ${dinero}
            <p>Sentimos que no podáis venir esta vez. Cuando queráis, aquí estamos.</p>
            ${SIGNATURE}`,
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
        case "booking_changed":         return renderBookingChanged(b);
        case "booking_cancelled":       return renderBookingCancelled(b);
    }
};

export const TEMPLATE_TO_FLAG: Record<TemplateKey, string> = {
    confirmation:           "confirmation_email_sent_at",
    reminder_7d:            "reminder_7d_email_sent_at",
    reminder_24h:           "reminder_24h_email_sent_at",
    review_request:         "review_request_email_sent_at",
    reactivation:           "reactivation_email_sent_at",
    operator_new_booking:   "operator_notified_at",       // anotamos pero no bloqueamos reenvíos
    booking_changed:        "change_email_sent_at",       // se anota la última vez; NO bloquea reenvíos
    booking_cancelled:      "cancellation_email_sent_at",
};

/** Plantillas que se pueden mandar más de una vez por reserva. */
export const REPEATABLE_TEMPLATES: TemplateKey[] = ["booking_changed"];

export type { BookingPayload, TemplateKey, RenderedEmail };

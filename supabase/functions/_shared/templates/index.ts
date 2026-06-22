// Plantillas HTML transaccionales — tono cercano, sin jerga corporativa.
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
    check_in: string;
    check_out: string;
    total_price: number;
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
        <p style="margin:0 0 8px;">¿Cualquier cosa? Estamos a un mensaje: <a href="${WHATSAPP_URL}" style="color:#556B2F;text-decoration:underline;">WhatsApp</a> · <a href="tel:${WHATSAPP_E164}" style="color:#556B2F;text-decoration:underline;">${WHATSAPP_E164}</a> · <a href="mailto:apartamentostiojosemaria@gmail.com" style="color:#556B2F;text-decoration:underline;">email</a></p>
        <p style="margin:0;">Calle Baja 1, 23486 Hinojares (Jaén) · VTAR/JA/00044 · <a href="${SITE_URL}/privacidad" style="color:#8C8468;">Privacidad</a></p>
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

const SIGNATURE = `<p style="margin:24px 0 0;color:#2C3319;">Un abrazo,<br><strong style="font-family:'Playfair Display',Georgia,serif;font-size:17px;color:#556B2F;">Mari Carmen y Jesús</strong><br><span style="font-size:12px;color:#8C8468;">Apartamentos Rurales Tío José María</span></p>`;

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

type TemplateKey = "confirmation" | "reminder_7d" | "reminder_24h" | "arrival" | "departure" | "review_request" | "reactivation" | "operator_new_booking";

interface RenderedEmail { subject: string; html: string; from: string; }

const renderConfirmation = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `Reserva confirmada — ${b.booking_code}`,
    html: shell(
        `Hola ${firstName(b.guest_name)}, todo listo`,
        `<p>Tu reserva en <strong>${b.apartment_name}</strong> está confirmada. Te esperamos en Hinojares.</p>
        ${apartmentPhoto(b)}
        ${bookingSummary(b)}
        <p>Unos días antes de tu llegada te mandaremos las instrucciones para entrar al apartamento, el horario de check-in y el formulario corto que la Guardia Civil nos pide para huéspedes. Mientras tanto, si necesitas cualquier cosa, escríbenos sin más.</p>
        <p>Gracias por reservar directamente. Eso nos permite cuidarte mejor y mantener el precio justo.</p>
        ${SIGNATURE}`,
        "Ver tu reserva",
        `${SITE_URL}/reservar/confirmada?code=${b.booking_code}`
    ),
});

const renderReminder7d = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `Falta una semana — ${b.apartment_name}`,
    html: shell(
        `${firstName(b.guest_name)}, en una semana en Hinojares`,
        `<p>Queremos que el viaje empiece bien desde antes. Aquí tienes lo esencial:</p>
        ${apartmentPhoto(b)}
        <ul style="padding-left:20px;color:#2C3319;">
          <li><strong>Cómo llegar:</strong> Hinojares está a la salida 314 de la A-44 (Madrid–Granada) → Quesada → Pozo Alcón. Aparcamiento gratis junto a la casa.</li>
          <li><strong>Tiempo:</strong> echa un ojo a la previsión un día antes. La sierra cambia rápido.</li>
          <li><strong>Qué traer:</strong> nosotros ponemos sábanas, toallas, menaje y leña para la chimenea. Tú trae ganas.</li>
        </ul>
        ${bookingSummary(b)}
        <p>Si necesitas adelantar la entrada, retrasar la salida o tienes una alergia o preferencia que debamos saber, mándanos un mensaje hoy mismo.</p>
        ${SIGNATURE}`,
        "Ver guía de la zona",
        `${SITE_URL}/hinojares`
    ),
});

const renderReminder24h = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `Mañana te esperamos — ${b.booking_code}`,
    html: shell(
        `Mañana te recibimos en ${b.apartment_name}`,
        `<p>Hola ${firstName(b.guest_name)}, recta final.</p>
        <p><strong>Check-in:</strong> entre las 16:00 y las 20:00. Te recibimos en persona y te enseñamos la casa. Si vas a llegar fuera de ese horario, dinos por WhatsApp para coordinarnos.</p>
        <p><strong>Dirección:</strong> Calle Baja 1, 23486 Hinojares. Cuando llegues al pueblo, búscanos con Google Maps; cualquier vecino te indica también.</p>
        ${bookingSummary(b)}
        <p>Te enviamos también el <strong>enlace al formulario de precheckin</strong> que tenemos que rellenar todos los huéspedes (obligación legal del Ministerio del Interior). Si lo completas antes, en la llegada solo nos chocamos los cinco y a disfrutar.</p>
        ${SIGNATURE}`,
        "Rellenar precheckin",
        `${SITE_URL}/precheckin?code=${b.booking_code}`
    ),
});

const renderArrival = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `Bienvenido a Tío José María`,
    html: shell(
        `Estás en casa, ${firstName(b.guest_name)}`,
        `<p>Esperamos que el viaje haya ido bien. Una vez te hayamos recibido y enseñado el apartamento, aquí tienes lo básico para los primeros minutos a solas:</p>
        <ul style="padding-left:20px;">
          <li><strong>WiFi:</strong> nombre y clave en la tarjeta de la mesa de la cocina.</li>
          <li><strong>Calefacción:</strong> termostato junto a la puerta del salón. Sube poco a poco, la casa retiene bien.</li>
          <li><strong>Chimenea:</strong> leña seca en la caja, papel y mecheros en el cajón. Si dudas, escríbenos antes de prenderla.</li>
        </ul>
        <p>Si echas algo en falta o algo no funciona como debe, dinos enseguida. Estamos cerca.</p>
        <p>Disfruta de Hinojares.</p>
        ${SIGNATURE}`,
        "Qué hacer estos días",
        `${SITE_URL}/rutas`
    ),
});

const renderDeparture = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `Buen viaje de vuelta`,
    html: shell(
        `${firstName(b.guest_name)}, gracias por venir`,
        `<p>Esperamos que la estancia haya sido todo lo que esperabas.</p>
        <p><strong>Antes de salir:</strong> deja la llave en la cerradura por dentro y cierra la puerta. Si has dejado algo en la chimenea, retíralo si ya está frío.</p>
        <p>Mañana o pasado te escribiremos para que nos cuentes qué tal todo. Tus comentarios reales son lo que ayuda a otros viajeros a decidirse.</p>
        ${bookingSummary(b)}
        <p>Hasta la próxima.</p>
        ${SIGNATURE}`
    ),
});

const renderReviewRequest = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `¿Qué tal Tío José María?`,
    html: shell(
        `${firstName(b.guest_name)}, dos minutos de tu tiempo`,
        `<p>Volvemos a aparecer en tu bandeja porque tu opinión nos ayuda muchísimo. La sierra es pequeña y boca a boca todavía manda — una reseña en Google nos cambia el mes.</p>
        <p>Si tienes un par de minutos, cuéntanos qué tal la estancia: lo que estuvo bien y, sobre todo, lo que mejoraríamos. Sin filtros.</p>
        <p>Y si vinisteis por Booking o Airbnb, allí también podéis dejarla y se agradece igual.</p>
        ${SIGNATURE}`,
        "Dejar una reseña en Google",
        GOOGLE_REVIEW_URL
    ),
});

const renderReactivation = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `Volver a Hinojares (con un guiño)`,
    html: shell(
        `Por si quieres volver`,
        `<p>Hola ${firstName(b.guest_name)}, hace un mes te despedías de Hinojares.</p>
        <p>No te escribimos por escribir: como ya nos conoces y la reserva fue directa, te dejamos un código para que tu siguiente estancia (cuando te apetezca, sin prisa) salga un 10% más barata.</p>
        <p>Código: <strong style="font-family:'SF Mono',Menlo,monospace;background:#FCFBF9;padding:4px 10px;border-radius:6px;border:1px solid #F0EDE6;">VUELVE10</strong></p>
        <p>Es para ti y caduca dentro de seis meses. Si no usas, no pasa nada — sigue siendo un placer haberte tenido aquí.</p>
        ${SIGNATURE}`,
        "Mirar fechas",
        `${SITE_URL}/reservar`
    ),
});

const renderOperatorNewBooking = (b: BookingPayload): RenderedEmail => ({
    from: EMAIL_FROM,
    subject: `🎉 Nueva reserva ${b.booking_code} — ${b.apartment_name}`,
    html: shell(
        `Nueva reserva confirmada`,
        `<p>Entra reserva nueva en el sistema. Datos al día:</p>
        ${bookingSummary(b)}
        <p><strong>Huésped:</strong> ${escapeHtml(b.guest_name)} · <a href="mailto:${b.guest_email}">${b.guest_email}</a></p>
        <p>Para gestionarla (factura, recordatorios, precheckin, notas internas) entra al panel.</p>`,
        "Abrir cockpit",
        `${SITE_URL}/admin`
    ),
});

// Pequeño helper porque la plantilla interpola guest_name en texto
function escapeHtml(s: string | null | undefined): string {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const render = (key: TemplateKey, b: BookingPayload): RenderedEmail => {
    switch (key) {
        case "confirmation":            return renderConfirmation(b);
        case "reminder_7d":             return renderReminder7d(b);
        case "reminder_24h":            return renderReminder24h(b);
        case "arrival":                 return renderArrival(b);
        case "departure":               return renderDeparture(b);
        case "review_request":          return renderReviewRequest(b);
        case "reactivation":            return renderReactivation(b);
        case "operator_new_booking":    return renderOperatorNewBooking(b);
    }
};

export const TEMPLATE_TO_FLAG: Record<TemplateKey, string> = {
    confirmation:           "confirmation_email_sent_at",
    reminder_7d:            "reminder_7d_email_sent_at",
    reminder_24h:           "reminder_24h_email_sent_at",
    arrival:                "arrival_email_sent_at",
    departure:              "departure_email_sent_at",
    review_request:         "review_request_email_sent_at",
    reactivation:           "reactivation_email_sent_at",
    operator_new_booking:   "operator_notified_at",       // anotamos pero no bloqueamos reenvíos
};

export type { BookingPayload, TemplateKey, RenderedEmail };

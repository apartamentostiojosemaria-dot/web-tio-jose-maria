// Edge function: create-payment-session
// =======================================
// Dos usos:
//  1. RESERVA (como siempre): booking_code en estado 'hold' desde la web publica.
//  2. COBRO: reserva ya guardada (confirmed/pending) a la que se le manda un
//     enlace de pago, por el importe pendiente o por una parte. Es lo que usa
//     el panel cuando ella apunta una reserva por telefono.
// Recibe un booking_code (o bookingId), crea una Stripe Checkout Session
// con el importe total y devuelve la URL de la pasarela.
//
// El cliente (ReservarPage) redirige al huésped a esa URL. El webhook
// (stripe-webhook) escucha checkout.session.completed y marca el booking
// como confirmed.
//
// Env vars requeridas en Supabase Secrets:
//   STRIPE_SECRET_KEY              sk_live_... o sk_test_...
//   PUBLIC_SITE_URL                https://tiojosemaria.com (default)
//
// Modelo de cobro inicial: 100% por adelantado. Cuando queramos separar
// señal+resto, se duplica esta función con price.deposit / price.balance
// o se usa Stripe Subscriptions con installments.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://tiojosemaria.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });

interface StripeSessionResponse {
    id: string;
    url: string;
    status?: string;
    amount_total?: number;
}

/** Correo de relleno que pone `create_manual_booking` cuando no hay ninguno. */
const esCorreoDeRelleno = (email: string) =>
    /@tiojosemaria\.local$/i.test(email.trim()) || /^sin-email\+/i.test(email.trim());

/**
 * Recupera una sesion de Stripe ya creada. Devuelve null si no existe, si ya
 * no esta abierta o si Stripe no contesta: en todos esos casos hay que crear
 * una nueva, porque la vieja ya no sirve para pagar.
 */
async function recuperarSesionAbierta(sessionId: string): Promise<StripeSessionResponse | null> {
    if (!/^cs_/.test(sessionId)) return null;   // pi_... (pago ya hecho) no es una sesion
    try {
        const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
            headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
        });
        if (!res.ok) return null;
        const s = await res.json() as StripeSessionResponse;
        return s.status === "open" && s.url ? s : null;
    } catch {
        return null;
    }
}

// Cliente Stripe mínimo via REST (sin SDK; mantiene la edge function ligera).
async function createStripeCheckoutSession(opts: {
    bookingCode: string;
    bookingId: number;
    apartmentName: string;
    totalEurCents: number;
    tipo?: "reserva" | "cobro";
    nights: number;
    checkIn: string;
    checkOut: string;
    guestName: string;
    guestEmail: string;
    successUrl: string;
    cancelUrl: string;
}): Promise<StripeSessionResponse> {
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", opts.successUrl);
    body.set("cancel_url", opts.cancelUrl);
    // Una reserva apuntada por telefono no tiene correo: `create_manual_booking`
    // le pone uno de relleno (sin-email+...@tiojosemaria.local). Si se lo damos
    // a Stripe, el campo queda BLOQUEADO en la pasarela con una direccion que no
    // existe: el huesped no puede escribir la suya y no recibe el recibo. En ese
    // caso no mandamos correo y que lo escriba el.
    if (opts.guestEmail && !esCorreoDeRelleno(opts.guestEmail)) {
        body.set("customer_email", opts.guestEmail);
    }
    body.set("client_reference_id", opts.bookingCode);
    body.set("payment_method_types[0]", "card");
    body.set("locale", "es");

    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "eur");
    body.set("line_items[0][price_data][unit_amount]", String(opts.totalEurCents));
    body.set("line_items[0][price_data][product_data][name]", `${opts.apartmentName} — ${opts.nights} ${opts.nights === 1 ? "noche" : "noches"}`);
    body.set("line_items[0][price_data][product_data][description]",
        `Reserva ${opts.bookingCode}: ${opts.checkIn} → ${opts.checkOut}, ${opts.guestName}`);

    body.set("metadata[booking_code]", opts.bookingCode);
    body.set("metadata[tipo]", opts.tipo || "reserva");
    body.set("metadata[importe_eur]", (opts.totalEurCents / 100).toFixed(2));
    body.set("metadata[booking_id]", String(opts.bookingId));
    body.set("metadata[check_in]", opts.checkIn);
    body.set("metadata[check_out]", opts.checkOut);

    // El hold de la web expira en 15 min y su sesion debe caducar antes. Un
    // enlace de cobro se manda por WhatsApp y tiene que aguantar el dia: 24 h
    // es el maximo que admite Stripe.
    const minutos = opts.tipo === "cobro" ? 24 * 60 : 30;
    body.set("expires_at", String(Math.floor(Date.now() / 1000) + minutos * 60));

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Stripe ${res.status}: ${err.slice(0, 400)}`);
    }
    return await res.json() as StripeSessionResponse;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    if (!STRIPE_SECRET_KEY) return json(503, { error: "stripe_not_configured" });

    let body: { bookingCode?: string; bookingId?: number; amountEur?: number; amount?: number };
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

    // El codigo de reserva (TJM-XXXXXX) es aleatorio y hace de secreto. El id es
    // secuencial: si se aceptara suelto, cualquiera podria pedir /1, /2, /3... y
    // la pasarela le ensenaria nombre del huesped, fechas, apartamento e importe.
    // Por eso el codigo es OBLIGATORIO y el id, si viene, solo sirve de filtro.
    const code = (body.bookingCode || "").trim().toUpperCase();
    if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) return json(400, { error: "invalid_booking_code" });
    const bookingId = Number(body.bookingId);
    const filtrarPorId = Number.isFinite(bookingId) && bookingId > 0;

    let consulta = supabase
        .from("guest_bookings")
        .select("id, booking_code, apartment_id, status, expires_at, total_price, paid_amount, pending_amount, check_in, check_out, guest_name, guest_email, payment_intent_id, apartments(name)")
        .eq("booking_code", code);
    if (filtrarPorId) consulta = consulta.eq("id", bookingId);

    const { data: booking, error: bErr } = await consulta.single();

    if (bErr || !booking) return json(404, { error: "booking_not_found" });

    const codigo = booking.booking_code as string;
    const esHold = booking.status === "hold";
    // Una reserva ya guardada tambien se puede cobrar por enlace: es el caso
    // normal cuando la reserva se apunto por telefono.
    const esCobro = booking.status === "confirmed" || booking.status === "pending";
    if (!esHold && !esCobro) return json(409, { error: "booking_not_payable", status: booking.status });

    if (esHold && booking.expires_at && new Date(booking.expires_at) < new Date()) {
        return json(410, { error: "hold_expired" });
    }

    // Idempotencia SOLO para el hold de la web: alli el enlace es uno y unico.
    // En un cobro puede hacer falta mandar varios enlaces (una senal y luego el
    // resto), asi que no reutilizamos sesion.
    // OJO: la URL de Stripe NO se puede inventar a partir del id. La buena
    // lleva un fragmento (#fid...) sin el cual la pasarela no abre. Hay que
    // pedirle a Stripe la sesion y devolver SU url. Si ya no esta abierta
    // (caducada o pagada), seguimos y creamos una nueva.
    if (esHold && booking.payment_intent_id) {
        const previa = await recuperarSesionAbierta(booking.payment_intent_id as string);
        if (previa) {
            return json(200, {
                url: previa.url,
                sessionId: previa.id,
                importe: (previa.amount_total ?? 0) / 100,
                idempotent: true,
                tipo: "reserva",
            });
        }
    }

    // Cuanto se cobra: lo que pidan, o lo que quede pendiente (o el total si es
    // un hold de la web, que todavia no tiene nada apuntado).
    const pendiente = Number(booking.pending_amount ?? booking.total_price);
    // El panel manda el importe como `amount` y la web como `amountEur`. Si solo
    // se mira uno, el otro se ignora en silencio y se cobra TODO lo pendiente
    // cuando ella queria cobrar una senal. Se aceptan los dos nombres.
    const pedido = Number(body.amountEur ?? body.amount);
    const totalEur = Number.isFinite(pedido) && pedido > 0
        ? Math.min(pedido, esHold ? Number(booking.total_price) : pendiente)
        : (esHold ? Number(booking.total_price) : pendiente);

    if (!Number.isFinite(totalEur) || totalEur <= 0) {
        return json(400, { error: esCobro ? "nothing_pending" : "invalid_total" });
    }

    // Nights (re-derivado del rango por si la columna generada falla)
    const checkInDate = new Date(booking.check_in);
    const checkOutDate = new Date(booking.check_out);
    const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 3600 * 1000)));

    const apartmentName = (booking.apartments as unknown as { name?: string })?.name || "Apartamento";

    let session: StripeSessionResponse;
    try {
        session = await createStripeCheckoutSession({
            bookingCode: codigo,
            bookingId: booking.id,
            apartmentName,
            totalEurCents: Math.round(totalEur * 100),
            nights,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            guestName: booking.guest_name,
            guestEmail: booking.guest_email,
            successUrl: `${SITE_URL}/reservar/confirmada?code=${codigo}`,
            cancelUrl: `${SITE_URL}/reservar?cancelled=${codigo}`,
            tipo: esHold ? "reserva" : "cobro",
        });
    } catch (e) {
        return json(502, { error: "stripe_error", detail: e instanceof Error ? e.message : String(e) });
    }

    // Anotar payment_intent_id (= session.id) solo en el hold: en un cobro
    // pisarlo romperia la idempotencia del pago original.
    if (esHold) {
        await supabase
            .from("guest_bookings")
            .update({ payment_intent_id: session.id })
            .eq("id", booking.id);
    }

    return json(200, {
        url: session.url,
        sessionId: session.id,
        importe: totalEur,
        tipo: esHold ? "reserva" : "cobro",
    });
});

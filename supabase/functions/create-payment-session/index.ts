// Edge function: create-payment-session
// =======================================
// Recibe un booking_code en estado 'hold', crea una Stripe Checkout Session
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
}

// Cliente Stripe mínimo via REST (sin SDK; mantiene la edge function ligera).
async function createStripeCheckoutSession(opts: {
    bookingCode: string;
    bookingId: number;
    apartmentName: string;
    totalEurCents: number;
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
    body.set("customer_email", opts.guestEmail);
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
    body.set("metadata[booking_id]", String(opts.bookingId));
    body.set("metadata[check_in]", opts.checkIn);
    body.set("metadata[check_out]", opts.checkOut);

    // El hold expira en 15min — la sesión Stripe debe expirar antes
    body.set("expires_at", String(Math.floor(Date.now() / 1000) + 30 * 60));

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

    let body: { bookingCode?: string };
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

    const code = (body.bookingCode || "").trim().toUpperCase();
    if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) return json(400, { error: "invalid_booking_code" });

    // Cargar booking + apartment, verificar status='hold' y no expirado
    const { data: booking, error: bErr } = await supabase
        .from("guest_bookings")
        .select("id, apartment_id, status, expires_at, total_price, check_in, check_out, guest_name, guest_email, payment_intent_id, apartments(name)")
        .eq("booking_code", code)
        .single();

    if (bErr || !booking) return json(404, { error: "booking_not_found" });
    if (booking.status !== "hold") return json(409, { error: "booking_not_in_hold_state", status: booking.status });
    if (booking.expires_at && new Date(booking.expires_at) < new Date()) return json(410, { error: "hold_expired" });

    // Idempotencia: si ya hay payment_intent_id, devolvemos esa URL en lugar
    // de crear una nueva sesión.
    if (booking.payment_intent_id) {
        return json(200, { url: `https://checkout.stripe.com/c/pay/${booking.payment_intent_id}`, idempotent: true });
    }

    const totalEur = Number(booking.total_price);
    if (!Number.isFinite(totalEur) || totalEur <= 0) return json(400, { error: "invalid_total" });

    // Nights (re-derivado del rango por si la columna generada falla)
    const checkInDate = new Date(booking.check_in);
    const checkOutDate = new Date(booking.check_out);
    const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 3600 * 1000)));

    const apartmentName = (booking.apartments as unknown as { name?: string })?.name || "Apartamento";

    let session: StripeSessionResponse;
    try {
        session = await createStripeCheckoutSession({
            bookingCode: code,
            bookingId: booking.id,
            apartmentName,
            totalEurCents: Math.round(totalEur * 100),
            nights,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            guestName: booking.guest_name,
            guestEmail: booking.guest_email,
            successUrl: `${SITE_URL}/reservar/confirmada?code=${code}`,
            cancelUrl: `${SITE_URL}/reservar?cancelled=${code}`,
        });
    } catch (e) {
        return json(502, { error: "stripe_error", detail: e instanceof Error ? e.message : String(e) });
    }

    // Anotar payment_intent_id (= session.id) en el booking para idempotencia
    await supabase
        .from("guest_bookings")
        .update({ payment_intent_id: session.id })
        .eq("id", booking.id);

    return json(200, { url: session.url, sessionId: session.id });
});

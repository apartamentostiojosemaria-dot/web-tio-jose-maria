// Edge function: send-booking-email
// ==================================
// Recibe { bookingCode, template } y envía el email transaccional
// correspondiente vía Resend. Idempotente: si el flag *_email_sent_at ya
// está marcado, no reenvía.
//
// Disparadores:
//   - stripe-webhook tras marcar booking confirmed → confirmation
//   - Trigger.dev cron diario daily-booking-emails → resto
//
// Env vars requeridas:
//   RESEND_API_KEY                 re_...
//   PUBLIC_SITE_URL                https://tiojosemaria.com (opcional)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { render, TEMPLATE_TO_FLAG, type TemplateKey } from "../_shared/templates/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const OPERATOR_NOTIFY_EMAIL = Deno.env.get("OPERATOR_NOTIFY_EMAIL") || "apartamentostiojosemaria@gmail.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const VALID_TEMPLATES: TemplateKey[] = [
    "confirmation", "reminder_7d", "reminder_24h", "arrival",
    "departure", "review_request", "reactivation", "operator_new_booking",
];

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

async function sendResend(opts: { from: string; to: string; subject: string; html: string }) {
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: opts.from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend ${res.status}: ${err.slice(0, 400)}`);
    }
    return await res.json() as { id?: string };
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    if (!RESEND_API_KEY) return json(503, { error: "resend_not_configured" });

    let body: { bookingCode?: string; template?: string };
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

    const code = (body.bookingCode || "").trim().toUpperCase();
    const template = body.template as TemplateKey | undefined;
    if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) return json(400, { error: "invalid_booking_code" });
    if (!template || !VALID_TEMPLATES.includes(template)) return json(400, { error: "invalid_template" });

    const flag = TEMPLATE_TO_FLAG[template];

    // Cargar booking + apartment (incluye images para mostrar foto en el email)
    const { data: booking, error: bErr } = await supabase
        .from("guest_bookings")
        .select(`id, booking_code, guest_name, guest_email, check_in, check_out,
                 total_price, apartment_id, status,
                 ${flag},
                 apartments(name, slug, images)`)
        .eq("booking_code", code)
        .single();

    if (bErr || !booking) return json(404, { error: "booking_not_found" });
    if (!booking.guest_email) return json(400, { error: "no_guest_email" });

    // Idempotencia: si ya se envió, no reenviar
    if (booking[flag as keyof typeof booking]) {
        return json(200, { ok: true, skipped: "already_sent", sentAt: booking[flag as keyof typeof booking] });
    }

    // RGPD: marketing requiere consentimiento explícito. review_request es interés legítimo
    // con opt-out (review_optout en customers).
    if (template === "reactivation" || template === "review_request") {
        const emailKey = booking.guest_email.toLowerCase().trim();
        const { data: c } = await supabase
            .from("customers")
            .select("marketing_consent, review_optout")
            .eq("email", emailKey)
            .maybeSingle();

        if (template === "reactivation" && !c?.marketing_consent) {
            return json(200, { ok: true, skipped: "no_marketing_consent", email: emailKey });
        }
        if (template === "review_request" && c?.review_optout) {
            return json(200, { ok: true, skipped: "review_opted_out", email: emailKey });
        }
    }

    const apt = (booking.apartments as unknown as { name: string; slug: string; images?: string[] }) || { name: "Apartamento", slug: "" };
    const firstImage = Array.isArray(apt.images) && apt.images.length > 0 ? apt.images[0] : null;

    // Si es notificacion al operador: cargar warnings + tags + preferences del CRM
    // para que Mari Carmen y Jesus vean el contexto del cliente inmediatamente.
    let customer_warnings: string[] = [];
    let customer_tags: string[] = [];
    let customer_preferences: string | null = null;
    if (template === "operator_new_booking") {
        const emailKey = booking.guest_email.toLowerCase().trim();
        const [{ data: notes }, { data: customer }] = await Promise.all([
            supabase.from("customer_notes").select("body").eq("customer_email", emailKey).eq("is_warning", true).order("created_at", { ascending: false }),
            supabase.from("customers").select("tags, preferences").eq("email", emailKey).maybeSingle(),
        ]);
        customer_warnings = (notes || []).map(n => n.body);
        customer_tags = customer?.tags || [];
        customer_preferences = customer?.preferences || null;
    }

    const payload = {
        booking_code: booking.booking_code,
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        apartment_name: apt.name,
        apartment_slug: apt.slug,
        apartment_image: firstImage,
        check_in: booking.check_in,
        check_out: booking.check_out,
        total_price: Number(booking.total_price),
        customer_warnings,
        customer_tags,
        customer_preferences,
    };

    const { subject, html, from } = render(template, payload);

    // El destinatario depende del template: operator_new_booking va al operador.
    const recipient = template === "operator_new_booking" ? OPERATOR_NOTIFY_EMAIL : booking.guest_email;

    let resendId: string | undefined;
    try {
        const r = await sendResend({ from, to: recipient, subject, html });
        resendId = r.id;
    } catch (e) {
        return json(502, { error: "resend_error", detail: e instanceof Error ? e.message : String(e) });
    }

    // Marcar flag como enviado (idempotencia)
    await supabase
        .from("guest_bookings")
        .update({ [flag]: new Date().toISOString() })
        .eq("id", booking.id);

    return json(200, { ok: true, template, resendId, sentTo: booking.guest_email });
});

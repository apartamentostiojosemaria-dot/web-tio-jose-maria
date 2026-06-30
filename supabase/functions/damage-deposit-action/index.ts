// Acciones sobre la fianza por daños via Stripe.
// Operaciones: 'preauth' (crea PaymentIntent capture_method=manual),
//             'capture' (cobra parcial o total del bloqueo),
//             'release' (libera el bloqueo sin cobrar).
//
// Idempotente: si el booking ya tiene damage_deposit_intent_id en estado coherente,
// no duplica operaciones.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

async function stripeForm(path: string, params: Record<string, string>) {
    const res = await fetch(`https://api.stripe.com${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
    return data;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    if (!STRIPE_SECRET_KEY) return json(503, { error: "stripe_not_configured" });

    let body: { bookingCode?: string; action?: string; amount_cents?: number; notes?: string };
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

    const code = (body.bookingCode || "").toUpperCase();
    const action = body.action;
    if (!code || !action) return json(400, { error: "missing_fields" });
    if (!["preauth", "capture", "release"].includes(action)) return json(400, { error: "invalid_action" });

    const { data: booking, error: bErr } = await supabase
        .from("guest_bookings")
        .select("id, booking_code, guest_email, guest_name, status, apartment_id, damage_deposit_intent_id, damage_deposit_status, damage_deposit_amount_cents, apartments(damage_deposit_cents)")
        .eq("booking_code", code).single();
    if (bErr || !booking) return json(404, { error: "booking_not_found" });

    try {
        if (action === "preauth") {
            if (booking.damage_deposit_intent_id) return json(200, { ok: true, skipped: "already_preauthorized" });
            const amount = booking.apartments?.damage_deposit_cents || 0;
            if (!amount) return json(400, { error: "no_deposit_configured" });
            // PaymentIntent con capture_method=manual para preautorizar
            const pi = await stripeForm("/v1/payment_intents", {
                amount: String(amount),
                currency: "eur",
                capture_method: "manual",
                "payment_method_types[0]": "card",
                description: `Fianza ${code} - ${booking.apartments?.name || ""}`,
                "metadata[booking_code]": code,
            });
            await supabase.from("guest_bookings").update({
                damage_deposit_intent_id: pi.id,
                damage_deposit_amount_cents: amount,
                damage_deposit_status: "preauthorized",
                damage_deposit_notes: body.notes || null,
            }).eq("id", booking.id);
            return json(200, { ok: true, intent_id: pi.id, client_secret: pi.client_secret, status: "preauthorized" });
        }

        if (action === "capture") {
            if (!booking.damage_deposit_intent_id) return json(400, { error: "no_intent_to_capture" });
            if (booking.damage_deposit_status !== "preauthorized") return json(400, { error: `cannot_capture_${booking.damage_deposit_status}` });
            const params: Record<string, string> = {};
            if (body.amount_cents) params.amount_to_capture = String(body.amount_cents);
            await stripeForm(`/v1/payment_intents/${booking.damage_deposit_intent_id}/capture`, params);
            await supabase.from("guest_bookings").update({
                damage_deposit_status: "captured",
                damage_deposit_amount_cents: body.amount_cents || booking.damage_deposit_amount_cents,
                damage_deposit_notes: body.notes || booking.damage_deposit_notes,
            }).eq("id", booking.id);
            return json(200, { ok: true, status: "captured" });
        }

        if (action === "release") {
            if (!booking.damage_deposit_intent_id) return json(400, { error: "no_intent_to_release" });
            if (booking.damage_deposit_status === "captured") return json(400, { error: "already_captured" });
            await stripeForm(`/v1/payment_intents/${booking.damage_deposit_intent_id}/cancel`, {});
            await supabase.from("guest_bookings").update({
                damage_deposit_status: "released",
                damage_deposit_notes: body.notes || booking.damage_deposit_notes,
            }).eq("id", booking.id);
            return json(200, { ok: true, status: "released" });
        }
    } catch (e) {
        await supabase.from("guest_bookings").update({
            damage_deposit_status: "failed",
            damage_deposit_notes: `Error: ${e instanceof Error ? e.message : String(e)}`,
        }).eq("id", booking.id);
        return json(502, { error: "stripe_error", detail: e instanceof Error ? e.message : String(e) });
    }
});

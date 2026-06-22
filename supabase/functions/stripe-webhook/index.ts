// Edge function: stripe-webhook
// ==============================
// Escucha eventos de Stripe (configurar webhook en dashboard Stripe → con la
// secret STRIPE_WEBHOOK_SECRET) y reconcilia el estado del booking:
//
//   checkout.session.completed       → booking status=confirmed, payment_status=paid
//   checkout.session.expired         → booking status=expired si seguía en hold
//   charge.refunded                  → booking payment_status=refunded
//
// Esta función se despliega con --no-verify-jwt porque Stripe firma con su
// propia secret (verificación SigV4-like). NUNCA confiar en el body sin
// verificar la firma.
//
// Env vars requeridas:
//   STRIPE_WEBHOOK_SECRET    whsec_...
//   STRIPE_SECRET_KEY        sk_... (para charge fetches si hace falta)
//
// Sprint 6 conectará aquí también el disparo de email de confirmación.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw", encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Verificación de firma Stripe (compatible con Stripe-Signature: t=...,v1=...)
async function verifyStripeSignature(header: string, payload: string, secret: string, toleranceSec = 300): Promise<boolean> {
    const parts = Object.fromEntries(header.split(",").map(p => p.split("=", 2)));
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) return false;
    const tsNum = parseInt(t, 10);
    if (!Number.isFinite(tsNum)) return false;
    if (Math.abs(Date.now() / 1000 - tsNum) > toleranceSec) return false;
    const expected = await hmacSha256Hex(secret, `${t}.${payload}`);
    // Comparación constant-time
    if (expected.length !== v1.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
    return mismatch === 0;
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
    if (!STRIPE_WEBHOOK_SECRET) return new Response("webhook_not_configured", { status: 503 });

    const sigHeader = req.headers.get("stripe-signature");
    if (!sigHeader) return new Response("missing_signature", { status: 400 });

    const payload = await req.text();
    const ok = await verifyStripeSignature(sigHeader, payload, STRIPE_WEBHOOK_SECRET);
    if (!ok) return new Response("invalid_signature", { status: 400 });

    let event: { type: string; data: { object: Record<string, unknown> } };
    try { event = JSON.parse(payload); } catch { return new Response("invalid_json", { status: 400 }); }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as {
                    id: string; client_reference_id?: string;
                    metadata?: { booking_code?: string };
                    amount_total?: number;
                    payment_intent?: string;
                };
                const code = session.metadata?.booking_code || session.client_reference_id;
                if (!code) break;
                await supabase
                    .from("guest_bookings")
                    .update({
                        status: "confirmed",
                        payment_status: "paid",
                        payment_amount_paid: (session.amount_total || 0) / 100,
                        payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("booking_code", code)
                    .in("status", ["hold", "pending"]);    // evita pisar cancelaciones

                // Disparar email de confirmacion inmediatamente (no esperar al cron).
                // Si Resend no está configurado, send-booking-email devuelve 503 y
                // el cron diario lo intentará al día siguiente.
                fetch(`${SUPABASE_URL}/functions/v1/send-booking-email`, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                    body: JSON.stringify({ bookingCode: code, template: "confirmation" }),
                }).catch(e => console.warn("[stripe-webhook] confirmation email fire-and-forget failed:", e));
                break;
            }
            case "checkout.session.expired": {
                const session = event.data.object as { metadata?: { booking_code?: string } };
                const code = session.metadata?.booking_code;
                if (!code) break;
                await supabase
                    .from("guest_bookings")
                    .update({ status: "expired", updated_at: new Date().toISOString() })
                    .eq("booking_code", code)
                    .eq("status", "hold");
                break;
            }
            case "charge.refunded": {
                const charge = event.data.object as { payment_intent?: string };
                if (!charge.payment_intent) break;
                await supabase
                    .from("guest_bookings")
                    .update({
                        payment_status: "refunded",
                        status: "cancelled",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("payment_intent_id", charge.payment_intent);
                break;
            }
            default:
                // Ignoramos otros eventos. Stripe espera 200 para no reintentar.
                break;
        }
    } catch (e) {
        // Log y devolver 500 — Stripe reintentará.
        console.error("[stripe-webhook] error procesando", event.type, e);
        return new Response("processing_error", { status: 500 });
    }

    return new Response("ok", { status: 200 });
});

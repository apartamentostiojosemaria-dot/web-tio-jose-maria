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

// ---------------------------------------------------------------------------
// Disparo de funciones internas SIN romper el flujo de la reserva
// ---------------------------------------------------------------------------
// Antes esto era `fetch(...).catch(...)`: un 404 (función sin desplegar) o un
// 500 NO son rechazos de la promesa, así que el `.catch` no saltaba nunca y el
// fallo se perdía en silencio. Eso es justo lo que pasó con `issue-invoice`:
// el webhook la llamaba, la función no existía, y nadie se enteraba.
//
// Ahora se comprueba el status, se registra el fallo y —para lo que importa
// (la factura)— se deja una tarea interna visible en el panel. La reserva
// NUNCA se rompe por esto: el webhook siempre devuelve 200 a Stripe.
async function llamarFuncion(
    nombre: string,
    payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; detalle?: string }> {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${nombre}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const detalle = (await res.text()).slice(0, 500);
            console.error(`[stripe-webhook] ${nombre} devolvió ${res.status}: ${detalle}`);
            return { ok: false, status: res.status, detalle };
        }
        return { ok: true, status: res.status };
    } catch (e) {
        const detalle = String((e as Error)?.message || e);
        console.error(`[stripe-webhook] ${nombre} no respondió:`, detalle);
        return { ok: false, status: 0, detalle };
    }
}

/** Deja una tarea visible en el panel. Nunca lanza: es el último recurso. */
async function avisar(title: string, lineas: string[]) {
    try {
        await supabase.from("internal_tasks").insert({
            title,
            description: lineas.join("\n"),
            category: "fiscal",
            priority: "high",
            status: "pending",
            scheduled_date: hoyEnMadrid(),
            auto_reschedule: false,
        });
    } catch (e) {
        console.error("[stripe-webhook] no se pudo registrar la tarea:", title, e);
    }
}

/** Deja constancia visible de que una factura no salió, para emitirla a mano. */
const avisarFacturaFallida = (code: string, detalle: string) =>
    avisar(`Factura pendiente de emitir — reserva ${code}`, [
        `El cobro de la reserva ${code} se registró bien, pero la factura no llegó a emitirse.`,
        `Motivo técnico: ${detalle}`,
        "",
        'Se arregla desde Facturas → "Hacer factura" en la ficha de la reserva.',
    ]);

/**
 * El huésped PAGÓ pero el cobro no se pudo apuntar. Es lo más grave que puede
 * pasar aquí: el dinero está en Stripe y la reserva sigue diciendo que debe.
 * Tiene que verse en el panel sí o sí.
 */
const avisarCobroNoApuntado = (code: string, importe: number, sessionId: string, detalle: string) =>
    avisar(`COBRO SIN APUNTAR — reserva ${code} (${importe.toFixed(2)} €)`, [
        `Se ha cobrado ${importe.toFixed(2)} € con tarjeta por enlace de la reserva ${code},`,
        "pero el cobro NO se ha podido apuntar y la reserva sigue figurando como pendiente.",
        `Motivo técnico: ${detalle}`,
        `Sesión de Stripe: ${sessionId}`,
        "",
        "Comprueba el cobro en Stripe y apúntalo a mano desde Dinero → Apuntar cobro.",
    ]);

/** Fecha de hoy en hora de España (el servidor va en UTC y de madrugada miente). */
function hoyEnMadrid(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}

/** Lanza trabajo en segundo plano sin bloquear la respuesta a Stripe. */
function enSegundoPlano(p: Promise<unknown>) {
    const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(p.catch((e) => console.error("[stripe-webhook] tarea de fondo:", e)));
    else p.catch((e) => console.error("[stripe-webhook] tarea de fondo:", e));
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
                    metadata?: { booking_code?: string; tipo?: string };
                    amount_total?: number;
                    payment_intent?: string;
                };
                const code = session.metadata?.booking_code || session.client_reference_id;
                if (!code) break;

                // COBRO de una reserva ya guardada (enlace mandado desde el
                // panel). No se toca el estado de la reserva: se APUNTA el
                // cobro, que es lo que cuadra "cobrado" y "pendiente". La
                // factura solo se emite cuando ya no queda nada pendiente.
                if (session.metadata?.tipo === "cobro") {
                    const importe = (session.amount_total || 0) / 100;
                    const marca = `(${session.id})`;

                    const { data: reserva } = await supabase
                        .from("guest_bookings").select("id").eq("booking_code", code).maybeSingle();

                    if (!reserva || !(importe > 0)) {
                        await avisarCobroNoApuntado(code, importe, session.id,
                            !reserva ? "no se ha encontrado la reserva con ese código" : "el importe cobrado venía a 0");
                        break;
                    }

                    // Stripe reintenta y puede repetir el mismo evento. Sin esto,
                    // un reintento apunta el cobro DOS veces y la reserva sale
                    // pagada de más. Cada sesión deja su id en la nota del cobro.
                    const { data: yaApuntado } = await supabase
                        .from("booking_payments").select("id")
                        .eq("booking_id", reserva.id).like("note", `%${session.id}%`).limit(1);
                    if (yaApuntado && yaApuntado.length > 0) {
                        console.log(`[stripe-webhook] cobro ${session.id} ya estaba apuntado, no se repite`);
                        break;
                    }

                    // `register_payment` RECHAZA devolviendo {ok:false,...} con
                    // HTTP 200: si no se mira el sobre, un rechazo pasa por bueno
                    // y el dinero cobrado se queda sin apuntar, en silencio.
                    const { data: res, error: rpcErr } = await supabase.rpc("register_payment", {
                        p_booking_id: reserva.id,
                        p_amount: importe,
                        p_method: "stripe",
                        p_paid_on: hoyEnMadrid(),
                        p_note: `Pago con tarjeta por enlace ${marca}`,
                    });
                    const sobre = res as { ok?: boolean; error?: string; pending_amount?: number } | null;

                    if (rpcErr || !sobre?.ok) {
                        const detalle = rpcErr?.message || sobre?.error || "respuesta vacía de register_payment";
                        console.error(`[stripe-webhook] register_payment rechazó el cobro de ${code}: ${detalle}`);
                        await avisarCobroNoApuntado(code, importe, session.id, detalle);
                        break;
                    }

                    // Factura solo cuando ya no queda nada pendiente (<=0 cubre
                    // el caso de haber cobrado de más).
                    const pendiente = Number(sobre.pending_amount ?? Number.NaN);
                    if (Number.isFinite(pendiente) && pendiente <= 0) {
                        enSegundoPlano((async () => {
                            const r = await llamarFuncion("issue-invoice", {
                                action: "issue_and_send", bookingCode: code,
                            });
                            if (!r.ok) await avisarFacturaFallida(code, `HTTP ${r.status} — ${r.detalle || "sin detalle"}`);
                        })());
                    }
                    break;
                }

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

                // Email de confirmacion al huésped + notificacion al operador.
                // En segundo plano, pero con el resultado comprobado (ver
                // `llamarFuncion`): un 404 o un 500 ya no pasan desapercibidos.
                enSegundoPlano(llamarFuncion("send-booking-email", { bookingCode: code, template: "confirmation" }));
                enSegundoPlano(llamarFuncion("send-booking-email", { bookingCode: code, template: "operator_new_booking" }));

                // Factura: se emite y se manda al huésped con el PDF adjunto.
                // Si algo falla, la reserva SIGUE BIEN — sólo queda una tarea
                // interna para emitirla a mano desde el panel.
                enSegundoPlano((async () => {
                    const r = await llamarFuncion("issue-invoice", {
                        action: "issue_and_send",
                        bookingCode: code,
                    });
                    if (!r.ok) await avisarFacturaFallida(code, `HTTP ${r.status} — ${r.detalle || "sin detalle"}`);
                })());

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

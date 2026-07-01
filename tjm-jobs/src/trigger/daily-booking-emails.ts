// Cron diario 09:00 Europe/Madrid: itera bookings_email_queue y dispara los
// emails transaccionales pendientes a la edge function send-booking-email.
//
// La vista bookings_email_queue (creada en migración Sprint 6) ya filtra:
//   - status IN (confirmed, completed)
//   - guest_email NOT NULL
//   - calcula qué email toca HOY según check_in/check_out vs current_date
//   - excluye los que ya tienen *_email_sent_at marcado
//
// Idempotencia adicional: la edge function send-booking-email vuelve a
// chequear el flag antes de enviar, así que si esta task se ejecuta dos
// veces el mismo día, no duplica.

import { schedules, logger } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import WebSocketImpl from "ws";

// Runtime Trigger.dev = Node.js 21, sin WebSocket nativo (llega en Node 22).
// createClient inicializa el Realtime client de Supabase, que exige un
// WebSocket global. Polyfill con `ws` ANTES de createClient o revienta en
// ejecución (no en compilación). Ver gotcha-supabase-js-node21-websocket.
if (!(globalThis as unknown as { WebSocket?: unknown }).WebSocket) {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocketImpl;
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface QueueRow {
    booking_code: string;
    guest_email: string;
    apartment_name: string;
    pending_email: string | null;
}

export const dailyBookingEmails = schedules.task({
    id: "daily-booking-emails",
    // NEUTRALIZADO 2026-07-01: sin `cron` la task se despliega pero NO se
    // dispara sola. Evita fallos en bucle mientras la vista bookings_email_queue
    // y send-booking-email no estén en el Supabase de TJM (y sin reservas reales
    // hasta Stripe live). Reactivar: descomentar.
    // cron: {
    //     pattern: "0 9 * * *",
    //     timezone: "Europe/Madrid",
    // },
    maxDuration: 300, // 5 min hard cap
    run: async (payload, { ctx }) => {
        logger.info("[daily-booking-emails] start", { scheduledAt: payload.timestamp });

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        // Cargar cola
        const { data: queue, error } = await supabase
            .from("bookings_email_queue")
            .select("booking_code, guest_email, apartment_name, pending_email")
            .not("pending_email", "is", null);

        if (error) {
            logger.error("[daily-booking-emails] query failed", { error: error.message });
            throw new Error(`Queue query failed: ${error.message}`);
        }

        const rows = (queue || []) as QueueRow[];
        logger.info("[daily-booking-emails] queue loaded", { count: rows.length });

        if (rows.length === 0) {
            return { sent: 0, errors: 0, skipped: 0 };
        }

        let sent = 0, errors = 0, skipped = 0;
        const errorDetails: Array<{ code: string; template: string; error: string }> = [];

        for (const row of rows) {
            if (!row.pending_email) { skipped++; continue; }
            try {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/send-booking-email`, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                    body: JSON.stringify({
                        bookingCode: row.booking_code,
                        template: row.pending_email,
                    }),
                });
                if (!res.ok) {
                    const body = await res.text().catch(() => "");
                    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
                }
                const result = await res.json() as { ok?: boolean; skipped?: string };
                if (result.skipped) {
                    skipped++;
                    logger.info("[daily-booking-emails] skipped", { code: row.booking_code, template: row.pending_email, reason: result.skipped });
                } else {
                    sent++;
                    logger.info("[daily-booking-emails] sent", { code: row.booking_code, template: row.pending_email, to: row.guest_email });
                }
            } catch (e) {
                errors++;
                const msg = e instanceof Error ? e.message : String(e);
                errorDetails.push({ code: row.booking_code, template: row.pending_email, error: msg });
                logger.error("[daily-booking-emails] error", { code: row.booking_code, template: row.pending_email, error: msg });
            }
        }

        logger.info("[daily-booking-emails] done", { sent, errors, skipped });
        return { sent, errors, skipped, errorDetails: errorDetails.slice(0, 10) };
    },
});

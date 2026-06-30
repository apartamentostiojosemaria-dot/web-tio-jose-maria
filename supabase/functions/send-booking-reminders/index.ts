// Edge function: send-booking-reminders
// ======================================
// Cron diario (pg_cron + net.http_post). Para cada tipo de recordatorio con
// regla de fecha, busca reservas CONFIRMADAS que tocan hoy y que aún no se han
// enviado, y dispara send-booking-email para cada una (que a su vez es
// idempotente y aplica los controles RGPD).
//
// Tipos cubiertos aquí:
//   reminder_7d   → 7 días antes del check_in
//   reminder_24h  → 1 día antes del check_in
//   arrival       → el día del check_in
//   departure     → el día del check_out
//   reactivation  → 30 días después del check_out (requiere marketing_consent)
//
// review_request NO se gestiona aquí: lo hace la función request-review con su
// propio cron daily-request-review.
//
// Body opcional: { "dryRun": true } → solo cuenta candidatos, no envía nada.
//
// Env vars (inyectadas por Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// regla = {template, columna de fecha, offset en días respecto a hoy, flag de idempotencia}
const RULES = [
    { template: "reminder_7d", dateCol: "check_in", offset: 7, flag: "reminder_7d_email_sent_at" },
    { template: "reminder_24h", dateCol: "check_in", offset: 1, flag: "reminder_24h_email_sent_at" },
    { template: "arrival", dateCol: "check_in", offset: 0, flag: "arrival_email_sent_at" },
    { template: "departure", dateCol: "check_out", offset: 0, flag: "departure_email_sent_at" },
    { template: "reactivation", dateCol: "check_out", offset: -30, flag: "reactivation_email_sent_at" },
];

// Fecha "hoy" en Europe/Madrid como YYYY-MM-DD (las columnas check_in/out son date).
function madridToday(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
}

function addDays(ymd: string, days: number): string {
    const d = new Date(ymd + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST" && req.method !== "GET") {
        return new Response("method_not_allowed", { status: 405, headers: CORS_HEADERS });
    }

    let dryRun = false;
    if (req.method === "POST") {
        try {
            const body = await req.json();
            dryRun = body?.dryRun === true;
        } catch { /* body vacío → cron normal */ }
    }

    const today = madridToday();
    const summary: Record<string, unknown>[] = [];

    for (const rule of RULES) {
        const target = addDays(today, rule.offset);
        const { data: due, error } = await supabase
            .from("guest_bookings")
            .select("booking_code")
            .eq("status", "confirmed")
            .is(rule.flag, null)
            .eq(rule.dateCol, target);

        if (error) {
            summary.push({ template: rule.template, target, error: error.message });
            continue;
        }

        const candidates = (due ?? []).map((b) => b.booking_code);
        let sent = 0, failed = 0;

        if (!dryRun) {
            for (const code of candidates) {
                try {
                    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-booking-email`, {
                        method: "POST",
                        headers: {
                            "content-type": "application/json",
                            authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        },
                        body: JSON.stringify({ bookingCode: code, template: rule.template }),
                    });
                    if (r.ok) sent++; else failed++;
                } catch { failed++; }
            }
        }

        summary.push({
            template: rule.template,
            target,
            candidates: candidates.length,
            ...(dryRun ? { dryRun: true, codes: candidates } : { sent, failed }),
        });
    }

    return new Response(JSON.stringify({ ok: true, today, dryRun, summary }), {
        status: 200,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
});

// Cron cada 30 minutos: invoca sync-ical-imports para reconciliar las
// reservas que entran desde Booking, Airbnb y Vrbo con nuestros blocked_dates,
// evitando overbooking.

import { schedules, logger } from "@trigger.dev/sdk";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const syncIcalChannels = schedules.task({
    id: "sync-ical-channels",
    cron: "*/30 * * * *",
    maxDuration: 120,
    run: async (payload) => {
        logger.info("[sync-ical-channels] start", { scheduledAt: payload.timestamp });

        const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-ical-imports`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({}),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`sync-ical-imports HTTP ${res.status}: ${body.slice(0, 200)}`);
        }
        const result = await res.json();
        logger.info("[sync-ical-channels] done", result);
        return result;
    },
});

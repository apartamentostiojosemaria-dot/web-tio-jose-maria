// Cron cada 15 minutos: invoca sync-ical-imports para reconciliar con
// nuestros blocked_dates / guest_bookings lo que entra por Airbnb, Booking,
// EscapadaRural y CasasRurales.net, evitando overbooking.
//
// Por que 15 y no 30: los canales refrescan LO SUYO cada 2-3 h (Airbnb 3 h,
// Booking 2 h, EscapadaRural 3 h, medido en su documentacion el 10-sep-2026).
// Esa es la ventana en la que se cuela un overbooking y no la controlamos
// nosotros. Lo que si controlamos es cuanto tardamos EN ENTERARNOS: bajar de
// 30 a 15 min recorta a la mitad el tiempo que una reserva de canal pasa sin
// bloquear las fechas en la web.
//
// OJO: este cron NO es el vigilante. Si Trigger.dev se cae, esto no corre y
// por tanto tampoco se queja. El vigilante vive aparte, en pg_cron dentro de
// la base, llamando a `sync-ical-imports?mode=watch`
// (ver supabase/migrations/_pendiente_canales.sql, seccion 7).

import { schedules, logger } from "@trigger.dev/sdk";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const syncIcalChannels = schedules.task({
    id: "sync-ical-channels",
    cron: "*/15 * * * *",
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

// Cron diario 10:00 Europe/Madrid: invoca submit-ses-hospedajes para
// transmitir al MIR los partes de viajero pendientes. El RD 933/2021 exige
// envío en 24h desde la entrada efectiva, así que el horario 10:00 cubre
// con margen los check-in del día anterior.
//
// Si SES_API_ENDPOINT no está configurado, la edge function corre en STUB
// MODE (genera el XML, marca stubbed) — útil para validar mientras el
// operador completa el alta en sede.mir.gob.es.

import { schedules, logger } from "@trigger.dev/sdk";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dailySesSubmit = schedules.task({
    id: "daily-ses-submit",
    cron: {
        pattern: "0 10 * * *",
        timezone: "Europe/Madrid",
    },
    maxDuration: 300,
    run: async (payload) => {
        logger.info("[daily-ses-submit] start", { scheduledAt: payload.timestamp });

        const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-ses-hospedajes`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({}),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            const msg = `HTTP ${res.status}: ${body.slice(0, 300)}`;
            logger.error("[daily-ses-submit] edge function failed", { error: msg });
            throw new Error(msg);
        }
        const result = await res.json() as { sent?: number; errors?: number; stubbed?: number; details?: unknown };
        logger.info("[daily-ses-submit] done", result);
        return result;
    },
});

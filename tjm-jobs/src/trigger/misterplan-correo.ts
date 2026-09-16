// Cron cada 10 minutos: lee el Gmail del negocio y apunta lo que MisterPlan
// avisa por correo (reserva nueva de cualquier canal, cancelación o
// modificación desde Booking, confirmación del motor web).
//
// Por qué existe: Booking entra por XML a MisterPlan y no da iCal mientras
// MisterPlan sea el channel manager (§7 decies del plan). Sin esto, una
// reserva de Booking solo llega al sistema si alguien la apunta a mano
// (Adrián: 3 días sin apuntar; Carmen López: 4 días cancelada sin saberlo).
//
// Idempotente por Message-ID (mail_import_log). Lo que no sabe apuntar lo
// deja marcado y avisa por correo. La lógica vive en ../lib/misterplan-importador.ts
// para poder probarla en seco desde fuera de Trigger.dev.

import { schedules, logger } from "@trigger.dev/sdk";
import { importarCorreosMisterPlan } from "../lib/misterplan-importador.js";

export const misterplanCorreo = schedules.task({
    id: "misterplan-correo",
    cron: "*/10 * * * *",
    maxDuration: 120,
    run: async (payload) => {
        logger.info("[misterplan-correo] start", { scheduledAt: payload.timestamp });
        const r = await importarCorreosMisterPlan({
            log: (msg, data) => logger.info(msg, data as Record<string, unknown> | undefined),
        });
        logger.info("[misterplan-correo] done", { leidos: r.leidos, procesados: r.procesados, acciones: r.acciones, atencion: r.atencion.length });
        return { leidos: r.leidos, procesados: r.procesados, acciones: r.acciones, atencion: r.atencion };
    },
});

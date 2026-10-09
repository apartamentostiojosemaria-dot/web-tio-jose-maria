-- 0055 · Los canales (iCal) se sincronizan desde la base, no desde Trigger.dev
-- ====================================================================
-- Hasta el 9-oct-2026 el importador lo disparaba Trigger.dev (tjm-jobs,
-- `sync-ical-channels`, cada 15 min) con un fetch sin tope de tiempo: el 28-sep
-- dos pasadas se quedaron esperando a la funcion mas de 120 s y Trigger.dev las
-- mato (MAX_DURATION_EXCEEDED) y mando correo. Regla de la casa: lo que puede
-- correr dentro de la base corre en pg_cron. Este cron llama a la misma funcion
-- igual que el vigilante `tjm-vigilar-canales` (0006 §6): cabecera `apikey` con
-- la clave PUBLICABLE (la funcion va con verify_jwt = false y solo exige la
-- service_role para `feedOverride`). Tope de 150 s, el limite de la edge function.
--
-- El vigilante sigue siendo independiente del disparador: mira cada hora si
-- algun canal lleva mas de 2 h sin pasada correcta (channel_sync_log), sea cual
-- sea el motivo. La tarea de Trigger.dev se retira en el mismo cambio
-- (tjm-jobs): nunca dos crones para lo mismo.
-- La clave del apikey es la PUBLICABLE (va en la web); no es un secreto.

SELECT cron.unschedule('tjm-sincronizar-canales')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-sincronizar-canales');

SELECT cron.schedule(
  'tjm-sincronizar-canales',
  '*/15 * * * *',
  $CRON$
    SELECT net.http_post(
      url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/sync-ical-imports',
      headers := '{"Content-Type":"application/json","apikey":"sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00"}'::jsonb, -- gitleaks:allow (publishable key, public by design; same as 0006)
      body    := '{}'::jsonb,
      timeout_milliseconds := 150000
    );
  $CRON$
);

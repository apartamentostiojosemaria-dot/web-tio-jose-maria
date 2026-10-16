-- 0062 · The channel watcher gets time to answer (16-oct-2026)
-- tjm-vigilar-canales had pg_net's default 5 s timeout: on 16-oct 07:07 the call was cut while
-- the function was still working, and the cron said «succeeded». First thing tjm_revisar() (0061)
-- caught. Same timeout style as tjm-sincronizar-canales.
SELECT cron.unschedule('tjm-vigilar-canales') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-vigilar-canales');
SELECT cron.schedule('tjm-vigilar-canales', '7 * * * *', $cron$
    SELECT net.http_post(
      url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/sync-ical-imports?mode=watch',
      headers := '{"Content-Type":"application/json","apikey":"sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00"}'::jsonb, -- gitleaks:allow (publishable key, public by design; same as 0006)
      body    := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
$cron$);

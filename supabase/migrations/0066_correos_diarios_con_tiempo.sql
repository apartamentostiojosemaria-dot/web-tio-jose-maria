-- 0066 · The daily guest e-mails get time to answer (16-oct-2026)
-- daily-booking-reminders and daily-request-review used pg_net's default 5 s timeout: on 16-oct 08:00 the
-- call was cut while the function was still sending. Caught by tjm_revisar() (0061). Same fix as 0062.
SELECT cron.unschedule('daily-booking-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-booking-reminders');
SELECT cron.schedule('daily-booking-reminders', '0 8 * * *', $cron$
  SELECT net.http_post(
    url := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/send-booking-reminders',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00"}'::jsonb, -- gitleaks:allow (publishable key, public by design; same as 0006)
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);
SELECT cron.unschedule('daily-request-review') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-request-review');
SELECT cron.schedule('daily-request-review', '0 8,9 * * *', $cron$
  SELECT net.http_post(
    url := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/request-review',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00"}'::jsonb, -- gitleaks:allow (publishable key, public by design; same as 0006)
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);

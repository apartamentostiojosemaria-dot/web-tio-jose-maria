-- 0052 · Holidu entra en v_channel_sync_status (0022 lo conectó pero la vista de 0006
-- solo listaba airbnb/booking/escapada/casasrurales: un feed de Holidu caído nunca salía en rojo).

CREATE OR REPLACE VIEW public.v_channel_sync_status WITH (security_invoker = true) AS
WITH configured AS (
    SELECT id AS apartment_id, name AS apartment_name, slug, 'airbnb'::text AS channel, airbnb_ical_url AS url
      FROM public.apartments WHERE is_active AND airbnb_ical_url IS NOT NULL
    UNION ALL
    SELECT id, name, slug, 'booking', booking_ical_url
      FROM public.apartments WHERE is_active AND booking_ical_url IS NOT NULL
    UNION ALL
    SELECT id, name, slug, 'escapada', escapada_ical_url
      FROM public.apartments WHERE is_active AND escapada_ical_url IS NOT NULL
    UNION ALL
    SELECT id, name, slug, 'casasrurales', casasrurales_ical_url
      FROM public.apartments WHERE is_active AND casasrurales_ical_url IS NOT NULL
    UNION ALL
    SELECT id, name, slug, 'holidu', holidu_ical_url
      FROM public.apartments WHERE is_active AND holidu_ical_url IS NOT NULL
),
last_run AS (
    SELECT DISTINCT ON (apartment_id, channel)
           apartment_id, channel, ran_at, ok, fetched, events_parsed,
           blocks_inserted, blocks_removed, bookings_created, bookings_updated,
           bookings_cancelled, conflicts, error_message
      FROM public.channel_sync_log
     ORDER BY apartment_id, channel, ran_at DESC
),
last_ok AS (
    SELECT DISTINCT ON (apartment_id, channel) apartment_id, channel, ran_at AS ok_at
      FROM public.channel_sync_log WHERE ok
     ORDER BY apartment_id, channel, ran_at DESC
)
SELECT c.apartment_id,
       c.apartment_name,
       c.slug,
       c.channel,
       r.ran_at                                   AS last_run_at,
       o.ok_at                                    AS last_ok_at,
       r.ok                                       AS last_run_ok,
       r.fetched                                  AS last_run_fetched,
       r.events_parsed,
       r.blocks_inserted,
       r.blocks_removed,
       r.bookings_created,
       r.bookings_updated,
       r.bookings_cancelled,
       r.conflicts,
       r.error_message,
       extract(epoch FROM (now() - o.ok_at)) / 60 AS minutes_since_ok,
       -- Rojo: nunca sincronizo, o hace mas de 2 horas que no hay pasada BUENA.
       (o.ok_at IS NULL OR o.ok_at < now() - interval '2 hours') AS is_stale
  FROM configured c
  LEFT JOIN last_run r ON r.apartment_id = c.apartment_id AND r.channel = c.channel
  LEFT JOIN last_ok  o ON o.apartment_id = c.apartment_id AND o.channel = c.channel;

COMMENT ON VIEW public.v_channel_sync_status IS
  'Estado de la sincronizacion por apartamento y canal configurado. is_stale = sin pasada correcta en 2 h (o ninguna nunca).';
GRANT SELECT ON public.v_channel_sync_status TO authenticated;

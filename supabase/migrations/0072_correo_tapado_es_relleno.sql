-- 0072 — A masked address is not a mailbox (26-oct-2026)
--
-- MisterPlan's notices hide some guests' addresses («n***@***.com»). The
-- reader stored them as-is, so 6 customers and 6 bookings carried an address
-- that looks like an email: the reminders went to it and Resend rejected it
-- every day (TJM-513DC3, 24 and 25-oct, 422 «Invalid `to` field»).
--
--   1. `tjm_es_relleno` also says yes to anything that is not a valid address,
--      so the linking trigger treats a masked one like the placeholders.
--   2. The 6 customers get the per-customer placeholder the trigger already
--      uses, and their bookings follow (the trigger copies it back).
-- The reader (tjm-jobs) and send-booking-email drop masked addresses too.

CREATE OR REPLACE FUNCTION public.tjm_es_relleno(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
    SELECT p_email IS NULL OR btrim(p_email) = ''
        OR lower(p_email) LIKE '%@example.invalid'
        OR lower(p_email) LIKE '%@tiojosemaria.local'
        OR btrim(p_email) !~* '^[^\s@*]+@[^\s@*]+\.[a-z]{2,}$';
$function$;

UPDATE public.customers
   SET email = 'sin-email+c' || id || '@tiojosemaria.local', updated_at = now()
 WHERE email ~ '\*';

UPDATE public.guest_bookings b
   SET guest_email = c.email, updated_at = now()
  FROM public.customers c
 WHERE b.customer_id = c.id AND b.guest_email ~ '\*';

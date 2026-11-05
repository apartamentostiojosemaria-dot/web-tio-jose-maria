-- 0077 · Beds24 como tubería hacia los portales (prueba del 5-nov-2026)
-- ====================================================================
-- Decisión en estudio (`clients/tio-jose-maria/projects/2026-09-10-sustituir-misterplan/
-- 2026-11-05-estudio-beds24-conexiones.md`): TJM es la única verdad y Beds24 solo lleva
-- Booking/Airbnb por API. Esta migración monta la tubería en MODO ESPEJO:
--
--   · TJM -> Beds24: cada cambio en guest_bookings o blocked_dates pide a la función
--     `beds24-sync` que mande la disponibilidad de ese apartamento (numAvail 0/1 por noche).
--   · Beds24 -> TJM: las reservas de Beds24 se guardan en `beds24_bookings` (espejo),
--     NO en guest_bookings. Así una reserva de prueba no sale en el panel, no manda
--     correos ni se comunica al Ministerio. Pasarlas a guest_bookings es el interruptor
--     `promover_reservas` de `beds24_config`, que se enciende el día que Booking pase a Beds24.
--   · Cron cada 10 min: repaso completo (lee reservas cambiadas y reenvía disponibilidad)
--     por si se pierde un aviso.
--
-- La función va con verify_jwt = false: no se fía de lo que le manden; un aviso de Beds24
-- solo dispara una relectura por la API con nuestro token. El token vive en los secretos de
-- la función (BEDS24_REFRESH_TOKEN), nunca en el repo.

-- 1) Enlace apartamento <-> habitación de Beds24 (propiedad 366113)
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS beds24_room_id integer UNIQUE;
UPDATE public.apartments SET beds24_room_id = v.room
  FROM (VALUES (1, 753783), (2, 753784), (3, 753785), (4, 753786)) AS v(apt, room)
 WHERE apartments.id = v.apt AND apartments.beds24_room_id IS DISTINCT FROM v.room;

-- 2) Configuración (clave -> valor)
CREATE TABLE IF NOT EXISTS public.beds24_config (
    clave       text PRIMARY KEY,
    valor       jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.beds24_config (clave, valor) VALUES
    ('property_id',        '366113'::jsonb),
    ('envio_activo',       'true'::jsonb),
    ('promover_reservas',  'false'::jsonb),
    ('dias_adelante',      '730'::jsonb),
    ('cursor_modificadas', 'null'::jsonb)
ON CONFLICT (clave) DO NOTHING;

-- 3) Espejo de las reservas de Beds24
CREATE TABLE IF NOT EXISTS public.beds24_bookings (
    beds24_id         bigint PRIMARY KEY,
    room_id           integer,
    apartment_id      bigint REFERENCES public.apartments(id),
    status            text,
    channel           text,
    api_source        text,
    referer           text,
    arrival           date,
    departure         date,
    guest_name        text,
    guest_email       text,
    guest_phone       text,
    num_adult         integer,
    num_child         integer,
    price             numeric,
    api_reference     text,
    booking_time      timestamptz,
    modified_time     timestamptz,
    raw               jsonb,
    guest_booking_id  uuid,
    first_seen_at     timestamptz NOT NULL DEFAULT now(),
    last_seen_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS beds24_bookings_apt_fechas ON public.beds24_bookings (apartment_id, arrival, departure);

-- 4) Registro de pasadas (lo que se hizo, no que se corrió)
CREATE TABLE IF NOT EXISTS public.beds24_sync_log (
    id          bigserial PRIMARY KEY,
    ran_at      timestamptz NOT NULL DEFAULT now(),
    modo        text NOT NULL,
    origen      text,
    ok          boolean NOT NULL,
    enviados    integer NOT NULL DEFAULT 0,
    leidas      integer NOT NULL DEFAULT 0,
    creditos    numeric,
    error       text,
    detalle     jsonb
);
CREATE INDEX IF NOT EXISTS beds24_sync_log_ran ON public.beds24_sync_log (ran_at DESC);

-- Solo la service role (la función). Ni anon ni authenticated.
ALTER TABLE public.beds24_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds24_bookings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds24_sync_log  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beds24_config, public.beds24_bookings, public.beds24_sync_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.beds24_sync_log_id_seq FROM anon, authenticated;

-- 5) Al cambiar una reserva o un bloqueo, avisar a la función (asíncrono, pg_net).
--    La clave del apikey es la PUBLICABLE (igual que 0055): no es un secreto.
CREATE OR REPLACE FUNCTION public.tjm_beds24_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_apt bigint;
BEGIN
    v_apt := COALESCE(NEW.apartment_id, OLD.apartment_id);
    IF v_apt IS NULL THEN RETURN NULL; END IF;
    PERFORM net.http_post(
        url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/beds24-sync',
        headers := '{"Content-Type":"application/json","apikey":"sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00"}'::jsonb, -- gitleaks:allow (publishable key, public by design; same as 0055)
        body    := jsonb_build_object('mode', 'push', 'apartmentId', v_apt, 'origen', TG_TABLE_NAME),
        timeout_milliseconds := 60000
    );
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tjm_beds24_avisar() FROM PUBLIC, anon, authenticated;

-- Solo cuando cambia de verdad algo que afecta a las noches (un UPDATE que reescribe el mismo
-- valor no dispara nada: el importador iCal toca filas cada 15 min).
DROP TRIGGER IF EXISTS beds24_avisar_reservas ON public.guest_bookings;
DROP TRIGGER IF EXISTS beds24_avisar_reservas_alta ON public.guest_bookings;
CREATE TRIGGER beds24_avisar_reservas_alta
    AFTER INSERT OR DELETE ON public.guest_bookings
    FOR EACH ROW EXECUTE FUNCTION public.tjm_beds24_avisar();
DROP TRIGGER IF EXISTS beds24_avisar_reservas_cambio ON public.guest_bookings;
CREATE TRIGGER beds24_avisar_reservas_cambio
    AFTER UPDATE ON public.guest_bookings
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.check_in IS DISTINCT FROM NEW.check_in
       OR OLD.check_out IS DISTINCT FROM NEW.check_out OR OLD.apartment_id IS DISTINCT FROM NEW.apartment_id)
    EXECUTE FUNCTION public.tjm_beds24_avisar();

DROP TRIGGER IF EXISTS beds24_avisar_bloqueos ON public.blocked_dates;
DROP TRIGGER IF EXISTS beds24_avisar_bloqueos_alta ON public.blocked_dates;
CREATE TRIGGER beds24_avisar_bloqueos_alta
    AFTER INSERT OR DELETE ON public.blocked_dates
    FOR EACH ROW EXECUTE FUNCTION public.tjm_beds24_avisar();
DROP TRIGGER IF EXISTS beds24_avisar_bloqueos_cambio ON public.blocked_dates;
CREATE TRIGGER beds24_avisar_bloqueos_cambio
    AFTER UPDATE ON public.blocked_dates
    FOR EACH ROW
    WHEN (OLD.start_date IS DISTINCT FROM NEW.start_date OR OLD.end_date IS DISTINCT FROM NEW.end_date
       OR OLD.apartment_id IS DISTINCT FROM NEW.apartment_id)
    EXECUTE FUNCTION public.tjm_beds24_avisar();

-- 6) Repaso cada 10 min (lee reservas cambiadas en Beds24 y reenvía la disponibilidad)
SELECT cron.unschedule('tjm-beds24-repaso')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-beds24-repaso');
SELECT cron.schedule(
  'tjm-beds24-repaso',
  '*/10 * * * *',
  $CRON$
    SELECT net.http_post(
      url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/beds24-sync',
      headers := '{"Content-Type":"application/json","apikey":"sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00"}'::jsonb, -- gitleaks:allow (publishable key, public by design)
      body    := '{"mode":"all","origen":"cron"}'::jsonb,
      timeout_milliseconds := 120000
    );
  $CRON$
);

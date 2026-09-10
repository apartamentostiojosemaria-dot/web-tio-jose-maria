-- =====================================================================
-- 0006_canales.sql   (paquetes P2.1 / P2.3)
-- =====================================================================
-- Todo aditivo e idempotente. No borra ni modifica datos existentes.
-- Los bloqueos reales de Airbnb en `blocked_dates` se conservan:
-- `external_uid` nace NULL y el importador la rellena al vuelo emparejando
-- por fechas la primera vez (backfill sin borrar ni reinsertar).
--
-- DOS CAMBIOS respecto del borrador `_pendiente_canales.sql`, medidos en
-- produccion antes de aplicar:
--   a) Las politicas RLS del borrador miraban `profiles.is_staff`, una
--      COLUMNA que NO EXISTE en esta base (profiles tiene `role`, y el
--      helper es la FUNCION public.is_staff()). Tal cual, habrian fallado
--      al crearse. Se usan los helpers reales: is_staff() para leer,
--      is_admin() para resolver conflictos.
--   b) La vista se crea con `security_invoker = true`. Sin eso, en PG15+
--      una vista corre con los permisos de su duena y se salta la RLS de
--      channel_sync_log: cualquier sesion autenticada veria el registro.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------

-- 1.a  blocked_dates: identidad del evento en el canal de origen. Sin esto
--      la reconciliacion va por (fecha_inicio|fecha_fin) y un cambio de
--      fechas en el canal se ve como "borrar + crear".
ALTER TABLE public.blocked_dates
  ADD COLUMN IF NOT EXISTS external_uid text;

COMMENT ON COLUMN public.blocked_dates.external_uid IS
  'UID del VEVENT en el iCal del canal de origen. Clave de idempotencia del importador.';

-- 1.b  guest_bookings: identidad del evento del canal, para no duplicar
--      reservas al reejecutar el cron.
ALTER TABLE public.guest_bookings
  ADD COLUMN IF NOT EXISTS external_uid text;

COMMENT ON COLUMN public.guest_bookings.external_uid IS
  'UID del VEVENT del iCal del canal que origino esta reserva. NULL en reservas propias.';

-- 1.c  apartments: hacen falta CUATRO enlaces por apartamento, no dos.
ALTER TABLE public.apartments
  ADD COLUMN IF NOT EXISTS escapada_ical_url text;

ALTER TABLE public.apartments
  ADD COLUMN IF NOT EXISTS casasrurales_ical_url text;

COMMENT ON COLUMN public.apartments.escapada_ical_url IS
  'URL del calendario iCal de EscapadaRural (importacion hacia TJM).';
COMMENT ON COLUMN public.apartments.casasrurales_ical_url IS
  'URL del calendario iCal de CasasRurales.net / AvaiBook (importacion hacia TJM).';


-- ---------------------------------------------------------------------
-- 2. Tablas nuevas
-- ---------------------------------------------------------------------

-- 2.a  Registro de sincronizaciones: una fila por apartamento, canal y
--      pasada. Registra el RESULTADO, no que el proceso corriera: un canal
--      que no se puede descargar deja fila con ok=false. Es lo que permite
--      detectar la AUSENCIA de pasada, no solo el fallo.
CREATE TABLE IF NOT EXISTS public.channel_sync_log (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    apartment_id       bigint REFERENCES public.apartments(id) ON DELETE CASCADE,
    channel            text NOT NULL,              -- airbnb | booking | escapada | casasrurales
    ran_at             timestamptz NOT NULL DEFAULT now(),
    ok                 boolean NOT NULL DEFAULT false,
    fetched            boolean NOT NULL DEFAULT false,   -- respondio la URL del canal?
    events_parsed      integer NOT NULL DEFAULT 0,
    blocks_inserted    integer NOT NULL DEFAULT 0,
    blocks_removed     integer NOT NULL DEFAULT 0,
    bookings_created   integer NOT NULL DEFAULT 0,
    bookings_updated   integer NOT NULL DEFAULT 0,
    bookings_cancelled integer NOT NULL DEFAULT 0,
    conflicts          integer NOT NULL DEFAULT 0,
    duration_ms        integer,
    error_message      text
);

COMMENT ON TABLE public.channel_sync_log IS
  'Una fila por pasada del importador iCal y por (apartamento, canal). Fuente de la vigilancia.';

-- 2.b  Conflictos: un evento del canal que pisa una reserva propia. Es lo
--      que evita un overbooking silencioso. No se resuelve solo: queda
--      abierto hasta que una persona lo cierra.
CREATE TABLE IF NOT EXISTS public.channel_sync_conflicts (
    id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    apartment_id           bigint REFERENCES public.apartments(id) ON DELETE CASCADE,
    channel                text NOT NULL,
    external_uid           text,
    start_date             date NOT NULL,
    end_date               date NOT NULL,          -- inclusive (ultima noche ocupada)
    summary                text,
    conflicting_booking_id bigint REFERENCES public.guest_bookings(id) ON DELETE SET NULL,
    detected_at            timestamptz NOT NULL DEFAULT now(),
    last_seen_at           timestamptz NOT NULL DEFAULT now(),
    notified_at            timestamptz,
    resolved_at            timestamptz,
    resolution             text
);

COMMENT ON TABLE public.channel_sync_conflicts IS
  'Solapes entre un evento importado de un canal y una reserva propia. Abierto = resolved_at IS NULL.';

-- 2.c  Antirrepeticion de avisos. Sin esto, un canal caido manda el mismo
--      correo cada 15 minutos y en dos dias nadie lo lee: un vigilante que
--      se convierte en ruido deja de vigilar.
CREATE TABLE IF NOT EXISTS public.channel_alerts (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    apartment_id bigint REFERENCES public.apartments(id) ON DELETE CASCADE,
    channel      text NOT NULL,
    kind         text NOT NULL,          -- sin_sincronizar | no_descarga
    last_sent_at timestamptz NOT NULL DEFAULT now(),
    last_via     text                    -- alertas | email | sin_via
);

CREATE UNIQUE INDEX IF NOT EXISTS channel_alerts_uniq
  ON public.channel_alerts (apartment_id, channel, kind);

COMMENT ON TABLE public.channel_alerts IS
  'Ultima vez que se aviso de cada problema por canal. El importador no repite antes de 6 h.';


-- ---------------------------------------------------------------------
-- 3. Indices y unicidad (idempotencia)
-- ---------------------------------------------------------------------

-- Un mismo UID no puede producir dos bloqueos del mismo canal en el mismo
-- apartamento. Garantia dura de que reejecutar el cron no duplica.
CREATE UNIQUE INDEX IF NOT EXISTS blocked_dates_external_uid_uniq
  ON public.blocked_dates (apartment_id, source, external_uid)
  WHERE external_uid IS NOT NULL;

-- Idem para reservas importadas.
CREATE UNIQUE INDEX IF NOT EXISTS guest_bookings_external_uid_uniq
  ON public.guest_bookings (external_uid)
  WHERE external_uid IS NOT NULL;

-- Un conflicto abierto por (apartamento, canal, uid): reejecutar no
-- multiplica avisos, solo refresca last_seen_at.
CREATE UNIQUE INDEX IF NOT EXISTS channel_sync_conflicts_open_uniq
  ON public.channel_sync_conflicts (apartment_id, channel, external_uid)
  WHERE resolved_at IS NULL AND external_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS channel_sync_log_lookup
  ON public.channel_sync_log (apartment_id, channel, ran_at DESC);

CREATE INDEX IF NOT EXISTS channel_sync_conflicts_open
  ON public.channel_sync_conflicts (resolved_at, detected_at DESC);

-- Anadidos aqui (no estaban en el borrador): las claves ajenas de
-- channel_sync_conflicts se quedaban sin indice que las cubriera — el
-- unico de arriba es PARCIAL y no sirve de cobertura.
CREATE INDEX IF NOT EXISTS channel_sync_conflicts_apartment
  ON public.channel_sync_conflicts (apartment_id);

CREATE INDEX IF NOT EXISTS channel_sync_conflicts_booking
  ON public.channel_sync_conflicts (conflicting_booking_id);


-- ---------------------------------------------------------------------
-- 4. Vista de vigilancia
-- ---------------------------------------------------------------------
-- Lo que pinta el panel de Jesus: por cada apartamento y canal CONFIGURADO,
-- cuando se miro por ultima vez y si eso ya es viejo.
--
-- Ojo con la trampa: un canal configurado que NUNCA ha sincronizado tiene
-- last_run NULL, y eso debe salir en rojo, no desaparecer de la lista. Por
-- eso el origen es la lista de URLs configuradas, no la del log.
DROP VIEW IF EXISTS public.v_channel_sync_status;
CREATE VIEW public.v_channel_sync_status WITH (security_invoker = true) AS
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


-- ---------------------------------------------------------------------
-- 5. RLS: leer, el panel (admin/staff); escribir, service_role
-- ---------------------------------------------------------------------
-- El importador entra con service_role, que se salta la RLS: no le hace
-- falta politica de escritura y no se le da a nadie mas.
ALTER TABLE public.channel_sync_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_alerts         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channel_sync_log_read ON public.channel_sync_log;
CREATE POLICY channel_sync_log_read ON public.channel_sync_log
    FOR SELECT TO authenticated
    USING (public.is_staff());

DROP POLICY IF EXISTS channel_sync_conflicts_read ON public.channel_sync_conflicts;
CREATE POLICY channel_sync_conflicts_read ON public.channel_sync_conflicts
    FOR SELECT TO authenticated
    USING (public.is_staff());

-- Marcar un conflicto como resuelto: solo Jesus (admin).
DROP POLICY IF EXISTS channel_sync_conflicts_resolve ON public.channel_sync_conflicts;
CREATE POLICY channel_sync_conflicts_resolve ON public.channel_sync_conflicts
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- channel_alerts es fontaneria del antirrepeticion: se lee para diagnosticar,
-- no se escribe desde el navegador.
DROP POLICY IF EXISTS channel_alerts_read ON public.channel_alerts;
CREATE POLICY channel_alerts_read ON public.channel_alerts
    FOR SELECT TO authenticated
    USING (public.is_staff());

-- La vista es security_invoker: hereda la RLS de apartments y de
-- channel_sync_log. Sin la politica de arriba, saldria vacia.
GRANT SELECT ON public.v_channel_sync_status TO authenticated;


-- ---------------------------------------------------------------------
-- 6. VIGILANTE INDEPENDIENTE (pg_cron)
-- ---------------------------------------------------------------------
-- El importador corre en Trigger.dev. Si Trigger.dev se cae, no corre y por
-- tanto TAMPOCO se queja: el vigilante caeria con lo vigilado y el corte no
-- se autodenunciaria. Por eso este vive en otro sitio: pg_cron, dentro de la
-- base. Cada hora llama a `sync-ical-imports?mode=watch`, que no sincroniza
-- nada: solo mira si algun canal configurado lleva mas de 2 h sin pasada
-- correcta y dispara aviso.
--
-- La clave se pasa como el resto de crons de este proyecto (jobs
-- `daily-request-review` y `daily-booking-reminders`, medidos en cron.job el
-- 10-sep-2026): cabecera `apikey` con la clave PUBLICABLE. Vale porque
-- `sync-ical-imports` va con verify_jwt = false (config.toml) y se defiende
-- sola por dentro con la service_role. No se usa vault: este proyecto no
-- guarda ahi ningun secreto hoy, y meter un patron nuevo para un solo cron
-- deja dos formas de hacer lo mismo.
SELECT cron.schedule(
  'tjm-vigilar-canales',
  '7 * * * *',
  $CRON$
    SELECT net.http_post(
      url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/sync-ical-imports?mode=watch',
      headers := '{"Content-Type":"application/json","apikey":"sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00"}'::jsonb,
      body    := '{}'::jsonb
    );
  $CRON$
);

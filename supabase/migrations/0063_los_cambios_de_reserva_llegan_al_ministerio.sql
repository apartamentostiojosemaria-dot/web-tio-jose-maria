-- 0063 · Changes to a booking reach the Ministry (audit 10-oct-2026, F5; fase 1 16-oct)
--
-- Why: once a reservation was communicated (RD 933/2021 art. 6.3.a), a change of dates,
-- apartment or number of people (Booking via MisterPlan, iCal, the panel) never reached the
-- Ministry: it kept the first version. The fix the audit proposed: cancel the communication
-- that is there and communicate it again with the new data. Only before arrival: once the
-- guests are in, what counts is the travellers' report.
--
-- Here: a mark on the booking when something that the Ministry holds changes, and the
-- pending list (`tjm_ses_pendientes`, the ONLY definition of «what is left to communicate»)
-- gets a third type, 'modificacion'. The function submit-ses-hospedajes does the rest.

ALTER TABLE public.guest_bookings
    ADD COLUMN IF NOT EXISTS modificacion_pendiente_at timestamptz,
    ADD COLUMN IF NOT EXISTS modificaciones_comunicadas integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.guest_bookings.modificacion_pendiente_at IS
    'Cuándo cambió algo que el Ministerio ya tenía (fechas, apartamento, personas) antes de la entrada. El barrido anula la comunicación anterior y comunica la nueva; luego vuelve a NULL (0063).';

CREATE OR REPLACE FUNCTION public.tjm_marcar_modificacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF OLD.reserva_comunicada_at IS NOT NULL
       AND NEW.status = 'confirmed'
       AND COALESCE(NEW.source, '') <> 'test'
       AND NEW.check_in >= (now() AT TIME ZONE 'Europe/Madrid')::date
       AND (NEW.check_in IS DISTINCT FROM OLD.check_in
            OR NEW.check_out IS DISTINCT FROM OLD.check_out
            OR NEW.apartment_id IS DISTINCT FROM OLD.apartment_id
            OR NEW.pax_count IS DISTINCT FROM OLD.pax_count) THEN
        NEW.modificacion_pendiente_at := now();
    END IF;
    RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_marcar_modificacion ON public.guest_bookings;
CREATE TRIGGER trg_marcar_modificacion
    BEFORE UPDATE OF check_in, check_out, apartment_id, pax_count ON public.guest_bookings
    FOR EACH ROW EXECUTE FUNCTION public.tjm_marcar_modificacion();

CREATE OR REPLACE FUNCTION public.tjm_ses_pendientes()
 RETURNS TABLE(booking_id bigint, booking_code text, tipo text, estado text, intentos integer, desde timestamp with time zone, limite_24h timestamp with time zone, fuera_de_plazo boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT gb.id, gb.booking_code, 'reserva'::text,
           COALESCE(c.estado, 'pendiente'),
           COALESCE(c.intentos, 0),
           gb.created_at,
           gb.created_at + INTERVAL '24 hours',
           now() > gb.created_at + INTERVAL '24 hours'
      FROM public.guest_bookings gb
      LEFT JOIN public.ses_comunicaciones c
             ON c.booking_id = gb.id AND c.tipo = 'reserva'
     WHERE public.tjm_puede_gestionar()
       AND gb.status IN ('confirmed','completed')
       AND COALESCE(gb.source, '') <> 'test'
       AND gb.reserva_comunicada_at IS NULL
       AND COALESCE(c.estado, 'pendiente') NOT IN ('enviado_a_mano','no_procede','aparcado')

    UNION ALL

    SELECT gb.id, gb.booking_code, 'anulacion'::text,
           COALESCE(c.estado, 'pendiente'),
           COALESCE(c.intentos, 0),
           gb.updated_at,
           gb.updated_at + INTERVAL '24 hours',
           now() > gb.updated_at + INTERVAL '24 hours'
      FROM public.guest_bookings gb
      LEFT JOIN public.ses_comunicaciones c
             ON c.booking_id = gb.id AND c.tipo = 'anulacion'
     WHERE public.tjm_puede_gestionar()
       AND gb.status = 'cancelled'
       AND COALESCE(gb.source, '') <> 'test'
       AND gb.reserva_comunicada_at IS NOT NULL
       AND gb.anulacion_comunicada_at IS NULL
       AND COALESCE(c.estado, 'pendiente') NOT IN ('enviado_a_mano','no_procede','aparcado')

    UNION ALL

    -- 0063: a change to a reservation the Ministry already has (before arrival)
    SELECT gb.id, gb.booking_code, 'modificacion'::text,
           'pendiente', 0,
           gb.modificacion_pendiente_at,
           gb.modificacion_pendiente_at + INTERVAL '24 hours',
           now() > gb.modificacion_pendiente_at + INTERVAL '24 hours'
      FROM public.guest_bookings gb
     WHERE public.tjm_puede_gestionar()
       AND gb.status = 'confirmed'
       AND COALESCE(gb.source, '') <> 'test'
       AND gb.reserva_comunicada_at IS NOT NULL
       AND gb.modificacion_pendiente_at IS NOT NULL;
$function$;

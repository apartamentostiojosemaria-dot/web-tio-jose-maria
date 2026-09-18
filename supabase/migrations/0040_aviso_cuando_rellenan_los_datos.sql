-- 0040 — Aviso cuando rellenan los datos de la policía.
--
-- Jesús, 18-sep-2026, con Adrián ya en casa: «debería haber algún tipo de
-- aviso cuando rellenan los datos». Hasta hoy la única forma de enterarse era
-- abrir la reserva en el panel y mirar el semáforo.
--
-- Desde ahora, cuando entra la ficha que completa la reserva (tantas fichas
-- como personas), la base manda UN correo al buzón del negocio (plantilla
-- operator_precheckin_done: quién ha rellenado y «termina el check-in») y lo
-- apunta en la reserva para no repetirlo. Lo hace un trigger con pg_net,
-- igual que el barrido del parte (0010): la base llama a la función, no
-- una persona.

ALTER TABLE public.guest_bookings ADD COLUMN IF NOT EXISTS precheckin_completo_avisado_at timestamptz;
COMMENT ON COLUMN public.guest_bookings.precheckin_completo_avisado_at IS 'Cuándo se avisó al buzón del negocio de que ya estaban todas las fichas de la policía.';

CREATE OR REPLACE FUNCTION public.tjm_avisar_precheckin_completo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_bk      record;
    v_fichas  integer;
BEGIN
    SELECT b.id, b.booking_code, b.pax_count, b.status, b.source, b.precheckin_completo_avisado_at
      INTO v_bk FROM public.guest_bookings b WHERE b.id = NEW.booking_id;
    IF NOT FOUND OR v_bk.status NOT IN ('confirmed', 'completed') OR COALESCE(v_bk.source, '') = 'test'
       OR v_bk.precheckin_completo_avisado_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT count(*) INTO v_fichas FROM public.traveler_records t WHERE t.booking_id = v_bk.id;
    IF v_fichas < GREATEST(COALESCE(v_bk.pax_count, 1), 1) THEN
        RETURN NEW;
    END IF;

    -- Se apunta ANTES de llamar: si la llamada tarda o falla, no se manda dos veces.
    UPDATE public.guest_bookings SET precheckin_completo_avisado_at = now() WHERE id = v_bk.id;

    PERFORM net.http_post(
        url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/send-booking-email',
        headers := jsonb_build_object(
                       'Content-Type', 'application/json',
                       'apikey', 'sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00'),
        body    := jsonb_build_object('bookingCode', v_bk.booking_code, 'template', 'operator_precheckin_done')
    );
    RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_avisar_precheckin_completo ON public.traveler_records;
CREATE TRIGGER trg_avisar_precheckin_completo
    AFTER INSERT ON public.traveler_records
    FOR EACH ROW EXECUTE FUNCTION public.tjm_avisar_precheckin_completo();

COMMENT ON FUNCTION public.tjm_avisar_precheckin_completo() IS
    'Cuando entra la última ficha de la policía de una reserva, avisa al buzón del negocio (send-booking-email / operator_precheckin_done) una sola vez.';

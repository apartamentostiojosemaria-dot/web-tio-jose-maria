-- 0083 · «check-in» → «entrada» en el aviso al móvil de los datos de la policía (5-nov-2026, auditoría de textos)

CREATE OR REPLACE FUNCTION public.tjm_avisar_precheckin_completo()
 RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_bk      record;
    v_fichas  integer;
    v_nombres text;
BEGIN
    SELECT b.id, b.booking_code, b.pax_count, b.status, b.source, b.precheckin_completo_avisado_at, b.guest_name, b.check_in, a.name AS apartamento
      INTO v_bk FROM public.guest_bookings b LEFT JOIN public.apartments a ON a.id = b.apartment_id WHERE b.id = NEW.booking_id;
    IF NOT FOUND OR v_bk.status NOT IN ('confirmed', 'completed') OR COALESCE(v_bk.source, '') = 'test'
       OR v_bk.precheckin_completo_avisado_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT count(*) INTO v_fichas FROM public.traveler_records t WHERE t.booking_id = v_bk.id;
    IF v_fichas < GREATEST(COALESCE(v_bk.pax_count, 1), 1) THEN
        RETURN NEW;
    END IF;

    UPDATE public.guest_bookings SET precheckin_completo_avisado_at = now() WHERE id = v_bk.id;

    PERFORM net.http_post(
        url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/send-booking-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00'), -- gitleaks:allow (publishable key, public by design)
        body    := jsonb_build_object('bookingCode', v_bk.booking_code, 'template', 'operator_precheckin_done')
    );

    SELECT string_agg(COALESCE(NULLIF(btrim(nombre), ''), '—'), ' y ' ORDER BY is_titular DESC, created_at)
      INTO v_nombres FROM public.traveler_records WHERE booking_id = v_bk.id;
    PERFORM public.tjm_notificar_push(
        'Ya han rellenado los datos de la policía',
        COALESCE(v_nombres, v_bk.guest_name, 'Los huéspedes') || ' · ' || COALESCE(v_bk.apartamento, '') ||
            CASE WHEN v_bk.check_in = current_date THEN '. Cuando les des la llave, termina la entrada en el panel.' ELSE '.' END,
        public.tjm_url_reserva(v_bk.id, 'parte'));
    RETURN NEW;
END $function$;

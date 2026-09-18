-- 0036 — El manual de la casa separa la entrada de la salida (la ficha del
-- huésped enseña una cosa antes de venir y la otra el día de irse).
ALTER TABLE public.guidebooks ADD COLUMN IF NOT EXISTS checkout_instructions text;

UPDATE public.guidebooks SET
    checkin_instructions  = 'Entrada a partir de las 16:00. Las llaves os las damos en mano al llegar. Si vais a llegar después de las 21:00, avisadnos por WhatsApp y os decimos cómo lo hacemos.',
    checkout_instructions = 'Salida antes de las 12:00. Dejad las llaves en la mesa del salón, las ventanas cerradas y las luces apagadas. No hace falta que limpiéis: con dejar la cocina recogida basta.',
    updated_at = now();

-- La función vuelve a definirse igual que en 0035, añadiendo `salir`.
CREATE OR REPLACE FUNCTION public.tjm_ficha_huesped(p_booking_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_code     text := upper(btrim(COALESCE(p_booking_code, '')));
    v_bk       record;
    v_apt      record;
    v_guia     record;
    v_hoy      date := (now() AT TIME ZONE 'Europe/Madrid')::date;
    v_fichas   integer;
    v_factura  record;
    v_ventana  text;
    v_momento  text;
    v_limite   date;
BEGIN
    IF v_code !~ '^TJM-[A-Z0-9]{6}$' THEN
        RETURN jsonb_build_object('ventana', 'no_encontrada');
    END IF;

    SELECT b.id, b.booking_code, b.guest_name, b.apartment_id, b.pax_count, b.check_in, b.check_out,
           b.status, b.channel, b.source, b.payment_status, b.paid_amount, b.pending_amount,
           b.total_price, b.checkin_at, b.checkout_at, b.invoice_not_needed
      INTO v_bk
      FROM public.guest_bookings b
     WHERE b.booking_code = v_code;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ventana', 'no_encontrada');
    END IF;

    v_ventana := CASE
        WHEN v_bk.status = 'cancelled'                              THEN 'cancelada'
        WHEN v_bk.status IN ('hold', 'pending', 'expired')          THEN 'sin_confirmar'
        WHEN v_bk.status = 'no_show'                                THEN 'cerrada'
        WHEN v_hoy > v_bk.check_out + 30                            THEN 'cerrada'
        ELSE 'abierta'
    END;

    IF v_ventana <> 'abierta' THEN
        RETURN jsonb_build_object('ventana', v_ventana, 'codigo', v_bk.booking_code);
    END IF;

    v_momento := CASE
        WHEN v_hoy >= v_bk.check_out                                     THEN 'despues'
        WHEN v_bk.checkin_at IS NOT NULL OR v_hoy >= v_bk.check_in       THEN 'dentro'
        ELSE 'antes'
    END;

    SELECT a.name, a.slug, a.capacity_people INTO v_apt FROM public.apartments a WHERE a.id = v_bk.apartment_id;
    SELECT g.* INTO v_guia FROM public.guidebooks g WHERE g.apartment_id = v_bk.apartment_id;

    SELECT count(*) INTO v_fichas FROM public.traveler_records t WHERE t.booking_id = v_bk.id;

    SELECT i.serie, i.numero, i.fecha_emision, i.email_sent_at
      INTO v_factura
      FROM public.invoices i
     WHERE i.booking_id = v_bk.id AND COALESCE(i.tipo, 'completa') <> 'rectificativa'
     ORDER BY i.created_at DESC LIMIT 1;

    v_limite := v_bk.check_in - 7;   -- misma regla que cancel_booking

    RETURN jsonb_build_object(
        'ventana', 'abierta',
        'momento', v_momento,
        'reserva', jsonb_build_object(
            'codigo',        v_bk.booking_code,
            'nombre',        v_bk.guest_name,
            'apartamento',   COALESCE(v_apt.name, 'Apartamento'),
            'slug',          v_apt.slug,
            'personas',      GREATEST(COALESCE(v_bk.pax_count, 1), 1),
            'entrada',       v_bk.check_in,
            'salida',        v_bk.check_out,
            'canal',         COALESCE(v_bk.channel, v_bk.source, 'web'),
            'es_canal',      lower(COALESCE(v_bk.channel, '')) IN ('booking', 'airbnb', 'holidu', 'escapada', 'casasrurales'),
            'pagado',        COALESCE(v_bk.pending_amount, 0) <= 0 OR v_bk.payment_status = 'paid',
            'pendiente',     GREATEST(COALESCE(v_bk.pending_amount, 0), 0),
            'total',         COALESCE(v_bk.total_price, 0),
            'entrada_hecha', v_bk.checkin_at IS NOT NULL,
            'salida_hecha',  v_bk.checkout_at IS NOT NULL
        ),
        'policia', jsonb_build_object(
            'abre_el',   v_bk.check_in - 7,
            'abierta',   v_hoy >= v_bk.check_in - 7,
            'total',     GREATEST(COALESCE(v_bk.pax_count, 1), 1),
            'rellenas',  v_fichas,
            'completo',  v_fichas >= GREATEST(COALESCE(v_bk.pax_count, 1), 1)
        ),
        'cancelacion', jsonb_build_object(
            'gratis_hasta', v_limite,
            'gratis',       v_hoy <= v_limite
        ),
        'factura', jsonb_build_object(
            'hay',        v_factura.numero IS NOT NULL,
            'numero',     CASE WHEN v_factura.numero IS NOT NULL THEN COALESCE(v_factura.serie || '-', '') || v_factura.numero::text END,
            'mandada_el', v_factura.email_sent_at,
            'no_hace_falta', COALESCE(v_bk.invoice_not_needed, false)
        ),
        'casa', jsonb_build_object(
            'bienvenida',  v_guia.welcome_message,
            'wifi_red',    v_guia.wifi_name,
            'wifi_clave',  v_guia.wifi_password,
            'entrar',      v_guia.checkin_instructions,
            'salir',       v_guia.checkout_instructions,
            'aparcar',     v_guia.parking_info,
            'normas',      v_guia.house_rules,
            'aparatos',    v_guia.appliance_instructions,
            'zona',        v_guia.nearby_recommendations,
            'urgencias',   v_guia.emergency_contact
        )
    );
END $function$;


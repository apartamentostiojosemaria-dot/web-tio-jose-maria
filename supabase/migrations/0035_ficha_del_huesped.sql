-- 0035 — La ficha del huésped se puede leer con el código de la reserva.
--
-- /guia/<código> daba «No encontramos tu reserva» porque leía guest_bookings
-- sin sesión, y la base (bien) no lo permite. Lo mismo le pasaba a
-- /reservar/confirmada, la pantalla de después del pago. Aquí va la lectura
-- pública, con la misma idea que tjm_precheckin_reserva (migración 0014/0018):
-- una función que devuelve SOLO lo que la ficha necesita, y nada cuando la
-- reserva no está viva.
--
-- Cuándo está viva (decidido con Jesús el 18-sep-2026): desde que se confirma
-- hasta 30 días después de la salida. Cancelada, caducada, a medio pagar o
-- «no se presentó» → solo el motivo, sin datos.

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
            'aparcar',     v_guia.parking_info,
            'normas',      v_guia.house_rules,
            'aparatos',    v_guia.appliance_instructions,
            'zona',        v_guia.nearby_recommendations,
            'urgencias',   v_guia.emergency_contact
        )
    );
END $function$;

REVOKE ALL ON FUNCTION public.tjm_ficha_huesped(text) FROM public;
GRANT EXECUTE ON FUNCTION public.tjm_ficha_huesped(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.tjm_ficha_huesped(text) IS
    'Lo que ve el huésped en /guia/<código>: su reserva, el estado de los datos de la policía, la cancelación, la factura y el manual del apartamento. Viva desde la confirmación hasta 30 días después de la salida.';

-- ---------------------------------------------------------------------------
-- El manual de la casa, con lo que hoy sabemos de verdad (guía del huésped
-- de abril + decisiones del 18-sep: llaves en mano, sin chimenea, toallas a
-- petición). El WiFi se queda en blanco hasta que Mari Carmen dé la red de
-- cada apartamento; se edita desde /admin → Guía del huésped.
-- ---------------------------------------------------------------------------
UPDATE public.guidebooks g SET
    welcome_message = 'Bienvenidos a ' || a.name || '. Aquí tenéis por escrito lo que os contamos al daros las llaves, por si os hace falta.',
    checkin_instructions = E'Entrada a partir de las 16:00. Las llaves os las damos en mano al llegar. Si vais a llegar después de las 21:00, avisadnos por WhatsApp y os decimos cómo lo hacemos.\nSalida antes de las 12:00: dejad las llaves en la mesa del salón, ventanas cerradas y luces apagadas.',
    parking_info = 'Se aparca gratis en la calle, justo enfrente de la casa.',
    house_rules = E'- Respetad el descanso de los vecinos a partir de las 23:00.\n- No se admiten mascotas.\n- No se fuma dentro.\n- No se hacen fiestas.\n- Apagad luces y calefacción al salir.',
    appliance_instructions = E'Calefacción: radiadores eléctricos; el termostato está en el salón.\nCocina: vitrocerámica, horno, microondas, nevera, cafetera italiana y tostadora. Hay aceite, sal y especias básicas.\nToallas y sábanas: no hay servicio de habitaciones; si estáis varios días y necesitáis un cambio, decídnoslo y os lo reponemos.\nBasura: en los contenedores de la plaza.',
    nearby_recommendations = NULL,
    emergency_contact = E'Nosotros: WhatsApp o teléfono 676 34 46 75.\nEmergencias: 112.\nCentro de Salud de Pozo Alcón: 953 105 066 (urgencias 953 366 144).\nFarmacia de Hinojares: Callejón Escuelas, 8.',
    updated_at = now()
FROM public.apartments a
WHERE a.id = g.apartment_id;

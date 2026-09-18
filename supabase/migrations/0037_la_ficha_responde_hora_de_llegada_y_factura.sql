-- 0037 — La ficha del huésped responde lo que hoy se pregunta por WhatsApp.
--
-- Dos cosas que Mari Carmen pregunta o le piden por WhatsApp y hay que
-- copiar a mano: «¿a qué hora llegáis?» y «necesito factura». Desde hoy el
-- huésped lo dice en su ficha (/guia/<código>) y a ella le sale en el panel:
-- la hora en la ficha de la reserva y en «Llegan hoy», y la petición de
-- factura con los datos ya puestos en la hoja de factura.
--
-- Las dos funciones son públicas (anon), pero solo funcionan con el código
-- de una reserva viva: el código es la llave, igual que en el precheckin.

ALTER TABLE public.guest_bookings
    ADD COLUMN IF NOT EXISTS hora_llegada_prevista time,
    ADD COLUMN IF NOT EXISTS factura_pedida_at timestamptz,
    ADD COLUMN IF NOT EXISTS factura_datos jsonb;

COMMENT ON COLUMN public.guest_bookings.hora_llegada_prevista IS 'La hora a la que el huésped dice que llega (la pone él en su ficha).';
COMMENT ON COLUMN public.guest_bookings.factura_pedida_at IS 'Cuándo pidió la factura desde su ficha.';
COMMENT ON COLUMN public.guest_bookings.factura_datos IS 'Datos que dio para la factura: {nombre, nif, direccion, email}. issue-invoice los usa como receptor.';

-- Una reserva «viva» para la ficha: confirmada o terminada hace menos de 30 días.
CREATE OR REPLACE FUNCTION public.tjm_ficha_reserva_viva(p_booking_code text)
 RETURNS bigint
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT b.id FROM public.guest_bookings b
     WHERE b.booking_code = upper(btrim(COALESCE(p_booking_code, '')))
       AND b.status IN ('confirmed', 'completed')
       AND (now() AT TIME ZONE 'Europe/Madrid')::date <= b.check_out + 30
     LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.tjm_ficha_reserva_viva(text) FROM public, anon;

CREATE OR REPLACE FUNCTION public.tjm_ficha_avisar_llegada(p_booking_code text, p_hora text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_id   bigint := public.tjm_ficha_reserva_viva(p_booking_code);
    v_hora time;
BEGIN
    IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'reserva_no_viva'); END IF;
    IF p_hora IS NULL OR p_hora = '' THEN
        UPDATE public.guest_bookings SET hora_llegada_prevista = NULL, updated_at = now() WHERE id = v_id;
        RETURN jsonb_build_object('ok', true, 'hora', NULL);
    END IF;
    IF p_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'hora_invalida');
    END IF;
    v_hora := p_hora::time;
    UPDATE public.guest_bookings SET hora_llegada_prevista = v_hora, updated_at = now() WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'hora', to_char(v_hora, 'HH24:MI'));
END $function$;
REVOKE ALL ON FUNCTION public.tjm_ficha_avisar_llegada(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.tjm_ficha_avisar_llegada(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tjm_ficha_pedir_factura(
    p_booking_code text, p_nombre text, p_nif text, p_direccion text, p_email text DEFAULT NULL
) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_id bigint := public.tjm_ficha_reserva_viva(p_booking_code);
BEGIN
    IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'reserva_no_viva'); END IF;
    IF length(btrim(COALESCE(p_nombre, ''))) < 3 OR length(btrim(COALESCE(p_nif, ''))) < 5
       OR length(btrim(COALESCE(p_direccion, ''))) < 5 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'datos_incompletos');
    END IF;
    IF COALESCE(p_email, '') <> '' AND p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'email_invalido');
    END IF;
    UPDATE public.guest_bookings
       SET factura_pedida_at = now(),
           factura_datos = jsonb_build_object(
               'nombre', left(btrim(p_nombre), 120), 'nif', upper(left(btrim(p_nif), 20)),
               'direccion', left(btrim(p_direccion), 200), 'email', NULLIF(lower(btrim(COALESCE(p_email, ''))), '')),
           invoice_not_needed = false,
           updated_at = now()
     WHERE id = v_id;
    RETURN jsonb_build_object('ok', true);
END $function$;
REVOKE ALL ON FUNCTION public.tjm_ficha_pedir_factura(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.tjm_ficha_pedir_factura(text, text, text, text, text) TO anon, authenticated, service_role;

-- La ficha devuelve además la hora avisada y si la factura ya está pedida.
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
           b.total_price, b.checkin_at, b.checkout_at, b.invoice_not_needed,
           b.hora_llegada_prevista, b.factura_pedida_at, b.factura_datos
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
            'salida_hecha',  v_bk.checkout_at IS NOT NULL,
            'hora_llegada',  CASE WHEN v_bk.hora_llegada_prevista IS NOT NULL THEN to_char(v_bk.hora_llegada_prevista, 'HH24:MI') END
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
            'no_hace_falta', COALESCE(v_bk.invoice_not_needed, false),
            'pedida_el',  v_bk.factura_pedida_at,
            'pedida_a',   v_bk.factura_datos -> 'nombre'
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

-- 0080 · Avisos al móvil claros y que abren lo que dicen (5-nov-2026)
-- ====================================================================
-- Jesús (5-nov): «los avisos no llegan claros: llegan palabras en inglés y, cuando pinchas el aviso,
-- no te abre lo que marca el aviso; te abre la aplicación simplemente».
-- Medido en `envios` (canal push): todos iban a '/panel'; el de salud del correo decía
-- «Dominio en Resend: verified · DKIM en DNS…»; el de correo rebotado pegaba el motivo técnico del
-- proveedor (en inglés). Desde aquí:
--   · Los avisos de una reserva abren la ficha de ESA reserva (`tjm_url_reserva`).
--   · Textos en castellano llano, sin nombres de proveedores ni términos técnicos: lo técnico queda
--     en la tarea del sistema (para nosotros), no en el móvil de la familia.
--   · push-enviar (v. 5-nov) además corta por palabras y, si el aviso cita un TJM-XXXXXX, abre esa reserva.

CREATE OR REPLACE FUNCTION public.tjm_url_reserva(p_id bigint, p_abrir text DEFAULT NULL)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT '/panel?s=reserva&p=' ||
        replace(replace(replace(replace(replace(
            (jsonb_build_object('reservaId', p_id)
             || CASE WHEN p_abrir IS NOT NULL THEN jsonb_build_object('abrir', p_abrir) ELSE '{}'::jsonb END)::text,
        ' ', ''), '{', '%7B'), '}', '%7D'), '"', '%22'), ':', '%3A')
$$;
REVOKE ALL ON FUNCTION public.tjm_url_reserva(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tjm_url_reserva(bigint, text) TO service_role;

-- a) Reserva nueva → su ficha
CREATE OR REPLACE FUNCTION public.tjm_avisar_reserva_nueva()
 RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_apt text;
BEGIN
    IF NEW.status <> 'confirmed' OR COALESCE(NEW.source, '') = 'test' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN RETURN NEW; END IF;
    SELECT name INTO v_apt FROM public.apartments WHERE id = NEW.apartment_id;
    PERFORM public.tjm_notificar_push(
        'Reserva nueva',
        COALESCE(NEW.guest_name, 'Sin nombre') || ' · ' || COALESCE(v_apt, '') || ' · del ' ||
            to_char(NEW.check_in, 'DD/MM') || ' al ' || to_char(NEW.check_out, 'DD/MM') ||
            CASE WHEN lower(COALESCE(NEW.channel, '')) IN ('booking','airbnb','holidu','escapada','casasrurales') THEN ' · por ' || initcap(NEW.channel) ELSE '' END,
        public.tjm_url_reserva(NEW.id));
    RETURN NEW;
END $function$;

-- b) Datos de la policía rellenos → su ficha, con la hoja del parte abierta
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
            CASE WHEN v_bk.check_in = current_date THEN '. Cuando les des la llave, termina el check-in.' ELSE '.' END,
        public.tjm_url_reserva(v_bk.id, 'parte'));
    RETURN NEW;
END $function$;

-- c) Hora de llegada → su ficha
CREATE OR REPLACE FUNCTION public.tjm_ficha_avisar_llegada(p_booking_code text, p_hora text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_id   bigint := public.tjm_ficha_reserva_viva(p_booking_code);
    v_hora time;
    v_bk   record;
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
    UPDATE public.guest_bookings SET hora_llegada_prevista = v_hora, updated_at = now() WHERE id = v_id
     RETURNING guest_name, source, check_in INTO v_bk;
    IF COALESCE(v_bk.source, '') <> 'test' THEN
        PERFORM public.tjm_notificar_push('Han dicho a qué hora llegan',
            COALESCE(v_bk.guest_name, '') || ' · ' || CASE WHEN v_bk.check_in = current_date THEN 'hoy' ELSE 'el ' || to_char(v_bk.check_in, 'DD/MM') END || ' sobre las ' || to_char(v_hora, 'HH24:MI'),
            public.tjm_url_reserva(v_id));
    END IF;
    RETURN jsonb_build_object('ok', true, 'hora', to_char(v_hora, 'HH24:MI'));
END $function$;

-- d) Piden factura → su ficha, con la hoja de factura abierta
CREATE OR REPLACE FUNCTION public.tjm_ficha_pedir_factura(p_booking_code text, p_nombre text, p_nif text, p_direccion text, p_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_id bigint := public.tjm_ficha_reserva_viva(p_booking_code);
    v_bk record;
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
     WHERE id = v_id
     RETURNING guest_name, source INTO v_bk;
    IF COALESCE(v_bk.source, '') <> 'test' THEN
        PERFORM public.tjm_notificar_push('Han pedido factura', COALESCE(v_bk.guest_name, '') || ' · a nombre de ' || left(btrim(p_nombre), 60),
            public.tjm_url_reserva(v_id, 'factura'));
    END IF;
    RETURN jsonb_build_object('ok', true);
END $function$;

-- e) Un correo a un huésped no ha llegado → en llano, con qué hacer, y abre su reserva.
--    El motivo técnico del proveedor (en inglés) queda solo en la tarea del sistema.
CREATE OR REPLACE FUNCTION public.tjm_registrar_evento_correo(p_proveedor_id text, p_tipo text, p_destinatario text, p_asunto text, p_detalle text DEFAULT NULL::text, p_cuando timestamp with time zone DEFAULT now())
 RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_estado   text;
    v_malo     boolean := false;
    v_fila     public.envios%ROWTYPE;
    v_quien    text;
BEGIN
    IF COALESCE(p_proveedor_id, '') = '' THEN RETURN NULL; END IF;

    v_estado := CASE p_tipo
        WHEN 'email.sent'             THEN 'enviado'
        WHEN 'email.delivered'        THEN 'entregado'
        WHEN 'email.delivery_delayed' THEN 'retrasado'
        WHEN 'email.bounced'          THEN 'rebotado'
        WHEN 'email.complained'       THEN 'queja'
        WHEN 'email.failed'           THEN 'fallido'
        ELSE NULL END;
    IF v_estado IS NULL THEN RETURN NULL; END IF;
    v_malo := v_estado IN ('rebotado', 'queja', 'fallido');

    INSERT INTO public.envios (canal, proveedor_id, destinatario, asunto, booking_id, booking_code, estado, detalle, eventos, created_at)
    VALUES ('correo', p_proveedor_id, p_destinatario, p_asunto,
            public.tjm_reserva_por_codigo_en_texto(p_asunto),
            (regexp_match(COALESCE(p_asunto, ''), 'TJM-[A-Za-z0-9]{6}'))[1],
            v_estado, p_detalle,
            jsonb_build_array(jsonb_build_object('cuando', p_cuando, 'tipo', p_tipo, 'detalle', p_detalle)),
            p_cuando)
    ON CONFLICT (proveedor_id) DO UPDATE SET
        estado = CASE
            WHEN EXCLUDED.estado = 'enviado' AND public.envios.estado <> 'enviado' THEN public.envios.estado
            ELSE EXCLUDED.estado END,
        destinatario = COALESCE(public.envios.destinatario, EXCLUDED.destinatario),
        asunto       = COALESCE(public.envios.asunto, EXCLUDED.asunto),
        booking_id   = COALESCE(public.envios.booking_id, EXCLUDED.booking_id),
        booking_code = COALESCE(public.envios.booking_code, EXCLUDED.booking_code),
        detalle      = COALESCE(EXCLUDED.detalle, public.envios.detalle),
        eventos      = public.envios.eventos || EXCLUDED.eventos,
        updated_at   = now()
    RETURNING * INTO v_fila;

    IF v_malo THEN
        v_quien := COALESCE(v_fila.booking_code, v_fila.destinatario, '');
        PERFORM public.tjm_notificar_push(
            'Un correo no le ha llegado al huésped',
            left('«' || COALESCE(v_fila.asunto, 'Correo') || '» a ' || COALESCE(v_fila.destinatario, 'su dirección')
                 || '. Llámale o escríbele por WhatsApp.', 230),
            CASE WHEN v_fila.booking_id IS NOT NULL THEN public.tjm_url_reserva(v_fila.booking_id) ELSE '/panel' END);
        PERFORM public.tjm_tarea_del_sistema(
            'Correos que no han llegado',
            to_char(p_cuando AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI') || ' · ' || v_estado || ' · '
                || COALESCE(v_fila.asunto, '') || ' → ' || COALESCE(v_fila.destinatario, '')
                || CASE WHEN v_quien <> '' THEN ' (' || v_quien || ')' ELSE '' END
                || CASE WHEN p_detalle IS NOT NULL THEN ' — ' || p_detalle ELSE '' END);
    END IF;
    RETURN v_estado;
END $function$;

-- f) Salud del correo: a la familia, en llano y qué hacer; el detalle técnico, en la tarea del sistema.
CREATE OR REPLACE FUNCTION public.tjm_anotar_salud_correo(p_ok boolean, p_dominio text, p_dkim boolean, p_fallidos integer, p_detalle jsonb)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_antes boolean;
BEGIN
    SELECT ok INTO v_antes FROM public.salud_correo ORDER BY comprobado_at DESC LIMIT 1;
    INSERT INTO public.salud_correo (ok, dominio_estado, dkim_ok, fallidos_24h, detalle)
    VALUES (p_ok, p_dominio, p_dkim, p_fallidos, COALESCE(p_detalle, '{}'::jsonb));
    DELETE FROM public.salud_correo WHERE id NOT IN (SELECT id FROM public.salud_correo ORDER BY comprobado_at DESC LIMIT 60);

    IF NOT p_ok THEN
        -- Solo la primera vez que falla (antes avisaba cada mañana mientras durase)
        IF v_antes IS DISTINCT FROM false THEN
            PERFORM public.tjm_notificar_push(
                'Puede que algún correo a los huéspedes no salga',
                CASE WHEN p_fallidos > 0
                     THEN 'En las últimas 24 horas no ha salido ' || p_fallidos || CASE WHEN p_fallidos = 1 THEN ' correo' ELSE ' correos' END || '. '
                     ELSE '' END
                || 'Si esperas que un huésped reciba algo importante, escríbele también por WhatsApp. Lo estamos mirando.',
                '/panel');
        END IF;
        PERFORM public.tjm_tarea_del_sistema(
            'El correo del sistema tiene un problema',
            to_char(now() AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI') || ' · dominio ' || COALESCE(p_dominio, '?')
                || ' · DKIM ' || CASE WHEN p_dkim THEN 'ok' ELSE 'FALTA (resend._domainkey en Hostinger)' END
                || ' · fallidos 24 h: ' || p_fallidos);
    ELSIF v_antes IS FALSE THEN
        PERFORM public.tjm_notificar_push('Los correos a los huéspedes vuelven a salir bien', 'Ya está arreglado. No hace falta hacer nada.', '/panel');
        UPDATE public.internal_tasks SET status = 'done', last_completed_at = now(), completion_notes = 'Resuelto solo: la comprobación ha vuelto a salir bien.', updated_at = now()
         WHERE title = 'El correo del sistema tiene un problema' AND status = 'pending';
    END IF;
END $function$;

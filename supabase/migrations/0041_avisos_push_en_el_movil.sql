-- 0041 — Avisos push en el móvil de Mari Carmen.
--
-- Jesús, 18-sep-2026: «¿tiene avisos push la aplicación?». No los tenía. El
-- correo al buzón del negocio (0040) sirve si se mira el Gmail; el móvil
-- vibrando en el bolsillo, siempre.
--
-- Piezas:
--   · push_subscriptions: una fila por móvil que dijo «avísame» (endpoint +
--     claves que da el navegador). Cada usuario ve y borra solo las suyas.
--   · Las claves VAPID viven en Vault (push_vapid_public / push_vapid_private),
--     como los secretos del MIR (0027). La pública la lee el panel por una
--     función; la privada solo la edge function push-enviar con la clave de
--     servicio. Los VALORES se cargan fuera del repo con vault.create_secret.
--   · tjm_notificar_push(titulo, texto, url): la base llama a push-enviar con la
--     llave del cron (misma idea que tjm_disparar_ses). La usan los mismos
--     sitios que hoy mandan correo: rellenan la policía, reserva nueva, piden
--     factura, avisan de la hora.

-- 1) Dónde se apuntan los móviles
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id           bigserial PRIMARY KEY,
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint     text NOT NULL UNIQUE,
    p256dh       text NOT NULL,
    auth         text NOT NULL,
    user_agent   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_ok_at   timestamptz,
    failed_at    timestamptz,
    fail_reason  text
);
COMMENT ON TABLE public.push_subscriptions IS 'Móviles que aceptaron los avisos del panel (Web Push). Una fila por navegador/dispositivo.';

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.push_subscriptions_id_seq TO authenticated;

-- 2) Huecos en Vault (vacíos: los valores se cargan aparte)
DO $$
DECLARE v_nombre text;
BEGIN
    FOREACH v_nombre IN ARRAY ARRAY['push_vapid_public', 'push_vapid_private'] LOOP
        IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = v_nombre) THEN
            PERFORM vault.create_secret('', v_nombre, 'Web Push (VAPID). Migración 0041.');
        END IF;
    END LOOP;
END $$;

-- La pública, para el panel (solo quien gestiona).
CREATE OR REPLACE FUNCTION public.tjm_push_clave_publica()
 RETURNS text
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT CASE WHEN public.tjm_puede_gestionar()
                THEN (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_vapid_public' LIMIT 1)
           END;
$$;
REVOKE ALL ON FUNCTION public.tjm_push_clave_publica() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tjm_push_clave_publica() TO authenticated, service_role;

-- Las dos claves y la llave del cron, solo para push-enviar (clave de servicio).
CREATE OR REPLACE FUNCTION public.tjm_secretos_push()
 RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT COALESCE(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
      FROM vault.decrypted_secrets
     WHERE name IN ('push_vapid_public', 'push_vapid_private', 'ses_cron_token');
$$;
REVOKE ALL ON FUNCTION public.tjm_secretos_push() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tjm_secretos_push() TO service_role;

-- 3) La base avisa: una llamada, un aviso a todos los móviles apuntados.
CREATE OR REPLACE FUNCTION public.tjm_notificar_push(p_titulo text, p_texto text, p_url text DEFAULT '/panel')
 RETURNS bigint
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_llave text;
    v_id    bigint;
BEGIN
    SELECT decrypted_secret INTO v_llave FROM vault.decrypted_secrets WHERE name = 'ses_cron_token' LIMIT 1;
    IF COALESCE(btrim(v_llave), '') = '' THEN RETURN NULL; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE failed_at IS NULL) THEN RETURN NULL; END IF;

    SELECT net.http_post(
        url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/push-enviar',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_llave),
        body    := jsonb_build_object('titulo', p_titulo, 'texto', p_texto, 'url', COALESCE(p_url, '/panel'))
    ) INTO v_id;
    RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.tjm_notificar_push(text, text, text) FROM public, anon, authenticated;

-- 4) Quién avisa
-- a) Rellenan los datos de la policía (0040): además del correo, el móvil.
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
        headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00'),
        body    := jsonb_build_object('bookingCode', v_bk.booking_code, 'template', 'operator_precheckin_done')
    );

    SELECT string_agg(COALESCE(NULLIF(btrim(nombre), ''), '—'), ' y ' ORDER BY is_titular DESC, created_at)
      INTO v_nombres FROM public.traveler_records WHERE booking_id = v_bk.id;
    PERFORM public.tjm_notificar_push(
        'Ya han rellenado los datos de la policía',
        COALESCE(v_nombres, v_bk.guest_name, 'Los huéspedes') || ' · ' || COALESCE(v_bk.apartamento, '') ||
            CASE WHEN v_bk.check_in = current_date THEN '. Cuando les des la llave, termina el check-in.' ELSE '.' END,
        '/panel');
    RETURN NEW;
END $function$;

-- b) Reserva nueva confirmada (web, panel o canal).
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
        '/panel');
    RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_avisar_reserva_nueva ON public.guest_bookings;
CREATE TRIGGER trg_avisar_reserva_nueva
    AFTER INSERT OR UPDATE OF status ON public.guest_bookings
    FOR EACH ROW EXECUTE FUNCTION public.tjm_avisar_reserva_nueva();

-- c) Piden factura desde su ficha.
CREATE OR REPLACE FUNCTION public.tjm_ficha_pedir_factura(
    p_booking_code text, p_nombre text, p_nif text, p_direccion text, p_email text DEFAULT NULL
) RETURNS jsonb
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
        PERFORM public.tjm_notificar_push('Han pedido factura', COALESCE(v_bk.guest_name, '') || ' · a nombre de ' || left(btrim(p_nombre), 60), '/panel');
    END IF;
    RETURN jsonb_build_object('ok', true);
END $function$;

-- d) Avisan de la hora de llegada.
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
            COALESCE(v_bk.guest_name, '') || ' · ' || CASE WHEN v_bk.check_in = current_date THEN 'hoy' ELSE 'el ' || to_char(v_bk.check_in, 'DD/MM') END || ' sobre las ' || to_char(v_hora, 'HH24:MI'), '/panel');
    END IF;
    RETURN jsonb_build_object('ok', true, 'hora', to_char(v_hora, 'HH24:MI'));
END $function$;

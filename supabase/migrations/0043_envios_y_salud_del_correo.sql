-- 0043 — Registro de envíos y salud del correo.
--
-- 20-sep-2026: el DKIM de Resend desapareció del DNS de Hostinger, Resend
-- desverificó el dominio y TODO lo que salía de hola@tiojosemaria.com se
-- quedó en «Failed»… mientras la API contestaba 200 con un id y el panel lo
-- daba por mandado. Nadie lo habría sabido sin entrar en resend.com.
--
-- Jesús: «¿en la plataforma hay algo donde se puedan ver los envíos y los
-- avisos, y cuando hay algún problema?». No lo había. Esto lo pone:
--
--   1. `envios`: una fila por cada correo (a huéspedes o internos) y cada
--      push, con el ESTADO REAL que devuelve Resend por webhook (entregado,
--      rebotado, fallido…). Lo alimentan el webhook (`resend-webhook`),
--      push-enviar y los remitentes.
--   2. `tjm_registrar_evento_correo`: lo que llama el webhook. Un rebote o
--      un fallo → push al móvil + tarea en el panel (una, no una por correo).
--   3. `salud_correo`: la comprobación diaria del dominio (estado en Resend +
--      DKIM en DNS) y de los fallos del día. Cron `tjm-vigilar-correo`.
--   4. `tjm_salud()`: lo que pinta el panel (bloque «El sistema» en Hoy y
--      la pantalla «Correos y avisos» de /admin).

-- ---------------------------------------------------------------------------
-- 1. Envíos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.envios (
    id            bigserial PRIMARY KEY,
    canal         text NOT NULL CHECK (canal IN ('correo', 'push')),
    -- id que da Resend; único por correo. Los push no lo tienen.
    proveedor_id  text UNIQUE,
    tipo          text,                     -- plantilla (confirmation, aviso, otp…)
    destinatario  text,
    asunto        text,
    booking_id    bigint REFERENCES public.guest_bookings(id) ON DELETE SET NULL,
    booking_code  text,
    estado        text NOT NULL DEFAULT 'enviado'
                  CHECK (estado IN ('enviado', 'entregado', 'retrasado', 'rebotado', 'queja', 'fallido', 'error_api')),
    detalle       text,
    eventos       jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.envios IS
    'Todo lo que sale del sistema: correos (estado real por webhook de Resend) y avisos push. Lo enseña /admin → Correos y avisos y el bloque «El sistema» del panel.';
CREATE INDEX IF NOT EXISTS envios_created_idx ON public.envios (created_at DESC);
CREATE INDEX IF NOT EXISTS envios_estado_idx ON public.envios (estado) WHERE estado IN ('rebotado', 'queja', 'fallido', 'error_api');
CREATE INDEX IF NOT EXISTS envios_booking_idx ON public.envios (booking_id);

ALTER TABLE public.envios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS envios_gestion ON public.envios;
CREATE POLICY envios_gestion ON public.envios FOR SELECT TO authenticated USING (public.tjm_puede_gestionar());
GRANT SELECT ON public.envios TO authenticated;
GRANT ALL ON public.envios TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.envios_id_seq TO service_role;

-- El código de reserva viaja en el asunto de casi todos los correos
-- («Reserva confirmada — TJM-1D48AA»). Si está, se engancha la reserva.
CREATE OR REPLACE FUNCTION public.tjm_reserva_por_codigo_en_texto(p_texto text)
 RETURNS bigint
 LANGUAGE sql STABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT b.id FROM public.guest_bookings b
     WHERE b.booking_code = upper((regexp_match(COALESCE(p_texto, ''), 'TJM-[A-Za-z0-9]{6}'))[1])
     LIMIT 1;
$$;

-- Tarea en el panel sin duplicar: si ya hay una pendiente con ese título, se
-- le añade la línea a la descripción y no se crea otra.
CREATE OR REPLACE FUNCTION public.tjm_tarea_del_sistema(p_titulo text, p_linea text, p_prioridad text DEFAULT 'high')
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    UPDATE public.internal_tasks
       SET description = left(COALESCE(description, '') || chr(10) || p_linea, 4000),
           updated_at  = now()
     WHERE title = p_titulo AND status = 'pending';
    IF NOT FOUND THEN
        -- Categoría 'tecnico' (la que ya entiende el calendario de mantenimiento);
        -- lo que marca que la abrió el sistema es assigned_to = 'sistema'.
        INSERT INTO public.internal_tasks (title, description, category, priority, status, scheduled_date, auto_reschedule, assigned_to)
        VALUES (p_titulo, p_linea, 'tecnico', p_prioridad, 'pending', current_date, false, 'sistema');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Un evento de Resend → la fila del envío
-- ---------------------------------------------------------------------------
-- Tipos de Resend: email.sent · email.delivered · email.delivery_delayed ·
-- email.bounced · email.complained · email.failed. `email.sent` crea la fila
-- si el remitente no la había creado (así se registran TODOS los correos,
-- también los de funciones que no se han tocado).
CREATE OR REPLACE FUNCTION public.tjm_registrar_evento_correo(
    p_proveedor_id text, p_tipo text, p_destinatario text, p_asunto text,
    p_detalle text DEFAULT NULL, p_cuando timestamptz DEFAULT now()
)
 RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
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
        -- «entregado» no vuelve a «enviado» si los eventos llegan desordenados.
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
            'Un correo no ha llegado',
            left(COALESCE(v_fila.asunto, 'Correo') || ' → ' || COALESCE(v_fila.destinatario, '') || ' · ' || v_estado
                 || CASE WHEN p_detalle IS NOT NULL THEN ' (' || p_detalle || ')' ELSE '' END, 230),
            '/panel');
        PERFORM public.tjm_tarea_del_sistema(
            'Correos que no han llegado',
            to_char(p_cuando AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI') || ' · ' || v_estado || ' · '
                || COALESCE(v_fila.asunto, '') || ' → ' || COALESCE(v_fila.destinatario, '')
                || CASE WHEN v_quien <> '' THEN ' (' || v_quien || ')' ELSE '' END
                || CASE WHEN p_detalle IS NOT NULL THEN ' — ' || p_detalle ELSE '' END);
    END IF;
    RETURN v_estado;
END $$;
REVOKE ALL ON FUNCTION public.tjm_registrar_evento_correo(text, text, text, text, text, timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tjm_registrar_evento_correo(text, text, text, text, text, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Salud del correo: la comprobación diaria
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salud_correo (
    id             bigserial PRIMARY KEY,
    comprobado_at  timestamptz NOT NULL DEFAULT now(),
    ok             boolean NOT NULL,
    dominio_estado text,          -- lo que dice Resend: verified · pending · failed · …
    dkim_ok        boolean,       -- el TXT resend._domainkey resuelve en DNS
    fallidos_24h   integer NOT NULL DEFAULT 0,
    detalle        jsonb NOT NULL DEFAULT '{}'::jsonb
);
COMMENT ON TABLE public.salud_correo IS 'Una fila por comprobación (cron tjm-vigilar-correo, y a mano desde /admin). Se guardan las últimas 60.';
ALTER TABLE public.salud_correo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS salud_correo_gestion ON public.salud_correo;
CREATE POLICY salud_correo_gestion ON public.salud_correo FOR SELECT TO authenticated USING (public.tjm_puede_gestionar());
GRANT SELECT ON public.salud_correo TO authenticated;
GRANT ALL ON public.salud_correo TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.salud_correo_id_seq TO service_role;

-- La función guarda el resultado, poda y avisa si está mal.
CREATE OR REPLACE FUNCTION public.tjm_anotar_salud_correo(p_ok boolean, p_dominio text, p_dkim boolean, p_fallidos int, p_detalle jsonb)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_antes boolean;
BEGIN
    SELECT ok INTO v_antes FROM public.salud_correo ORDER BY comprobado_at DESC LIMIT 1;
    INSERT INTO public.salud_correo (ok, dominio_estado, dkim_ok, fallidos_24h, detalle)
    VALUES (p_ok, p_dominio, p_dkim, p_fallidos, COALESCE(p_detalle, '{}'::jsonb));
    DELETE FROM public.salud_correo WHERE id NOT IN (SELECT id FROM public.salud_correo ORDER BY comprobado_at DESC LIMIT 60);

    IF NOT p_ok THEN
        PERFORM public.tjm_notificar_push(
            'El correo del sistema tiene un problema',
            left('Dominio en Resend: ' || COALESCE(p_dominio, '?') || ' · DKIM en DNS: ' || CASE WHEN p_dkim THEN 'sí' ELSE 'NO' END
                 || ' · fallidos 24 h: ' || p_fallidos || '. Los correos a huéspedes pueden no estar saliendo.', 230),
            '/panel');
        PERFORM public.tjm_tarea_del_sistema(
            'El correo del sistema tiene un problema',
            to_char(now() AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI') || ' · dominio ' || COALESCE(p_dominio, '?')
                || ' · DKIM ' || CASE WHEN p_dkim THEN 'ok' ELSE 'FALTA (resend._domainkey en Hostinger)' END
                || ' · fallidos 24 h: ' || p_fallidos);
    ELSIF v_antes IS FALSE THEN
        PERFORM public.tjm_notificar_push('El correo del sistema vuelve a funcionar', 'Dominio verificado y sin fallos.', '/panel');
        UPDATE public.internal_tasks SET status = 'done', last_completed_at = now(), completion_notes = 'Resuelto solo: la comprobación ha vuelto a salir bien.', updated_at = now()
         WHERE title = 'El correo del sistema tiene un problema' AND status = 'pending';
    END IF;
END $$;
REVOKE ALL ON FUNCTION public.tjm_anotar_salud_correo(boolean, text, boolean, int, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tjm_anotar_salud_correo(boolean, text, boolean, int, jsonb) TO service_role;

-- Quién llama a la función de correo desde la base (misma idea que tjm_disparar_ses).
CREATE OR REPLACE FUNCTION public.tjm_disparar_correo(p_accion text)
 RETURNS bigint
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_llave text; v_id bigint;
BEGIN
    SELECT decrypted_secret INTO v_llave FROM vault.decrypted_secrets WHERE name = 'ses_cron_token' LIMIT 1;
    IF COALESCE(btrim(v_llave), '') = '' THEN RETURN NULL; END IF;
    SELECT net.http_post(
        url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/resend-webhook?accion=' || p_accion,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_llave),
        body    := '{}'::jsonb,
        timeout_milliseconds := 30000
    ) INTO v_id;
    RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.tjm_disparar_correo(text) FROM public, anon, authenticated;

SELECT cron.unschedule('tjm-vigilar-correo') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-vigilar-correo');
SELECT cron.schedule('tjm-vigilar-correo', '30 7 * * *', $cron$SELECT public.tjm_disparar_correo('vigilar');$cron$);

-- ---------------------------------------------------------------------------
-- 4. Lo que pinta el panel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tjm_salud()
 RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_correo  jsonb;
    v_envios  jsonb;
    v_partes  jsonb;
    v_crons   jsonb;
    v_tareas  jsonb;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RAISE EXCEPTION 'sin_permiso' USING ERRCODE = '42501';
    END IF;

    SELECT to_jsonb(s) INTO v_correo FROM (
        SELECT ok, comprobado_at, dominio_estado, dkim_ok, fallidos_24h, detalle
          FROM public.salud_correo ORDER BY comprobado_at DESC LIMIT 1
    ) s;

    SELECT jsonb_build_object(
        'total_24h',    count(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
        'fallidos_24h', count(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND estado IN ('rebotado', 'queja', 'fallido', 'error_api')),
        'fallidos_7d',  count(*) FILTER (WHERE created_at >= now() - interval '7 days'  AND estado IN ('rebotado', 'queja', 'fallido', 'error_api')),
        'ultimos_fallidos', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', e.id, 'cuando', e.created_at, 'canal', e.canal, 'asunto', e.asunto,
                                                'destinatario', e.destinatario, 'estado', e.estado, 'detalle', e.detalle,
                                                'booking_code', e.booking_code, 'guest_name', b.guest_name)
                             ORDER BY e.created_at DESC)
              FROM (SELECT * FROM public.envios
                     WHERE estado IN ('rebotado', 'queja', 'fallido', 'error_api') AND created_at >= now() - interval '7 days'
                     ORDER BY created_at DESC LIMIT 10) e
              LEFT JOIN public.guest_bookings b ON b.id = e.booking_id), '[]'::jsonb),
        'ultimo', (SELECT max(created_at) FROM public.envios)
    ) INTO v_envios FROM public.envios;

    SELECT jsonb_build_object(
        'rechazados', count(DISTINCT booking_id) FILTER (WHERE mir_response_status IN ('error', 'retry')),
        'faltan_datos', count(DISTINCT booking_id) FILTER (WHERE mir_response_status = 'faltan_datos'),
        'esperando', count(DISTINCT booking_id) FILTER (WHERE mir_response_status = 'enviado_pendiente_acuse')
    ) INTO v_partes FROM public.traveler_records;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', j.jobname, 'horario', j.schedule, 'ultimo', r.start_time, 'estado', r.status, 'mensaje', left(r.return_message, 120)) ORDER BY j.jobname), '[]'::jsonb)
      INTO v_crons
      FROM cron.job j
      LEFT JOIN LATERAL (SELECT start_time, status, return_message FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY start_time DESC LIMIT 1) r ON true
     WHERE j.jobname LIKE 'tjm-%';

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'titulo', title, 'descripcion', description, 'desde', created_at) ORDER BY created_at DESC), '[]'::jsonb)
      INTO v_tareas FROM public.internal_tasks WHERE assigned_to = 'sistema' AND status = 'pending';

    RETURN jsonb_build_object(
        'ok', COALESCE((v_correo->>'ok')::boolean, true)
              AND (v_envios->>'fallidos_24h')::int = 0
              AND jsonb_array_length(v_tareas) = 0,
        'correo', v_correo, 'envios', v_envios, 'partes', v_partes, 'crons', v_crons, 'tareas', v_tareas,
        'ahora', now()
    );
END $$;
REVOKE ALL ON FUNCTION public.tjm_salud() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tjm_salud() TO authenticated, service_role;

-- Los envíos, paginados, para la pantalla de /admin.
CREATE OR REPLACE FUNCTION public.tjm_envios(p_solo_fallidos boolean DEFAULT false, p_limite int DEFAULT 100)
 RETURNS TABLE(id bigint, created_at timestamptz, canal text, tipo text, destinatario text, asunto text, estado text, detalle text,
               booking_code text, guest_name text, eventos jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT e.id, e.created_at, e.canal, e.tipo, e.destinatario, e.asunto, e.estado, e.detalle,
           COALESCE(e.booking_code, b.booking_code), b.guest_name, e.eventos
      FROM public.envios e LEFT JOIN public.guest_bookings b ON b.id = e.booking_id
     WHERE public.tjm_puede_gestionar()
       AND (NOT p_solo_fallidos OR e.estado IN ('rebotado', 'queja', 'fallido', 'error_api'))
     ORDER BY e.created_at DESC
     LIMIT LEAST(GREATEST(p_limite, 1), 500);
$$;
REVOKE ALL ON FUNCTION public.tjm_envios(boolean, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tjm_envios(boolean, int) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Secretos en Vault desde la función (solo clave de servicio)
-- ---------------------------------------------------------------------------
-- La firma del webhook de Resend la da de alta la propia función
-- (`?accion=alta-webhook`) y la guarda aquí: no pasa por nadie ni por ningún
-- fichero. La lee al arrancar con tjm_secreto_vault.
CREATE OR REPLACE FUNCTION public.tjm_secreto_vault(p_nombre text)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$ SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_nombre LIMIT 1; $$;
REVOKE ALL ON FUNCTION public.tjm_secreto_vault(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tjm_secreto_vault(text) TO service_role;

CREATE OR REPLACE FUNCTION public.tjm_guardar_secreto_vault(p_nombre text, p_valor text, p_nota text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_id uuid;
BEGIN
    SELECT id INTO v_id FROM vault.secrets WHERE name = p_nombre LIMIT 1;
    IF v_id IS NULL THEN
        PERFORM vault.create_secret(p_valor, p_nombre, COALESCE(p_nota, ''));
    ELSE
        PERFORM vault.update_secret(v_id, p_valor, p_nombre, COALESCE(p_nota, ''));
    END IF;
END $$;
REVOKE ALL ON FUNCTION public.tjm_guardar_secreto_vault(text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tjm_guardar_secreto_vault(text, text, text) TO service_role;

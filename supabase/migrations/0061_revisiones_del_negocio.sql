-- 0061 · Revisiones del negocio (fase 1 del plan del gerente, 16-oct-2026)
--
-- Why: the system stored data but nobody closed the processes. A reservation sat 49 tries
-- without reaching the Ministry, 8 of 12 cleanings were never marked, 5 recurring tasks were
-- overdue with nobody knowing, and a cron could say «succeeded» while the function failed.
-- This migration:
--   1. sends the travellers' report every hour, not once a day (audit 10-oct, F3);
--   2. closes stays on their own (confirmed -> completed the day after check-out) and closes
--      cleanings that obviously happened (the next guest already arrived);
--   3. gives every recurring task an owner and lets the family see and complete theirs;
--   4. creates `tjm_revisiones`: one row per thing that is wrong right now, per process. It is
--      what the manager agent reads every morning, and what the watchdog of crons writes into.

-- ---------------------------------------------------------------------------
-- 1. Travellers' report every hour (F3)
-- ---------------------------------------------------------------------------
SELECT cron.unschedule('tjm-parte-viajeros') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-parte-viajeros');
SELECT cron.schedule('tjm-parte-viajeros', '53 * * * *', $cron$SELECT public.tjm_disparar_ses('tanda');$cron$);

-- ---------------------------------------------------------------------------
-- 2. Stays and cleanings close on their own
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tjm_cerrar_estancias()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_hoy date := (now() AT TIME ZONE 'Europe/Madrid')::date;
    v_estancias int;
    v_limpiezas int;
BEGIN
    UPDATE public.guest_bookings
       SET status = 'completed', updated_at = now()
     WHERE status = 'confirmed' AND check_out < v_hoy;
    GET DIAGNOSTICS v_estancias = ROW_COUNT;

    -- A pending cleaning whose apartment already received the next guest was done:
    -- nobody marked it. It is closed with a note saying so, never deleted.
    UPDATE public.cleaning_tasks c
       SET status = 'done', completed_at = COALESCE(c.completed_at, now()), updated_at = now(),
           notes = concat_ws(' · ', NULLIF(c.notes, ''), 'Cerrada sola: ya entró el siguiente huésped (' || to_char(v_hoy, 'DD/MM') || ')')
     WHERE c.status = 'pending'
       AND EXISTS (
           SELECT 1 FROM public.guest_bookings b
            WHERE b.apartment_id = c.apartment_id
              AND b.status IN ('confirmed', 'completed')
              AND b.check_in >= c.scheduled_date
              AND b.check_in <= v_hoy
              AND b.id IS DISTINCT FROM c.booking_out_id);
    GET DIAGNOSTICS v_limpiezas = ROW_COUNT;

    RETURN jsonb_build_object('estancias_cerradas', v_estancias, 'limpiezas_cerradas', v_limpiezas);
END $function$;

REVOKE ALL ON FUNCTION public.tjm_cerrar_estancias() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('tjm-cerrar-estancias') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-cerrar-estancias');
SELECT cron.schedule('tjm-cerrar-estancias', '10 2 * * *', $cron$SELECT public.tjm_cerrar_estancias();$cron$);

-- ---------------------------------------------------------------------------
-- 3. Recurring tasks: an owner each, and the family completes theirs from the panel
-- ---------------------------------------------------------------------------
-- assigned_to: 'familia' (house, done by Mari Carmen and family) · 'jesus' (money, legal,
-- tax, commercial) · 'sistema' (what the system already watches or does by itself).
UPDATE public.internal_tasks SET assigned_to = 'familia'
 WHERE COALESCE(assigned_to, '') = '' AND category = 'mantenimiento';
UPDATE public.internal_tasks SET assigned_to = 'sistema'
 WHERE COALESCE(assigned_to, '') = '' AND category = 'tecnico';
UPDATE public.internal_tasks SET assigned_to = 'jesus'
 WHERE COALESCE(assigned_to, '') = '';

-- Watched by the system since 0055 (sync every 15 min + alert after 2 h): done by itself.
UPDATE public.internal_tasks
   SET status = 'done', last_completed_at = now(), updated_at = now(),
       completion_notes = 'Retirada el 16-oct-2026: la vigilancia de canales lo comprueba cada hora y avisa sola (migración 0055).'
 WHERE title ILIKE 'Verificar sincronización iCal%' AND status = 'pending';

CREATE OR REPLACE FUNCTION public.tjm_siguiente_fecha(p_fecha date, p_rec text)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $function$
    SELECT CASE p_rec
        WHEN 'monthly'   THEN (p_fecha + interval '1 month')::date
        WHEN 'quarterly' THEN (p_fecha + interval '3 months')::date
        WHEN 'biannual'  THEN (p_fecha + interval '6 months')::date
        WHEN 'annual'    THEN (p_fecha + interval '1 year')::date
        ELSE NULL END
$function$;

-- Same logic as InternalTasksManager.jsx (admin): mark done and create the next one.
CREATE OR REPLACE FUNCTION public.tjm_completar_tarea(p_id uuid, p_notas text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    t public.internal_tasks;
    v_hoy date := (now() AT TIME ZONE 'Europe/Madrid')::date;
    v_sig date;
BEGIN
    IF NOT public.is_staff() THEN RAISE EXCEPTION 'Solo el equipo puede completar tareas'; END IF;
    SELECT * INTO t FROM public.internal_tasks WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No encuentro esa tarea'; END IF;
    IF t.status = 'done' THEN RETURN jsonb_build_object('ok', true, 'ya_estaba', true); END IF;

    UPDATE public.internal_tasks
       SET status = 'done', last_completed_at = now(), completion_notes = NULLIF(btrim(COALESCE(p_notas, '')), ''),
           updated_at = now()
     WHERE id = p_id;

    IF t.recurrence <> 'none' AND t.auto_reschedule THEN
        v_sig := public.tjm_siguiente_fecha(t.scheduled_date, t.recurrence);
        -- an overdue task does not create another one already overdue
        WHILE v_sig IS NOT NULL AND v_sig <= v_hoy LOOP
            v_sig := public.tjm_siguiente_fecha(v_sig, t.recurrence);
        END LOOP;
        INSERT INTO public.internal_tasks
            (title, description, category, scheduled_date, recurrence, status, assigned_to, priority, auto_reschedule)
        VALUES (t.title, t.description, t.category, v_sig, t.recurrence, 'pending', t.assigned_to, t.priority, true);
    END IF;
    RETURN jsonb_build_object('ok', true, 'siguiente', v_sig);
END $function$;

REVOKE ALL ON FUNCTION public.tjm_completar_tarea(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tjm_completar_tarea(uuid, text) TO authenticated;

-- The family's list: their tasks that are overdue or due within p_dias.
CREATE OR REPLACE FUNCTION public.tjm_tareas_casa(p_dias int DEFAULT 14)
RETURNS TABLE (id uuid, title text, description text, scheduled_date date, recurrence text, vencida boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF NOT public.is_staff() THEN RETURN; END IF;
    RETURN QUERY
        SELECT t.id, t.title, t.description, t.scheduled_date, t.recurrence,
               t.scheduled_date < (now() AT TIME ZONE 'Europe/Madrid')::date
          FROM public.internal_tasks t
         WHERE t.status = 'pending' AND t.assigned_to = 'familia'
           AND t.scheduled_date <= (now() AT TIME ZONE 'Europe/Madrid')::date + p_dias
         ORDER BY t.scheduled_date;
END $function$;

REVOKE ALL ON FUNCTION public.tjm_tareas_casa(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tjm_tareas_casa(int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Revisiones: what is wrong right now, per process
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tjm_revisiones (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave         text NOT NULL,                 -- stable id of the problem, e.g. ses_reserva:TJM-8A9D74
    proceso       text NOT NULL,                 -- P5 ministerio · P11 limpieza · P12 mantenimiento · P15 sistema…
    gravedad      text NOT NULL CHECK (gravedad IN ('alta', 'media', 'baja')),
    quien         text NOT NULL CHECK (quien IN ('familia', 'jesus', 'sistema', 'gerente')),
    mensaje       text NOT NULL,
    detalle       jsonb NOT NULL DEFAULT '{}'::jsonb,
    detectado_at  timestamptz NOT NULL DEFAULT now(),
    visto_at      timestamptz NOT NULL DEFAULT now(),
    resuelto_at   timestamptz
);
COMMENT ON TABLE public.tjm_revisiones IS
    'Una fila por problema abierto de un proceso del negocio (fase 1 del gerente, 16-oct-2026). La rellena tjm_revisar() cada hora; se cierra sola (resuelto_at) cuando el problema desaparece. La lee el gerente cada mañana.';
CREATE UNIQUE INDEX IF NOT EXISTS tjm_revisiones_abierta ON public.tjm_revisiones (clave) WHERE resuelto_at IS NULL;

ALTER TABLE public.tjm_revisiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tjm_revisiones_staff_lee ON public.tjm_revisiones;
CREATE POLICY tjm_revisiones_staff_lee ON public.tjm_revisiones FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS tjm_revisiones_service ON public.tjm_revisiones;
CREATE POLICY tjm_revisiones_service ON public.tjm_revisiones FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tjm_revisar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_hoy date := (now() AT TIME ZONE 'Europe/Madrid')::date;
    v_abiertas int;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS _rev (clave text, proceso text, gravedad text, quien text, mensaje text, detalle jsonb) ON COMMIT DROP;
    TRUNCATE _rev;

    -- P5 · reservation not communicated to the Ministry 12 h after it was made
    INSERT INTO _rev
    SELECT 'ses_reserva:' || b.booking_code, 'P5 ministerio', 'alta', 'familia',
           b.booking_code || ' (entrada ' || to_char(b.check_in, 'DD/MM') || ') sin comunicar al Ministerio: ' ||
               COALESCE(s.mensaje, 'sin intento todavía'),
           jsonb_build_object('booking_id', b.id, 'canal', b.channel, 'localizador', b.external_locator, 'intentos', s.intentos)
      FROM public.guest_bookings b
      LEFT JOIN public.ses_comunicaciones s ON s.booking_id = b.id AND s.tipo = 'reserva'
     WHERE b.status IN ('confirmed', 'completed') AND COALESCE(b.source, '') <> 'test'
       AND b.reserva_comunicada_at IS NULL AND b.created_at < now() - interval '12 hours'
       AND b.check_out >= v_hoy
       AND b.created_at >= '2026-09-16';   -- stays before the registration are a closed matter (Jesús)

    -- P5 · travellers' report stuck for people who already arrived
    INSERT INTO _rev
    SELECT 'ses_parte:' || b.booking_code, 'P5 ministerio', 'alta', 'familia',
           'Parte de ' || b.booking_code || ' sin salir (' || max(t.mir_response_status) || '): ' ||
               COALESCE(max(t.mir_response_payload->>'mensaje'), ''),
           jsonb_build_object('booking_id', b.id)
      FROM public.guest_bookings b JOIN public.traveler_records t ON t.booking_id = b.id
     WHERE b.status IN ('confirmed', 'completed') AND b.check_in <= v_hoy AND t.submitted_at IS NULL
       AND COALESCE(b.source, '') <> 'test'
     GROUP BY b.id, b.booking_code;

    -- P5 · in the house since yesterday or before, without a single form
    INSERT INTO _rev
    SELECT 'sin_fichas:' || b.booking_code, 'P5 ministerio', 'alta', 'familia',
           b.booking_code || ' entró el ' || to_char(b.check_in, 'DD/MM') || ' y no hay ninguna ficha de viajeros',
           jsonb_build_object('booking_id', b.id)
      FROM public.guest_bookings b
     WHERE b.status = 'confirmed' AND b.check_in < v_hoy AND b.check_out >= v_hoy
       AND COALESCE(b.source, '') <> 'test'
       AND NOT EXISTS (SELECT 1 FROM public.traveler_records t WHERE t.booking_id = b.id);

    -- P11 · next guest arrives today or tomorrow and the previous cleaning is not marked
    INSERT INTO _rev
    SELECT 'limpieza:' || c.id, 'P11 limpieza', 'media', 'familia',
           'Limpieza de ' || a.name || ' del ' || to_char(c.scheduled_date, 'DD/MM') || ' sin marcar; el siguiente huésped llega el ' ||
               to_char(nb.check_in, 'DD/MM'),
           jsonb_build_object('cleaning_id', c.id, 'llegada', nb.check_in)
      FROM public.cleaning_tasks c
      JOIN public.apartments a ON a.id = c.apartment_id
      JOIN LATERAL (
          SELECT b.check_in FROM public.guest_bookings b
           WHERE b.apartment_id = c.apartment_id AND b.status = 'confirmed' AND b.check_in >= c.scheduled_date
           ORDER BY b.check_in LIMIT 1) nb ON true
     WHERE c.status = 'pending' AND nb.check_in <= v_hoy + 1;

    -- P12 · recurring tasks overdue (or due within 7 days, low)
    INSERT INTO _rev
    SELECT 'tarea:' || t.id, 'P12 mantenimiento',
           CASE WHEN t.scheduled_date < v_hoy THEN 'media' ELSE 'baja' END,
           CASE WHEN t.assigned_to IN ('familia', 'jesus', 'sistema') THEN t.assigned_to ELSE 'jesus' END,
           t.title || CASE WHEN t.scheduled_date < v_hoy THEN ' · vencida el ' ELSE ' · vence el ' END || to_char(t.scheduled_date, 'DD/MM'),
           jsonb_build_object('task_id', t.id, 'categoria', t.category)
      FROM public.internal_tasks t
     WHERE t.status = 'pending' AND t.scheduled_date <= v_hoy + 7;

    -- P15 · a cron that failed in the last 26 h
    INSERT INTO _rev
    SELECT 'cron:' || j.jobname, 'P15 sistema', 'alta', 'gerente',
           'La tarea programada ' || j.jobname || ' falló ' || count(*) || ' vez/veces en 26 h: ' || left(max(d.return_message), 160),
           jsonb_build_object('fallos', count(*), 'ultimo', max(d.start_time))
      FROM cron.job_run_details d JOIN cron.job j USING (jobid)
     WHERE d.start_time > now() - interval '26 hours' AND d.status NOT IN ('succeeded', 'running', 'starting')
     GROUP BY j.jobname;

    -- P15 · the cron «succeeded» but the function answered with an error (audit P3)
    INSERT INTO _rev
    SELECT 'http_error', 'P15 sistema', 'media', 'gerente',
           count(*) || ' llamadas a funciones con error en las últimas 2 h (la tarea programada consta como correcta)',
           jsonb_build_object('ejemplos', jsonb_agg(left(COALESCE(r.error_msg, r.content::text), 160)) )
      FROM net._http_response r
     WHERE r.created > now() - interval '2 hours'
       AND (r.timed_out OR r.status_code >= 400 OR r.error_msg IS NOT NULL)
    HAVING count(*) > 0;

    -- P15 · the hourly report batch has not run fine for 3 h
    INSERT INTO _rev
    SELECT 'tanda_parada', 'P15 sistema', 'alta', 'gerente',
           'La tanda del parte de viajeros no ha corrido bien en las últimas 3 h', '{}'::jsonb
     WHERE NOT EXISTS (
         SELECT 1 FROM cron.job_run_details d JOIN cron.job j USING (jobid)
          WHERE j.jobname = 'tjm-parte-viajeros' AND d.status = 'succeeded' AND d.start_time > now() - interval '3 hours')
       AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-parte-viajeros' AND active);

    -- P2 · a portal calendar not synced fine for 2 h
    INSERT INTO _rev
    SELECT 'canal:' || l.channel || ':' || l.apartment_id, 'P2 canales', 'alta', 'gerente',
           'El calendario de ' || l.channel || ' (apartamento ' || l.apartment_id || ') no se sincroniza bien desde ' ||
               to_char(max(l.ran_at) FILTER (WHERE l.ok) AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI'),
           jsonb_build_object('ultimo_ok', max(l.ran_at) FILTER (WHERE l.ok))
      FROM public.channel_sync_log l
     WHERE l.ran_at > now() - interval '7 days'
     GROUP BY l.channel, l.apartment_id
    HAVING COALESCE(max(l.ran_at) FILTER (WHERE l.ok), 'epoch') < now() - interval '2 hours';

    -- P9 · e-mail to guests not healthy (last check)
    INSERT INTO _rev
    SELECT 'correo', 'P9 comunicacion', 'alta', 'gerente',
           'La última comprobación del correo a huéspedes falló (' || COALESCE(s.dominio_estado, '?') || ', ' ||
               COALESCE(s.fallidos_24h, 0) || ' fallidos en 24 h)',
           jsonb_build_object('comprobado_at', s.comprobado_at)
      FROM (SELECT * FROM public.salud_correo ORDER BY comprobado_at DESC LIMIT 1) s
     WHERE s.ok IS FALSE;

    -- open the new ones, refresh the ones still there, close the ones that vanished
    INSERT INTO public.tjm_revisiones (clave, proceso, gravedad, quien, mensaje, detalle)
    SELECT r.clave, r.proceso, r.gravedad, r.quien, r.mensaje, r.detalle FROM _rev r
    ON CONFLICT (clave) WHERE resuelto_at IS NULL
    DO UPDATE SET mensaje = EXCLUDED.mensaje, detalle = EXCLUDED.detalle, gravedad = EXCLUDED.gravedad,
                  quien = EXCLUDED.quien, visto_at = now();

    UPDATE public.tjm_revisiones v SET resuelto_at = now()
     WHERE v.resuelto_at IS NULL AND NOT EXISTS (SELECT 1 FROM _rev r WHERE r.clave = v.clave);

    SELECT count(*) INTO v_abiertas FROM public.tjm_revisiones WHERE resuelto_at IS NULL;
    RETURN jsonb_build_object('abiertas', v_abiertas, 'detectadas_ahora', (SELECT count(*) FROM _rev));
END $function$;

REVOKE ALL ON FUNCTION public.tjm_revisar() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('tjm-revisar') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-revisar');
SELECT cron.schedule('tjm-revisar', '40 * * * *', $cron$SELECT public.tjm_revisar();$cron$);

-- Morning note to the family's phones: only what is theirs, only if there is something.
CREATE OR REPLACE FUNCTION public.tjm_aviso_familia()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_lineas text;
    v_n int;
BEGIN
    PERFORM public.tjm_revisar();
    SELECT count(*), string_agg('• ' || mensaje, E'\n' ORDER BY gravedad, detectado_at)
      INTO v_n, v_lineas
      FROM public.tjm_revisiones
     WHERE resuelto_at IS NULL AND quien = 'familia' AND gravedad IN ('alta', 'media');
    IF COALESCE(v_n, 0) = 0 THEN RETURN NULL; END IF;
    RETURN public.tjm_notificar_push(
        CASE WHEN v_n = 1 THEN 'Hoy hay 1 cosa pendiente en la casa' ELSE 'Hoy hay ' || v_n || ' cosas pendientes en la casa' END,
        left(v_lineas, 900), '/panel');
END $function$;

REVOKE ALL ON FUNCTION public.tjm_aviso_familia() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('tjm-aviso-familia') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-aviso-familia');
SELECT cron.schedule('tjm-aviso-familia', '30 7 * * *', $cron$SELECT public.tjm_aviso_familia();$cron$);

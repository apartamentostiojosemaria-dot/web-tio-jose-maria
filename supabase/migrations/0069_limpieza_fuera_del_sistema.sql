-- 2026-10-24 · Cleaning is no longer tracked by the system (Jesús: the family runs it well, no notice needed,
-- and the list only piled up: a cleaning closed itself only when the next guest arrived, so in low season
-- 10 stayed open from 11-sep to 20-oct).
-- 1. A confirmed booking no longer creates a cleaning task (the panel can still note a one-off cleaning).
-- 2. The business review no longer raises «limpieza sin marcar» (same function as 0061, minus that block).
-- 3. The open ones are closed with a note, and so are their open review rows.

DROP TRIGGER IF EXISTS guest_bookings_schedule_cleaning ON public.guest_bookings;

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

UPDATE public.cleaning_tasks
   SET status = 'done', completed_at = COALESCE(completed_at, now()), updated_at = now(),
       notes = concat_ws(' · ', NULLIF(notes, ''), 'Cerrada el 24-oct-2026: la limpieza ya no se lleva en el sistema')
 WHERE status = 'pending';

UPDATE public.tjm_revisiones SET resuelto_at = now()
 WHERE resuelto_at IS NULL AND clave LIKE 'limpieza:%';

-- 0051 — «Hoy» tardaba por el estado del sistema: tjm_salud() rápida y el histórico de pg_cron a raya (23-sep-2026).
--
-- Medido en los registros de Supabase: `rpc/tjm_salud` 478 ms de media y 1,3 s de pico, llamada cada vez que se
-- abre «Hoy». La culpa era buscar la última ejecución de cada tarea en `cron.job_run_details`: 135.597 filas
-- desde mayo (expire-booking-holds corre cada minuto) y sin índice por tarea (Supabase no deja crearlo: la tabla
-- es de pg_cron). Arreglo: el histórico se queda en una semana (limpieza diaria a las 03:45) y la consulta mira
-- solo los dos últimos días, de una pasada. Resultado medido: 5,9 ms.
-- (Aplicado el 23-sep con el conector; se deja aquí para el repo.)

DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days';

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'tjm-purgar-historial-cron';
SELECT cron.schedule('tjm-purgar-historial-cron', '45 3 * * *',
    $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days'$$);

CREATE OR REPLACE FUNCTION public.tjm_salud()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

    -- Última ejecución de cada tarea: UNA pasada sobre los dos últimos días
    -- (antes, una búsqueda por tarea en todo el histórico, sin índice: 0,5-1,3 s).
    WITH ultimas AS (
        SELECT DISTINCT ON (d.jobid) d.jobid, d.start_time, d.status, d.return_message
          FROM cron.job_run_details d
         WHERE d.start_time >= now() - interval '2 days'
         ORDER BY d.jobid, d.start_time DESC
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', j.jobname, 'horario', j.schedule, 'ultimo', r.start_time, 'estado', r.status, 'mensaje', left(r.return_message, 120)) ORDER BY j.jobname), '[]'::jsonb)
      INTO v_crons
      FROM cron.job j
      LEFT JOIN ultimas r ON r.jobid = j.jobid
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
END $function$;

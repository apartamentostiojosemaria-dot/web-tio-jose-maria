-- 0067 · Calls to the Ministry function get time to answer (16-oct-2026)
-- tjm_disparar_ses (hourly batch, reservations sweep, acknowledgements) used pg_net's default 5 s timeout.
-- The function talks to the Ministry's web service and can take longer: on 10-oct 08:00 two calls were cut
-- (audit P3). Same pattern as tjm_disparar_parte / tjm_disparar_correo, which already had it.
CREATE OR REPLACE FUNCTION public.tjm_disparar_ses(p_accion text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_llave text;
    v_id    bigint;
BEGIN
    SELECT decrypted_secret INTO v_llave
      FROM vault.decrypted_secrets
     WHERE name = 'ses_cron_token'
     LIMIT 1;

    IF COALESCE(btrim(v_llave), '') = '' THEN
        INSERT INTO public.internal_tasks (title, description, category, priority, status, scheduled_date, auto_reschedule)
        SELECT
            'El parte de viajeros no puede salir solo: falta la llave del sistema',
            'El barrido automatico del RD 933/2021 (reservas, anulaciones y parte de viajeros) esta programado pero NO puede llamar a la funcion, porque la llave ses_cron_token no esta en Vault.' || chr(10) || chr(10)
            || 'Se arregla en Supabase -> SQL Editor, ejecutando el bloque DO de la migracion 0010 (vault.create_secret ... ''ses_cron_token''). La edge function la lee sola al arrancar; no hay que copiarla a ningun sitio.' || chr(10) || chr(10)
            || 'Hasta entonces el parte hay que mandarlo a mano desde el panel.',
            'legal', 'high', 'pending', current_date, false
        WHERE NOT EXISTS (
            SELECT 1 FROM public.internal_tasks
             WHERE title = 'El parte de viajeros no puede salir solo: falta la llave del sistema'
               AND status = 'pending'
        );
        RETURN NULL;
    END IF;

    SELECT net.http_post(
        url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/submit-ses-hospedajes',
        headers := jsonb_build_object(
                       'Content-Type',  'application/json',
                       'Authorization', 'Bearer ' || v_llave),
        body    := jsonb_build_object('accion', p_accion),
        timeout_milliseconds := 150000
    ) INTO v_id;

    RETURN v_id;
END $function$;

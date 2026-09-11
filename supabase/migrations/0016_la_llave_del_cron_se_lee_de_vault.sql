-- 0016 · La llave del cron se lee de Vault: se acaba el paso manual
-- ====================================================================
-- Hasta hoy la llave `ses_cron_token` vivia en Vault (la usa el disparador
-- `tjm_disparar_ses`) y habia que COPIARLA a mano al secreto SES_CRON_TOKEN
-- de la edge function. Ese paso nunca se dio: desde el 10-sep a las 16:23 UTC
-- el barrido horario y la tanda diaria recibian 401 `token_no_valido`, una
-- vez cada hora, y nadie se enteraba salvo por el aviso de Trigger.dev.
--
-- Remedio de cimiento: la edge function pide la llave a la base al arrancar,
-- con la clave de servicio, a traves de `tjm_llave_cron()`. Una sola fuente,
-- nadie copia nada, no puede volver a divergir. El secreto SES_CRON_TOKEN de
-- la funcion queda como alternativa opcional, no como requisito.

CREATE OR REPLACE FUNCTION public.tjm_llave_cron()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT decrypted_secret
      FROM vault.decrypted_secrets
     WHERE name = 'ses_cron_token'
     LIMIT 1;
$function$;

COMMENT ON FUNCTION public.tjm_llave_cron() IS
  'Devuelve la llave compartida ses_cron_token de Vault. Solo la lee la edge function submit-ses-hospedajes con la clave de servicio, al arrancar, para reconocer las llamadas de tjm_disparar_ses. Nadie mas puede ejecutarla.';

REVOKE ALL ON FUNCTION public.tjm_llave_cron() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_llave_cron() FROM anon;
REVOKE ALL ON FUNCTION public.tjm_llave_cron() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tjm_llave_cron() TO service_role;

-- El disparador: el mensaje de la tarea ya no manda copiar nada a mano.
-- Si la llave falta en Vault, se vuelve a crear (mismo bloque que en 0010).
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
        -- Ni una llamada a ciegas. Se deja constancia UNA vez, no una por
        -- pasada: una alerta repetida cada hora se convierte en ruido y
        -- deja de leerse.
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
        body    := jsonb_build_object('accion', p_accion)
    ) INTO v_id;

    RETURN v_id;
END $function$;

COMMENT ON FUNCTION public.tjm_disparar_ses(text) IS
  'Llama a submit-ses-hospedajes con la llave del sistema guardada en Vault (ses_cron_token). La edge function lee esa misma llave con tjm_llave_cron(), asi que no hay copia manual. Si la llave no esta, NO llama y deja una tarea en el panel en vez de fallar en silencio.';

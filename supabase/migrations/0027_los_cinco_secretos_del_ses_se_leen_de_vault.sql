-- 0027 · Los cinco secretos del servicio web se leen de Vault
-- ==========================================================
-- Hermana de 0016. Aquella resolvio la llave del cron; esta resuelve las
-- credenciales del MIR, que sufren el mismo problema: vivian SOLO como
-- secretos de la edge function, habia que teclearlas en el panel de Supabase
-- y ese panel esta en una cuenta distinta de la del operador. Resultado: el
-- 17-sep-2026 se descubrio que el alta en SES.HOSPEDAJES llevaba hecha desde
-- el 17-abr-2025 y el modulo seguia en modo preparado por no tener a mano
-- donde escribir cinco cadenas.
--
-- Remedio de cimiento, el mismo de 0016: la base es la fuente y la edge
-- function los pide al arrancar con la clave de servicio. Las variables de
-- entorno siguen teniendo preferencia si algun dia existen, asi que esto no
-- rompe ninguna instalacion previa.
--
-- OJO: aqui NO hay ningun valor. Los secretos se cargan con vault.create_secret
-- fuera del repositorio. Esta migracion solo crea los huecos y la puerta.

-- 1) Los huecos: se crean vacios si no existen, para que `tjm_secretos_ses()`
--    devuelva siempre las cinco claves y se vea cual falta.
DO $$
DECLARE
    v_nombre text;
    v_nombres text[] := ARRAY[
        'ses_ws_user', 'ses_ws_password', 'ses_arrendador',
        'ses_establecimiento', 'ses_endpoint'
    ];
BEGIN
    FOREACH v_nombre IN ARRAY v_nombres LOOP
        IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = v_nombre) THEN
            PERFORM vault.create_secret(
                '', v_nombre,
                'Credencial del servicio web de SES.HOSPEDAJES (RD 933/2021). La lee submit-ses-hospedajes con tjm_secretos_ses(). Vacio = pendiente de cargar.'
            );
        END IF;
    END LOOP;
END $$;

-- 2) La puerta: solo la clave de servicio puede abrirla.
CREATE OR REPLACE FUNCTION public.tjm_secretos_ses()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT COALESCE(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
      FROM vault.decrypted_secrets
     WHERE name IN (
        'ses_ws_user', 'ses_ws_password', 'ses_arrendador',
        'ses_establecimiento', 'ses_endpoint'
     );
$function$;

COMMENT ON FUNCTION public.tjm_secretos_ses() IS
  'Devuelve las cinco credenciales del servicio web del MIR guardadas en Vault. Solo la lee submit-ses-hospedajes con la clave de servicio, al arrancar. Una sola fuente: nadie copia nada al panel de Supabase.';

REVOKE ALL ON FUNCTION public.tjm_secretos_ses() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_secretos_ses() FROM anon;
REVOKE ALL ON FUNCTION public.tjm_secretos_ses() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tjm_secretos_ses() TO service_role;

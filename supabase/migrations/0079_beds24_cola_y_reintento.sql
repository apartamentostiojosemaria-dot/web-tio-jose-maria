-- 0079 · Beds24: cola de apartamentos pendientes y reintento cada minuto (5-nov-2026)
-- ====================================================================
-- Hallado en la batería de pruebas del 5-nov:
--   · Cambiar una reserva o un bloqueo de apartamento solo mandaba el NUEVO: el viejo se quedaba
--     cerrado en Beds24 (T3, T7).
--   · Con muchos cambios seguidos se agota el límite de Beds24 (100 créditos / 5 min) y el envío
--     que falla (429) se perdía hasta el repaso de 10 min.
-- Desde aquí el disparador apunta en `beds24_pendientes` los apartamentos afectados (viejo y
-- nuevo) y pide un envío; la función manda TODOS los pendientes en una llamada y solo los borra
-- si Beds24 lo acepta. Un cron cada minuto reintenta si queda alguno.

CREATE TABLE IF NOT EXISTS public.beds24_pendientes (
    apartment_id  bigint PRIMARY KEY REFERENCES public.apartments(id),
    desde         timestamptz NOT NULL DEFAULT now(),
    intentos      integer NOT NULL DEFAULT 0
);
ALTER TABLE public.beds24_pendientes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beds24_pendientes FROM anon, authenticated;

-- Pide un envío a la función con la llave de Vault (lo usan el disparador y el reintento)
CREATE OR REPLACE FUNCTION public.tjm_beds24_pedir_envio(p_origen text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_llave text;
BEGIN
    SELECT decrypted_secret INTO v_llave FROM vault.decrypted_secrets WHERE name = 'beds24_cron_token' LIMIT 1;
    IF COALESCE(v_llave, '') = '' THEN RETURN NULL; END IF;
    RETURN net.http_post(
        url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/beds24-sync',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_llave),
        body    := jsonb_build_object('mode', 'push', 'pendientes', true, 'origen', p_origen),
        timeout_milliseconds := 60000
    );
END;
$$;
REVOKE ALL ON FUNCTION public.tjm_beds24_pedir_envio(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tjm_beds24_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    INSERT INTO public.beds24_pendientes (apartment_id)
    SELECT DISTINCT a FROM unnest(ARRAY[
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.apartment_id END,
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.apartment_id END]) AS a
     WHERE a IS NOT NULL
    ON CONFLICT (apartment_id) DO UPDATE SET desde = now();  -- un cambio nuevo no se pierde si se está enviando el anterior
    PERFORM public.tjm_beds24_pedir_envio(TG_TABLE_NAME);
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tjm_beds24_avisar() FROM PUBLIC, anon, authenticated;

-- Reintento: cada minuto, solo si queda algo pendiente
CREATE OR REPLACE FUNCTION public.tjm_beds24_reintentar()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.beds24_pendientes) THEN RETURN NULL; END IF;
    RETURN public.tjm_beds24_pedir_envio('reintento');
END;
$$;
REVOKE ALL ON FUNCTION public.tjm_beds24_reintentar() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('tjm-beds24-reintento')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-beds24-reintento');
SELECT cron.schedule('tjm-beds24-reintento', '* * * * *', $CRON$ SELECT public.tjm_beds24_reintentar(); $CRON$);

-- Para poder lanzar el repaso o el reintento a mano desde la service role (pruebas, soporte)
GRANT EXECUTE ON FUNCTION public.tjm_beds24_repaso() TO service_role;
GRANT EXECUTE ON FUNCTION public.tjm_beds24_reintentar() TO service_role;

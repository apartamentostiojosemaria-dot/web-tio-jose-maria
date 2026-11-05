-- 0078 · La tubería Beds24 llama con llave propia (5-nov-2026)
-- ====================================================================
-- 0077 llamaba a `beds24-sync` solo con la clave publicable: cualquiera que conociera la URL
-- podía pedir pasadas (gastando los créditos de Beds24, 100 cada 5 min) y leer en la respuesta
-- ids y estados de reservas. Desde aquí:
--   · La base genera ella misma una llave aleatoria en Vault (`beds24_cron_token`); nadie la
--     teclea ni la ve. El disparador y el repaso la mandan en `Authorization: Bearer`.
--   · La función, sin esa llave (o la service role), solo acepta el aviso de Beds24: una pasada
--     completa como mucho cada 30 s y responde `{ok}` sin detalles.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'beds24_cron_token') THEN
        PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'beds24_cron_token',
                                    'Llave de la base y el cron para beds24-sync. Migración 0078.');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tjm_beds24_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_apt   bigint;
    v_llave text;
BEGIN
    v_apt := COALESCE(NEW.apartment_id, OLD.apartment_id);
    IF v_apt IS NULL THEN RETURN NULL; END IF;
    SELECT decrypted_secret INTO v_llave FROM vault.decrypted_secrets WHERE name = 'beds24_cron_token' LIMIT 1;
    IF COALESCE(v_llave, '') = '' THEN RETURN NULL; END IF;
    PERFORM net.http_post(
        url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/beds24-sync',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_llave),
        body    := jsonb_build_object('mode', 'push', 'apartmentId', v_apt, 'origen', TG_TABLE_NAME),
        timeout_milliseconds := 60000
    );
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tjm_beds24_avisar() FROM PUBLIC, anon, authenticated;

-- El repaso, con la misma llave (leída de Vault en cada pasada)
CREATE OR REPLACE FUNCTION public.tjm_beds24_repaso()
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
        body    := '{"mode":"all","origen":"cron"}'::jsonb,
        timeout_milliseconds := 120000
    );
END;
$$;
REVOKE ALL ON FUNCTION public.tjm_beds24_repaso() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('tjm-beds24-repaso')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-beds24-repaso');
SELECT cron.schedule('tjm-beds24-repaso', '*/10 * * * *', $CRON$ SELECT public.tjm_beds24_repaso(); $CRON$);

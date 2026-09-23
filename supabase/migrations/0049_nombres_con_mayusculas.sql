-- 0049 — Los nombres que llegan en minúsculas (o en mayúsculas) salen bien escritos (23-sep-2026).
--
-- Booking manda a veces «antonio bravo» o «mari carmen rodriguez fernandez» y
-- así salían en todo el panel. Un trigger los pone con mayúscula inicial y las
-- partículas en minúscula («de la», «del», «y»). Un nombre ya escrito con
-- mayúsculas y minúsculas se respeta tal cual. Se arreglan también los que ya
-- había (reservas y fichas de cliente).
-- (Aplicado el 23-sep con el conector, en dos pasos: 0049 y 0049b. Aquí, junto.)

CREATE OR REPLACE FUNCTION public.tjm_nombre_bonito(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v text;
    w text;
BEGIN
    IF p IS NULL OR btrim(p) = '' OR NOT (p = lower(p) OR p = upper(p)) THEN
        RETURN p;
    END IF;
    v := initcap(btrim(p));
    -- Las partículas en minúscula, salvo si abren el nombre. Dos pasadas:
    -- con «de la» la primera se come el espacio que necesita la segunda.
    FOREACH w IN ARRAY ARRAY['De','Del','La','Las','Los','Y','E','Da','Do','Dos','Van','Von'] LOOP
        v := regexp_replace(v, '(\s)' || w || '(\s)', '\1' || lower(w) || '\2', 'g');
        v := regexp_replace(v, '(\s)' || w || '(\s)', '\1' || lower(w) || '\2', 'g');
    END LOOP;
    RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.tjm_nombre_bonito_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.guest_name := public.tjm_nombre_bonito(NEW.guest_name);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nombre_bonito ON public.guest_bookings;
CREATE TRIGGER trg_nombre_bonito
    BEFORE INSERT OR UPDATE OF guest_name ON public.guest_bookings
    FOR EACH ROW EXECUTE FUNCTION public.tjm_nombre_bonito_trg();

UPDATE public.guest_bookings SET guest_name = public.tjm_nombre_bonito(guest_name)
 WHERE guest_name IS NOT NULL AND guest_name <> public.tjm_nombre_bonito(guest_name);
UPDATE public.customers SET canonical_name = public.tjm_nombre_bonito(canonical_name)
 WHERE canonical_name IS NOT NULL AND canonical_name <> public.tjm_nombre_bonito(canonical_name);

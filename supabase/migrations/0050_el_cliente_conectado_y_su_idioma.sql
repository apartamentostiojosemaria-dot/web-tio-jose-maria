-- 0050 — El cliente conectado: su ficha manda y llega a todas sus reservas; y su idioma (23-sep-2026).
--
-- Hasta hoy los datos del cliente vivían dos veces: en su ficha (`customers`,
-- por correo) y copiados en cada reserva, sin hablarse. El 23-sep el teléfono
-- de Michael estaba en su ficha y su reserva no lo sabía; y dos desconocidos
-- sin correo compartían una sola ficha. Jesús: «si cambio algo en la ficha
-- del cliente, en cualquier sitio que esté ese cliente tiene que estar».
--
-- Cómo queda:
--   1. Cada ficha tiene un número propio (`customers.id`) y cada reserva
--      apunta a la suya (`guest_bookings.customer_id`). El correo sigue siendo
--      la clave de la ficha (notas y correos lo usan); un cliente sin correo
--      lleva uno de relleno PROPIO (`sin-email+…@tiojosemaria.local`), nunca
--      el compartido `sin-correo@example.invalid`.
--   2. Al entrar una reserva (a mano, de Booking, de Holidu…) se enlaza sola:
--      por correo de verdad; si no, por teléfono (si hay UNA ficha con él);
--      si no, por su relleno propio; y si no, ficha nueva. Lo que falte en la
--      ficha se rellena con lo de la reserva; lo que ya tenga no se pisa.
--   3. Lo que se cambia en la ficha (nombre, teléfono, correo, idioma) se
--      copia al momento a TODAS sus reservas. Las pantallas, los botones de
--      WhatsApp y los correos automáticos leen la reserva, así que todo
--      queda al día sin tocar nada más.
--   4. El idioma del cliente (es · en · de · fr): se deduce del prefijo del
--      teléfono y se puede cambiar a mano en su ficha. Viaja a la reserva
--      (`guest_bookings.idioma`) para los correos y el formulario.
--   5. Lo que deja quien reserva en el check-in (correo, teléfono) va a su
--      ficha (antes iba directo a la reserva, migración 0046).
--   6. Cambiar el correo de una ficha arrastra sus apuntes; si ya existía
--      otra ficha con ese correo, se juntan en una.
-- (Aplicado el 23-sep con el conector; se deja aquí para el repo.)

-- ---------------------------------------------------------------- 1. columnas
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS idioma_a_mano boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS customers_id_key ON public.customers (id);

ALTER TABLE public.guest_bookings
    ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers (id) ON UPDATE CASCADE ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS idioma text;
CREATE INDEX IF NOT EXISTS guest_bookings_customer_id_idx ON public.guest_bookings (customer_id);

COMMENT ON COLUMN public.guest_bookings.customer_id IS 'La ficha del cliente. Lo que cambia en la ficha se copia a la reserva (trigger en customers).';
COMMENT ON COLUMN public.guest_bookings.idioma IS 'Idioma del huésped (es, en, de, fr), copiado de su ficha. NULL = castellano.';
COMMENT ON COLUMN public.customers.idioma_a_mano IS 'true = el idioma lo ha puesto una persona; ya no se deduce del teléfono.';

-- ---------------------------------------------------------------- utilidades
CREATE OR REPLACE FUNCTION public.tjm_es_relleno(p_email text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
    SELECT p_email IS NULL OR btrim(p_email) = ''
        OR lower(p_email) LIKE '%@example.invalid'
        OR lower(p_email) LIKE '%@tiojosemaria.local';
$$;

CREATE OR REPLACE FUNCTION public.tjm_clave_telefono(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 9
                THEN right(regexp_replace(p, '\D', '', 'g'), 9) END;
$$;

-- es · en · de · fr por el prefijo. Sin prefijo y 9 cifras = móvil español.
CREATE OR REPLACE FUNCTION public.tjm_idioma_por_telefono(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d text := regexp_replace(coalesce(p, ''), '[^\d+]', '', 'g');
BEGIN
    IF d = '' THEN RETURN NULL; END IF;
    IF left(d, 2) = '00' THEN d := '+' || substr(d, 3); END IF;
    IF left(d, 1) <> '+' THEN
        RETURN CASE WHEN d ~ '^[6789]\d{8}$' THEN 'es' ELSE NULL END;
    END IF;
    IF d LIKE '+34%' THEN RETURN 'es'; END IF;
    IF d LIKE '+49%' OR d LIKE '+43%' OR d LIKE '+41%' THEN RETURN 'de'; END IF;
    IF d LIKE '+33%' OR d LIKE '+32%' OR d LIKE '+352%' THEN RETURN 'fr'; END IF;
    RETURN 'en';
END;
$$;

-- ---------------------------------------------------------------- 2. enlazar la reserva
CREATE OR REPLACE FUNCTION public.tjm_enlazar_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_email text := lower(btrim(coalesce(NEW.guest_email, '')));
    v_tel   text := public.tjm_clave_telefono(NEW.guest_phone);
    v_id    uuid;
    v_n     int;
    v_cli   public.customers%ROWTYPE;
BEGIN
    IF NEW.source = 'test' THEN RETURN NEW; END IF;

    IF NEW.customer_id IS NULL THEN
        -- a) correo de verdad
        IF NOT public.tjm_es_relleno(v_email) THEN
            INSERT INTO public.customers (email, canonical_name, phone)
            VALUES (v_email, NEW.guest_name, NEW.guest_phone)
            ON CONFLICT (email) DO NOTHING;
            SELECT id INTO v_id FROM public.customers WHERE email = v_email;
        END IF;
        -- b) teléfono, solo si hay UNA ficha con él
        IF v_id IS NULL AND v_tel IS NOT NULL THEN
            SELECT count(*), min(id::text)::uuid INTO v_n, v_id
              FROM public.customers WHERE public.tjm_clave_telefono(phone) = v_tel;
            IF v_n <> 1 THEN v_id := NULL; END IF;
        END IF;
        -- c) su relleno propio
        IF v_id IS NULL AND v_email LIKE 'sin-email+%@tiojosemaria.local' THEN
            SELECT id INTO v_id FROM public.customers WHERE email = v_email;
        END IF;
        -- d) ficha nueva, con relleno propio si no trae correo de verdad
        IF v_id IS NULL THEN
            INSERT INTO public.customers (email, canonical_name, phone)
            VALUES (CASE WHEN public.tjm_es_relleno(v_email) OR v_email = ''
                         THEN 'sin-email+r' || NEW.id || '@tiojosemaria.local' ELSE v_email END,
                    NEW.guest_name, NEW.guest_phone)
            ON CONFLICT (email) DO NOTHING
            RETURNING id INTO v_id;
            IF v_id IS NULL THEN
                SELECT id INTO v_id FROM public.customers WHERE email = 'sin-email+r' || NEW.id || '@tiojosemaria.local';
            END IF;
        END IF;
        NEW.customer_id := v_id;
    END IF;

    -- Lo que falte en la ficha, de la reserva; lo que la ficha ya tenga, a la reserva.
    SELECT * INTO v_cli FROM public.customers WHERE id = NEW.customer_id;
    IF FOUND THEN
        IF v_cli.phone IS NULL AND NEW.guest_phone IS NOT NULL AND btrim(NEW.guest_phone) <> '' THEN
            UPDATE public.customers SET phone = NEW.guest_phone, updated_at = now() WHERE id = v_cli.id;
            v_cli.phone := NEW.guest_phone;
        END IF;
        IF v_cli.canonical_name IS NULL AND NEW.guest_name IS NOT NULL THEN
            UPDATE public.customers SET canonical_name = NEW.guest_name, updated_at = now() WHERE id = v_cli.id;
            v_cli.canonical_name := NEW.guest_name;
        END IF;
        IF NOT v_cli.idioma_a_mano AND public.tjm_idioma_por_telefono(v_cli.phone) IS NOT NULL
           AND v_cli.preferred_language IS DISTINCT FROM public.tjm_idioma_por_telefono(v_cli.phone) THEN
            UPDATE public.customers SET preferred_language = public.tjm_idioma_por_telefono(v_cli.phone), updated_at = now()
             WHERE id = v_cli.id;
            v_cli.preferred_language := public.tjm_idioma_por_telefono(v_cli.phone);
        END IF;
        -- Las demás reservas de la ficha, al día (esta se pone abajo, en NEW).
        UPDATE public.guest_bookings b
           SET guest_name  = coalesce(v_cli.canonical_name, b.guest_name),
               guest_phone = coalesce(v_cli.phone, b.guest_phone),
               idioma      = CASE WHEN v_cli.preferred_language IN ('es', 'en', 'de', 'fr') THEN v_cli.preferred_language END
         WHERE b.customer_id = v_cli.id AND b.id <> NEW.id
           AND (b.guest_name IS DISTINCT FROM coalesce(v_cli.canonical_name, b.guest_name)
             OR b.guest_phone IS DISTINCT FROM coalesce(v_cli.phone, b.guest_phone)
             OR b.idioma IS DISTINCT FROM (CASE WHEN v_cli.preferred_language IN ('es', 'en', 'de', 'fr') THEN v_cli.preferred_language END));
        NEW.guest_name  := coalesce(v_cli.canonical_name, NEW.guest_name);
        NEW.guest_phone := coalesce(v_cli.phone, NEW.guest_phone);
        IF NOT public.tjm_es_relleno(v_cli.email) OR public.tjm_es_relleno(NEW.guest_email) THEN
            NEW.guest_email := v_cli.email;
        END IF;
        NEW.idioma := CASE WHEN v_cli.preferred_language IN ('es', 'en', 'de', 'fr') THEN v_cli.preferred_language END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guest_bookings_ensure_customer ON public.guest_bookings;
DROP TRIGGER IF EXISTS trg_enlazar_cliente ON public.guest_bookings;
CREATE TRIGGER trg_enlazar_cliente
    BEFORE INSERT OR UPDATE OF guest_email, guest_phone, guest_name, customer_id ON public.guest_bookings
    FOR EACH ROW
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION public.tjm_enlazar_cliente();

-- ---------------------------------------------------------------- 3. la ficha manda
CREATE OR REPLACE FUNCTION public.tjm_cliente_a_sus_reservas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    UPDATE public.guest_bookings b
       SET guest_name  = coalesce(NEW.canonical_name, b.guest_name),
           guest_phone = coalesce(NEW.phone, b.guest_phone),
           guest_email = CASE WHEN NOT public.tjm_es_relleno(NEW.email) OR public.tjm_es_relleno(b.guest_email)
                              THEN NEW.email ELSE b.guest_email END,
           idioma      = CASE WHEN NEW.preferred_language IN ('es', 'en', 'de', 'fr') THEN NEW.preferred_language END,
           updated_at  = now()
     WHERE b.customer_id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cliente_a_sus_reservas ON public.customers;
CREATE TRIGGER trg_cliente_a_sus_reservas
    AFTER UPDATE OF canonical_name, phone, email, preferred_language ON public.customers
    FOR EACH ROW
    -- Solo desde fuera de otro trigger: dentro (enlazar la reserva, el
    -- check-in) cada uno pone al día las reservas él mismo, sin tocar la
    -- fila que se está guardando (Postgres no deja modificarla dos veces).
    WHEN (pg_trigger_depth() < 1 AND (OLD.canonical_name IS DISTINCT FROM NEW.canonical_name
       OR OLD.phone IS DISTINCT FROM NEW.phone
       OR OLD.email IS DISTINCT FROM NEW.email
       OR OLD.preferred_language IS DISTINCT FROM NEW.preferred_language))
    EXECUTE FUNCTION public.tjm_cliente_a_sus_reservas();

-- El nombre bonito también en la ficha (0049 lo hace en la reserva).
CREATE OR REPLACE FUNCTION public.tjm_cliente_nombre_bonito_trg()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.canonical_name := public.tjm_nombre_bonito(NEW.canonical_name);
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_cliente_nombre_bonito ON public.customers;
CREATE TRIGGER trg_cliente_nombre_bonito
    BEFORE INSERT OR UPDATE OF canonical_name ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.tjm_cliente_nombre_bonito_trg();

-- ---------------------------------------------------------------- 6. guardar la ficha desde el panel
-- Nombre, teléfono, correo e idioma de UNA ficha. Si el correo nuevo ya es de
-- otra ficha, se juntan: las reservas y los apuntes pasan a esa y esta se va.
CREATE OR REPLACE FUNCTION public.tjm_guardar_cliente(
    p_id uuid, p_nombre text, p_telefono text, p_correo text DEFAULT NULL, p_idioma text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_cli  public.customers%ROWTYPE;
    v_otra uuid;
    v_mail text := lower(btrim(coalesce(p_correo, '')));
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN RAISE EXCEPTION 'sin_permiso'; END IF;
    SELECT * INTO v_cli FROM public.customers WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'cliente_no_encontrado'; END IF;
    IF p_idioma IS NOT NULL AND p_idioma NOT IN ('es', 'en', 'de', 'fr') THEN RAISE EXCEPTION 'idioma_no_valido'; END IF;
    IF v_mail <> '' AND v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'correo_no_valido'; END IF;

    -- Correo nuevo que ya tiene otra ficha: se juntan en esa.
    IF v_mail <> '' AND v_mail <> v_cli.email THEN
        SELECT id INTO v_otra FROM public.customers WHERE email = v_mail;
        IF v_otra IS NOT NULL THEN
            UPDATE public.guest_bookings SET customer_id = v_otra WHERE customer_id = v_cli.id;
            UPDATE public.customer_notes SET customer_email = v_mail WHERE customer_email = v_cli.email;
            DELETE FROM public.customers WHERE id = v_cli.id;
            p_id := v_otra;
        ELSE
            UPDATE public.customer_notes SET customer_email = v_mail WHERE customer_email = v_cli.email;
            UPDATE public.customers SET email = v_mail, updated_at = now() WHERE id = v_cli.id;
        END IF;
    END IF;

    UPDATE public.customers
       SET canonical_name = coalesce(nullif(btrim(p_nombre), ''), canonical_name),
           phone = nullif(btrim(coalesce(p_telefono, '')), ''),
           preferred_language = coalesce(p_idioma,
               CASE WHEN idioma_a_mano THEN preferred_language
                    ELSE coalesce(public.tjm_idioma_por_telefono(nullif(btrim(coalesce(p_telefono, '')), '')), preferred_language) END),
           idioma_a_mano = idioma_a_mano OR p_idioma IS NOT NULL,
           updated_at = now()
     WHERE id = p_id;

    -- Las reservas, al día (también las que llegaron por la junta).
    PERFORM public.tjm_cliente_a_sus_reservas_por_id(p_id);
    RETURN p_id;
END;
$$;

-- La misma copia a las reservas, llamable (para la junta de fichas).
CREATE OR REPLACE FUNCTION public.tjm_cliente_a_sus_reservas_por_id(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v public.customers%ROWTYPE;
BEGIN
    SELECT * INTO v FROM public.customers WHERE id = p_id;
    IF NOT FOUND THEN RETURN; END IF;
    UPDATE public.guest_bookings b
       SET guest_name  = coalesce(v.canonical_name, b.guest_name),
           guest_phone = coalesce(v.phone, b.guest_phone),
           guest_email = CASE WHEN NOT public.tjm_es_relleno(v.email) OR public.tjm_es_relleno(b.guest_email)
                              THEN v.email ELSE b.guest_email END,
           idioma      = CASE WHEN v.preferred_language IN ('es', 'en', 'de', 'fr') THEN v.preferred_language END,
           updated_at  = now()
     WHERE b.customer_id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tjm_guardar_cliente(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tjm_guardar_cliente(uuid, text, text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.tjm_cliente_a_sus_reservas_por_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tjm_enlazar_cliente() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tjm_cliente_a_sus_reservas() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- 5. el check-in va a la ficha
CREATE OR REPLACE FUNCTION public.tjm_correo_del_titular_a_la_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_email text := lower(trim(coalesce(NEW.email, '')));
    v_tel   text := nullif(trim(coalesce(NEW.telefono_movil, NEW.telefono_fijo, '')), '');
    v_cli   public.customers%ROWTYPE;
    v_otra  uuid;
BEGIN
    IF NOT NEW.is_titular THEN RETURN NEW; END IF;
    SELECT c.* INTO v_cli FROM public.customers c
      JOIN public.guest_bookings b ON b.customer_id = c.id
     WHERE b.id = NEW.booking_id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    -- Su correo, si la ficha solo tenía relleno.
    IF v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND NOT public.tjm_es_relleno(v_email)
       AND public.tjm_es_relleno(v_cli.email) THEN
        SELECT id INTO v_otra FROM public.customers WHERE email = v_email;
        IF v_otra IS NOT NULL AND v_otra <> v_cli.id THEN
            -- Ya era cliente con ese correo: la reserva pasa a su ficha.
            UPDATE public.guest_bookings SET customer_id = v_otra WHERE customer_id = v_cli.id;
            PERFORM public.tjm_cliente_a_sus_reservas_por_id(v_otra);
            SELECT * INTO v_cli FROM public.customers WHERE id = v_otra;
        ELSE
            UPDATE public.customer_notes SET customer_email = v_email WHERE customer_email = v_cli.email;
            UPDATE public.customers SET email = v_email, updated_at = now() WHERE id = v_cli.id;
        END IF;
    END IF;

    -- Su teléfono, si la ficha no tenía.
    IF v_tel IS NOT NULL AND (v_cli.phone IS NULL OR btrim(v_cli.phone) = '') THEN
        UPDATE public.customers SET phone = v_tel, updated_at = now() WHERE id = v_cli.id;
    END IF;
    PERFORM public.tjm_cliente_a_sus_reservas_por_id(v_cli.id);
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------- 7. lo que ya había
-- (a) idioma por teléfono en todas las fichas (hoy todas decían 'es' por defecto)
UPDATE public.customers
   SET preferred_language = coalesce(public.tjm_idioma_por_telefono(phone), preferred_language, 'es')
 WHERE NOT idioma_a_mano;

-- (b) la ficha del relleno COMPARTIDO no es de nadie: juntaba a desconocidos
--     (se llamaba «Adrián Rivas Pérez» y tenía el móvil de Emilia). Se borra;
--     sus reservas se enlazan una a una abajo, cada una con su ficha.
DELETE FROM public.customers c
 WHERE c.email = 'sin-correo@example.invalid'
   AND NOT EXISTS (SELECT 1 FROM public.customer_notes n WHERE n.customer_email = c.email);
-- (c) enlazar cada reserva con su ficha, una a una.
UPDATE public.guest_bookings SET customer_id = NULL WHERE customer_id IS NOT NULL;
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT id FROM public.guest_bookings WHERE coalesce(source, '') <> 'test' ORDER BY id LOOP
        UPDATE public.guest_bookings SET guest_name = guest_name WHERE id = r.id;
    END LOOP;
END $$;

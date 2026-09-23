-- 0046 — «Quien reserva» en el check-in y el correo del check-in pasa a la reserva (23-sep-2026).
--
-- 1) tjm_checkin_personas no devolvía is_titular: el panel no podía poner la
--    etiqueta «Quien reserva» a nadie. Cambia el tipo de vuelta, así que se
--    borra y se crea de nuevo (con los mismos permisos que en 0014).
--
-- 2) Las reservas de canal o importadas llegan sin correo (relleno). Cuando
--    quien reserva rellena el check-in y deja su correo y su teléfono, la
--    reserva seguía sin ellos: no le llegaba ningún aviso y en Clientes no
--    aparecía su correo (Emilia, reserva 75). Ahora, al guardar la ficha del
--    titular, si la reserva tiene correo de relleno se le pone el suyo, y el
--    teléfono si no tenía. Un correo real que ya estuviera no se toca.
--
-- 3) ensure_customer_exists creaba fichas de cliente con el relleno
--    COMPARTIDO `sin-correo@example.invalid`: todas las reservas sin correo
--    caían en una sola ficha, con el nombre de la primera y el teléfono de la
--    última («Adrián Rivas Pérez» con el móvil de Emilia). Ese relleno ya no
--    crea ficha. El de `@tiojosemaria.local` es uno por persona y se queda.
--
-- (Aplicado el 23-sep con el conector; se deja aquí para el repo.)

-- ---------------------------------------------------------------- 1
DROP FUNCTION IF EXISTS public.tjm_checkin_personas(bigint);

CREATE FUNCTION public.tjm_checkin_personas(p_booking_id bigint)
RETURNS TABLE(
    id uuid, is_titular boolean, nombre text, apellido_primero text, apellido_segundo text,
    tipo_documento text, numero_documento text, fecha_nacimiento date,
    es_menor boolean, tiene_firma boolean,
    documento_verificado_at timestamptz, submitted_at timestamptz, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
    -- Quien recibe (rol staff) tiene que ver nombre y documento para
    -- compararlos con el DNI que tiene delante, y quién es el que reservó.
    -- Nada más: ni domicilio, ni teléfonos, ni la firma en sí.
    SELECT tr.id, tr.is_titular, tr.nombre, tr.apellido_primero, tr.apellido_segundo,
           tr.tipo_documento, tr.numero_documento, tr.fecha_nacimiento,
           (tr.fecha_nacimiento IS NOT NULL
             AND date_part('year', age(current_date::timestamp, tr.fecha_nacimiento::timestamp)) < 18),
           (tr.firma_base64 IS NOT NULL AND length(tr.firma_base64) > 100),
           tr.documento_verificado_at, tr.submitted_at, tr.created_at
      FROM public.traveler_records tr
     WHERE tr.booking_id = p_booking_id
       AND public.tjm_puede_gestionar()
     ORDER BY tr.is_titular DESC, tr.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.tjm_checkin_personas(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tjm_checkin_personas(bigint) FROM anon;  -- Supabase lo da solo al crearla
GRANT EXECUTE ON FUNCTION public.tjm_checkin_personas(bigint) TO authenticated, service_role;

-- ---------------------------------------------------------------- 2
CREATE OR REPLACE FUNCTION public.tjm_correo_del_titular_a_la_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_email text := lower(trim(coalesce(NEW.email, '')));
    v_tel   text := nullif(trim(coalesce(NEW.telefono_movil, NEW.telefono_fijo, '')), '');
BEGIN
    IF NOT NEW.is_titular THEN
        RETURN NEW;
    END IF;

    -- Solo un correo que parezca correo y no sea otro relleno.
    IF v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       AND v_email NOT LIKE '%@example.invalid'
       AND v_email NOT LIKE '%@tiojosemaria.local' THEN
        UPDATE public.guest_bookings b
           SET guest_email = v_email,
               updated_at  = now()
         WHERE b.id = NEW.booking_id
           AND (b.guest_email IS NULL OR b.guest_email = ''
                OR lower(b.guest_email) LIKE '%@example.invalid'
                OR lower(b.guest_email) LIKE '%@tiojosemaria.local');
    END IF;

    IF v_tel IS NOT NULL THEN
        UPDATE public.guest_bookings b
           SET guest_phone = v_tel,
               updated_at  = now()
         WHERE b.id = NEW.booking_id
           AND (b.guest_phone IS NULL OR b.guest_phone = '');
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tjm_correo_del_titular_a_la_reserva() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_correo_del_titular_a_la_reserva ON public.traveler_records;
CREATE TRIGGER trg_correo_del_titular_a_la_reserva
    AFTER INSERT OR UPDATE OF email, telefono_movil, telefono_fijo, is_titular ON public.traveler_records
    FOR EACH ROW EXECUTE FUNCTION public.tjm_correo_del_titular_a_la_reserva();

-- ---------------------------------------------------------------- 3
CREATE OR REPLACE FUNCTION public.ensure_customer_exists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    IF NEW.guest_email IS NOT NULL AND NEW.guest_email <> ''
       AND lower(NEW.guest_email) NOT LIKE '%@example.invalid' THEN
        INSERT INTO public.customers (email, canonical_name, phone)
        VALUES (LOWER(TRIM(NEW.guest_email)), NEW.guest_name, NEW.guest_phone)
        ON CONFLICT (email) DO UPDATE SET
            canonical_name = COALESCE(public.customers.canonical_name, EXCLUDED.canonical_name),
            phone = COALESCE(EXCLUDED.phone, public.customers.phone),
            updated_at = now();
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------- lo que ya estaba
-- Las reservas con check-in hecho y correo de relleno: se les pone el del
-- titular ahora (hoy: la de Emilia). Tocar la fila dispara el trigger de arriba.
UPDATE public.traveler_records tr
   SET email = tr.email
  FROM public.guest_bookings b
 WHERE b.id = tr.booking_id
   AND tr.is_titular
   AND coalesce(tr.email, '') <> ''
   AND (b.guest_email IS NULL OR b.guest_email = ''
        OR lower(b.guest_email) LIKE '%@example.invalid'
        OR lower(b.guest_email) LIKE '%@tiojosemaria.local');

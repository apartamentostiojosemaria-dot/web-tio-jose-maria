-- 0014 — Lo que hace falta para que el check-in se haga con el movil DEL HUESPED.
--
-- Contexto (10-sep-2026): el precheckin se penso para UN enlace por correo que
-- rellenaba una persona. El check-in en persona funciona al reves: se ensena un
-- QR y cada huesped rellena lo suyo desde SU movil. Eso destapo cinco cosas:
--
--   1. `submit_traveler_records` BORRABA a los anteriores -> el segundo movil
--      dejaba fuera al primero. Es el fallo grave.
--   2. `anon` puede ESCRIBIR el parte pero no puede LEER la reserva, asi que al
--      escanear el QR salia "No encontramos esa reserva".
--   3. `traveler_records` solo la lee `admin`: la madre (rol staff) veria la
--      lista vacia, sin error.
--   4. No habia donde apuntar que ella ha COMPROBADO el documento contra el DNI
--      que tiene delante, que es lo unico que el art. 4.3 le exige.
--   5. El titular del pago que declara el huesped no tenia por donde entrar.
--
-- Y ademas `traveler_records` no estaba publicada en realtime, asi que la
-- pantalla no se enteraba de que entraba gente nueva.

-- ---------------------------------------------------------------------------
-- 1. Identidad de un viajero, para no duplicar ni pisar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tjm_clave_viajero(
    p_nombre text, p_apellido text, p_nacimiento date, p_documento text
) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
    -- Con documento, manda el documento. Los menores suelen no tenerlo, asi que
    -- para ellos la identidad es nombre + apellido + fecha de nacimiento.
    SELECT COALESCE(
        NULLIF(upper(btrim(COALESCE(p_documento, ''))), ''),
        'SIN-DOC:' || lower(btrim(COALESCE(p_nombre, ''))) || '|'
                   || lower(btrim(COALESCE(p_apellido, ''))) || '|'
                   || COALESCE(p_nacimiento::text, '')
    );
$$;

COMMENT ON FUNCTION public.tjm_clave_viajero(text, text, date, text) IS
    'Identifica a un viajero dentro de una reserva. Con documento, el documento; sin el (menores), nombre+apellido+nacimiento.';

-- ---------------------------------------------------------------------------
-- 2. El precheckin ANADE en vez de reemplazar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_traveler_records(p_booking_code text, p_travelers jsonb)
 RETURNS TABLE(saved integer, booking_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_booking_id bigint;
    v_check_in   date;
    v_check_out  date;
    v_status     text;
    v_count      int := 0;
    v_traveler   jsonb;
    v_ids        uuid[] := '{}';
    v_nuevo      uuid;
    v_indice     int;
    v_adulto     uuid;
    v_total      int;
BEGIN
    SELECT id, check_in, check_out, status
      INTO v_booking_id, v_check_in, v_check_out, v_status
      FROM public.guest_bookings
     WHERE booking_code = upper(p_booking_code);

    IF v_booking_id IS NULL THEN
        RAISE EXCEPTION 'booking_not_found' USING ERRCODE = '22023';
    END IF;
    IF v_status NOT IN ('confirmed', 'completed') THEN
        RAISE EXCEPTION 'booking_status_invalid: %', v_status USING ERRCODE = '22023';
    END IF;
    IF v_check_in - current_date > 7 THEN
        RAISE EXCEPTION 'precheckin_too_early' USING ERRCODE = '22023';
    END IF;
    IF v_check_out < current_date THEN
        RAISE EXCEPTION 'booking_already_past' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_travelers) = 0 OR jsonb_array_length(p_travelers) > 20 THEN
        RAISE EXCEPTION 'invalid_traveler_count' USING ERRCODE = '22023';
    END IF;

    -- ANTES: se borraban TODAS las fichas sin comunicar de la reserva, asi que
    -- el segundo movil borraba al primero. AHORA solo se retiran las fichas de
    -- las personas que vienen en ESTA entrega (para que alguien pueda corregir
    -- lo suyo), y los demas se quedan donde estaban.
    DELETE FROM public.traveler_records tr
     WHERE tr.booking_id = v_booking_id
       AND tr.submitted_at IS NULL
       AND public.tjm_clave_viajero(tr.nombre, tr.apellido_primero, tr.fecha_nacimiento, tr.numero_documento)
           IN (SELECT public.tjm_clave_viajero(
                          t->>'nombre', t->>'apellido_primero',
                          NULLIF(t->>'fecha_nacimiento','')::date, t->>'numero_documento')
                 FROM jsonb_array_elements(p_travelers) t);

    FOR v_traveler IN SELECT * FROM jsonb_array_elements(p_travelers) LOOP
        INSERT INTO public.traveler_records (
            booking_id, is_titular,
            apellido_primero, apellido_segundo, nombre, sexo,
            tipo_documento, numero_documento, soporte_documento,
            nacionalidad, fecha_nacimiento,
            direccion_via, direccion_municipio, direccion_cp, direccion_pais,
            telefono_fijo, telefono_movil, email,
            parentesco, firma_base64
        ) VALUES (
            v_booking_id,
            COALESCE((v_traveler->>'is_titular')::boolean, false),
            v_traveler->>'apellido_primero',
            v_traveler->>'apellido_segundo',
            v_traveler->>'nombre',
            v_traveler->>'sexo',
            v_traveler->>'tipo_documento',
            v_traveler->>'numero_documento',
            v_traveler->>'soporte_documento',
            v_traveler->>'nacionalidad',
            NULLIF(v_traveler->>'fecha_nacimiento','')::date,
            v_traveler->>'direccion_via',
            v_traveler->>'direccion_municipio',
            v_traveler->>'direccion_cp',
            v_traveler->>'direccion_pais',
            v_traveler->>'telefono_fijo',
            v_traveler->>'telefono_movil',
            v_traveler->>'email',
            NULLIF(upper(btrim(COALESCE(v_traveler->>'parentesco', ''))), ''),
            v_traveler->>'firma_base64'
        )
        RETURNING id INTO v_nuevo;

        v_ids  := v_ids || v_nuevo;
        v_count := v_count + 1;
    END LOOP;

    -- Tope de seguridad: nadie mete 50 personas en un apartamento de 4.
    SELECT count(*) INTO v_total FROM public.traveler_records WHERE traveler_records.booking_id = v_booking_id;
    IF v_total > 20 THEN
        RAISE EXCEPTION 'invalid_traveler_count' USING ERRCODE = '22023';
    END IF;

    -- El adulto dice de quien es pariente (contrato de 0011).
    v_indice := 0;
    FOR v_traveler IN SELECT * FROM jsonb_array_elements(p_travelers) LOOP
        v_indice := v_indice + 1;
        IF (v_traveler->>'parentesco_menor_indice') IS NOT NULL THEN
            DECLARE
                v_apunta int := (v_traveler->>'parentesco_menor_indice')::int + 1;
            BEGIN
                IF v_apunta BETWEEN 1 AND array_length(v_ids, 1)
                   AND v_apunta <> v_indice THEN
                    UPDATE public.traveler_records
                       SET parentesco_menor_id = v_ids[v_apunta],
                           updated_at          = now()
                     WHERE id = v_ids[v_indice];
                END IF;
            END;
        END IF;
    END LOOP;

    -- Red de seguridad: parentesco que llego en la ficha del MENOR se pasa al
    -- adulto responsable. Ahora mira a TODOS los adultos de la reserva, no solo
    -- a los de esta entrega: con un movil por persona, el adulto puede haber
    -- entrado antes.
    FOR v_nuevo IN
        SELECT tr.id
          FROM public.traveler_records tr
         WHERE tr.booking_id = v_booking_id
           AND tr.parentesco IS NOT NULL
           AND tr.parentesco_menor_id IS NULL
           AND tr.fecha_nacimiento IS NOT NULL
           AND date_part('year', age(v_check_in::timestamp, tr.fecha_nacimiento::timestamp)) < 18
    LOOP
        SELECT a.id INTO v_adulto
          FROM public.traveler_records a
         WHERE a.booking_id = v_booking_id
           AND a.id <> v_nuevo
           AND a.fecha_nacimiento IS NOT NULL
           AND date_part('year', age(v_check_in::timestamp, a.fecha_nacimiento::timestamp)) >= 18
           AND a.parentesco_menor_id IS NULL
         ORDER BY a.is_titular DESC, a.created_at ASC
         LIMIT 1;

        IF v_adulto IS NOT NULL THEN
            UPDATE public.traveler_records adulto
               SET parentesco          = menor.parentesco,
                   parentesco_menor_id = menor.id,
                   updated_at          = now()
              FROM public.traveler_records menor
             WHERE adulto.id = v_adulto
               AND menor.id  = v_nuevo;

            UPDATE public.traveler_records
               SET parentesco = NULL,
                   updated_at = now()
             WHERE id = v_nuevo;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_count, v_booking_id;
END $function$;

-- ---------------------------------------------------------------------------
-- 3. El huesped que escanea el QR puede LEER su reserva
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tjm_precheckin_reserva(p_booking_code text)
RETURNS TABLE(
    booking_code text, guest_name text, guest_email text, guest_phone text,
    pax_count integer, check_in date, check_out date, status text,
    channel text, payment_status text, apartment_name text, titular_pago text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
    -- El secreto es el propio codigo (TJM-XXXXXX, aleatorio). Ademas solo se
    -- contesta dentro de la ventana del precheckin, para que un codigo viejo no
    -- siga devolviendo el nombre de nadie.
    SELECT b.booking_code, b.guest_name, b.guest_email, b.guest_phone,
           b.pax_count, b.check_in, b.check_out, b.status,
           b.channel, b.payment_status, a.name, b.payment_holder
      FROM public.guest_bookings b
      LEFT JOIN public.apartments a ON a.id = b.apartment_id
     WHERE b.booking_code = upper(btrim(p_booking_code))
       AND b.status IN ('confirmed', 'completed')
       AND b.check_in - current_date <= 7
       AND b.check_out >= current_date;
$$;

COMMENT ON FUNCTION public.tjm_precheckin_reserva(text) IS
    'Lo minimo que necesita el formulario de precheckin. Para anon: el codigo de reserva hace de secreto y solo contesta en la ventana del precheckin.';

REVOKE ALL ON FUNCTION public.tjm_precheckin_reserva(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tjm_precheckin_reserva(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. El huesped declara quien pago
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tjm_guardar_pagador(p_booking_code text, p_titular_pago text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_id bigint; v_titular text;
BEGIN
    v_titular := NULLIF(btrim(COALESCE(p_titular_pago, '')), '');
    IF v_titular IS NULL OR length(v_titular) > 120 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'titular_invalido');
    END IF;

    SELECT id INTO v_id
      FROM public.guest_bookings
     WHERE booking_code = upper(btrim(p_booking_code))
       AND status IN ('confirmed', 'completed')
       AND check_in - current_date <= 7
       AND check_out >= current_date;

    IF v_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reserva_no_encontrada');
    END IF;

    -- Solo se rellena si esta vacio: lo que venga de Stripe o de Booking manda
    -- sobre lo que teclee una persona.
    UPDATE public.guest_bookings
       SET payment_holder = v_titular, updated_at = now()
     WHERE id = v_id AND (payment_holder IS NULL OR btrim(payment_holder) = '');

    RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.tjm_guardar_pagador(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tjm_guardar_pagador(text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Ella ve la lista y apunta que ha comprobado el documento
-- ---------------------------------------------------------------------------
ALTER TABLE public.traveler_records
    ADD COLUMN IF NOT EXISTS documento_verificado_at timestamptz,
    ADD COLUMN IF NOT EXISTS documento_verificado_por text;

COMMENT ON COLUMN public.traveler_records.documento_verificado_at IS
    'Cuando se comprobo el documento contra el original (art. 4.3 RD 933/2021). Lo unico que la ley exige hacer a quien recibe.';

CREATE OR REPLACE FUNCTION public.tjm_checkin_personas(p_booking_id bigint)
RETURNS TABLE(
    id uuid, nombre text, apellido_primero text, apellido_segundo text,
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
    -- compararlos con el DNI que tiene delante. Nada mas: ni domicilio, ni
    -- telefonos, ni la firma en si.
    SELECT tr.id, tr.nombre, tr.apellido_primero, tr.apellido_segundo,
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
GRANT EXECUTE ON FUNCTION public.tjm_checkin_personas(bigint) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tjm_checkin_verificar(p_traveler_id uuid, p_coincide boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_tocadas int;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
    END IF;

    UPDATE public.traveler_records
       SET documento_verificado_at  = CASE WHEN p_coincide THEN now() ELSE NULL END,
           documento_verificado_por = CASE WHEN p_coincide THEN COALESCE(auth.uid()::text, 'sistema') ELSE NULL END,
           updated_at = now()
     WHERE id = p_traveler_id;

    GET DIAGNOSTICS v_tocadas = ROW_COUNT;
    IF v_tocadas = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'persona_no_encontrada');
    END IF;
    RETURN jsonb_build_object('ok', true, 'verificado', p_coincide);
END $$;

REVOKE ALL ON FUNCTION public.tjm_checkin_verificar(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tjm_checkin_verificar(uuid, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Que la pantalla se entere de que entra gente nueva
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
             WHERE pubname = 'supabase_realtime'
               AND schemaname = 'public' AND tablename = 'traveler_records'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.traveler_records;
        END IF;
    END IF;
END $$;
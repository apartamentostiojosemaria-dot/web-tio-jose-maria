-- 0057 — Lo que entra por el formulario del huésped tiene que estar bien, sí o sí.
--
-- 10-oct-2026: tres partes parados o rechazados por datos mal escritos que el formulario
-- dejó pasar (un número de soporte en el campo del correo → 10118 del Ministerio; dos DNI
-- con una cifra cambiada y la misma pareja metida dos veces; un municipio escrito a mano
-- sin código INE; una adulta sin teléfono ni correo). El formulario ya lo comprueba en
-- pantalla (PrecheckinPage.jsx); esta es la puerta: la base no guarda nada que no cuadre,
-- venga de donde venga (un móvil con la versión vieja de la web, el panel, otra entrada).
--
--   1. tjm_validar_viajeros(p_travelers, p_check_in): NULL si todo cuadra; si no, la
--      primera pega en castellano.
--   2. submit_traveler_records: la llama antes de escribir (error 'datos_invalidos: …')
--      y, al volver a rellenar, sustituye también la ficha sin comunicar de la MISMA
--      persona aunque el documento venga distinto (es una corrección: TJM-111).

CREATE OR REPLACE FUNCTION public.tjm_validar_viajeros(p_travelers jsonb, p_check_in date)
 RETURNS text
 LANGUAGE plpgsql STABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    c_letras CONSTANT text := 'TRWAGMYFPDXBNJZSQVHLCKE';
    t        jsonb;
    v_quien  text;
    v_tipo   text;
    v_num    text;
    v_sop    text;
    v_mail   text;
    v_tel    text;
    v_edad   int;
    v_cifras text;
    v_cp     text;
BEGIN
    FOR t IN SELECT * FROM jsonb_array_elements(p_travelers) LOOP
        v_quien := btrim(COALESCE(t->>'nombre', '') || ' ' || COALESCE(t->>'apellido_primero', ''));
        IF v_quien = '' THEN v_quien := 'un viajero'; END IF;
        v_tipo := upper(btrim(COALESCE(t->>'tipo_documento', '')));
        v_num  := upper(regexp_replace(COALESCE(t->>'numero_documento', ''), '[\s.-]', '', 'g'));
        v_sop  := upper(regexp_replace(COALESCE(t->>'soporte_documento', ''), '[\s.-]', '', 'g'));
        v_sop  := translate(left(v_sop, 3), '0', 'O') || substr(v_sop, 4);
        v_mail := btrim(COALESCE(t->>'email', ''));
        v_tel  := regexp_replace(COALESCE(t->>'telefono_movil', ''), '\D', '', 'g');
        v_edad := CASE WHEN NULLIF(t->>'fecha_nacimiento', '') IS NULL THEN NULL
                       ELSE date_part('year', age(p_check_in::timestamp, (t->>'fecha_nacimiento')::date::timestamp))::int END;

        -- Documento: la letra tiene que cuadrar con las cifras.
        IF v_num <> '' AND v_tipo IN ('D', 'NIF', 'DNI') THEN
            IF v_num !~ '^\d{8}[A-Z]$'
               OR substr(c_letras, (left(v_num, 8)::bigint % 23)::int + 1, 1) <> right(v_num, 1) THEN
                RETURN v_quien || ': el DNI ' || v_num || ' no cuadra con su letra';
            END IF;
            IF v_sop !~ '^[A-Z]{3}\d{6}$' THEN
                RETURN v_quien || ': el número de soporte del DNI no tiene la forma de tres letras y seis cifras';
            END IF;
        ELSIF v_num <> '' AND v_tipo IN ('N', 'NIE', 'TIE') THEN
            IF v_num !~ '^[XYZ]\d{7}[A-Z]$' THEN
                RETURN v_quien || ': el NIE ' || v_num || ' no tiene la forma correcta';
            END IF;
            v_cifras := (strpos('XYZ', left(v_num, 1)) - 1)::text || substr(v_num, 2, 7);
            IF substr(c_letras, (v_cifras::bigint % 23)::int + 1, 1) <> right(v_num, 1) THEN
                RETURN v_quien || ': el NIE ' || v_num || ' no cuadra con su letra';
            END IF;
            IF v_sop !~ '^([A-Z]{3}\d{6}|[A-Z]\d{8})$' THEN
                RETURN v_quien || ': el número de soporte del NIE no tiene la forma correcta';
            END IF;
        END IF;

        -- Contacto: con forma correcta, y todo adulto da al menos uno.
        IF v_mail <> '' AND v_mail !~ '^[^@\s]+@[^.\s@]+\.[^\s@]+$' THEN
            RETURN v_quien || ': el correo «' || v_mail || '» no es un correo';
        END IF;
        IF v_tel <> '' AND (length(v_tel) < 9 OR length(v_tel) > 15) THEN
            RETURN v_quien || ': el teléfono no tiene entre 9 y 15 cifras';
        END IF;
        IF v_edad IS NOT NULL AND v_edad >= 18 AND v_mail = '' AND v_tel = '' THEN
            RETURN v_quien || ': falta un teléfono o un correo';
        END IF;

        -- Domicilio en España: municipio del INE y código postal de cinco cifras.
        IF public.fn_ine_es_espana(t->>'direccion_pais') THEN
            v_cp := btrim(COALESCE(t->>'direccion_cp', ''));
            IF v_cp !~ '^\d{5}$' THEN
                RETURN v_quien || ': el código postal tiene que ser de cinco cifras';
            END IF;
            IF COALESCE(NULLIF(t->>'direccion_municipio_ine', ''),
                        public.tjm_ine_municipio(t->>'direccion_municipio', v_cp)) IS NULL THEN
                RETURN v_quien || ': el municipio «' || COALESCE(t->>'direccion_municipio', '') || '» no está en la lista del INE';
            END IF;
        END IF;
    END LOOP;

    -- Lo que no puede repetirse entre dos personas de la misma entrega.
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_travelers) x(v)
                WHERE COALESCE(x.v->>'numero_documento', '') <> ''
                GROUP BY upper(regexp_replace(x.v->>'numero_documento', '[\s.-]', '', 'g')) HAVING count(*) > 1) THEN
        RETURN 'el mismo documento está puesto en dos personas';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_travelers) x(v)
                WHERE COALESCE(x.v->>'soporte_documento', '') <> ''
                GROUP BY upper(regexp_replace(x.v->>'soporte_documento', '[\s.-]', '', 'g')) HAVING count(*) > 1) THEN
        RETURN 'el mismo número de soporte está puesto en dos personas';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_travelers) x(v)
                GROUP BY public.tjm_clave_viajero(x.v->>'nombre', x.v->>'apellido_primero',
                                                  NULLIF(x.v->>'fecha_nacimiento', '')::date, NULL)
                HAVING count(*) > 1) THEN
        RETURN 'la misma persona está dos veces';
    END IF;

    RETURN NULL;
END $$;
COMMENT ON FUNCTION public.tjm_validar_viajeros(jsonb, date) IS
    'Puerta de datos del parte de viajeros: NULL si todo cuadra; si no, la primera pega en castellano. La usa submit_traveler_records (0057).';

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
    v_existente  uuid;
    v_pega       text;
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

    -- Nada que no cuadre llega a la tabla (0057).
    v_pega := public.tjm_validar_viajeros(p_travelers, v_check_in);
    IF v_pega IS NOT NULL THEN
        RAISE EXCEPTION 'datos_invalidos: %', v_pega USING ERRCODE = '22023';
    END IF;

    -- Las fichas SIN comunicar de las personas que vienen en esta entrega se
    -- retiran y se vuelven a crear (así cada uno corrige lo suyo). Las YA
    -- comunicadas se corrigen en el sitio, más abajo.
    DELETE FROM public.traveler_records tr
     WHERE tr.booking_id = v_booking_id
       AND tr.submitted_at IS NULL
       AND public.tjm_clave_viajero(tr.nombre, tr.apellido_primero, tr.fecha_nacimiento, tr.numero_documento)
           IN (SELECT public.tjm_clave_viajero(
                          t->>'nombre', t->>'apellido_primero',
                          NULLIF(t->>'fecha_nacimiento','')::date, t->>'numero_documento')
                 FROM jsonb_array_elements(p_travelers) t);

    -- La misma persona con otro documento es una corrección (TJM-111: el
    -- grupo volvió a rellenarlo con el DNI bien escrito): la ficha vieja sin
    -- comunicar se retira también.
    DELETE FROM public.traveler_records tr
     WHERE tr.booking_id = v_booking_id
       AND tr.submitted_at IS NULL
       AND public.tjm_clave_viajero(tr.nombre, tr.apellido_primero, tr.fecha_nacimiento, NULL)
           IN (SELECT public.tjm_clave_viajero(
                          t->>'nombre', t->>'apellido_primero',
                          NULLIF(t->>'fecha_nacimiento','')::date, NULL)
                 FROM jsonb_array_elements(p_travelers) t);

    FOR v_traveler IN SELECT * FROM jsonb_array_elements(p_travelers) LOOP
        SELECT tr.id INTO v_existente
          FROM public.traveler_records tr
         WHERE tr.booking_id = v_booking_id
           AND public.tjm_clave_viajero(tr.nombre, tr.apellido_primero, tr.fecha_nacimiento, tr.numero_documento)
             = public.tjm_clave_viajero(
                   v_traveler->>'nombre', v_traveler->>'apellido_primero',
                   NULLIF(v_traveler->>'fecha_nacimiento','')::date, v_traveler->>'numero_documento')
         ORDER BY tr.created_at
         LIMIT 1;

        IF v_existente IS NOT NULL THEN
            -- Misma persona, ficha ya comunicada: se corrigen los datos y se
            -- conserva lo del Ministerio (lote, estado, submitted_at).
            UPDATE public.traveler_records SET
                is_titular          = COALESCE((v_traveler->>'is_titular')::boolean, is_titular),
                apellido_primero    = v_traveler->>'apellido_primero',
                apellido_segundo    = v_traveler->>'apellido_segundo',
                nombre              = v_traveler->>'nombre',
                sexo                = v_traveler->>'sexo',
                tipo_documento      = v_traveler->>'tipo_documento',
                numero_documento    = v_traveler->>'numero_documento',
                soporte_documento   = v_traveler->>'soporte_documento',
                nacionalidad        = v_traveler->>'nacionalidad',
                fecha_nacimiento    = NULLIF(v_traveler->>'fecha_nacimiento','')::date,
                direccion_via       = v_traveler->>'direccion_via',
                direccion_municipio = v_traveler->>'direccion_municipio',
                direccion_municipio_ine = NULLIF(v_traveler->>'direccion_municipio_ine', ''),
                direccion_cp        = v_traveler->>'direccion_cp',
                direccion_pais      = v_traveler->>'direccion_pais',
                telefono_fijo       = v_traveler->>'telefono_fijo',
                telefono_movil      = v_traveler->>'telefono_movil',
                email               = v_traveler->>'email',
                parentesco          = NULLIF(upper(btrim(COALESCE(v_traveler->>'parentesco', ''))), ''),
                firma_base64        = COALESCE(v_traveler->>'firma_base64', firma_base64),
                updated_at          = now()
             WHERE id = v_existente;
            v_nuevo := v_existente;
        ELSE
            INSERT INTO public.traveler_records (
                booking_id, is_titular,
                apellido_primero, apellido_segundo, nombre, sexo,
                tipo_documento, numero_documento, soporte_documento,
                nacionalidad, fecha_nacimiento,
                direccion_via, direccion_municipio, direccion_municipio_ine, direccion_cp, direccion_pais,
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
                NULLIF(v_traveler->>'direccion_municipio_ine', ''),
                v_traveler->>'direccion_cp',
                v_traveler->>'direccion_pais',
                v_traveler->>'telefono_fijo',
                v_traveler->>'telefono_movil',
                v_traveler->>'email',
                NULLIF(upper(btrim(COALESCE(v_traveler->>'parentesco', ''))), ''),
                v_traveler->>'firma_base64'
            )
            RETURNING id INTO v_nuevo;
        END IF;

        v_ids  := v_ids || v_nuevo;
        v_count := v_count + 1;
        v_existente := NULL;
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
    -- adulto responsable (mira a TODOS los adultos de la reserva).
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
-- 3. La lista de municipios del formulario volvía «permiso denegado» al huésped
-- ---------------------------------------------------------------------------
-- Visto el 10-oct-2026 al probar este formulario: tjm_municipios_buscar (0042)
-- llama a fn_ine_norm y fn_ine_provincia_por_cp, que la 0007 cerró a `anon` a
-- propósito. Desde el 20-sep la lista no salía nunca y el huésped escribía el
-- municipio a mano (así llegó «San Juan De Alicante» sin código, TJM-111). Se
-- arregla sin reabrir las funciones internas: la búsqueda corre como su dueño.
ALTER FUNCTION public.tjm_municipios_buscar(text, text) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.tjm_municipios_buscar(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tjm_municipios_buscar(text, text) TO anon, authenticated, service_role;

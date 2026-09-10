-- =====================================================================
--  0011 — El precheckin guarda el parentesco donde toca
--
--  Continuacion de `0010`. Alli se añadio `traveler_records.
--  parentesco_menor_id`; aqui se enseña a `submit_traveler_records()` a
--  rellenarlo, que es la RPC por la que entran TODOS los datos del
--  formulario del huesped.
--
--  Aplicado contra produccion (nmtukksbzbnuzqsksdmw) el 10-sep-2026.
--
--  LA FIRMA NO CAMBIA: sigue siendo (p_booking_code text, p_travelers
--  jsonb) y sigue devolviendo (saved, booking_id). `PrecheckinPage.jsx`
--  no se entera de nada. Lo unico que cambia es que ahora se reconoce
--  UNA clave opcional mas dentro de cada objeto del array:
--
--      parentesco_menor_indice   (entero, base 0)
--
--  que dice, en la ficha del ADULTO, a que persona del array se refiere
--  su `parentesco`. Es el contrato nuevo para el formulario.
--
--  Y hay una red debajo: si el formulario sigue mandando el parentesco
--  en la ficha del MENOR (que es como lo manda hoy), la RPC lo pasa sola
--  a la ficha del adulto responsable. Asi el parte sale correcto desde
--  este minuto, sin esperar a que el formulario cambie, y seguira
--  saliendo correcto cuando cambie.
--
--  Por que en el ADULTO — Instrucciones del MIR, campo `parentesco`:
--  «Si alguna de las personas es menor de edad, al menos una de las
--  personas mayores de edad ha de tener informada su relacion de
--  parentesco con esta persona menor de edad».
-- =====================================================================

CREATE OR REPLACE FUNCTION public.submit_traveler_records(
    p_booking_code text,
    p_travelers    jsonb
)
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
    v_ids        uuid[] := '{}';        -- id de cada fila, en el orden del array
    v_nuevo      uuid;
    v_indice     int;
    v_adulto     uuid;
BEGIN
    -- ---- Validaciones: identicas a las de siempre --------------------
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

    -- Reenvio del precheckin: se tiran los viajeros que aun no se han
    -- comunicado. La FK de `parentesco_menor_id` es ON DELETE SET NULL,
    -- asi que esto no deja punteros colgando.
    DELETE FROM public.traveler_records
     WHERE traveler_records.booking_id = v_booking_id
       AND submitted_at IS NULL;

    -- ---- Insercion, guardando el orden -------------------------------
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
            (v_traveler->>'fecha_nacimiento')::date,
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

    -- ---- Contrato NUEVO: el adulto dice de quien es pariente ---------
    v_indice := 0;
    FOR v_traveler IN SELECT * FROM jsonb_array_elements(p_travelers) LOOP
        v_indice := v_indice + 1;                       -- los arrays de SQL empiezan en 1
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

    -- ---- Red de seguridad: el parentesco que llego en el MENOR -------
    -- Se pasa a la ficha del adulto responsable: el titular si es mayor
    -- de edad y, si no, el primer adulto del array. El valor no se toca:
    -- el formulario ya pregunta desde el punto de vista del adulto
    -- («Soy su padre o su madre»), solo estaba guardado en la fila que no
    -- era. Y al menor se le quita, porque el Ministerio lo quiere en el
    -- adulto.
    FOR v_nuevo IN
        SELECT tr.id
          FROM public.traveler_records tr
         WHERE tr.booking_id = v_booking_id
           AND tr.parentesco IS NOT NULL
           AND tr.parentesco_menor_id IS NULL
           AND date_part('year', age(v_check_in::timestamp, tr.fecha_nacimiento::timestamp)) < 18
    LOOP
        SELECT a.id INTO v_adulto
          FROM public.traveler_records a
         WHERE a.booking_id = v_booking_id
           AND a.id <> v_nuevo
           AND date_part('year', age(v_check_in::timestamp, a.fecha_nacimiento::timestamp)) >= 18
           AND a.parentesco_menor_id IS NULL
         ORDER BY a.is_titular DESC, a.created_at ASC
         LIMIT 1;

        -- Sin ningun adulto libre no se toca nada: se deja el dato donde
        -- esta y que la validacion del parte lo cante. Perder el dato
        -- seria peor que tenerlo en la fila equivocada.
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

COMMENT ON FUNCTION public.submit_traveler_records(text, jsonb) IS
  'Guarda los datos del precheckin. Misma firma de siempre. Reconoce la clave opcional parentesco_menor_indice (base 0) en la ficha del ADULTO, y si el parentesco llega en la ficha del MENOR lo pasa solo al adulto responsable, que es donde lo exige el MIR. Migracion 0011.';

REVOKE ALL ON FUNCTION public.submit_traveler_records(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_traveler_records(text, jsonb) TO anon, authenticated, service_role;

-- 0060 — Pedir el dato concreto que falta y que el huésped lo complete solo.
--
-- 10-oct-2026 (auditoría, paquete 5): el parte de TJM-22DC48 estaba parado porque a una
-- acompañante le faltaba el teléfono. El recordatorio mandaba el formulario ENTERO, sin decir
-- qué faltaba: el huésped tenía que adivinarlo y volver a rellenar a esa persona de arriba
-- abajo. Ahora:
--   1. tjm_precheckin_pendientes(code): qué dato falta y de quién (solo el nombre, sin apellidos).
--      No devuelve nada más de la ficha: el enlace lo puede abrir cualquiera que lo tenga.
--   2. tjm_completar_dato(code, id, campo, valor): rellena ESE dato, y solo si sigue faltando.
--      Lista cerrada: contacto (teléfono o correo), soporte del DNI/NIE y código postal.
--      Con las mismas reglas de forma que la 0057.
--   3. Al completarlo se dispara el envío de ese parte al momento (tjm_disparar_parte), sin
--      esperar a la tanda del día siguiente: el plazo legal es de 24 h desde la entrada.

-- ---------------------------------------------------------------------------
-- Reglas de forma compartidas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tjm_correo_real(p text)
 RETURNS boolean LANGUAGE sql IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
    -- Patrón del XSD del Ministerio, y fuera los de relleno y los tapados («m***@***.com»).
    SELECT COALESCE(btrim(p), '') ~ '^[^@\s]+@[^.\s@]+\.[^\s@]+$'
       AND COALESCE(p, '') !~* '(\*|\.invalid$|\.local$)';
$$;

CREATE OR REPLACE FUNCTION public.tjm_telefono_real(p text)
 RETURNS boolean LANGUAGE sql IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT COALESCE(p, '') !~ '\*'
       AND length(regexp_replace(COALESCE(p, ''), '\D', '', 'g')) BETWEEN 9 AND 15;
$$;

CREATE OR REPLACE FUNCTION public.tjm_soporte_normal(p text)
 RETURNS text LANGUAGE sql IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
    -- Sin espacios, puntos ni guiones; un 0 en las tres primeras posiciones es una O.
    SELECT translate(left(s, 3), '0', 'O') || substr(s, 4)
      FROM (SELECT upper(regexp_replace(COALESCE(p, ''), '[\s.-]', '', 'g')) AS s) x;
$$;

CREATE OR REPLACE FUNCTION public.tjm_soporte_cuadra(p_tipo text, p_soporte text)
 RETURNS boolean LANGUAGE sql IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT CASE
        WHEN upper(COALESCE(p_tipo, '')) IN ('D', 'NIF', 'DNI') THEN public.tjm_soporte_normal(p_soporte) ~ '^[A-Z]{3}\d{6}$'
        WHEN upper(COALESCE(p_tipo, '')) IN ('N', 'NIE', 'TIE') THEN public.tjm_soporte_normal(p_soporte) ~ '^([A-Z]{3}\d{6}|[A-Z]\d{8})$'
        ELSE true
    END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Qué falta y de quién
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tjm_precheckin_pendientes(p_booking_code text)
 RETURNS TABLE(id uuid, nombre text, campo text)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
    WITH r AS (
        SELECT gb.id, gb.check_in
          FROM public.guest_bookings gb
         WHERE gb.booking_code = upper(btrim(p_booking_code))
           AND gb.status IN ('confirmed', 'completed')
           AND gb.check_out >= current_date - 1
    ), t AS (
        SELECT tr.*, date_part('year', age(r.check_in::timestamp, tr.fecha_nacimiento::timestamp))::int AS edad
          FROM public.traveler_records tr JOIN r ON r.id = tr.booking_id
         WHERE tr.submitted_at IS NULL
    )
    SELECT t.id, regexp_replace(btrim(t.nombre), '\s+', ' ', 'g'), c.campo
      FROM t
      CROSS JOIN LATERAL (VALUES
        ('contacto', t.edad >= 18
                     AND NOT public.tjm_telefono_real(t.telefono_movil)
                     AND NOT public.tjm_telefono_real(t.telefono_fijo)
                     AND NOT public.tjm_correo_real(t.email)),
        ('soporte',  COALESCE(t.numero_documento, '') <> ''
                     AND upper(COALESCE(t.tipo_documento, '')) IN ('D','NIF','DNI','N','NIE','TIE')
                     AND NOT public.tjm_soporte_cuadra(t.tipo_documento, t.soporte_documento)),
        ('cp',       public.fn_ine_es_espana(t.direccion_pais)
                     AND COALESCE(btrim(t.direccion_cp), '') !~ '^\d{5}$')
      ) AS c(campo, falta)
     WHERE c.falta
     ORDER BY t.is_titular DESC, t.created_at, c.campo;
$$;
COMMENT ON FUNCTION public.tjm_precheckin_pendientes(text) IS
    'Datos concretos que faltan en las fichas sin comunicar de una reserva: id, nombre de pila y campo (contacto | soporte | cp). Nada más de la ficha. 0060.';
REVOKE ALL ON FUNCTION public.tjm_precheckin_pendientes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tjm_precheckin_pendientes(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Mandar ESE parte ya (lo llama tjm_completar_dato; no lo llama nadie de fuera)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tjm_disparar_parte(p_booking_id bigint)
 RETURNS bigint
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_llave text;
    v_id    bigint;
BEGIN
    SELECT decrypted_secret INTO v_llave FROM vault.decrypted_secrets WHERE name = 'ses_cron_token' LIMIT 1;
    IF COALESCE(btrim(v_llave), '') = '' THEN RETURN NULL; END IF;   -- la tanda diaria lo recoge
    SELECT net.http_post(
        url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/submit-ses-hospedajes',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_llave),
        body    := jsonb_build_object('accion', 'mandar', 'booking_id', p_booking_id),
        timeout_milliseconds := 60000
    ) INTO v_id;
    RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.tjm_disparar_parte(bigint) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Completar el dato
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tjm_completar_dato(p_booking_code text, p_id uuid, p_campo text, p_valor text)
 RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_valor   text := btrim(COALESCE(p_valor, ''));
    v_booking bigint;
    v_tipo    text;
    v_ine     text;
    v_sop     text;
BEGIN
    -- Sólo lo que sigue faltando, de esa reserva y de esa persona.
    IF NOT EXISTS (SELECT 1 FROM public.tjm_precheckin_pendientes(p_booking_code) x
                    WHERE x.id = p_id AND x.campo = p_campo) THEN
        RETURN 'no_falta';
    END IF;
    SELECT tr.booking_id, upper(COALESCE(tr.tipo_documento, '')), tr.direccion_municipio_ine
      INTO v_booking, v_tipo, v_ine
      FROM public.traveler_records tr WHERE tr.id = p_id;

    IF p_campo = 'contacto' THEN
        IF position('@' IN v_valor) > 0 THEN
            IF NOT public.tjm_correo_real(v_valor) THEN RETURN 'correo_mal'; END IF;
            UPDATE public.traveler_records SET email = v_valor, updated_at = now() WHERE id = p_id;
        ELSE
            IF NOT public.tjm_telefono_real(v_valor) THEN RETURN 'telefono_mal'; END IF;
            UPDATE public.traveler_records SET telefono_movil = v_valor, updated_at = now() WHERE id = p_id;
        END IF;
    ELSIF p_campo = 'soporte' THEN
        v_sop := public.tjm_soporte_normal(v_valor);
        IF NOT public.tjm_soporte_cuadra(v_tipo, v_sop) THEN RETURN 'soporte_mal'; END IF;
        IF EXISTS (SELECT 1 FROM public.traveler_records o
                    WHERE o.booking_id = v_booking AND o.id <> p_id
                      AND public.tjm_soporte_normal(o.soporte_documento) = v_sop) THEN
            RETURN 'soporte_repetido';
        END IF;
        UPDATE public.traveler_records SET soporte_documento = v_sop, updated_at = now() WHERE id = p_id;
    ELSIF p_campo = 'cp' THEN
        IF v_valor !~ '^\d{5}$' THEN RETURN 'cp_mal'; END IF;
        IF v_ine IS NOT NULL AND left(v_valor, 2) <> left(v_ine, 2) THEN RETURN 'cp_provincia'; END IF;
        UPDATE public.traveler_records SET direccion_cp = v_valor, updated_at = now() WHERE id = p_id;
    ELSE
        RETURN 'no_falta';
    END IF;

    -- Si ya no falta nada de esa reserva, el parte sale ahora.
    IF NOT EXISTS (SELECT 1 FROM public.tjm_precheckin_pendientes(p_booking_code)) THEN
        PERFORM public.tjm_disparar_parte(v_booking);
    END IF;
    RETURN 'ok';
END $$;
COMMENT ON FUNCTION public.tjm_completar_dato(text, uuid, text, text) IS
    'El huésped completa UN dato que falta (contacto | soporte | cp) desde el enlace del recordatorio. Si ya no falta nada, dispara el envío del parte. 0060.';
REVOKE ALL ON FUNCTION public.tjm_completar_dato(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tjm_completar_dato(text, uuid, text, text) TO anon, authenticated, service_role;

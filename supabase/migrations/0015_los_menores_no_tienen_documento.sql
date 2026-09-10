-- 0015 — Un menor de 18 anos puede no tener documento, y la ley no se lo exige.
--
-- Hallado el 10-sep-2026 probando un check-in real con una nina de 8 anos: la
-- tabla exigia `numero_documento` y `tipo_documento` a TODO el mundo. O reventaba
-- el alta, o se colaba una cadena vacia haciendo pasar por documento algo que no
-- lo es. El RD 933/2021 pide documento y parentesco a partir de los 18 (ver
-- docs/CHECKIN-LEGAL.md); por debajo, basta con nombre, apellidos, sexo,
-- nacionalidad y fecha de nacimiento, y el adulto declara el parentesco.

ALTER TABLE public.traveler_records
    ALTER COLUMN numero_documento DROP NOT NULL,
    ALTER COLUMN tipo_documento   DROP NOT NULL;

-- Ademas: el domicilio tampoco se le pide a un menor que vive con el adulto.
ALTER TABLE public.traveler_records
    ALTER COLUMN direccion_via       DROP NOT NULL,
    ALTER COLUMN direccion_municipio DROP NOT NULL,
    ALTER COLUMN direccion_cp        DROP NOT NULL,
    ALTER COLUMN direccion_pais      DROP NOT NULL;

-- Pero un ADULTO sin documento no puede colarse en silencio: lo canta la propia
-- tabla. La edad se mide contra la fecha de nacimiento, que si es obligatoria.
ALTER TABLE public.traveler_records
    DROP CONSTRAINT IF EXISTS traveler_records_adulto_con_documento;

ALTER TABLE public.traveler_records
    ADD CONSTRAINT traveler_records_adulto_con_documento CHECK (
        fecha_nacimiento IS NULL
        OR date_part('year', age(current_date::timestamp, fecha_nacimiento::timestamp)) < 18
        OR (NULLIF(btrim(COALESCE(numero_documento, '')), '') IS NOT NULL
            AND NULLIF(btrim(COALESCE(tipo_documento,   '')), '') IS NOT NULL)
    ) NOT VALID;

-- NOT VALID: no revalida filas antiguas (hoy la tabla esta vacia, pero si
-- manana hubiera historico no queremos que una migracion lo tumbe). Las filas
-- nuevas si se comprueban.

COMMENT ON COLUMN public.traveler_records.numero_documento IS
    'Obligatorio desde los 18 (RD 933/2021 anexo I A.3). Los menores pueden no tenerlo: ahi va NULL, nunca cadena vacia.';

-- Las cadenas vacias no son documentos: se guardan como NULL.
CREATE OR REPLACE FUNCTION public.tjm_normalizar_viajero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    NEW.numero_documento    := NULLIF(btrim(COALESCE(NEW.numero_documento, '')), '');
    NEW.tipo_documento      := NULLIF(btrim(COALESCE(NEW.tipo_documento, '')), '');
    NEW.soporte_documento   := NULLIF(btrim(COALESCE(NEW.soporte_documento, '')), '');
    NEW.direccion_via       := NULLIF(btrim(COALESCE(NEW.direccion_via, '')), '');
    NEW.direccion_municipio := NULLIF(btrim(COALESCE(NEW.direccion_municipio, '')), '');
    NEW.direccion_cp        := NULLIF(btrim(COALESCE(NEW.direccion_cp, '')), '');
    NEW.direccion_pais      := NULLIF(btrim(COALESCE(NEW.direccion_pais, '')), '');
    NEW.apellido_segundo    := NULLIF(btrim(COALESCE(NEW.apellido_segundo, '')), '');
    NEW.email               := NULLIF(btrim(COALESCE(NEW.email, '')), '');
    NEW.telefono_fijo       := NULLIF(btrim(COALESCE(NEW.telefono_fijo, '')), '');
    NEW.telefono_movil      := NULLIF(btrim(COALESCE(NEW.telefono_movil, '')), '');
    RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tjm_normalizar_viajero() FROM PUBLIC;

DROP TRIGGER IF EXISTS traveler_records_normalizar ON public.traveler_records;
CREATE TRIGGER traveler_records_normalizar
    BEFORE INSERT OR UPDATE ON public.traveler_records
    FOR EACH ROW EXECUTE FUNCTION public.tjm_normalizar_viajero();
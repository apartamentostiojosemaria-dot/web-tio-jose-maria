-- =====================================================================
--  0008 — Parte de viajeros (RD 933/2021)
--  Paquetes P3.1–P3.4 del plan «sustituir-misterplan».
--
--  Aplicado contra producción (nmtukksbzbnuzqsksdmw) el 10-sep-2026.
--
--  Todo es ADITIVO o ENSANCHA: no se estrecha ninguna restricción, no
--  se borra ninguna política y no se toca ningún dato.
--
--  La vista `v_parte_estado` sigue exponiendo las MISMAS doce columnas
--  de `0003_rol_staff.sql` (booking_id, booking_code, guest_name,
--  apartment_name, check_in, check_out, pax_count, viajeros_rellenos,
--  faltan, faltan_cuantos, estado_envio, ultimo_envio) y añade dos al
--  final (`completo`, `mandado_a_mano`). Ninguna pantalla se rompe:
--  PanelHome.jsx (usa `faltan`), HojaParte.jsx (`faltan`,
--  `faltan_cuantos`, `viajeros_rellenos`) y ParteViajerosPanel.jsx
--  (`pax_count`, `viajeros_rellenos`, `faltan_cuantos`, `estado_envio`,
--  `ultimo_envio`, `check_in`, `check_out`) leen la vista con
--  `select('*')`. TravelersManager.jsx no toca la vista: lee
--  `traveler_records` con la política de admin.
--
--  Fuentes de los catálogos (verificadas el 10-sep-2026):
--    · «MIR-HOSPE-DSI-WS — Servicio de Hospedajes · Comunicaciones»
--      v3.1.2/v3.1.3, apartado 8 (tablas de códigos) y esquema
--      `tiposGenerales.xsd`.
--    · Instrucciones de alta masiva del MIR, §8.4 (SEXO) y §8.5
--      (TIPO_DOCUMENTO, TIPO_PARENTESCO):
--      https://hospedajes.ses.mir.es/hospedajes-sede/assets/docs/Instrucciones.pdf
--    · RD 933/2021, anexo I y arts. 4, 5.3 y 6.3:
--      https://www.boe.es/buscar/act.php?id=BOE-A-2021-17461
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Parentesco: el catálogo del Ministerio, no el de la primera versión
-- ---------------------------------------------------------------------
-- Hasta ahora el CHECK sólo admitía PA, TU, AB y OT. El catálogo del
-- Ministerio (TIPO_PARENTESCO) es mucho más amplio y 'PA' ni siquiera
-- existe en él: su equivalente es 'PM'. La edge function los traduce
-- (ver PARENTESCO_BD_A_MIR en
-- `supabase/functions/submit-ses-hospedajes/parte-modelo.ts`).
--
-- Se ENSANCHA: se conservan los cuatro antiguos para no invalidar filas
-- ya guardadas, y se añaden los del catálogo.
ALTER TABLE public.traveler_records DROP CONSTRAINT IF EXISTS traveler_records_parentesco_check;
ALTER TABLE public.traveler_records ADD CONSTRAINT traveler_records_parentesco_check
  CHECK (
    parentesco IS NULL
    OR parentesco = ANY (ARRAY[
      -- Catálogo TIPO_PARENTESCO del Ministerio
      'AB','BA','BN','CD','CY','HJ','HR','NI','PM','SB','SG','TI','YN','TU','OT',
      -- Heredados de la primera versión del formulario (se traducen al enviar)
      'PA'
    ])
  );

COMMENT ON COLUMN public.traveler_records.parentesco IS
  'Relacion de parentesco cuando hay un menor de edad (anexo I RD 933/2021). Codigos del catalogo TIPO_PARENTESCO del MIR; PA es heredado y equivale a PM.';


-- ---------------------------------------------------------------------
-- 2. Sexo: admitir también la 'O' del Ministerio
-- ---------------------------------------------------------------------
-- El catálogo del MIR es H / M / O. La columna admitía H / M / X. Se
-- añade 'O' sin quitar la 'X', que es lo que guarda el formulario hoy y
-- lo que la edge function traduce a 'O' al enviar.
ALTER TABLE public.traveler_records DROP CONSTRAINT IF EXISTS traveler_records_sexo_check;
ALTER TABLE public.traveler_records ADD CONSTRAINT traveler_records_sexo_check
  CHECK (sexo = ANY (ARRAY['H','M','O','X']));

COMMENT ON COLUMN public.traveler_records.sexo IS
  'H hombre / M mujer / O u X sin especificar. El MIR usa H, M y O; la X es la que guarda el formulario y se traduce a O al enviar.';


-- ---------------------------------------------------------------------
-- 3. Semáforo del parte: dos columnas más y un estado que no mentía
-- ---------------------------------------------------------------------
-- Reemplaza la función de `0003_rol_staff.sql` AÑADIENDO columnas al
-- final (no se quita ninguna, así ninguna pantalla se rompe):
--
--   · `completo`       → cierto cuando han rellenado todos.
--   · `mandado_a_mano` → distingue el parte que mandó la persona por su
--     vía de siempre del que fue por el servicio web.
--
-- Y corrige el cómputo de errores: además de 'error' y 'retry', ahora
-- cuenta también 'rechazado'.
--
-- OJO: añadir columnas a un RETURNS TABLE cambia el tipo de retorno y
-- `CREATE OR REPLACE FUNCTION` lo rechaza (42P13). Hay que tirar antes
-- la vista que depende de ella, y luego la función.
DROP VIEW IF EXISTS public.v_parte_estado;
DROP FUNCTION IF EXISTS public.tjm_parte_estado();

CREATE FUNCTION public.tjm_parte_estado()
 RETURNS TABLE(
    booking_id        bigint,
    booking_code      text,
    guest_name        text,
    apartment_name    text,
    check_in          date,
    check_out         date,
    pax_count         integer,
    viajeros_rellenos integer,
    faltan            boolean,
    faltan_cuantos    integer,
    estado_envio      text,
    ultimo_envio      timestamptz,
    completo          boolean,
    mandado_a_mano    boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT
        gb.id,
        gb.booking_code,
        gb.guest_name,
        a.name,
        gb.check_in,
        gb.check_out,
        gb.pax_count,
        t.n::int,
        (t.n < COALESCE(gb.pax_count, 1)),
        GREATEST(COALESCE(gb.pax_count, 1) - t.n, 0)::int,
        CASE
            WHEN t.n = 0                     THEN 'sin_datos'
            WHEN t.con_error > 0             THEN 'error'
            WHEN t.enviados = t.n            THEN 'enviado'
            ELSE 'pendiente_envio'
        END,
        t.ultimo,
        (t.n > 0 AND t.n >= COALESCE(gb.pax_count, 1)),
        (t.a_mano > 0)
    FROM public.guest_bookings gb
    JOIN public.apartments a ON a.id = gb.apartment_id
    CROSS JOIN LATERAL (
        SELECT
            count(*)::int AS n,
            count(*) FILTER (WHERE tr.submitted_at IS NOT NULL)::int AS enviados,
            count(*) FILTER (WHERE tr.mir_response_status IN ('error','retry','rechazado'))::int AS con_error,
            count(*) FILTER (WHERE tr.mir_response_status = 'enviado_a_mano')::int AS a_mano,
            max(tr.submitted_at) AS ultimo
        FROM public.traveler_records tr
        WHERE tr.booking_id = gb.id
    ) t
    WHERE public.is_staff()
      AND gb.status IN ('confirmed', 'completed')
      AND gb.check_out >= current_date - 90;
$function$;

COMMENT ON FUNCTION public.tjm_parte_estado() IS
  'Semaforo del parte de viajeros. Devuelve 0 filas si quien llama no es staff ni admin. NUNCA expone nombre, documento ni direccion de los viajeros.';

-- La vista se recrea porque la funcion cambia de firma (dos columnas
-- mas). Se enumeran las columnas a proposito: las doce viejas primero y
-- en el mismo orden, para que nada que dependa del orden se mueva.
CREATE VIEW public.v_parte_estado WITH (security_invoker = true) AS
  SELECT
      booking_id,
      booking_code,
      guest_name,
      apartment_name,
      check_in,
      check_out,
      pax_count,
      viajeros_rellenos,
      faltan,
      faltan_cuantos,
      estado_envio,
      ultimo_envio,
      completo,
      mandado_a_mano
  FROM public.tjm_parte_estado();

COMMENT ON VIEW public.v_parte_estado IS
  'Estado del parte de viajeros por reserva, sin datos personales. Es la UNICA via por la que staff toca traveler_records.';

REVOKE ALL ON FUNCTION public.tjm_parte_estado() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_parte_estado() FROM anon;
GRANT EXECUTE ON FUNCTION public.tjm_parte_estado() TO authenticated, service_role;

REVOKE ALL ON public.v_parte_estado FROM PUBLIC;
REVOKE ALL ON public.v_parte_estado FROM anon;
GRANT SELECT ON public.v_parte_estado TO authenticated, service_role;


-- ---------------------------------------------------------------------
-- 4. Índice para el semáforo
-- ---------------------------------------------------------------------
-- El semáforo hace un LATERAL por reserva sobre `traveler_records`.
CREATE INDEX IF NOT EXISTS traveler_records_booking_id_idx
  ON public.traveler_records (booking_id);


-- ---------------------------------------------------------------------
-- 5. Borrado a los tres años (art. 5.3 del RD 933/2021)
-- ---------------------------------------------------------------------
-- Los datos del registro se conservan TRES AÑOS desde el fin del
-- servicio. Esta función deja el rastro de que el parte existió y se
-- comunicó, pero borra todo lo identificable.
CREATE OR REPLACE FUNCTION public.tjm_purgar_partes_caducados()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_borrados integer;
BEGIN
    WITH caducados AS (
        SELECT tr.id
        FROM public.traveler_records tr
        JOIN public.guest_bookings gb ON gb.id = tr.booking_id
        WHERE gb.check_out < current_date - INTERVAL '3 years'
    )
    UPDATE public.traveler_records tr
       SET nombre               = 'BORRADO',
           apellido_primero     = 'BORRADO',
           apellido_segundo     = NULL,
           numero_documento     = 'BORRADO',
           soporte_documento    = NULL,
           fecha_nacimiento     = '1900-01-01',
           direccion_via        = 'BORRADO',
           direccion_municipio  = 'BORRADO',
           direccion_cp         = '00000',
           telefono_fijo        = NULL,
           telefono_movil       = NULL,
           email                = NULL,
           firma_base64         = NULL,
           mir_response_payload = jsonb_build_object(
               'purgado_en', now(),
               'motivo', 'plazo de tres anos del art. 5.3 RD 933/2021'),
           updated_at           = now()
      FROM caducados c
     WHERE tr.id = c.id
       AND tr.nombre <> 'BORRADO';

    GET DIAGNOSTICS v_borrados = ROW_COUNT;
    RETURN v_borrados;
END $function$;

COMMENT ON FUNCTION public.tjm_purgar_partes_caducados() IS
  'Anonimiza los partes de viajero con mas de 3 anos desde la salida (art. 5.3 RD 933/2021). Devuelve cuantas filas ha tocado.';

REVOKE ALL ON FUNCTION public.tjm_purgar_partes_caducados() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_purgar_partes_caducados() FROM anon;
REVOKE ALL ON FUNCTION public.tjm_purgar_partes_caducados() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tjm_purgar_partes_caducados() TO service_role;


-- ---------------------------------------------------------------------
-- 6. Lo que queda por hacer DESPUÉS de esta migración
-- ---------------------------------------------------------------------
--  a) `src/pages/PrecheckinPage.jsx`: ampliar la lista PARENTESCOS al
--     catálogo del Ministerio (hijo/a, nieto/a, hermano/a, sobrino/a…)
--     y quitar el comentario que explica por qué estaba recortada.
--  b) Programar `tjm_purgar_partes_caducados()` (pg_cron mensual o un
--     job de tjm-jobs) y anotarlo en `supabase/MANIFEST.md`.

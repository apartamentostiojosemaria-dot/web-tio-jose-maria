-- 0058 — El semáforo del parte dice la verdad.
--
-- 10-oct-2026: el parte de TJM-22DC48 estaba parado («faltan_datos»: una acompañante sin
-- teléfono ni correo) y el panel lo pintaba en VERDE, «Todos han rellenado sus datos»,
-- con el plazo de 24 h venciendo ese mismo día. tjm_parte_estado() solo contaba como
-- problema error/retry/rechazado, y daba «enviado» en cuanto había submitted_at, aunque
-- el Ministerio aún no hubiera contestado.
--
-- estado_envio ahora:
--   sin_datos        nadie ha rellenado
--   faltan_datos     hay fichas, pero el parte no puede salir: `motivo` dice qué falta
--   error            el Ministerio lo rechazó o no se pudo mandar: `motivo`
--   pendiente_envio  listo, sale en la pasada siguiente
--   esperando        mandado; el Ministerio aún no lo ha confirmado
--   enviado          aceptado por el Ministerio (o mandado a mano)
-- Columna nueva al final: `motivo` (el último mensaje de la ficha con problema).

DROP VIEW IF EXISTS public.v_parte_estado;
DROP FUNCTION IF EXISTS public.tjm_parte_estado();

CREATE FUNCTION public.tjm_parte_estado()
 RETURNS TABLE(booking_id bigint, booking_code text, guest_name text, apartment_name text,
               check_in date, check_out date, pax_count integer, viajeros_rellenos integer,
               faltan boolean, faltan_cuantos integer, estado_envio text,
               ultimo_envio timestamp with time zone, completo boolean, mandado_a_mano boolean,
               motivo text)
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
            WHEN t.n = 0                               THEN 'sin_datos'
            WHEN t.con_error > 0                       THEN 'error'
            WHEN t.faltan_datos > 0                    THEN 'faltan_datos'
            WHEN t.enviados = t.n AND t.esperando > 0  THEN 'esperando'
            WHEN t.enviados = t.n                      THEN 'enviado'
            ELSE 'pendiente_envio'
        END,
        t.ultimo,
        (t.n > 0 AND t.n >= COALESCE(gb.pax_count, 1)),
        (t.a_mano > 0),
        t.motivo
    FROM public.guest_bookings gb
    JOIN public.apartments a ON a.id = gb.apartment_id
    CROSS JOIN LATERAL (
        SELECT
            count(*)::int AS n,
            count(*) FILTER (WHERE tr.submitted_at IS NOT NULL)::int AS enviados,
            count(*) FILTER (WHERE tr.mir_response_status IN ('error','retry','rechazado'))::int AS con_error,
            count(*) FILTER (WHERE tr.mir_response_status = 'faltan_datos'
                               AND tr.submitted_at IS NULL)::int AS faltan_datos,
            count(*) FILTER (WHERE tr.mir_response_status = 'enviado_pendiente_acuse')::int AS esperando,
            count(*) FILTER (WHERE tr.mir_response_status = 'enviado_a_mano')::int AS a_mano,
            max(tr.submitted_at) AS ultimo,
            (SELECT x.mir_response_payload->>'mensaje'
               FROM public.traveler_records x
              WHERE x.booking_id = gb.id
                AND x.mir_response_status IN ('faltan_datos','error','retry','rechazado')
              ORDER BY x.updated_at DESC LIMIT 1) AS motivo
        FROM public.traveler_records tr
        WHERE tr.booking_id = gb.id
    ) t
    WHERE public.is_staff()
      AND gb.status IN ('confirmed', 'completed')
      AND gb.check_out >= current_date - 90;
$function$;

REVOKE ALL ON FUNCTION public.tjm_parte_estado() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tjm_parte_estado() TO authenticated, service_role;

CREATE VIEW public.v_parte_estado WITH (security_invoker = true) AS
    SELECT * FROM public.tjm_parte_estado();
REVOKE ALL ON public.v_parte_estado FROM PUBLIC, anon;
GRANT SELECT ON public.v_parte_estado TO authenticated, service_role;

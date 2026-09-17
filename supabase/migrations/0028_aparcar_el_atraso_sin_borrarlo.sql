-- 0028 · Un estado para lo aparcado: 'aparcado'
-- ============================================
-- El 17-sep-2026 se mando la primera comunicacion real al MIR. Quedan 13
-- reservas con la entrada YA PASADA (12 'completed' de mayo a agosto y una
-- 'confirmed' del 20-jul) cuya comunicacion nunca salio, desde el alta de
-- abril de 2025.
--
-- Mandarlas es lo correcto en abstracto —fuera de plazo es infraccion leve,
-- omitir es grave— pero antes hay que saber que ha estado mandando la madre
-- de Jesus por su cuenta y que dice la abogada. Hasta entonces NO deben
-- salir solas en el barrido horario.
--
-- Aparcar no es 'no_procede' (si procede) ni 'enviado_a_mano' (nadie ha dicho
-- que se mandara). Por eso un estado propio: dice la verdad y se ve en el
-- panel. Desaparcar = volver a 'pendiente_de_alta'. No se borra nada.
--
-- Este fichero solo cambia el filtro. El estado entra en la restriccion de la
-- tabla en 0028b, y el marcado de las 13 filas se hizo con un UPDATE fuera de
-- migracion (son datos, no esquema).

CREATE OR REPLACE FUNCTION public.tjm_ses_pendientes()
 RETURNS TABLE(booking_id bigint, booking_code text, tipo text, estado text, intentos integer, desde timestamp with time zone, limite_24h timestamp with time zone, fuera_de_plazo boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    -- RESERVAS confirmadas que todavia no se han comunicado.
    SELECT gb.id, gb.booking_code, 'reserva'::text,
           COALESCE(c.estado, 'pendiente'),
           COALESCE(c.intentos, 0),
           gb.created_at,
           gb.created_at + INTERVAL '24 hours',
           now() > gb.created_at + INTERVAL '24 hours'
      FROM public.guest_bookings gb
      LEFT JOIN public.ses_comunicaciones c
             ON c.booking_id = gb.id AND c.tipo = 'reserva'
     WHERE public.tjm_puede_gestionar()
       AND gb.status IN ('confirmed','completed')
       AND gb.reserva_comunicada_at IS NULL
       AND COALESCE(c.estado, 'pendiente') NOT IN ('enviado_a_mano','no_procede','aparcado')

    UNION ALL

    -- ANULACIONES de reservas que SI se llegaron a comunicar. Si el MIR
    -- nunca vio la reserva no hay nada que anular: eso se marca como
    -- 'no_procede' y no se manda, antes que mandar la baja de algo
    -- inexistente y comerse un rechazo.
    SELECT gb.id, gb.booking_code, 'anulacion'::text,
           COALESCE(c.estado, 'pendiente'),
           COALESCE(c.intentos, 0),
           gb.updated_at,
           gb.updated_at + INTERVAL '24 hours',
           now() > gb.updated_at + INTERVAL '24 hours'
      FROM public.guest_bookings gb
      LEFT JOIN public.ses_comunicaciones c
             ON c.booking_id = gb.id AND c.tipo = 'anulacion'
     WHERE public.tjm_puede_gestionar()
       AND gb.status = 'cancelled'
       AND gb.reserva_comunicada_at IS NOT NULL
       AND gb.anulacion_comunicada_at IS NULL
       AND COALESCE(c.estado, 'pendiente') NOT IN ('enviado_a_mano','no_procede','aparcado');
$function$;

-- 0031 — Las reservas de prueba no van a la policía.
-- ==================================================
-- Entre las 13 comunicaciones «aparcadas» del 17-sep estaba TJM-DD4B28: la
-- reserva de PRUEBA de Jesús (source = 'test', julio-2026, a su nombre). Nadie
-- durmió ahí. Comunicarla al MIR sería declarar una estancia falsa, y el
-- barrido no distinguía las de prueba de las reales: cualquier prueba futura
-- habría acabado en el Ministerio.
--
-- Dos cosas: el barrido de reservas ignora source = 'test' (el del parte de
-- viajeros lo hace en la función, mismo commit), y la de DD4B28 pasa a
-- 'no_procede' con el motivo escrito.

CREATE OR REPLACE FUNCTION public.tjm_ses_pendientes()
 RETURNS TABLE(booking_id bigint, booking_code text, tipo text, estado text, intentos integer, desde timestamp with time zone, limite_24h timestamp with time zone, fuera_de_plazo boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
       AND COALESCE(gb.source, '') <> 'test'
       AND gb.reserva_comunicada_at IS NULL
       AND COALESCE(c.estado, 'pendiente') NOT IN ('enviado_a_mano','no_procede','aparcado')

    UNION ALL

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
       AND COALESCE(gb.source, '') <> 'test'
       AND gb.reserva_comunicada_at IS NOT NULL
       AND gb.anulacion_comunicada_at IS NULL
       AND COALESCE(c.estado, 'pendiente') NOT IN ('enviado_a_mano','no_procede','aparcado');
$function$;

UPDATE public.ses_comunicaciones c
   SET estado = 'no_procede',
       mensaje = 'Reserva de prueba (source = test): nadie se alojó. No se comunica.',
       updated_at = now()
  FROM public.guest_bookings gb
 WHERE gb.id = c.booking_id
   AND gb.source = 'test'
   AND c.estado = 'aparcado';

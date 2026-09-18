-- 0038 — El precheckin sabe quién está ya.
--
-- Con dos móviles pasaba esto (visto el 18-sep-2026): el primero rellena su
-- ficha y envía; el segundo abre el mismo enlace y ve al titular prellenado
-- y una ficha vacía, sin forma de saber que el primero ya está. Tenía que
-- borrar al titular o rellenar a los dos. Nadie lo adivina en la puerta.
--
-- Arreglo: la función pública del precheckin devuelve además cuántas fichas
-- hay ya enviadas y los NOMBRES DE PILA de esas personas (nada más: ni
-- apellidos ni documentos), para que el formulario ofrezca solo lo que
-- falta («Ya tenemos a Jesús. Falta 1 de 2»). Cambia la forma del resultado,
-- así que se suelta y se vuelve a crear, con sus permisos.

DROP FUNCTION IF EXISTS public.tjm_precheckin_reserva(text);

CREATE FUNCTION public.tjm_precheckin_reserva(p_booking_code text)
RETURNS TABLE (
    booking_code   text,
    guest_name     text,
    guest_email    text,
    guest_phone    text,
    pax_count      integer,
    check_in       date,
    check_out      date,
    status         text,
    channel        text,
    payment_status text,
    apartment_name text,
    titular_pago   text,
    ventana        text,
    rellenas       integer,
    nombres_ya     text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
    WITH r AS (
        SELECT b.id, b.booking_code, b.guest_name, b.guest_email, b.guest_phone,
               b.pax_count, b.check_in, b.check_out, b.status, b.channel,
               b.payment_status, a.name AS apartment_name, b.payment_holder,
               CASE
                   WHEN b.status = 'cancelled'                      THEN 'cancelada'
                   WHEN b.status NOT IN ('confirmed', 'completed') THEN 'sin_confirmar'
                   WHEN b.check_out < current_date                 THEN 'pasada'
                   WHEN b.check_in - current_date > 7              THEN 'pronto'
                   ELSE 'abierta'
               END AS ventana
          FROM public.guest_bookings b
          LEFT JOIN public.apartments a ON a.id = b.apartment_id
         WHERE b.booking_code = upper(btrim(p_booking_code))
    ),
    f AS (
        SELECT t.booking_id,
               count(*)::integer AS rellenas,
               array_agg(COALESCE(NULLIF(btrim(t.nombre), ''), '—') ORDER BY t.is_titular DESC, t.created_at) AS nombres_ya
          FROM public.traveler_records t
         WHERE t.booking_id = (SELECT id FROM r)
         GROUP BY t.booking_id
    )
    SELECT r.booking_code,
           CASE WHEN r.ventana = 'abierta' THEN r.guest_name     END,
           CASE WHEN r.ventana = 'abierta' THEN r.guest_email    END,
           CASE WHEN r.ventana = 'abierta' THEN r.guest_phone    END,
           CASE WHEN r.ventana = 'abierta' THEN r.pax_count      END,
           r.check_in,                                   -- para decir cuándo se abre
           CASE WHEN r.ventana = 'abierta' THEN r.check_out      END,
           r.status,
           CASE WHEN r.ventana = 'abierta' THEN r.channel        END,
           CASE WHEN r.ventana = 'abierta' THEN r.payment_status END,
           CASE WHEN r.ventana = 'abierta' THEN r.apartment_name END,
           CASE WHEN r.ventana = 'abierta' THEN r.payment_holder END,
           r.ventana,
           CASE WHEN r.ventana = 'abierta' THEN COALESCE(f.rellenas, 0) ELSE 0 END,
           CASE WHEN r.ventana = 'abierta' THEN COALESCE(f.nombres_ya, ARRAY[]::text[]) ELSE ARRAY[]::text[] END
      FROM r LEFT JOIN f ON f.booking_id = r.id;
$function$;

REVOKE ALL ON FUNCTION public.tjm_precheckin_reserva(text) FROM public;
GRANT EXECUTE ON FUNCTION public.tjm_precheckin_reserva(text)
    TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.tjm_precheckin_reserva(text) IS
    'Lo que el formulario público del precheckin necesita saber de una reserva, por código. Fuera de la ventana no suelta datos personales. Desde 0038 dice cuántas fichas hay ya y sus nombres de pila.';

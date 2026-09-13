-- 0018 — El formulario del huésped dice CUÁNDO se abre, en vez de «no
-- encontramos esa reserva».
--
-- Motivo (punto 4 de la prueba del 11-sep-2026, plan §7 bis): el enlace del
-- prechequeo solo contesta desde siete días antes de la llegada. Quien lo
-- abría antes —y es lo normal: el enlace va en el correo de confirmación—
-- veía «No encontramos esa reserva», que suena a que su reserva no existe.
-- El huésped se queda preocupado y llama; la madre no sabe qué contestar.
--
-- La función seguía siendo la correcta: fuera de la ventana no puede soltar
-- el nombre, el correo ni el teléfono de nadie, porque contesta a `anon` con
-- el solo código de reserva por secreto. Lo que faltaba era DECIR POR QUÉ.
--
-- A partir de aquí devuelve SIEMPRE una fila si el código existe, con:
--   · `ventana` = abierta | pronto | pasada | cancelada | sin_confirmar
--   · `check_in`, para poder decir el día exacto en que se abre
--   · el resto de los campos SOLO cuando la ventana está abierta (fuera de
--     ella van a NULL: ni nombre, ni correo, ni teléfono, ni apartamento).
--
-- Cambia la forma de lo que devuelve, así que hay que soltarla y volver a
-- crearla: eso borra los permisos, y por eso se vuelven a dar abajo —
-- `anon` es quien la llama desde el móvil del huésped.

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
    ventana        text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
    WITH r AS (
        SELECT b.booking_code, b.guest_name, b.guest_email, b.guest_phone,
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
           r.ventana
      FROM r;
$function$;

REVOKE ALL ON FUNCTION public.tjm_precheckin_reserva(text) FROM public;
GRANT EXECUTE ON FUNCTION public.tjm_precheckin_reserva(text)
    TO anon, authenticated, service_role;

-- 0017 — La limpieza SIGUE a la reserva cuando se mueve o se cancela.
--
-- Motivo (medido el 11-sep-2026 probando el panel en el navegador de Jesús):
--   1. Se cambió una reserva del 9-11 de febrero al 15-17 de septiembre desde
--      «Cambiar fechas o apartamento». La tarea de limpieza se quedó en el
--      11 de febrero: la madre habría visto una limpieza fantasma en febrero y
--      ninguna el 17 de septiembre.
--   2. Se canceló esa misma reserva. La limpieza pendiente siguió ahí, y «Hoy»
--      la habría reclamado como atrasada al pasar la fecha.
--
-- La tarea de limpieza que nace de una reserva (`booking_out_id`) es de esa
-- reserva: si la reserva cambia de fechas o de apartamento, la tarea PENDIENTE
-- se mueve con ella; si la reserva se cancela, la tarea pendiente se borra.
-- Las tareas ya empezadas o hechas no se tocan: son historia.

CREATE OR REPLACE FUNCTION public.cleaning_follows_booking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Cancelada: la limpieza pendiente sobra.
    IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
        DELETE FROM public.cleaning_tasks
         WHERE booking_out_id = NEW.id
           AND status = 'pending';
        RETURN NEW;
    END IF;

    -- Movida (fechas o apartamento): la limpieza pendiente se mueve con ella.
    IF NEW.status IN ('confirmed', 'completed')
       AND (NEW.check_out IS DISTINCT FROM OLD.check_out
            OR NEW.apartment_id IS DISTINCT FROM OLD.apartment_id) THEN
        UPDATE public.cleaning_tasks
           SET apartment_id   = NEW.apartment_id,
               scheduled_date = NEW.check_out
         WHERE booking_out_id = NEW.id
           AND status = 'pending'
           -- Si ya hay otra limpieza ese día en ese apartamento, no se duplica.
           AND NOT EXISTS (
               SELECT 1 FROM public.cleaning_tasks c2
                WHERE c2.apartment_id = NEW.apartment_id
                  AND c2.scheduled_date = NEW.check_out
                  AND c2.booking_out_id IS DISTINCT FROM NEW.id
           );
    END IF;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guest_bookings_cleaning_follows ON public.guest_bookings;

CREATE TRIGGER guest_bookings_cleaning_follows
    AFTER UPDATE OF status, check_out, apartment_id ON public.guest_bookings
    FOR EACH ROW EXECUTE FUNCTION public.cleaning_follows_booking();

-- Prueba dentro de la propia migración (se deshace sola).
DO $$
DECLARE
    v_apt  bigint;
    v_id   bigint;
    v_dia  date;
BEGIN
    SELECT id INTO v_apt FROM public.apartments ORDER BY id LIMIT 1;

    INSERT INTO public.guest_bookings (apartment_id, check_in, check_out, pax_count, guest_name, guest_email, status, total_price, source, channel)
    VALUES (v_apt, DATE '2099-01-10', DATE '2099-01-12', 1, 'prueba migracion 0017', 'prueba0017@example.invalid', 'confirmed', 1, 'manual', 'telefono')
    RETURNING id INTO v_id;

    UPDATE public.guest_bookings SET check_out = DATE '2099-01-14' WHERE id = v_id;
    SELECT scheduled_date INTO v_dia FROM public.cleaning_tasks WHERE booking_out_id = v_id AND status = 'pending';
    IF v_dia IS DISTINCT FROM DATE '2099-01-14' THEN
        RAISE EXCEPTION '0017: la limpieza no siguió a la reserva (quedó en %)', v_dia;
    END IF;

    UPDATE public.guest_bookings SET status = 'cancelled' WHERE id = v_id;
    IF EXISTS (SELECT 1 FROM public.cleaning_tasks WHERE booking_out_id = v_id) THEN
        RAISE EXCEPTION '0017: la limpieza sobrevivió a la cancelación';
    END IF;

    DELETE FROM public.guest_bookings WHERE id = v_id;
    DELETE FROM public.customers WHERE email = 'prueba0017@example.invalid';
END $$;

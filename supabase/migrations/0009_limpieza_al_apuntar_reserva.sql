-- 0009 — La limpieza tambien se crea al APUNTAR una reserva a mano.
--
-- Motivo (medido el 10-sep-2026 recorriendo el panel): el disparador era
-- `AFTER UPDATE OF status`, asi que solo saltaba cuando una reserva CAMBIABA
-- a 'confirmed'. Las que apunta la madre por telefono nacen ya 'confirmed'
-- en un INSERT, de modo que nunca generaban su tarea de limpieza: la lista
-- de limpiezas mentia por omision, sin dar la cara.
--
-- La funcion ya contemplaba el caso (`OLD IS NULL`); lo que faltaba era que
-- el disparador cubriera el INSERT.

DROP TRIGGER IF EXISTS guest_bookings_schedule_cleaning ON public.guest_bookings;

CREATE TRIGGER guest_bookings_schedule_cleaning
    AFTER INSERT OR UPDATE OF status ON public.guest_bookings
    FOR EACH ROW EXECUTE FUNCTION public.schedule_cleaning_on_booking_confirmed();

-- El extra decia "Late check-out", una de las palabras que el panel de la
-- madre tiene prohibidas (y que en la web publica tampoco aporta nada).
UPDATE public.addons
   SET name = 'Salida tarde, hasta las 14:00'
 WHERE name ILIKE '%check-out%';
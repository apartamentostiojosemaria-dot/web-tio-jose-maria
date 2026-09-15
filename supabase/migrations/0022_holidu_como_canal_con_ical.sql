-- 0022 · Holidu como canal con iCal
-- =================================
-- Holidu (dueña de Clubrural) tiene los cuatro apartamentos publicados y los
-- distribuye a 25 portales. Cobra al huésped y abona tras la llegada. Hasta
-- hoy sus reservas entraban en el sistema como canal «otro» a mano (Michael,
-- desde MisterPlan) y no había forma de que llegaran solas.
-- Exporta un iCal por apartamento (api.host.holidu.com/ical/…) con el nombre
-- del huésped abreviado en el SUMMARY («Michael S.»): el importador lo lee
-- como RESERVA con nombre, no como bloqueo mudo.

ALTER TABLE public.apartments
  ADD COLUMN IF NOT EXISTS holidu_ical_url text;
COMMENT ON COLUMN public.apartments.holidu_ical_url IS
  'iCal de exportación de Holidu para este apartamento (solo reservas de Holidu y bloqueos manuales de Holidu). Lo lee sync-ical-imports.';

ALTER TABLE public.guest_bookings
  DROP CONSTRAINT IF EXISTS guest_bookings_channel_check;
ALTER TABLE public.guest_bookings
  ADD CONSTRAINT guest_bookings_channel_check
  CHECK (channel = ANY (ARRAY['web','booking','airbnb','escapada','casasrurales','holidu','telefono','whatsapp','otro']));

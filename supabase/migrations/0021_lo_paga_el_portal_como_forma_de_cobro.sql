-- 0021 · «Lo paga el portal» como forma de cobro
-- ==============================================
-- Holidu (y Clubrural, que es de Holidu) cobra al huésped y abona al
-- alojamiento en un solo pago tras la llegada: el huésped no paga nada en
-- persona. Hasta hoy las formas de cobro eran las de la migración 0002
-- (transferencia, bizum, efectivo, tarjeta, stripe, booking) y una reserva
-- de Holidu solo cabía como «transferencia» — así llegó la de Michael desde
-- MisterPlan, con un «anticipo» que el panel de ella convertía en «faltan
-- 53,13 €» y un botón de cobrar al huésped que NO hay que pulsar.
-- Se añade `ota` (= lo paga el portal), que issue-invoice ya sabía nombrar.

ALTER TABLE public.booking_payments
  DROP CONSTRAINT IF EXISTS booking_payments_method_check;
ALTER TABLE public.booking_payments
  ADD CONSTRAINT booking_payments_method_check
  CHECK (method = ANY (ARRAY['transferencia','bizum','efectivo','tarjeta','stripe','booking','ota']));

ALTER TABLE public.guest_bookings
  DROP CONSTRAINT IF EXISTS guest_bookings_payment_method_check;
ALTER TABLE public.guest_bookings
  ADD CONSTRAINT guest_bookings_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['transferencia','bizum','efectivo','tarjeta','stripe','booking','ota']));

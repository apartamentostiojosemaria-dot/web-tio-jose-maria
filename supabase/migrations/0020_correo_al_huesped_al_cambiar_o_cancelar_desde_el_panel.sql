-- 0020 · Correo al huésped al cambiar o cancelar desde el panel
-- =============================================================
-- Punto 2 de §7 bis del plan «sustituir MisterPlan»: al cambiar las fechas
-- o cancelar desde el panel de la madre, al huésped no le llegaba nada.
-- Regla: solo a quien reservó DIRECTO (web, teléfono, WhatsApp) y tiene un
-- correo de verdad; a los que vienen por Booking o Airbnb les avisa el canal.
-- La madre decide en cada caso (un toque); nunca sale solo.
--
-- Dos marcas nuevas, como las del resto de correos del ciclo de vida:
--   · cancellation_email_sent_at → idempotente (una cancelación, un correo).
--   · change_email_sent_at       → la ÚLTIMA vez; una reserva puede cambiar
--                                  más de una vez y cada cambio merece su aviso.

ALTER TABLE public.guest_bookings
  ADD COLUMN IF NOT EXISTS change_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_email_sent_at timestamptz;

COMMENT ON COLUMN public.guest_bookings.change_email_sent_at IS
  'Última vez que se avisó al huésped por correo de un cambio de fechas/apartamento hecho desde el panel (plantilla booking_changed). Se puede repetir: no bloquea reenvíos.';
COMMENT ON COLUMN public.guest_bookings.cancellation_email_sent_at IS
  'Cuándo se avisó al huésped por correo de la cancelación (plantilla booking_cancelled). Idempotente.';

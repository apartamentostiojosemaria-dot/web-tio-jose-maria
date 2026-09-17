-- 0030 — Los huéspedes de canal reciben el correo de 7 días y el de la víspera.
--
-- Decisión de Jesús (17-sep-2026): esos dos correos llevan el enlace de los
-- datos de la policía (obligación legal, no marketing) y el alias del canal
-- (@guest.booking.com) reenvía al huésped. Hasta hoy los importadores los
-- marcaban como «ya enviados» al crear la reserva y nunca salían: 0 de 36
-- precheckins rellenos. Los importadores ya no ponen esas dos marcas
-- (sync-ical-imports v13, tjm-jobs 20260917.2); aquí se sueltan en las
-- reservas de canal vivas. Los de confirmación, llegada, salida y
-- reactivación siguen bloqueados: esos los manda el canal o son promoción.
--
-- Sin efecto retroactivo: el cron solo manda el de 7 días cuando faltan
-- exactamente 7 y el de la víspera cuando falta exactamente 1.

UPDATE public.guest_bookings
   SET reminder_7d_email_sent_at  = NULL,
       reminder_24h_email_sent_at = NULL
 WHERE status = 'confirmed'
   AND check_in >= current_date
   AND lower(channel) IN ('booking', 'airbnb', 'holidu', 'escapada', 'casasrurales')
   AND (reminder_7d_email_sent_at IS NOT NULL OR reminder_24h_email_sent_at IS NOT NULL);

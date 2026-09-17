-- 0032 — Las estancias traídas como historia no piden dinero.
-- ===========================================================
-- El 16-sep el importador trajo de MisterPlan 12 estancias de Booking de
-- mayo a agosto, ya terminadas, como historia para informes e INE. Entraron
-- con payment_status = 'pending' y 0 € cobrados, y el panel de la madre las
-- enseñaba como «ya se fue y falta cobrar» (2.000 € de gente que se fue hace
-- meses). Visto por Jesús el 17-sep.
--
-- Su cobro pasó ANTES de este sistema, por la vía de entonces (tarjeta
-- virtual de Booking con MisterPlan de por medio). Se apuntan como cobradas
-- por Booking con la fecha de salida y una nota que dice exactamente eso:
-- cierra la reserva sin fingir que el cobro se registró aquí. El importador
-- hace lo mismo desde hoy con cualquier estancia que ya haya terminado al
-- traerla (tjm-jobs).
--
-- Solo estancias completadas ANTES de existir en el sistema (check_out <
-- fecha de creación de la fila) y sin ningún cobro apuntado.

INSERT INTO public.booking_payments (booking_id, amount, method, paid_on, note, created_by)
SELECT gb.id,
       gb.total_price,
       CASE lower(gb.channel) WHEN 'booking' THEN 'booking' WHEN 'web' THEN 'transferencia' ELSE 'ota' END,
       gb.check_out,
       'Estancia anterior a este sistema, traída de MisterPlan como historia: el cobro se hizo entonces por la vía de la época. Apuntado para cerrarla, no es un cobro registrado aquí.',
       'migracion-0032'
  FROM public.guest_bookings gb
 WHERE gb.status = 'completed'
   AND gb.check_out < gb.created_at::date
   AND gb.source IN ('misterplan', 'misterplan-correo', 'booking-extranet')
   AND COALESCE(gb.total_price, 0) > 0
   AND NOT EXISTS (SELECT 1 FROM public.booking_payments p WHERE p.booking_id = gb.id);

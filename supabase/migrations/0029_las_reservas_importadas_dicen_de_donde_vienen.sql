-- 0029 — Las reservas importadas dicen de dónde vienen.
--
-- `guest_bookings.source` es por dónde entró la fila en nuestro sistema
-- (web = motor propio, manual = tecleada en el panel, <canal> = iCal,
-- test = pruebas). Los importadores (el barrido a mano del 11-sep, el job
-- `misterplan-correo` y la carga desde la extranet de Booking) dejaban el
-- valor por defecto, 'manual', y 33 reservas parecían tecleadas por la madre.
-- Ese dato induce a error al mirar quién apuntó qué (plan §7 ter).
--
-- `created_by` ya decía la verdad; se copia esa verdad a `source`. El job
-- escribe 'misterplan-correo' desde este mismo día (tjm-jobs).

UPDATE public.guest_bookings
   SET source = CASE created_by
                    WHEN 'importacion-misterplan'       THEN 'misterplan'        -- barrido a mano del 11-sep (§7 ter)
                    WHEN 'importacion-booking-extranet' THEN 'booking-extranet'
                    ELSE 'misterplan-correo'                                     -- el job de Trigger.dev
                END
 WHERE source = 'manual'
   AND created_by IN (
       'importacion-misterplan',
       'importacion-misterplan-correo',
       'importacion-ruralgest-correo',
       'importacion-booking-extranet'
   );

-- 0023 — Registro de los correos de MisterPlan que lee el job `misterplan-correo`.
-- ==========================================================================
-- MisterPlan (RuralGest) avisa por correo al Gmail del negocio de cada reserva
-- que le entra por cualquier canal, de cada cancelación y modificación de
-- Booking, y de cada pre-reserva / confirmación de su motor web. Booking no
-- manda correo de reserva nueva (entra por XML) y no da iCal mientras
-- MisterPlan sea el channel manager (§7 decies), así que ESTE correo es la
-- única vía automática para enterarse (Adrián: avisado el 13-sep, apuntado a
-- mano el 15; Carmen López cancelada: avisado el 11, visto el 15).
--
-- Una fila por correo leído. `message_id` es la clave de idempotencia: un
-- correo ya registrado no se vuelve a procesar aunque el job se repita.
-- `necesita_atencion` = el job no supo qué hacer (apartamento desconocido,
-- solape con otra reserva, cancelación de algo que no existía...): se avisa
-- por correo y queda aquí hasta que alguien lo mire.

CREATE TABLE IF NOT EXISTS public.mail_import_log (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id        text NOT NULL UNIQUE,
    mail_uid          integer,
    received_at       timestamptz,
    subject           text,
    sender            text,
    kind              text NOT NULL,          -- reserva | cancelacion_booking | modificacion_booking | pre_reserva | confirmacion_web | otro
    channel           text,                   -- booking | airbnb | web | otro
    locator           text,                   -- localizador del canal (Booking / Airbnb) si lo hay
    misterplan_ref    text,                   -- «1-8060298»
    booking_id        bigint REFERENCES public.guest_bookings(id) ON DELETE SET NULL,
    action            text NOT NULL,          -- creada | enlazada | ya_existia | cancelada | modificada | ignorada | error
    detail            jsonb,
    necesita_atencion boolean NOT NULL DEFAULT false,
    atendido_at       timestamptz,
    processed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_import_log_received_idx ON public.mail_import_log (received_at DESC);
CREATE INDEX IF NOT EXISTS mail_import_log_atencion_idx ON public.mail_import_log (necesita_atencion) WHERE necesita_atencion;

COMMENT ON TABLE public.mail_import_log IS
  'Correos de MisterPlan leídos por el job misterplan-correo (tjm-jobs): qué era cada uno y qué se hizo con él. message_id = idempotencia.';

ALTER TABLE public.mail_import_log ENABLE ROW LEVEL SECURITY;

-- Solo gestión (staff) lee; escribe únicamente la clave de servicio (el job).
DROP POLICY IF EXISTS mail_import_log_staff_read ON public.mail_import_log;
CREATE POLICY mail_import_log_staff_read ON public.mail_import_log
    FOR SELECT TO authenticated USING (public.is_staff());

GRANT SELECT ON public.mail_import_log TO authenticated;
GRANT ALL ON public.mail_import_log TO service_role;

-- Marca de origen en la reserva: created_by = 'importacion-misterplan-correo'
-- (columna ya existente). Nada más que tocar en guest_bookings.

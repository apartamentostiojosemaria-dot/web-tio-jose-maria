-- 0047 — Queda apuntado cuándo se le recordó rellenar los datos de la policía (23-sep-2026).
--
-- Tras pulsar «Recordárselo» no quedaba rastro: si el padre miraba después,
-- se lo volvía a mandar. Ahora el panel apunta la hora y la vía al pulsar, y
-- lo enseña («Se lo recordaste hoy a las 12:05 por WhatsApp»).
-- (Aplicado el 23-sep con el conector; se deja aquí para el repo.)

ALTER TABLE public.guest_bookings
    ADD COLUMN IF NOT EXISTS recordatorio_parte_at  timestamptz,
    ADD COLUMN IF NOT EXISTS recordatorio_parte_via text;

COMMENT ON COLUMN public.guest_bookings.recordatorio_parte_at IS
    'Última vez que desde el panel se le recordó rellenar los datos de la policía (se apunta al pulsar el botón).';

CREATE OR REPLACE FUNCTION public.tjm_apuntar_recordatorio(p_booking_id bigint, p_via text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_ahora timestamptz := now();
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RAISE EXCEPTION 'sin_permiso';
    END IF;
    IF p_via NOT IN ('whatsapp', 'correo') THEN
        RAISE EXCEPTION 'via_no_valida';
    END IF;
    UPDATE public.guest_bookings
       SET recordatorio_parte_at = v_ahora, recordatorio_parte_via = p_via
     WHERE id = p_booking_id;
    RETURN v_ahora;
END;
$$;

REVOKE ALL ON FUNCTION public.tjm_apuntar_recordatorio(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tjm_apuntar_recordatorio(bigint, text) TO authenticated, service_role;

-- El de Michael (reserva 60) se mandó el 23-sep a las 12:05 por WhatsApp.
UPDATE public.guest_bookings
   SET recordatorio_parte_at = '2026-09-23 10:05:00+00', recordatorio_parte_via = 'whatsapp'
 WHERE id = 60 AND recordatorio_parte_at IS NULL;

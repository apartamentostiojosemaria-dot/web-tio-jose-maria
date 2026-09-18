-- 0034 — «No se presentó» existe en el sistema.
--
-- La política (condiciones, punto 8) dice que no presentarse sin avisar supone
-- perder el importe, pero la base no tenía forma de decirlo: una reserva a la
-- que nadie llegó se quedaba «confirmed» para siempre, contaba como estancia y
-- salía en los informes como si hubieran venido. Estudio del 18-sep-2026,
-- arreglo 5 de 5.
--
-- Qué hace: un estado `no_show` y una función que solo puede usar quien
-- gestiona (Mari Carmen desde el panel), y solo cuando el día de llegada ya
-- pasó o es hoy y nadie ha hecho la entrada. El dinero cobrado se queda (no es
-- una cancelación); las fechas ya pasaron, así que no libera nada. No se
-- comunica nada a la policía: la reserva ya se comunicó y no hubo estancia.

ALTER TABLE public.guest_bookings DROP CONSTRAINT IF EXISTS guest_bookings_status_check;
ALTER TABLE public.guest_bookings ADD CONSTRAINT guest_bookings_status_check
    CHECK (status = ANY (ARRAY['hold','pending','confirmed','cancelled','completed','expired','no_show']));

CREATE OR REPLACE FUNCTION public.marcar_no_show(p_booking_id bigint, p_nota text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_bk record;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
    END IF;

    SELECT gb.id, gb.status, gb.check_in, gb.checkin_at, gb.paid_amount, gb.internal_notes
      INTO v_bk FROM public.guest_bookings gb WHERE gb.id = p_booking_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reserva_no_encontrada');
    END IF;
    IF v_bk.status = 'no_show' THEN
        RETURN jsonb_build_object('ok', true, 'ya_marcada', true);
    END IF;
    IF v_bk.status <> 'confirmed' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'estado_no_permite_no_show');
    END IF;
    IF v_bk.check_in > current_date THEN
        RETURN jsonb_build_object('ok', false, 'error', 'todavia_no_ha_llegado_el_dia');
    END IF;
    IF v_bk.checkin_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ya_hicieron_la_entrada');
    END IF;

    UPDATE public.guest_bookings
       SET status = 'no_show',
           internal_notes = TRIM(BOTH E'\n' FROM
               COALESCE(v_bk.internal_notes || E'\n', '') ||
               'No se presentó (marcado el ' || to_char(current_date, 'DD/MM/YYYY') || ')' ||
               CASE WHEN COALESCE(TRIM(p_nota), '') <> '' THEN ' — ' || TRIM(p_nota) ELSE '' END ||
               ' — importe retenido según las condiciones: ' || COALESCE(v_bk.paid_amount, 0)::text || ' EUR'),
           updated_at = now()
     WHERE id = p_booking_id;

    RETURN jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'cobrado', COALESCE(v_bk.paid_amount, 0));
END $function$;

REVOKE ALL ON FUNCTION public.marcar_no_show(bigint, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.marcar_no_show(bigint, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.marcar_no_show(bigint, text) IS
    'Marca una reserva confirmada como no presentada (solo staff/admin, solo desde el día de llegada y sin entrada hecha). El dinero cobrado se queda.';

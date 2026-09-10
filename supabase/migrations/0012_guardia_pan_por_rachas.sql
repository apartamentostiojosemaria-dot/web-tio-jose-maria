-- =====================================================================
--  0012 — La guardia del número de tarjeta, bien medida
--
--  Corrección de `0010`, encontrada probándola el mismo día contra
--  producción (10-sep-2026).
--
--  EL FALLO. La guardia que impide guardar un número de tarjeta entero en
--  `guest_bookings.payment_instrument` quitaba TODO lo que no fuera un
--  dígito y miraba el resultado:
--
--      regexp_replace(payment_instrument, '[^0-9]', '', 'g') !~ '^[0-9]{13,19}$'
--
--  Eso junta dígitos que no van juntos. El caso de Booking, que es el más
--  frecuente de los cuatro canales:
--
--      «Tarjeta virtual Booking ****1234 · localizador 4821736455»
--       → 1234 + 4821736455 = 12344821736455 (14 dígitos) → RECHAZADO
--
--  Un valor legítimo —y justo el que el anexo I A.4.d quiere: marca,
--  últimos cuatro y localizador— no se podía guardar. Y al revés, un IBAN
--  quedaba a un dígito de caer también.
--
--  EL ARREGLO. Lo que hay que buscar no es «cuántos dígitos hay en total»
--  sino «hay una RACHA de 13 a 19 dígitos seguidos», admitiendo el espacio
--  o el guion que la gente teclea dentro de un número de tarjeta, y con la
--  racha ENTERA delimitada por algo que no sea un dígito:
--
--      (^|[^0-9])[0-9]([ -]?[0-9]){12,18}([^0-9]|$)
--
--  Con eso:
--    · «4242 4242 4242 4242» y «4242424242424242»  → rechazados (16)
--    · «VISA ****4242»                              → pasa (4)
--    · «Tarjeta virtual Booking ****1234 · localizador 4821736455» → pasa
--    · «ES9121000418450200051332» (IBAN, 22 dígitos) → pasa, porque la
--      racha entera no cabe en la ventana de 13-19 y no hay forma de
--      recortarla dejando un no-dígito a los dos lados
--    · «+34600111222» (Bizum)                       → pasa (11)
--
--  No es una guardia infalible —ninguna lo es sin Luhn y sin contexto—,
--  pero deja de estorbar a los cuatro valores reales del alojamiento y
--  sigue parando lo que de verdad importa: un PAN pegado tal cual.
--
--  Aplicado contra producción (nmtukksbzbnuzqsksdmw) el 10-sep-2026.
--  Aditivo: sólo ENSANCHA lo que se admite. Ninguna fila existente pasa a
--  ser inválida.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. El CHECK de la tabla
-- ---------------------------------------------------------------------
ALTER TABLE public.guest_bookings
  DROP CONSTRAINT IF EXISTS guest_bookings_payment_instrument_sin_pan_check;

ALTER TABLE public.guest_bookings
  ADD CONSTRAINT guest_bookings_payment_instrument_sin_pan_check
  CHECK (
    payment_instrument IS NULL
    OR payment_instrument !~ '(^|[^0-9])[0-9]([ -]?[0-9]){12,18}([^0-9]|$)'
  );

COMMENT ON COLUMN public.guest_bookings.payment_instrument IS
  'Identificacion del medio de pago (anexo I A.4.d): marca y ultimos cuatro digitos («VISA ****4242»), IBAN del ordenante, telefono del Bizum o localizador de la plataforma. PROHIBIDO el numero completo de la tarjeta y el CVV: el CHECK rechaza cualquier racha de 13 a 19 digitos seguidos.';

-- ---------------------------------------------------------------------
-- 2. La misma medida dentro de la RPC
-- ---------------------------------------------------------------------
-- La RPC comprueba lo mismo antes que el CHECK para poder contestar con
-- un mensaje que se entienda en vez de con un error de restriccion. Si
-- las dos medidas se separan, gana la que no mira nadie.
CREATE OR REPLACE FUNCTION public.set_payment_details(
    p_booking_id bigint,
    p_type       text,
    p_instrument text DEFAULT NULL,
    p_holder     text DEFAULT NULL,
    p_expiry     text DEFAULT NULL,
    p_date       date DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_tipo       text := upper(btrim(COALESCE(p_type, '')));
    v_instrument text := NULLIF(btrim(COALESCE(p_instrument, '')), '');
    v_holder     text := NULLIF(btrim(COALESCE(p_holder, '')), '');
    v_expiry     text := NULLIF(btrim(COALESCE(p_expiry, '')), '');
    v_code       text;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'sin_permiso');
    END IF;

    IF v_tipo NOT IN ('EFECT','TARJT','PLATF','TRANS','MOVIL','TREG','DESTI','OTRO') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'tipo_de_pago_no_valido',
            'mensaje', 'El tipo de pago tiene que ser uno del catalogo del Ministerio.');
    END IF;

    -- Una racha de 13 a 19 digitos seguidos es un numero de tarjeta. Los
    -- ultimos cuatro, un IBAN o un telefono no lo son (ver la cabecera).
    IF v_instrument IS NOT NULL
       AND v_instrument ~ '(^|[^0-9])[0-9]([ -]?[0-9]){12,18}([^0-9]|$)' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'parece_una_tarjeta_entera',
            'mensaje', 'Ahi no va el numero completo de la tarjeta. Marca y ultimos cuatro: «VISA ****4242».');
    END IF;

    IF v_expiry IS NOT NULL AND v_expiry !~ '^(0[1-9]|1[0-2])/([0-9]{2}|[0-9]{4})$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'caducidad_no_valida',
            'mensaje', 'La caducidad va como MM/AA o MM/AAAA.');
    END IF;

    UPDATE public.guest_bookings
       SET payment_type       = v_tipo,
           payment_instrument = v_instrument,
           -- El titular no se inventa: si no viene, se queda como estaba.
           payment_holder     = COALESCE(v_holder, payment_holder),
           payment_expiry     = v_expiry,
           payment_date       = COALESCE(p_date, payment_date),
           updated_at         = now()
     WHERE id = p_booking_id
    RETURNING booking_code INTO v_code;

    IF v_code IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reserva_no_encontrada');
    END IF;

    RETURN jsonb_build_object('ok', true, 'booking_code', v_code, 'payment_type', v_tipo);
END $function$;

COMMENT ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) IS
  'Apunta los datos de pago del anexo I A.4.d desde el panel (transferencia, Bizum, efectivo, tarjeta virtual de Booking). Lo de Stripe lo rellena solo el webhook. Rechaza una racha de 13 a 19 digitos (un numero de tarjeta) y nunca supone el titular.';

REVOKE ALL ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) TO authenticated, service_role;

-- =====================================================================
--  0013 — La guardia del número de tarjeta, medida de una vez
--
--  Tercera y última vuelta sobre lo mismo (10-sep-2026). Vale la pena
--  dejar escrito el camino, porque el error de fondo se repite:
--
--    · `0010` contaba TODOS los dígitos de la cadena juntos. El valor de
--      Booking («…****1234 · localizador 4821736455») sumaba 14 y se
--      rechazaba, siendo legítimo.
--    · `0012` buscaba una racha de 13-19 dígitos con un regex, admitiendo
--      el espacio de dentro de un número de tarjeta. Arreglaba Booking y
--      el IBAN pegado, pero rompía el IBAN ESCRITO CON ESPACIOS
--      («ES91 2100 0418 4502 0005 1332»): como el espacio contaba a la vez
--      como separador y como frontera, el regex podía recortar una
--      ventana de 16 dígitos por el medio del IBAN y darla por buena.
--
--  Las dos veces el fallo es el mismo: medir con una regla que no
--  distingue UN número de VARIOS números pegados. La medida correcta es
--  «cuántos dígitos tiene CADA número», y eso no lo dice un regex de una
--  línea: lo dice una función.
--
--  `tjm_parece_tarjeta()` parte el texto en rachas de dígitos (admitiendo
--  espacios y guiones DENTRO de una racha, que es como se teclea un
--  número de tarjeta), cuenta los dígitos de cada racha por separado y
--  contesta que sí sólo cuando ALGUNA racha tiene entre 13 y 19.
--
--  Comprobado contra los seis valores reales del alojamiento y contra las
--  tres formas de escribir un PAN — la prueba está en el propio fichero,
--  al final, y se puede volver a correr cuando se quiera.
--
--  Aplicado contra producción (nmtukksbzbnuzqsksdmw) el 10-sep-2026.
--  Aditivo: sólo ENSANCHA lo que se admite.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.tjm_parece_tarjeta(p_texto text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
    -- Una racha es un número tal y como lo escribe una persona: dígitos,
    -- con espacios o guiones por medio, empezando y acabando en dígito.
    -- De cada racha se cuentan sólo los dígitos. 13-19 es el rango de un
    -- número de tarjeta (13 Visa antigua, 19 algunas Maestro).
    SELECT COALESCE(bool_or(
        length(regexp_replace(racha, '[^0-9]', '', 'g')) BETWEEN 13 AND 19
    ), false)
    FROM regexp_matches(
        COALESCE(p_texto, ''),
        '[0-9](?:[0-9 -]*[0-9])?',
        'g'
    ) AS m(partes)
    CROSS JOIN LATERAL (SELECT m.partes[1]) AS r(racha);
$function$;

COMMENT ON FUNCTION public.tjm_parece_tarjeta(text) IS
  'Cierto cuando el texto contiene un numero de 13 a 19 digitos seguidos, o sea un numero de tarjeta. Cuenta los digitos de CADA numero por separado: un IBAN (22) y unos ultimos cuatro (4) no lo son, ni juntos ni con espacios por medio. Ver migraciones 0010 y 0012 para los dos intentos anteriores, que median mal.';

REVOKE ALL ON FUNCTION public.tjm_parece_tarjeta(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_parece_tarjeta(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.tjm_parece_tarjeta(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- El CHECK, ahora con una sola medida
-- ---------------------------------------------------------------------
ALTER TABLE public.guest_bookings
  DROP CONSTRAINT IF EXISTS guest_bookings_payment_instrument_sin_pan_check;

ALTER TABLE public.guest_bookings
  ADD CONSTRAINT guest_bookings_payment_instrument_sin_pan_check
  CHECK (payment_instrument IS NULL OR NOT public.tjm_parece_tarjeta(payment_instrument));

-- ---------------------------------------------------------------------
-- La RPC usa la MISMA función, no una copia
-- ---------------------------------------------------------------------
-- Dos medidas del mismo límite acaban discrepando; ya ha pasado dos veces
-- en dos migraciones seguidas. Una sola función y se acabó.
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

    IF public.tjm_parece_tarjeta(v_instrument) THEN
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
  'Apunta los datos de pago del anexo I A.4.d desde el panel (transferencia, Bizum, efectivo, tarjeta virtual de Booking). Lo de Stripe lo rellena solo el webhook. Rechaza un numero de tarjeta usando tjm_parece_tarjeta(), la misma medida que el CHECK de la tabla, y nunca supone el titular.';

REVOKE ALL ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- La prueba, dentro de la propia migración
-- ---------------------------------------------------------------------
-- Si alguien vuelve a tocar la medida, esto revienta la migración en vez
-- de dejar pasar un número de tarjeta o bloquear un IBAN en silencio.
DO $$
DECLARE
    v_caso   text;
    v_espera boolean;
    v_casos  text[][] := ARRAY[
        -- valores reales del alojamiento: NINGUNO es una tarjeta
        ARRAY['VISA ****4242', 'false'],
        ARRAY['Tarjeta virtual Booking ****1234 · localizador 4821736455', 'false'],
        ARRAY['ES9121000418450200051332', 'false'],
        ARRAY['ES91 2100 0418 4502 0005 1332', 'false'],
        ARRAY['+34600111222', 'false'],
        ARRAY['Cobro de la plataforma · localizador XYZ123', 'false'],
        ARRAY[NULL, 'false'],
        -- las tres formas de escribir un PAN: las tres se paran
        ARRAY['4242 4242 4242 4242', 'true'],
        ARRAY['4242424242424242', 'true'],
        ARRAY['4242-4242-4242-4242', 'true'],
        ARRAY['pago con 4242424242424242 el martes', 'true']
    ];
    v_fila text[];
BEGIN
    FOREACH v_fila SLICE 1 IN ARRAY v_casos LOOP
        v_caso := v_fila[1];
        v_espera := v_fila[2]::boolean;
        IF public.tjm_parece_tarjeta(v_caso) IS DISTINCT FROM v_espera THEN
            RAISE EXCEPTION
                'tjm_parece_tarjeta(%) devolvio % y se esperaba %',
                COALESCE(v_caso, '<NULL>'), public.tjm_parece_tarjeta(v_caso), v_espera;
        END IF;
    END LOOP;
END $$;

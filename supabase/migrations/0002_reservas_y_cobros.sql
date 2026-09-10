-- =====================================================================
-- 0002_reservas_y_cobros.sql        APLICADA en produccion el 2026-09-10
--
-- Paquete P1.1 del plan "sustituir MisterPlan": el modelo de reserva de
-- canal (Booking / Airbnb / telefono...) con comision, localizador y
-- cobros parciales, mas los RPC que usara el modo sencillo de la madre.
--
-- Todo ADITIVO. No borra datos, no borra politicas, no toca service_role.
-- Unicas excepciones (widening de CHECK, imprescindible):
--   - pricing_rules_rule_type_check: se recrea anadiendo 'special_price'.
--
-- Contrato de nombres cerrado con los agentes de front: NO renombrar.
--
-- NOTA sobre el historial de Supabase: se aplico en tandas
-- (0002_reservas_y_cobros, _motor_precios, _rpcs, _fix_search_path_extensions,
-- _fix_nights_es_generada, _revoke_trigger_functions). Este fichero es el
-- resultado final consolidado y es el que hay que leer.
--
-- Dos cosas que costaron un intento fallido y conviene no olvidar:
--   1. guest_bookings.nights es GENERATED ALWAYS AS (check_out - check_in)
--      STORED. No se puede insertar ni actualizar a mano.
--   2. pgcrypto (gen_random_bytes, digest) vive en el esquema `extensions`,
--      no en `public`. Cualquier funcion con search_path fijo que llame a
--      generate_booking_code() o issue_invoice() tiene que incluirlo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. guest_bookings: columnas de canal, comision y cobro
-- ---------------------------------------------------------------------
ALTER TABLE public.guest_bookings
  ADD COLUMN IF NOT EXISTS channel            text    NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS external_locator   text,
  ADD COLUMN IF NOT EXISTS commission_pct     numeric,
  ADD COLUMN IF NOT EXISTS commission_amount  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method     text,
  ADD COLUMN IF NOT EXISTS vcc_chargeable_from date,
  ADD COLUMN IF NOT EXISTS paid_amount        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_not_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by         text,
  ADD COLUMN IF NOT EXISTS internal_notes     text;

-- Columna calculada: lo que falta por cobrar. Se mantiene sola.
ALTER TABLE public.guest_bookings
  ADD COLUMN IF NOT EXISTS pending_amount numeric
    GENERATED ALWAYS AS (COALESCE(total_price, 0) - COALESCE(paid_amount, 0)) STORED;

COMMENT ON COLUMN public.guest_bookings.channel IS 'Por donde entro la reserva: web, booking, airbnb, escapada, casasrurales, telefono, whatsapp, otro';
COMMENT ON COLUMN public.guest_bookings.external_locator IS 'Localizador del canal (p.ej. numero de reserva de Booking)';
COMMENT ON COLUMN public.guest_bookings.commission_pct IS 'Comision del canal en %, informativa';
COMMENT ON COLUMN public.guest_bookings.commission_amount IS 'Comision del canal en euros. Neto a percibir = total_price - commission_amount';
COMMENT ON COLUMN public.guest_bookings.vcc_chargeable_from IS 'Booking: fecha desde la que se puede cobrar la tarjeta virtual';
COMMENT ON COLUMN public.guest_bookings.paid_amount IS 'Suma de booking_payments. La mantiene el trigger booking_payments_recalc: NO escribir a mano';
COMMENT ON COLUMN public.guest_bookings.pending_amount IS 'Calculada: total_price - paid_amount';
COMMENT ON COLUMN public.guest_bookings.invoice_not_needed IS 'Marcada = esta reserva no necesita factura (no sale en pendientes)';

ALTER TABLE public.guest_bookings
  DROP CONSTRAINT IF EXISTS guest_bookings_channel_check;
ALTER TABLE public.guest_bookings
  ADD CONSTRAINT guest_bookings_channel_check
  CHECK (channel = ANY (ARRAY['web','booking','airbnb','escapada','casasrurales','telefono','whatsapp','otro']));

ALTER TABLE public.guest_bookings
  DROP CONSTRAINT IF EXISTS guest_bookings_payment_method_check;
ALTER TABLE public.guest_bookings
  ADD CONSTRAINT guest_bookings_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['transferencia','bizum','efectivo','tarjeta','stripe','booking']));

CREATE INDEX IF NOT EXISTS guest_bookings_channel_idx ON public.guest_bookings USING btree (channel);
CREATE INDEX IF NOT EXISTS guest_bookings_pending_idx ON public.guest_bookings USING btree (check_in)
  WHERE (status = ANY (ARRAY['confirmed','pending'])) AND pending_amount > 0;


-- ---------------------------------------------------------------------
-- 2. booking_payments: un apunte por cobro
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id bigint NOT NULL REFERENCES public.guest_bookings(id) ON DELETE CASCADE,
  amount     numeric NOT NULL CHECK (amount <> 0),
  method     text NOT NULL,
  paid_on    date NOT NULL DEFAULT current_date,
  note       text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.booking_payments
  DROP CONSTRAINT IF EXISTS booking_payments_method_check;
ALTER TABLE public.booking_payments
  ADD CONSTRAINT booking_payments_method_check
  CHECK (method = ANY (ARRAY['transferencia','bizum','efectivo','tarjeta','stripe','booking']));

CREATE INDEX IF NOT EXISTS booking_payments_booking_idx ON public.booking_payments USING btree (booking_id);
CREATE INDEX IF NOT EXISTS booking_payments_paid_on_idx ON public.booking_payments USING btree (paid_on DESC);

COMMENT ON TABLE public.booking_payments IS 'Cobros apuntados de una reserva. amount negativo = devolucion.';

ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_payments_service_all ON public.booking_payments;
CREATE POLICY booking_payments_service_all ON public.booking_payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS booking_payments_admin_all ON public.booking_payments;
CREATE POLICY booking_payments_admin_all ON public.booking_payments
  FOR ALL TO authenticated USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());
-- (la politica de staff la anade 0003_rol_staff.sql)


-- ---------------------------------------------------------------------
-- 3. Triggers de cuadre del dinero
-- ---------------------------------------------------------------------

-- 3.1 Al tocar booking_payments, recalcular paid_amount y payment_status.
CREATE OR REPLACE FUNCTION public.recalc_booking_paid_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_booking bigint;
    v_sum     numeric;
    v_total   numeric;
    v_status  text;
BEGIN
    v_booking := COALESCE(NEW.booking_id, OLD.booking_id);

    SELECT COALESCE(SUM(bp.amount), 0) INTO v_sum
      FROM public.booking_payments bp WHERE bp.booking_id = v_booking;

    SELECT gb.total_price, gb.payment_status INTO v_total, v_status
      FROM public.guest_bookings gb WHERE gb.id = v_booking;

    IF NOT FOUND THEN
        RETURN COALESCE(NEW, OLD);   -- la reserva ya no existe (cascade)
    END IF;

    UPDATE public.guest_bookings gb
       SET paid_amount = v_sum,
           payment_status = CASE
               WHEN v_status IN ('refunded', 'failed') THEN v_status
               WHEN v_sum <= 0 THEN 'pending'
               WHEN v_total IS NOT NULL AND v_total > 0 AND v_sum >= v_total THEN 'paid'
               ELSE 'partial'
           END,
           updated_at = now()
     WHERE gb.id = v_booking;

    RETURN COALESCE(NEW, OLD);
END $function$;

DROP TRIGGER IF EXISTS booking_payments_recalc ON public.booking_payments;
CREATE TRIGGER booking_payments_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.booking_payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_booking_paid_amount();


-- 3.2 Cuando Stripe marca la reserva como pagada, apuntar SOLO la
--     diferencia que falte: si la madre ya habia apuntado una senal,
--     no se duplica. Si ya cuadra, no inserta nada.
CREATE OR REPLACE FUNCTION public.sync_stripe_payment_to_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_delta numeric;
BEGIN
    IF NEW.payment_status = 'paid'
       AND OLD.payment_status IS DISTINCT FROM 'paid'
       AND NEW.payment_intent_id IS NOT NULL
       AND COALESCE(NEW.payment_amount_paid, 0) > 0
    THEN
        v_delta := COALESCE(NEW.payment_amount_paid, 0) - COALESCE(NEW.paid_amount, 0);
        IF v_delta > 0.004 THEN
            INSERT INTO public.booking_payments (booking_id, amount, method, paid_on, note, created_by)
            VALUES (NEW.id, ROUND(v_delta, 2), 'stripe', current_date,
                    'Cobro por Stripe ' || COALESCE(NEW.payment_intent_id, ''), 'stripe');
        END IF;
    END IF;
    RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS guest_bookings_sync_stripe_payment ON public.guest_bookings;
CREATE TRIGGER guest_bookings_sync_stripe_payment
  AFTER UPDATE OF payment_status ON public.guest_bookings
  FOR EACH ROW EXECUTE FUNCTION public.sync_stripe_payment_to_booking();


-- ---------------------------------------------------------------------
-- 4. pricing_rules: precio fijo por noche para unas fechas
-- ---------------------------------------------------------------------
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS night_price numeric;
COMMENT ON COLUMN public.pricing_rules.night_price IS 'rule_type=special_price: precio fijo por noche (euros) que sustituye a price_low/price_high';

-- Widening del CHECK para admitir special_price (0 filas en la tabla).
ALTER TABLE public.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_rule_type_check;
ALTER TABLE public.pricing_rules ADD CONSTRAINT pricing_rules_rule_type_check
  CHECK (rule_type = ANY (ARRAY['weekend_premium','last_minute','early_bird','min_nights','occupancy_boost','special_price']));

CREATE INDEX IF NOT EXISTS pricing_rules_special_idx ON public.pricing_rules USING btree (rule_type, valid_from, valid_until)
  WHERE rule_type = 'special_price';


-- ---------------------------------------------------------------------
-- 5. Motor de precios
-- ---------------------------------------------------------------------

-- 5.1 check_availability: MISMA funcion de siempre; el unico cambio es
--     que base_price consulta primero un special_price para esa noche.
--     Sin reglas special_price el resultado es identico al anterior.
CREATE OR REPLACE FUNCTION public.check_availability(p_check_in date, p_check_out date, p_pax integer DEFAULT 1)
 RETURNS TABLE(apartment_id bigint, slug text, name text, capacity_people integer, nights integer, nightly_avg numeric, total_price numeric, price_breakdown jsonb, images jsonb, short_description text)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_nights int;
    v_advance int;
    v_today date := current_date;
BEGIN
    IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in THEN
        RAISE EXCEPTION 'invalid_dates' USING ERRCODE = '22023';
    END IF;
    IF p_check_in < v_today THEN
        RAISE EXCEPTION 'check_in_in_past' USING ERRCODE = '22023';
    END IF;

    v_nights := p_check_out - p_check_in;
    v_advance := p_check_in - v_today;

    RETURN QUERY
    WITH candidate_apartments AS (
        SELECT a.id, a.slug, a.name, a.capacity_people, a.price_low, a.price_high,
               a.images, a.short_description
        FROM public.apartments a
        WHERE a.is_active = true
          AND a.capacity_people >= p_pax
    ),
    min_nights_violations AS (
        SELECT DISTINCT ca.id AS apt_id
        FROM candidate_apartments ca
        JOIN public.pricing_rules pr ON pr.active = true
            AND pr.rule_type = 'min_nights'
            AND (pr.apartment_id IS NULL OR pr.apartment_id = ca.id)
            AND (pr.valid_from IS NULL OR pr.valid_from <= p_check_in)
            AND (pr.valid_until IS NULL OR pr.valid_until >= p_check_out)
        WHERE v_nights < COALESCE(pr.threshold_days, 1)
    ),
    daily_prices AS (
        SELECT
            ca.id AS apt_id,
            ca.slug, ca.name, ca.capacity_people,
            ca.images, ca.short_description,
            d::date AS night_date,
            -- 1) precio especial para esa noche si lo hay (manda sobre temporada)
            -- 2) si no, temporada alta / baja
            COALESCE(
                (
                    SELECT pr.night_price
                    FROM public.pricing_rules pr
                    WHERE pr.active = true
                      AND pr.rule_type = 'special_price'
                      AND pr.night_price IS NOT NULL
                      AND (pr.apartment_id IS NULL OR pr.apartment_id = ca.id)
                      AND (pr.valid_from IS NULL OR pr.valid_from <= d::date)
                      AND (pr.valid_until IS NULL OR pr.valid_until >= d::date)
                    ORDER BY pr.priority DESC NULLS LAST, (pr.apartment_id IS NOT NULL) DESC
                    LIMIT 1
                ),
                (CASE
                    WHEN EXISTS (
                        SELECT 1 FROM public.high_seasons hs
                        WHERE d::date >= hs.start_date AND d::date <= hs.end_date
                    ) THEN ca.price_high
                    ELSE ca.price_low
                END)
            ) AS base_price
        FROM candidate_apartments ca
        CROSS JOIN generate_series(p_check_in, p_check_out - interval '1 day', interval '1 day') AS d
        WHERE ca.id NOT IN (SELECT apt_id FROM min_nights_violations)
    ),
    priced_nights AS (
        SELECT
            dp.*,
            (dp.base_price
                + COALESCE((
                    SELECT COALESCE(pr.flat_extra, 0)
                            + dp.base_price * (COALESCE(pr.multiplier, 1) - 1)
                    FROM public.pricing_rules pr
                    WHERE pr.active = true
                      AND pr.rule_type = 'weekend_premium'
                      AND (pr.apartment_id IS NULL OR pr.apartment_id = dp.apt_id)
                      AND (pr.valid_from IS NULL OR pr.valid_from <= dp.night_date)
                      AND (pr.valid_until IS NULL OR pr.valid_until >= dp.night_date)
                      AND (pr.weekday_mask IS NULL OR pr.weekday_mask ILIKE
                           '%' || (ARRAY['SUN','MON','TUE','WED','THU','FRI','SAT'])[EXTRACT(DOW FROM dp.night_date)::int + 1] || '%')
                    ORDER BY pr.priority DESC NULLS LAST
                    LIMIT 1
                ), 0)
            ) AS night_price
        FROM daily_prices dp
    ),
    aggregated AS (
        SELECT
            pn.apt_id,
            MAX(pn.slug) AS slug,
            MAX(pn.name) AS name,
            MAX(pn.capacity_people) AS capacity_people,
            (MAX(pn.images::text))::jsonb AS images,
            MAX(pn.short_description) AS short_description,
            v_nights AS nights,
            ROUND(AVG(pn.night_price), 2) AS nightly_avg,
            SUM(pn.night_price) AS subtotal,
            jsonb_build_object(
                'nights', v_nights,
                'breakdown', jsonb_agg(jsonb_build_object(
                    'date', pn.night_date,
                    'base', pn.base_price,
                    'price', pn.night_price
                ) ORDER BY pn.night_date)
            ) AS price_breakdown
        FROM priced_nights pn
        GROUP BY pn.apt_id
    ),
    with_global_rules AS (
        SELECT
            ag.*,
            (ag.subtotal * COALESCE((
                SELECT COALESCE(pr.multiplier, 1)
                FROM public.pricing_rules pr
                WHERE pr.active = true
                  AND pr.rule_type IN ('last_minute', 'early_bird')
                  AND (pr.apartment_id IS NULL OR pr.apartment_id = ag.apt_id)
                  AND (pr.valid_from IS NULL OR pr.valid_from <= p_check_in)
                  AND (pr.valid_until IS NULL OR pr.valid_until >= p_check_out)
                  AND (
                    (pr.rule_type = 'last_minute' AND v_advance <= COALESCE(pr.threshold_days, 0))
                    OR
                    (pr.rule_type = 'early_bird' AND v_advance >= COALESCE(pr.threshold_days, 999))
                  )
                ORDER BY pr.priority DESC NULLS LAST
                LIMIT 1
            ), 1)) AS total_with_rules
        FROM aggregated ag
    )
    SELECT
        a.apt_id, a.slug, a.name, a.capacity_people, a.nights,
        ROUND((a.total_with_rules / a.nights), 2) AS nightly_avg,
        ROUND(a.total_with_rules, 2) AS total_price,
        a.price_breakdown, a.images, a.short_description
    FROM with_global_rules a
    WHERE NOT EXISTS (
        SELECT 1 FROM public.guest_bookings gb
        WHERE gb.apartment_id = a.apt_id
          AND gb.status IN ('hold', 'pending', 'confirmed')
          AND daterange(gb.check_in, gb.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.blocked_dates bd
        WHERE bd.apartment_id = a.apt_id
          AND daterange(bd.start_date, bd.end_date + 1, '[)') && daterange(p_check_in, p_check_out, '[)')
    )
    ORDER BY total_price ASC;
END $function$;


-- 5.2 Cotizacion SIN filtro de ocupacion: la usan create_manual_booking y
--     move_booking, donde el apartamento ya esta ocupado por la propia
--     reserva y check_availability lo descartaria. Misma logica de precio.
CREATE OR REPLACE FUNCTION public.tjm_quote_price(p_apartment_id bigint, p_check_in date, p_check_out date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
    WITH nights AS (
        SELECT d::date AS night_date
        FROM generate_series(p_check_in, p_check_out - interval '1 day', interval '1 day') AS d
    ),
    base AS (
        SELECT a.id AS apt_id, n.night_date,
            COALESCE(
                (SELECT pr.night_price FROM public.pricing_rules pr
                  WHERE pr.active = true AND pr.rule_type = 'special_price' AND pr.night_price IS NOT NULL
                    AND (pr.apartment_id IS NULL OR pr.apartment_id = a.id)
                    AND (pr.valid_from IS NULL OR pr.valid_from <= n.night_date)
                    AND (pr.valid_until IS NULL OR pr.valid_until >= n.night_date)
                  ORDER BY pr.priority DESC NULLS LAST, (pr.apartment_id IS NOT NULL) DESC
                  LIMIT 1),
                (CASE WHEN EXISTS (SELECT 1 FROM public.high_seasons hs
                                    WHERE n.night_date >= hs.start_date AND n.night_date <= hs.end_date)
                      THEN a.price_high ELSE a.price_low END)
            ) AS base_price
        FROM nights n
        CROSS JOIN public.apartments a
        WHERE a.id = p_apartment_id
    ),
    priced AS (
        SELECT b.night_date,
            b.base_price + COALESCE((
                SELECT COALESCE(pr.flat_extra, 0) + b.base_price * (COALESCE(pr.multiplier, 1) - 1)
                FROM public.pricing_rules pr
                WHERE pr.active = true AND pr.rule_type = 'weekend_premium'
                  AND (pr.apartment_id IS NULL OR pr.apartment_id = b.apt_id)
                  AND (pr.valid_from IS NULL OR pr.valid_from <= b.night_date)
                  AND (pr.valid_until IS NULL OR pr.valid_until >= b.night_date)
                  AND (pr.weekday_mask IS NULL OR pr.weekday_mask ILIKE
                       '%' || (ARRAY['SUN','MON','TUE','WED','THU','FRI','SAT'])[EXTRACT(DOW FROM b.night_date)::int + 1] || '%')
                ORDER BY pr.priority DESC NULLS LAST LIMIT 1
            ), 0) AS night_price
        FROM base b
    )
    SELECT ROUND(SUM(p.night_price), 2) FROM priced p;
$function$;

COMMENT ON FUNCTION public.tjm_quote_price(bigint, date, date) IS
  'Precio sugerido de una estancia sin comprobar disponibilidad. No aplica last_minute/early_bird (dependen de la antelacion respecto a hoy y aqui se usa para reservas ya existentes).';


-- ---------------------------------------------------------------------
-- 6. Guardia de autorizacion de los RPC
-- ---------------------------------------------------------------------
-- SECURITY INVOKER a proposito: solo compone auth.role() + is_staff()
-- (que ya es SECURITY DEFINER). Asi no anade ruido a los advisors.
CREATE OR REPLACE FUNCTION public.tjm_puede_gestionar()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT COALESCE(auth.role() = 'service_role', false) OR public.is_staff();
$function$;


-- ---------------------------------------------------------------------
-- 7. RPCs de gestion (todos SECURITY DEFINER, search_path fijo, jsonb)
-- ---------------------------------------------------------------------

-- 7.1 Apuntar una reserva a mano (telefono, WhatsApp, Booking, ...)
CREATE OR REPLACE FUNCTION public.create_manual_booking(
    p_apartment_id      bigint,
    p_check_in          date,
    p_check_out         date,
    p_pax               integer DEFAULT 2,
    p_guest_name        text    DEFAULT NULL,
    p_guest_email       text    DEFAULT NULL,
    p_guest_phone       text    DEFAULT NULL,
    p_channel           text    DEFAULT 'telefono',
    p_total_price       numeric DEFAULT NULL,
    p_external_locator  text    DEFAULT NULL,
    p_commission_amount numeric DEFAULT 0,
    p_notes             text    DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'   -- extensions: gen_random_bytes
AS $function$
DECLARE
    v_apt      record;
    v_code     text;
    v_id       bigint;
    v_total    numeric;
    v_email    text;
    v_channel  text;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
    END IF;

    -- fechas
    IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in
       OR (p_check_out - p_check_in) > 60 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'fechas_invalidas');
    END IF;

    -- apartamento
    SELECT a.id, a.capacity_people, a.is_active INTO v_apt
    FROM public.apartments a WHERE a.id = p_apartment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'apartamento_no_encontrado');
    END IF;

    -- capacidad
    IF COALESCE(p_pax, 0) < 1 OR p_pax > COALESCE(v_apt.capacity_people, 0) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'capacidad');
    END IF;

    -- solape con otras reservas vivas
    IF EXISTS (
        SELECT 1 FROM public.guest_bookings gb
        WHERE gb.apartment_id = p_apartment_id
          AND gb.status IN ('hold', 'pending', 'confirmed')
          AND daterange(gb.check_in, gb.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ocupado');
    END IF;

    -- solape con bloqueos (end_date es INCLUSIVA)
    IF EXISTS (
        SELECT 1 FROM public.blocked_dates bd
        WHERE bd.apartment_id = p_apartment_id
          AND daterange(bd.start_date, bd.end_date + 1, '[)') && daterange(p_check_in, p_check_out, '[)')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ocupado');
    END IF;

    v_channel := COALESCE(NULLIF(TRIM(p_channel), ''), 'telefono');
    v_total   := COALESCE(p_total_price, public.tjm_quote_price(p_apartment_id, p_check_in, p_check_out), 0);

    -- guest_email es NOT NULL en la tabla: si no lo tenemos, marcador interno
    v_email := NULLIF(LOWER(TRIM(COALESCE(p_guest_email, ''))), '');
    IF v_email IS NULL THEN
        v_email := 'sin-email+' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '@tiojosemaria.local';
    END IF;

    LOOP
        v_code := public.generate_booking_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.guest_bookings gb WHERE gb.booking_code = v_code);
    END LOOP;

    BEGIN
        -- `nights` NO se lista: es columna generada.
        INSERT INTO public.guest_bookings (
            apartment_id, guest_name, guest_email, guest_phone,
            pax_count, check_in, check_out,
            total_price, status, payment_status,
            source, channel, external_locator, commission_amount,
            booking_code, internal_notes, created_by
        ) VALUES (
            p_apartment_id,
            COALESCE(NULLIF(TRIM(COALESCE(p_guest_name, '')), ''), 'Sin nombre'),
            v_email,
            p_guest_phone,
            p_pax, p_check_in, p_check_out,
            v_total, 'confirmed', 'pending',
            'manual', v_channel, p_external_locator, COALESCE(p_commission_amount, 0),
            v_code, p_notes, COALESCE(auth.uid()::text, 'service_role')
        )
        RETURNING id INTO v_id;
    EXCEPTION WHEN exclusion_violation THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ocupado');
    END;

    -- El trigger guest_bookings_ensure_customer ya ha creado/actualizado
    -- la ficha en customers con este email.

    RETURN jsonb_build_object(
        'ok', true,
        'booking_id', v_id,
        'booking_code', v_code,
        'total_price', v_total,
        'channel', v_channel
    );
END $function$;


-- 7.2 Apuntar un cobro
CREATE OR REPLACE FUNCTION public.register_payment(
    p_booking_id bigint,
    p_amount     numeric,
    p_method     text,
    p_paid_on    date DEFAULT NULL,
    p_note       text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_paid    numeric;
    v_pending numeric;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.guest_bookings gb WHERE gb.id = p_booking_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reserva_no_encontrada');
    END IF;

    IF p_amount IS NULL OR p_amount = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'importe_invalido');
    END IF;

    IF p_method IS NULL OR p_method NOT IN ('transferencia','bizum','efectivo','tarjeta','stripe','booking') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forma_de_pago_invalida');
    END IF;

    INSERT INTO public.booking_payments (booking_id, amount, method, paid_on, note, created_by)
    VALUES (p_booking_id, ROUND(p_amount, 2), p_method, COALESCE(p_paid_on, current_date),
            p_note, COALESCE(auth.uid()::text, 'service_role'));

    SELECT gb.paid_amount, gb.pending_amount INTO v_paid, v_pending
      FROM public.guest_bookings gb WHERE gb.id = p_booking_id;

    RETURN jsonb_build_object('ok', true, 'paid_amount', v_paid, 'pending_amount', v_pending);
END $function$;


-- 7.3 Cambiar fechas y/o apartamento
CREATE OR REPLACE FUNCTION public.move_booking(
    p_booking_id   bigint,
    p_apartment_id bigint,
    p_check_in     date,
    p_check_out    date
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_bk         record;
    v_apt        record;
    v_sugerido   numeric;
    v_nights     integer;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
    END IF;

    SELECT gb.id, gb.apartment_id, gb.check_in, gb.check_out, gb.pax_count, gb.total_price, gb.status
      INTO v_bk FROM public.guest_bookings gb WHERE gb.id = p_booking_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reserva_no_encontrada');
    END IF;

    IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in
       OR (p_check_out - p_check_in) > 60 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'fechas_invalidas');
    END IF;

    SELECT a.id, a.capacity_people INTO v_apt FROM public.apartments a WHERE a.id = p_apartment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'apartamento_no_encontrado');
    END IF;
    IF COALESCE(v_bk.pax_count, 1) > COALESCE(v_apt.capacity_people, 0) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'capacidad');
    END IF;

    -- solape con OTRAS reservas vivas (se excluye a si misma)
    IF EXISTS (
        SELECT 1 FROM public.guest_bookings gb
        WHERE gb.id <> p_booking_id
          AND gb.apartment_id = p_apartment_id
          AND gb.status IN ('hold', 'pending', 'confirmed')
          AND daterange(gb.check_in, gb.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ocupado');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.blocked_dates bd
        WHERE bd.apartment_id = p_apartment_id
          AND daterange(bd.start_date, bd.end_date + 1, '[)') && daterange(p_check_in, p_check_out, '[)')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ocupado');
    END IF;

    v_sugerido := public.tjm_quote_price(p_apartment_id, p_check_in, p_check_out);

    BEGIN
        -- `nights` es columna generada: se recalcula sola al mover las fechas.
        UPDATE public.guest_bookings
           SET apartment_id = p_apartment_id,
               check_in     = p_check_in,
               check_out    = p_check_out,
               updated_at   = now()
         WHERE id = p_booking_id;
    EXCEPTION WHEN exclusion_violation THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ocupado');
    END;

    SELECT gb.nights INTO v_nights FROM public.guest_bookings gb WHERE gb.id = p_booking_id;

    RETURN jsonb_build_object(
        'ok', true,
        'booking_id', p_booking_id,
        'nights', v_nights,
        'precio_sugerido', v_sugerido,
        'diferencia', ROUND(COALESCE(v_sugerido, 0) - COALESCE(v_bk.total_price, 0), 2),
        'total_price', v_bk.total_price
    );
END $function$;

COMMENT ON FUNCTION public.move_booking(bigint, bigint, date, date) IS
  'Mueve la reserva y recalcula noches. NO cambia total_price: devuelve precio_sugerido y diferencia para que decida quien gestiona.';


-- 7.4 Cancelar
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id bigint, p_reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_bk         record;
    v_a_devolver numeric;
    v_gratis     boolean;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
    END IF;

    SELECT gb.id, gb.check_in, gb.paid_amount, gb.status, gb.internal_notes
      INTO v_bk FROM public.guest_bookings gb WHERE gb.id = p_booking_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reserva_no_encontrada');
    END IF;

    IF v_bk.status = 'cancelled' THEN
        RETURN jsonb_build_object('ok', true, 'ya_cancelada', true, 'a_devolver', 0);
    END IF;

    -- Politica: gratis hasta 7 dias antes de la llegada; despues no se devuelve.
    v_gratis := (v_bk.check_in - current_date) >= 7;
    v_a_devolver := CASE WHEN v_gratis THEN GREATEST(COALESCE(v_bk.paid_amount, 0), 0) ELSE 0 END;

    UPDATE public.guest_bookings
       SET status = 'cancelled',
           internal_notes = TRIM(BOTH E'\n' FROM
               COALESCE(v_bk.internal_notes || E'\n', '') ||
               'Cancelada el ' || to_char(current_date, 'DD/MM/YYYY') ||
               CASE WHEN COALESCE(TRIM(p_reason), '') <> '' THEN ' — motivo: ' || TRIM(p_reason) ELSE '' END ||
               CASE WHEN v_gratis THEN ' — cancelacion gratuita (7+ dias de antelacion), a devolver '
                    ELSE ' — fuera de plazo (menos de 7 dias), a devolver ' END ||
               v_a_devolver::text || ' EUR'),
           updated_at = now()
     WHERE id = p_booking_id;

    -- Al pasar a 'cancelled' la reserva deja de contar para
    -- no_overlap_bookings y para check_availability: las fechas quedan libres.

    RETURN jsonb_build_object(
        'ok', true,
        'booking_id', p_booking_id,
        'a_devolver', v_a_devolver,
        'gratuita', v_gratis,
        'cobrado', COALESCE(v_bk.paid_amount, 0)
    );
END $function$;


-- 7.5 Precio especial para unas fechas
CREATE OR REPLACE FUNCTION public.set_special_price(
    p_apartment_id bigint,
    p_from         date,
    p_to           date,
    p_night_price  numeric,
    p_name         text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_id   uuid;
    v_name text;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
    END IF;

    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
        RETURN jsonb_build_object('ok', false, 'error', 'fechas_invalidas');
    END IF;
    IF p_night_price IS NULL OR p_night_price <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'precio_invalido');
    END IF;
    IF p_apartment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.apartments a WHERE a.id = p_apartment_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'apartamento_no_encontrado');
    END IF;

    v_name := COALESCE(NULLIF(TRIM(COALESCE(p_name, '')), ''),
                       'Precio especial ' || to_char(p_from, 'DD/MM') || '-' || to_char(p_to, 'DD/MM/YYYY'));

    -- Si ya hay una regla special_price para el mismo apartamento y tramo, se actualiza.
    SELECT pr.id INTO v_id
      FROM public.pricing_rules pr
     WHERE pr.rule_type = 'special_price'
       AND pr.apartment_id IS NOT DISTINCT FROM p_apartment_id
       AND pr.valid_from  IS NOT DISTINCT FROM p_from
       AND pr.valid_until IS NOT DISTINCT FROM p_to
     LIMIT 1;

    IF v_id IS NOT NULL THEN
        UPDATE public.pricing_rules
           SET night_price = p_night_price, name = v_name, active = true
         WHERE id = v_id;
    ELSE
        INSERT INTO public.pricing_rules (apartment_id, name, rule_type, night_price, valid_from, valid_until, active, priority)
        VALUES (p_apartment_id, v_name, 'special_price', p_night_price, p_from, p_to, true, 100)
        RETURNING id INTO v_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'rule_id', v_id, 'night_price', p_night_price,
                              'apartment_id', p_apartment_id, 'from', p_from, 'to', p_to);
END $function$;


-- 7.6 Cerrar ventas (no alquilar estos dias)
CREATE OR REPLACE FUNCTION public.close_sales(
    p_apartment_ids bigint[],
    p_from          date,
    p_to            date,
    p_reason        text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_ids   uuid[] := ARRAY[]::uuid[];
    v_apt   bigint;
    v_new   uuid;
    v_lista bigint[];
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
    END IF;

    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
        RETURN jsonb_build_object('ok', false, 'error', 'fechas_invalidas');
    END IF;

    -- Sin lista = los cuatro apartamentos activos
    IF p_apartment_ids IS NULL OR array_length(p_apartment_ids, 1) IS NULL THEN
        SELECT array_agg(a.id) INTO v_lista FROM public.apartments a WHERE a.is_active = true;
    ELSE
        v_lista := p_apartment_ids;
    END IF;

    FOREACH v_apt IN ARRAY v_lista LOOP
        IF EXISTS (SELECT 1 FROM public.apartments a WHERE a.id = v_apt) THEN
            INSERT INTO public.blocked_dates (apartment_id, start_date, end_date, source, reason)
            VALUES (v_apt, p_from, p_to, 'cierre', NULLIF(TRIM(COALESCE(p_reason, '')), ''))
            RETURNING id INTO v_new;
            v_ids := array_append(v_ids, v_new);
        END IF;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'creados', COALESCE(array_length(v_ids, 1), 0),
                              'ids', to_jsonb(v_ids), 'from', p_from, 'to', p_to);
END $function$;

COMMENT ON FUNCTION public.close_sales(bigint[], date, date, text) IS
  'Cierra ventas insertando en blocked_dates con source=cierre. end_date es INCLUSIVA (p_to es el ultimo dia cerrado).';


-- ---------------------------------------------------------------------
-- 8. Permisos de ejecucion
-- ---------------------------------------------------------------------
-- Ningun RPC de gestion es accesible por anon. authenticated si (el panel
-- llama por PostgREST) y cada funcion comprueba tjm_puede_gestionar().
DO $do$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.create_manual_booking(bigint,date,date,integer,text,text,text,text,numeric,text,numeric,text)',
    'public.register_payment(bigint,numeric,text,date,text)',
    'public.move_booking(bigint,bigint,date,date)',
    'public.cancel_booking(bigint,text)',
    'public.set_special_price(bigint,date,date,numeric,text)',
    'public.close_sales(bigint[],date,date,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $do$;

GRANT EXECUTE ON FUNCTION public.tjm_quote_price(bigint, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tjm_puede_gestionar() TO authenticated, service_role;

-- Las funciones de trigger las ejecuta el motor al disparar el trigger: no
-- necesitan EXECUTE y no deben quedar publicadas como RPC en /rest/v1/rpc.
REVOKE ALL ON FUNCTION public.recalc_booking_paid_amount() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalc_booking_paid_amount() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_stripe_payment_to_booking() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_stripe_payment_to_booking() FROM anon, authenticated;

-- 0026 · Descuento de última hora en la web (16-sep-2026)
-- =======================================================
-- Decisión de Jesús (plan de captación, §13 + estudio de descuentos del
-- 16-sep): en los portales se activa un 10 % si la llegada es en los
-- próximos 5 días. Para que la web siga siendo la más barata, la MISMA
-- regla tiene que existir aquí. El motor (`check_availability`) ya sabía
-- aplicar reglas `last_minute`; lo que faltaba era:
--
--   1. Que NO se aplique cuando la estancia toca temporada alta (puentes,
--      Navidad, verano): ahí no sobran noches. Holidu hace lo mismo.
--   2. Que el desglose (`price_breakdown`) diga cuánto ha descontado, para
--      que la web pueda enseñarlo («−10 % última hora») en vez de un total
--      que no cuadra con la suma de noches.
--   3. La regla en sí (no había ninguna fila en `pricing_rules`).
--
-- No cambia nada más del motor: sin reglas activas el resultado es el de
-- siempre.

CREATE OR REPLACE FUNCTION public.check_availability(p_check_in date, p_check_out date, p_pax integer DEFAULT 1)
 RETURNS TABLE(apartment_id bigint, slug text, name text, capacity_people integer, nights integer, nightly_avg numeric, total_price numeric, price_breakdown jsonb, images jsonb, short_description text)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_nights int;
    v_advance int;
    v_today date := current_date;
    v_toca_alta boolean;
BEGIN
    IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in THEN
        RAISE EXCEPTION 'invalid_dates' USING ERRCODE = '22023';
    END IF;
    IF p_check_in < v_today THEN
        RAISE EXCEPTION 'check_in_in_past' USING ERRCODE = '22023';
    END IF;

    v_nights := p_check_out - p_check_in;
    v_advance := p_check_in - v_today;

    -- ¿Alguna noche de la estancia cae en temporada alta? Entonces las
    -- reglas de última hora no juegan (blocked_dates y high_seasons llevan
    -- end_date INCLUSIVO, de ahí el +1).
    SELECT EXISTS (
        SELECT 1 FROM public.high_seasons hs
        WHERE daterange(hs.start_date, hs.end_date + 1, '[)') && daterange(p_check_in, p_check_out, '[)')
    ) INTO v_toca_alta;

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
            jsonb_agg(jsonb_build_object(
                'date', pn.night_date,
                'base', pn.base_price,
                'price', pn.night_price
            ) ORDER BY pn.night_date) AS noches
        FROM priced_nights pn
        GROUP BY pn.apt_id
    ),
    with_global_rules AS (
        SELECT
            ag.*,
            (
                SELECT jsonb_build_object('name', pr.name, 'rule_type', pr.rule_type, 'multiplier', COALESCE(pr.multiplier, 1))
                FROM public.pricing_rules pr
                WHERE pr.active = true
                  AND pr.rule_type IN ('last_minute', 'early_bird')
                  AND (pr.apartment_id IS NULL OR pr.apartment_id = ag.apt_id)
                  AND (pr.valid_from IS NULL OR pr.valid_from <= p_check_in)
                  AND (pr.valid_until IS NULL OR pr.valid_until >= p_check_out)
                  AND (
                    (pr.rule_type = 'last_minute' AND NOT v_toca_alta AND v_advance <= COALESCE(pr.threshold_days, 0))
                    OR
                    (pr.rule_type = 'early_bird' AND v_advance >= COALESCE(pr.threshold_days, 999))
                  )
                ORDER BY pr.priority DESC NULLS LAST
                LIMIT 1
            ) AS regla
        FROM aggregated ag
    ),
    totals AS (
        SELECT
            w.*,
            ROUND(w.subtotal * COALESCE((w.regla->>'multiplier')::numeric, 1), 2) AS total_with_rules
        FROM with_global_rules w
    )
    SELECT
        a.apt_id, a.slug, a.name, a.capacity_people, a.nights,
        ROUND((a.total_with_rules / a.nights), 2) AS nightly_avg,
        a.total_with_rules AS total_price,
        jsonb_build_object(
            'nights', a.nights,
            'breakdown', a.noches,
            'subtotal', a.subtotal,
            'discount', CASE WHEN a.regla IS NULL THEN NULL ELSE jsonb_build_object(
                'name', a.regla->>'name',
                'rule_type', a.regla->>'rule_type',
                'pct', ROUND((1 - (a.regla->>'multiplier')::numeric) * 100),
                'amount', ROUND(a.subtotal - a.total_with_rules, 2)
            ) END
        ) AS price_breakdown,
        a.images, a.short_description
    FROM totals a
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

-- La regla: 10 % menos si la llegada es en los próximos 5 días (misma
-- ventana que en Holidu). Sin fecha de fin: se apaga poniendo active=false.
INSERT INTO public.pricing_rules (name, rule_type, multiplier, threshold_days, active, priority)
SELECT 'Última hora: −10 % si entras en los próximos 5 días', 'last_minute', 0.900, 5, true, 10
WHERE NOT EXISTS (SELECT 1 FROM public.pricing_rules WHERE rule_type = 'last_minute');

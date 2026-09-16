-- 0025 — Informes de Jesús: el mes por apartamento y por canal (P6.3).
-- ===================================================================
-- Lo que MisterPlan daba en «Informes» (facturación por elemento/canal,
-- ocupación, pernoctaciones) y la pantalla «Analíticas» de hoy NO da: esa
-- cuenta reservas totales con canceladas y pruebas dentro, sin canal, sin
-- comisión, sin ocupación.
--
-- Dos funciones, SECURITY INVOKER (leen con la RLS de quien llama: admin y
-- staff ven reservas; anon no ve nada) y search_path fijo:
--
--   v_informe_mes(año, mes)        → filas por nivel: 'total', 'apartamento', 'canal'
--   v_informe_serie(desde, hasta)  → una fila por mes (totales), para tendencia
--                                    y comparativa con el año anterior
--
-- Criterios (los mismos que el INE, migraciones 0007/0024):
--   · Cuentan las reservas confirmed/completed; las de prueba (source='test')
--     fuera; las canceladas solo en la columna de cancelaciones.
--   · Una noche = una fila (apartamento, día). Ingresos y comisión se
--     PRORRATEAN por noche: una estancia a caballo entre dos meses reparte su
--     importe entre los dos. Así ingresos, ocupación y precio/noche hablan del
--     mismo periodo.
--   · Noches disponibles = apartamentos × días del mes − noches cerradas
--     (cierre propio o cierre reflejado por el canal, external_kind='closed').
--   · Un bloqueo de canal marcado 'reserved' sin reserva detrás (Airbnb por
--     iCal) cuenta como noche ocupada del canal, con ingresos desconocidos
--     (NULL, no 0): se ve como «sin datos», no como gratis.
--   · Neto = bruto − comisión. En Booking la comisión viene apuntada en la
--     reserva (commission_amount); si falta, se estima con commission_pct.

CREATE OR REPLACE FUNCTION public.v_informe_mes(p_year int, p_month int)
RETURNS TABLE (
    nivel                text,      -- total | apartamento | canal
    clave                text,      -- slug del apartamento / clave del canal / 'total'
    nombre               text,
    noches_disponibles   int,
    noches_ocupadas      int,       -- con reserva propia
    noches_canal         int,       -- bloqueo 'reserved' de canal sin reserva detrás
    ocupacion_pct        numeric,   -- (ocupadas + canal) / disponibles
    entradas             int,       -- reservas que entran en el mes
    cancelaciones        int,       -- reservas canceladas con entrada en el mes
    viajeros             int,       -- personas de las reservas que entran
    pernoctaciones       int,       -- personas × noches del mes
    ingresos_brutos      numeric,   -- prorrateados por noche
    comision             numeric,
    ingresos_netos       numeric,
    precio_medio_noche   numeric,   -- bruto / noches ocupadas
    estancia_media       numeric    -- noches / entradas (de las reservas que entran)
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
WITH bounds AS (
    SELECT make_date(p_year, p_month, 1) AS d0,
           (make_date(p_year, p_month, 1) + interval '1 month')::date AS d1
),
dias AS (
    SELECT generate_series(b.d0, b.d1 - 1, interval '1 day')::date AS dia FROM bounds b
),
apts AS (
    SELECT a.id, a.slug, a.name FROM public.apartments a WHERE a.is_active
),
reservas AS (
    SELECT gb.id, gb.apartment_id, gb.check_in, gb.check_out, gb.status,
           COALESCE(NULLIF(gb.channel, ''), 'web') AS canal,
           COALESCE(gb.pax_count, 0) AS pax,
           COALESCE(gb.total_price, 0) AS total,
           COALESCE(gb.commission_amount,
                    CASE WHEN gb.commission_pct IS NOT NULL THEN round(COALESCE(gb.total_price, 0) * gb.commission_pct / 100, 2) END,
                    0) AS comision,
           GREATEST(gb.check_out - gb.check_in, 1) AS noches_totales
    FROM public.guest_bookings gb
    WHERE COALESCE(gb.source, '') <> 'test'
),
vivas AS (SELECT * FROM reservas WHERE status IN ('confirmed', 'completed')),
-- Una fila por noche de reserva dentro del mes, con su parte del importe.
noches AS (
    SELECT r.id, r.apartment_id, r.canal, r.pax, d.dia,
           r.total / r.noches_totales AS bruto_noche,
           r.comision / r.noches_totales AS comision_noche
    FROM vivas r
    JOIN dias d ON d.dia >= r.check_in AND d.dia < r.check_out
),
-- Noches cerradas por apartamento (cierre propio o reflejado por el canal).
cerradas AS (
    SELECT DISTINCT bd.apartment_id, d.dia
    FROM public.blocked_dates bd
    JOIN dias d ON d.dia BETWEEN bd.start_date AND bd.end_date
    JOIN apts a ON a.id = bd.apartment_id
    WHERE bd.source = 'cierre' OR bd.reason ILIKE 'cierre%' OR bd.external_kind = 'closed'
),
-- Noches de canal sin reserva propia detrás (Airbnb por iCal, «Reserved»).
canal_sin_reserva AS (
    SELECT DISTINCT bd.apartment_id, bd.source AS canal, d.dia
    FROM public.blocked_dates bd
    JOIN dias d ON d.dia BETWEEN bd.start_date AND bd.end_date
    JOIN apts a ON a.id = bd.apartment_id
    WHERE bd.source NOT IN ('manual', 'cierre')
      AND COALESCE(bd.external_kind, 'reserved') <> 'closed'
      AND NOT EXISTS (SELECT 1 FROM noches n WHERE n.apartment_id = bd.apartment_id AND n.dia = d.dia)
),
entradas AS (
    SELECT r.* FROM reservas r, bounds b WHERE r.check_in >= b.d0 AND r.check_in < b.d1
),
-- ---- por apartamento -------------------------------------------------
por_apto AS (
    SELECT 'apartamento'::text AS nivel, a.slug AS clave, a.name AS nombre,
           (SELECT count(*)::int FROM dias) - (SELECT count(*)::int FROM cerradas c WHERE c.apartment_id = a.id) AS disp,
           (SELECT count(*)::int FROM noches n WHERE n.apartment_id = a.id) AS ocup,
           (SELECT count(*)::int FROM canal_sin_reserva c WHERE c.apartment_id = a.id) AS ocup_canal,
           (SELECT count(*)::int FROM entradas e WHERE e.apartment_id = a.id AND e.status IN ('confirmed', 'completed')) AS entr,
           (SELECT count(*)::int FROM entradas e WHERE e.apartment_id = a.id AND e.status = 'cancelled') AS canc,
           (SELECT COALESCE(sum(e.pax), 0)::int FROM entradas e WHERE e.apartment_id = a.id AND e.status IN ('confirmed', 'completed')) AS viaj,
           (SELECT COALESCE(sum(n.pax), 0)::int FROM noches n WHERE n.apartment_id = a.id) AS pernoc,
           (SELECT COALESCE(sum(n.bruto_noche), 0) FROM noches n WHERE n.apartment_id = a.id) AS bruto,
           (SELECT COALESCE(sum(n.comision_noche), 0) FROM noches n WHERE n.apartment_id = a.id) AS com,
           (SELECT COALESCE(sum(e.noches_totales), 0)::int FROM entradas e WHERE e.apartment_id = a.id AND e.status IN ('confirmed', 'completed')) AS noches_entr
    FROM apts a
),
-- ---- por canal ----------------------------------------------------------
canales AS (
    SELECT DISTINCT canal FROM noches
    UNION SELECT DISTINCT canal FROM entradas
    UNION SELECT DISTINCT canal FROM canal_sin_reserva
),
por_canal AS (
    SELECT 'canal'::text AS nivel, c.canal AS clave,
           CASE c.canal
               WHEN 'web' THEN 'Directo (web)' WHEN 'booking' THEN 'Booking.com' WHEN 'airbnb' THEN 'Airbnb'
               WHEN 'escapada' THEN 'Escapada Rural' WHEN 'casasrurales' THEN 'CasasRurales.net' WHEN 'holidu' THEN 'Holidu'
               WHEN 'telefono' THEN 'Teléfono' WHEN 'whatsapp' THEN 'WhatsApp' WHEN 'manual' THEN 'Apuntada a mano'
               ELSE initcap(c.canal) END AS nombre,
           NULL::int AS disp,
           (SELECT count(*)::int FROM noches n WHERE n.canal = c.canal) AS ocup,
           (SELECT count(*)::int FROM canal_sin_reserva x WHERE x.canal = c.canal) AS ocup_canal,
           (SELECT count(*)::int FROM entradas e WHERE e.canal = c.canal AND e.status IN ('confirmed', 'completed')) AS entr,
           (SELECT count(*)::int FROM entradas e WHERE e.canal = c.canal AND e.status = 'cancelled') AS canc,
           (SELECT COALESCE(sum(e.pax), 0)::int FROM entradas e WHERE e.canal = c.canal AND e.status IN ('confirmed', 'completed')) AS viaj,
           (SELECT COALESCE(sum(n.pax), 0)::int FROM noches n WHERE n.canal = c.canal) AS pernoc,
           (SELECT COALESCE(sum(n.bruto_noche), 0) FROM noches n WHERE n.canal = c.canal) AS bruto,
           (SELECT COALESCE(sum(n.comision_noche), 0) FROM noches n WHERE n.canal = c.canal) AS com,
           (SELECT COALESCE(sum(e.noches_totales), 0)::int FROM entradas e WHERE e.canal = c.canal AND e.status IN ('confirmed', 'completed')) AS noches_entr
    FROM canales c
),
-- ---- total ----------------------------------------------------------------
total AS (
    SELECT 'total'::text AS nivel, 'total'::text AS clave, 'Todos los apartamentos'::text AS nombre,
           (SELECT COALESCE(sum(p.disp), 0)::int FROM por_apto p) AS disp,
           (SELECT count(*)::int FROM noches) AS ocup,
           (SELECT count(*)::int FROM canal_sin_reserva) AS ocup_canal,
           (SELECT count(*)::int FROM entradas e WHERE e.status IN ('confirmed', 'completed')) AS entr,
           (SELECT count(*)::int FROM entradas e WHERE e.status = 'cancelled') AS canc,
           (SELECT COALESCE(sum(e.pax), 0)::int FROM entradas e WHERE e.status IN ('confirmed', 'completed')) AS viaj,
           (SELECT COALESCE(sum(n.pax), 0)::int FROM noches n) AS pernoc,
           (SELECT COALESCE(sum(n.bruto_noche), 0) FROM noches n) AS bruto,
           (SELECT COALESCE(sum(n.comision_noche), 0) FROM noches n) AS com,
           (SELECT COALESCE(sum(e.noches_totales), 0)::int FROM entradas e WHERE e.status IN ('confirmed', 'completed')) AS noches_entr
),
todo AS (
    SELECT * FROM total UNION ALL SELECT * FROM por_apto UNION ALL SELECT * FROM por_canal
)
SELECT nivel, clave, nombre,
       disp,
       ocup,
       ocup_canal,
       CASE WHEN disp > 0 THEN round(100.0 * (ocup + ocup_canal) / disp, 1) END,
       entr, canc, viaj, pernoc,
       round(bruto, 2),
       round(com, 2),
       round(bruto - com, 2),
       CASE WHEN ocup > 0 THEN round(bruto / ocup, 2) END,
       CASE WHEN entr > 0 THEN round(noches_entr::numeric / entr, 2) END
FROM todo
ORDER BY CASE nivel WHEN 'total' THEN 0 WHEN 'apartamento' THEN 1 ELSE 2 END, nombre;
$$;

COMMENT ON FUNCTION public.v_informe_mes(int, int) IS
'Informe del mes por apartamento y por canal: ocupación, entradas, cancelaciones, viajeros, pernoctaciones, ingresos brutos/comisión/netos prorrateados por noche. Sin pruebas ni cierres.';

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v_informe_serie(p_desde date, p_hasta date)
RETURNS TABLE (
    mes                  date,      -- primer día del mes
    noches_disponibles   int,
    noches_ocupadas      int,
    noches_canal         int,
    ocupacion_pct        numeric,
    entradas             int,
    cancelaciones        int,
    viajeros             int,
    pernoctaciones       int,
    ingresos_brutos      numeric,
    comision             numeric,
    ingresos_netos       numeric,
    precio_medio_noche   numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
SELECT m.mes::date,
       t.noches_disponibles, t.noches_ocupadas, t.noches_canal, t.ocupacion_pct,
       t.entradas, t.cancelaciones, t.viajeros, t.pernoctaciones,
       t.ingresos_brutos, t.comision, t.ingresos_netos, t.precio_medio_noche
FROM generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), interval '1 month') AS m(mes)
CROSS JOIN LATERAL public.v_informe_mes(EXTRACT(YEAR FROM m.mes)::int, EXTRACT(MONTH FROM m.mes)::int) t
WHERE t.nivel = 'total'
ORDER BY m.mes;
$$;

COMMENT ON FUNCTION public.v_informe_serie(date, date) IS
'Totales de v_informe_mes mes a mes entre dos fechas: para la tendencia y la comparativa con el año anterior.';

-- Permisos: gestión (admin/staff) sí; anon no. La RLS de guest_bookings ya
-- decide qué ve cada uno dentro.
REVOKE ALL ON FUNCTION public.v_informe_mes(int, int)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.v_informe_serie(date, date)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v_informe_mes(int, int)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.v_informe_serie(date, date) TO authenticated, service_role;

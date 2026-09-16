-- 0024 — El INE no cuenta como ocupación los cierres que el canal refleja.
-- ==================================================================
-- Medido el 16-sep-2026: v_ine_mes(2026, 9) daba 33 noches «ocupadas por canal»
-- que eran los cierres de Airbnb (14-17 y 21-24, los cuatro apartamentos;
-- Tomillo 14-24; Albahaca 21-27): lo que MisterPlan empuja al portal, no
-- huéspedes. La vista se escribió el 10-sep (0007), antes de que el importador
-- distinguiera reserva de cierre (blocked_dates.external_kind, 0019, 15-sep).
--
-- Cambia dos cosas, en v_ine_mes y v_ine_mes_detalle:
--   · un bloqueo de canal con external_kind = 'closed' NO es una noche ocupada;
--   · un día en que TODOS los apartamentos están cerrados (cierre propio o
--     cierre reflejado por el canal) NO es un día abierto (apdo 2).
-- El resto de 0007 queda igual. Resultado en septiembre: 38 → 5 alojamientos
-- ocupados; 30 → 22 días abiertos (8 días con los cuatro cerrados). Aplicada y
-- comprobada el 16-sep: 5 = Adrián 2 + Michael 1 + Emilia 2.

CREATE OR REPLACE FUNCTION public.v_ine_mes(p_year int, p_month int)
RETURNS TABLE (
    -- Identificación
    anio                            int,
    mes                             int,
    mes_nombre                      text,
    dias_del_mes                    int,
    -- Apdo 2: periodo de actividad
    dias_abiertos                   int,
    -- Apdo 3: tipo de establecimiento
    num_alojamientos                int,
    plazas                          int,
    -- Apdo 4: ocupación
    alojamientos_ocupados_reservas  int,   -- 4.2 contando SOLO guest_bookings
    alojamientos_ocupados_canal     int,   -- 4.2 aportado por bloqueos de canal (Airbnb/Booking)
    alojamientos_ocupados_total     int,   -- 4.2 a declarar
    plazas_supletorias              int,   -- 4.3 (no se registra en el sistema → 0)
    -- Apdo 6: viajeros y pernoctaciones
    viajeros_entrados               int,
    pernoctaciones                  int,
    pernoctaciones_fin_semana       int,   -- 6.1 (noches de viernes y sábado)
    -- Apdo 7: precios (uso completo)
    precio_medio_normal             numeric,
    precio_medio_fin_semana         numeric,
    pct_ocupados_normal             numeric,
    pct_ocupados_fin_semana         numeric,
    -- Indicadores derivados (NO son casillas: control de coherencia)
    grado_ocupacion_plazas          numeric,
    grado_ocupacion_alojamientos    numeric,
    estancia_media                  numeric,
    -- Avisos de calidad del dato
    noches_canal_sin_viajeros       int,
    viajeros_sin_residencia         int
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
    SELECT a.id, a.capacity_people FROM public.apartments a WHERE a.is_active
),
-- Un día cuenta como CERRADO solo si TODOS los apartamentos están cerrados
-- ese día por un cierre del establecimiento. Que un apartamento esté
-- ocupado o bloqueado no cierra el alojamiento (apdo 2: "días que sería
-- posible alojarse, haya tenido o no plazas ocupadas").
dias_cerrados AS (
    SELECT d.dia
    FROM dias d
    WHERE (SELECT count(*) FROM apts) > 0
      AND (SELECT count(*) FROM apts a
           WHERE EXISTS (
               SELECT 1 FROM public.blocked_dates bd
               WHERE bd.apartment_id = a.id
                 AND (bd.source = 'cierre' OR bd.reason ILIKE 'cierre%'
                      -- 0024: un cierre que el canal refleja («Airbnb (Not
                      -- available)», lo que empuja MisterPlan) también cierra.
                      OR bd.external_kind = 'closed')
                 AND d.dia BETWEEN bd.start_date AND bd.end_date
           )) = (SELECT count(*) FROM apts)
),
reservas AS (
    SELECT gb.* FROM public.guest_bookings gb
    WHERE gb.status IN ('confirmed', 'completed')
      -- Las reservas de prueba (plan §7: `source='test'`) NO son estadística.
      AND COALESCE(gb.source, '') <> 'test'
),
-- Una fila por (reserva, noche) dentro del mes. check_out EXCLUSIVO.
noches AS (
    SELECT r.id, r.apartment_id, r.pax_count, r.total_price, r.nights,
           r.price_breakdown, d.dia
    FROM reservas r
    JOIN dias d ON d.dia >= r.check_in AND d.dia < r.check_out
),
-- Noches ocupadas por bloqueos de CANAL (Airbnb/Booking): son estancias
-- reales, pero llegan sin huésped ni nº de personas. end_date INCLUSIVO.
noches_canal AS (
    SELECT DISTINCT bd.apartment_id, d.dia
    FROM public.blocked_dates bd
    JOIN dias d ON d.dia BETWEEN bd.start_date AND bd.end_date
    JOIN apts a ON a.id = bd.apartment_id
    WHERE bd.source NOT IN ('manual', 'cierre')
      -- 0024: un cierre del canal (external_kind = 'closed', mig. 0019) NO es
      -- una estancia: es MisterPlan cerrando fechas en el portal. Solo cuenta
      -- lo que el canal marca como reserva («Reserved») o no clasifica.
      AND COALESCE(bd.external_kind, 'reserved') <> 'closed'
      -- una noche ya cubierta por una reserva propia no se cuenta dos veces
      AND NOT EXISTS (
          SELECT 1 FROM noches n
          WHERE n.apartment_id = bd.apartment_id AND n.dia = d.dia
      )
),
-- Precio aplicado por noche: el desglose real si existe, si no el
-- promedio de la reserva. Apdo 7.2 pide precio de la vivienda completa.
noches_precio AS (
    SELECT n.dia,
           EXTRACT(DOW FROM n.dia)::int IN (5, 6) AS es_finde,   -- 5=viernes, 6=sábado
           COALESCE(
               (SELECT (e->>'price')::numeric
                FROM jsonb_array_elements(n.price_breakdown->'breakdown') e
                WHERE (e->>'date')::date = n.dia
                LIMIT 1),
               CASE WHEN n.nights > 0 THEN n.total_price / n.nights END
           ) AS precio
    FROM noches n
),
agg AS (
    SELECT
        (SELECT count(*)::int FROM dias) AS n_dias,
        (SELECT count(*)::int FROM dias) - (SELECT count(*)::int FROM dias_cerrados) AS n_abiertos,
        (SELECT count(*)::int FROM apts) AS n_apts,
        (SELECT COALESCE(sum(a.capacity_people), 0)::int FROM apts a) AS n_plazas,
        (SELECT count(DISTINCT (n.apartment_id, n.dia))::int FROM noches n) AS ocup_res,
        (SELECT count(*)::int FROM noches_canal) AS ocup_canal,
        (SELECT COALESCE(sum(n.pax_count), 0)::int FROM noches n) AS pernoc,
        (SELECT COALESCE(sum(n.pax_count), 0)::int FROM noches n
          WHERE EXTRACT(DOW FROM n.dia)::int IN (5, 6)) AS pernoc_fs,
        (SELECT COALESCE(sum(r.pax_count), 0)::int
           FROM reservas r, bounds b
          WHERE r.check_in >= b.d0 AND r.check_in < b.d1) AS viajeros,
        (SELECT COALESCE(sum(r.pax_count), 0)::int
           FROM reservas r, bounds b
          WHERE r.check_in >= b.d0 AND r.check_in < b.d1
            AND (SELECT count(*) FROM public.traveler_records t WHERE t.booking_id = r.id) = 0
        ) AS sin_residencia,
        (SELECT round(avg(p.precio), 2) FROM noches_precio p WHERE NOT p.es_finde) AS p_normal,
        (SELECT round(avg(p.precio), 2) FROM noches_precio p WHERE p.es_finde) AS p_finde,
        (SELECT count(*)::int FROM noches_precio p WHERE NOT p.es_finde) AS n_normal,
        (SELECT count(*)::int FROM noches_precio p WHERE p.es_finde) AS n_finde
)
SELECT
    p_year,
    p_month,
    trim(to_char(make_date(p_year, p_month, 1), 'TMMonth')),
    agg.n_dias,
    agg.n_abiertos,
    agg.n_apts,
    agg.n_plazas,
    agg.ocup_res,
    agg.ocup_canal,
    agg.ocup_res + agg.ocup_canal,
    0,                                    -- 4.3: el sistema no registra camas supletorias
    agg.viajeros,
    agg.pernoc,
    agg.pernoc_fs,
    agg.p_normal,
    agg.p_finde,
    CASE WHEN agg.n_normal + agg.n_finde > 0
         THEN round(100.0 * agg.n_normal / (agg.n_normal + agg.n_finde), 1) END,
    CASE WHEN agg.n_normal + agg.n_finde > 0
         THEN round(100.0 * agg.n_finde  / (agg.n_normal + agg.n_finde), 1) END,
    -- Grado de ocupación por plazas (metodología 5.7): pernoctaciones
    -- sobre plazas × días. Usamos DÍAS ABIERTOS como denominador porque
    -- aquí medimos UN establecimiento, no el agregado provincial.
    CASE WHEN agg.n_plazas * agg.n_abiertos > 0
         THEN round(100.0 * agg.pernoc / (agg.n_plazas * agg.n_abiertos), 2) END,
    CASE WHEN agg.n_apts * agg.n_abiertos > 0
         THEN round(100.0 * (agg.ocup_res + agg.ocup_canal) / (agg.n_apts * agg.n_abiertos), 2) END,
    -- Estancia media (metodología 5.5) = pernoctaciones / viajeros
    CASE WHEN agg.viajeros > 0
         THEN round(agg.pernoc::numeric / agg.viajeros, 2) END,
    agg.ocup_canal,
    agg.sin_residencia
FROM agg;
$$;

CREATE OR REPLACE FUNCTION public.v_ine_mes_detalle(p_year int, p_month int)
RETURNS TABLE (
    origen              text,
    referencia          text,
    apartamento         text,
    huesped             text,
    entrada             date,
    salida              date,
    personas            int,
    noches_en_el_mes    int,
    entra_en_el_mes     boolean,
    pernoctaciones      int,
    partes_rellenos     int,
    residencia          text
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
WITH bounds AS (
    SELECT make_date(p_year, p_month, 1) AS d0,
           (make_date(p_year, p_month, 1) + interval '1 month')::date AS d1
),
res AS (
    SELECT 'Reserva'::text AS origen,
           COALESCE(gb.booking_code, gb.id::text) AS referencia,
           a.name AS apartamento,
           gb.guest_name AS huesped,
           gb.check_in AS entrada,
           gb.check_out AS salida,
           COALESCE(gb.pax_count, 0) AS personas,
           (SELECT count(*)::int
              FROM generate_series(gb.check_in, gb.check_out - 1, interval '1 day') g, bounds b
             WHERE g::date >= b.d0 AND g::date < b.d1) AS noches_en_el_mes,
           (gb.check_in >= (SELECT d0 FROM bounds) AND gb.check_in < (SELECT d1 FROM bounds)) AS entra_en_el_mes,
           (SELECT count(*)::int FROM public.traveler_records t WHERE t.booking_id = gb.id) AS partes_rellenos,
           (SELECT string_agg(DISTINCT COALESCE(
                CASE WHEN public.fn_ine_es_espana(t.direccion_pais)
                     THEN public.fn_ine_ccaa_por_cp(t.direccion_cp)
                     ELSE public.fn_ine_grupo_extranjero(t.direccion_pais)
                END, 'Sin determinar'), ', ')
              FROM public.traveler_records t WHERE t.booking_id = gb.id) AS residencia
    FROM public.guest_bookings gb
    JOIN public.apartments a ON a.id = gb.apartment_id
    WHERE gb.status IN ('confirmed', 'completed')
      AND COALESCE(gb.source, '') <> 'test'      -- reservas de prueba fuera
),
-- Bloqueos de canal: estancias reales SIN datos. Se listan aparte para
-- que se vea exactamente lo que falta declarar.
blo AS (
    SELECT 'Bloqueo de canal'::text AS origen,
           bd.source AS referencia,
           a.name AS apartamento,
           NULL::text AS huesped,
           bd.start_date AS entrada,
           (bd.end_date + 1) AS salida,          -- normalizado a salida exclusiva
           0 AS personas,
           (SELECT count(*)::int
              FROM generate_series(bd.start_date, bd.end_date, interval '1 day') g, bounds b
             WHERE g::date >= b.d0 AND g::date < b.d1) AS noches_en_el_mes,
           (bd.start_date >= (SELECT d0 FROM bounds) AND bd.start_date < (SELECT d1 FROM bounds)) AS entra_en_el_mes,
           0 AS partes_rellenos,
           'Sin determinar'::text AS residencia
    FROM public.blocked_dates bd
    JOIN public.apartments a ON a.id = bd.apartment_id
    WHERE bd.source NOT IN ('manual', 'cierre')
      -- 0024: los cierres de canal no son estancias (ver v_ine_mes).
      AND COALESCE(bd.external_kind, 'reserved') <> 'closed'
)
SELECT origen, referencia, apartamento, huesped, entrada, salida, personas,
       noches_en_el_mes, entra_en_el_mes,
       personas * noches_en_el_mes AS pernoctaciones,
       partes_rellenos, residencia
FROM (SELECT * FROM res UNION ALL SELECT * FROM blo) x
WHERE noches_en_el_mes > 0
ORDER BY entrada, apartamento;
$$;

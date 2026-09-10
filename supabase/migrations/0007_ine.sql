-- =====================================================================
--  INE — Encuesta de Ocupación en Alojamientos de Turismo Rural (EOTR)
--  Paquete P5.1 del plan "sustituir-misterplan".
--
--  ✅ APLICADA en producción el 10-sep-2026 como `0007_ine.sql`.
--
--  Único cambio respecto del borrador `_pendiente_ine.sql`: las nueve
--  funciones llevan ahora `SET search_path TO 'public', 'pg_temp'`. Sin él,
--  el search_path lo elige quien llama, y una función que resuelve tablas
--  por nombre puede acabar leyendo otras. El asesor de seguridad de Supabase
--  lo marca como `function_search_path_mutable`.
--
--  Modelo del cuestionario en vigor: **Mod. EOTR-21**
--    https://www.ine.es/daco/daco42/ocuptr/eotr_21.pdf
--  Metodología (año 2025):
--    https://www.ine.es/daco/daco42/ocuptr/meto_eotr.pdf
--
--  Convenios del esquema TJM (verificados el 10-sep-2026 contra
--  `check_availability` y `sync-ical-imports`):
--    · guest_bookings.check_out  → EXCLUSIVO (noches = check_in .. check_out-1)
--    · blocked_dates.end_date    → INCLUSIVO (última noche ocupada)
--
--  Todo lo de aquí es SOLO LECTURA: no crea ni modifica tablas de datos.
--  La única escritura es la fila recordatorio de `internal_tasks` (al final,
--  idempotente).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Utilidades de normalización de texto
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_ine_norm(p_txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public', 'pg_temp'
AS $$
    -- Mayúsculas y sin acentos, para poder comparar texto libre del
    -- precheckin ("españa", "España", "ESPAÑA", "Espana") con una lista.
    SELECT upper(
        translate(
            btrim(coalesce(p_txt, '')),
            'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
            'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
        )
    );
$$;

COMMENT ON FUNCTION public.fn_ine_norm(text) IS
'INE/EOTR: normaliza texto libre (mayúsculas, sin acentos) para clasificar residencias.';


-- ---------------------------------------------------------------------
-- 2. ¿Es España el país de residencia?
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_ine_es_espana(p_pais text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT public.fn_ine_norm(p_pais) IN
        ('ES', 'ESP', 'E', 'ESPANA', 'SPAIN', 'ESPAGNE', 'SPANIEN', 'SPAGNA', '724');
$$;


-- ---------------------------------------------------------------------
-- 3. Código postal español → Comunidad / Ciudad Autónoma
--
--    ⚠️ IMPORTANTE — corrección al brief del paquete:
--    el cuestionario EOTR-21 (apartado 6) NO pide provincia. Pide
--    **Comunidad o Ciudad Autónoma de procedencia** (19 casillas:
--    1.1 Andalucía … 1.19 Melilla). La metodología lo confirma en 5.3:
--    "En el caso de los residentes en España se solicita información
--     sobre la Comunidad o Ciudad Autónoma de procedencia."
--    Guardamos la provincia solo como dato auxiliar de auditoría.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_ine_provincia_por_cp(p_cp text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT CASE left(regexp_replace(coalesce(p_cp, ''), '\D', '', 'g'), 2)
        WHEN '01' THEN 'Araba/Álava'          WHEN '02' THEN 'Albacete'
        WHEN '03' THEN 'Alicante'             WHEN '04' THEN 'Almería'
        WHEN '05' THEN 'Ávila'                WHEN '06' THEN 'Badajoz'
        WHEN '07' THEN 'Illes Balears'        WHEN '08' THEN 'Barcelona'
        WHEN '09' THEN 'Burgos'               WHEN '10' THEN 'Cáceres'
        WHEN '11' THEN 'Cádiz'                WHEN '12' THEN 'Castellón'
        WHEN '13' THEN 'Ciudad Real'          WHEN '14' THEN 'Córdoba'
        WHEN '15' THEN 'A Coruña'             WHEN '16' THEN 'Cuenca'
        WHEN '17' THEN 'Girona'               WHEN '18' THEN 'Granada'
        WHEN '19' THEN 'Guadalajara'          WHEN '20' THEN 'Gipuzkoa'
        WHEN '21' THEN 'Huelva'               WHEN '22' THEN 'Huesca'
        WHEN '23' THEN 'Jaén'                 WHEN '24' THEN 'León'
        WHEN '25' THEN 'Lleida'               WHEN '26' THEN 'La Rioja'
        WHEN '27' THEN 'Lugo'                 WHEN '28' THEN 'Madrid'
        WHEN '29' THEN 'Málaga'               WHEN '30' THEN 'Murcia'
        WHEN '31' THEN 'Navarra'              WHEN '32' THEN 'Ourense'
        WHEN '33' THEN 'Asturias'             WHEN '34' THEN 'Palencia'
        WHEN '35' THEN 'Las Palmas'           WHEN '36' THEN 'Pontevedra'
        WHEN '37' THEN 'Salamanca'            WHEN '38' THEN 'S.C. de Tenerife'
        WHEN '39' THEN 'Cantabria'            WHEN '40' THEN 'Segovia'
        WHEN '41' THEN 'Sevilla'              WHEN '42' THEN 'Soria'
        WHEN '43' THEN 'Tarragona'            WHEN '44' THEN 'Teruel'
        WHEN '45' THEN 'Toledo'               WHEN '46' THEN 'Valencia'
        WHEN '47' THEN 'Valladolid'           WHEN '48' THEN 'Bizkaia'
        WHEN '49' THEN 'Zamora'               WHEN '50' THEN 'Zaragoza'
        WHEN '51' THEN 'Ceuta'                WHEN '52' THEN 'Melilla'
        ELSE NULL
    END;
$$;


CREATE OR REPLACE FUNCTION public.fn_ine_ccaa_por_cp(p_cp text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public', 'pg_temp'
AS $$
    -- Etiquetas EXACTAS del cuestionario EOTR-21, apartado 6.
    SELECT CASE left(regexp_replace(coalesce(p_cp, ''), '\D', '', 'g'), 2)
        WHEN '04' THEN 'Andalucía' WHEN '11' THEN 'Andalucía' WHEN '14' THEN 'Andalucía'
        WHEN '18' THEN 'Andalucía' WHEN '21' THEN 'Andalucía' WHEN '23' THEN 'Andalucía'
        WHEN '29' THEN 'Andalucía' WHEN '41' THEN 'Andalucía'

        WHEN '22' THEN 'Aragón' WHEN '44' THEN 'Aragón' WHEN '50' THEN 'Aragón'

        WHEN '33' THEN 'Asturias, Principado de'
        WHEN '07' THEN 'Balears, Illes'
        WHEN '35' THEN 'Canarias' WHEN '38' THEN 'Canarias'
        WHEN '39' THEN 'Cantabria'

        WHEN '05' THEN 'Castilla y León' WHEN '09' THEN 'Castilla y León'
        WHEN '24' THEN 'Castilla y León' WHEN '34' THEN 'Castilla y León'
        WHEN '37' THEN 'Castilla y León' WHEN '40' THEN 'Castilla y León'
        WHEN '42' THEN 'Castilla y León' WHEN '47' THEN 'Castilla y León'
        WHEN '49' THEN 'Castilla y León'

        WHEN '02' THEN 'Castilla-La Mancha' WHEN '13' THEN 'Castilla-La Mancha'
        WHEN '16' THEN 'Castilla-La Mancha' WHEN '19' THEN 'Castilla-La Mancha'
        WHEN '45' THEN 'Castilla-La Mancha'

        WHEN '08' THEN 'Cataluña' WHEN '17' THEN 'Cataluña'
        WHEN '25' THEN 'Cataluña' WHEN '43' THEN 'Cataluña'

        WHEN '03' THEN 'Comunitat Valenciana' WHEN '12' THEN 'Comunitat Valenciana'
        WHEN '46' THEN 'Comunitat Valenciana'

        WHEN '06' THEN 'Extremadura' WHEN '10' THEN 'Extremadura'

        WHEN '15' THEN 'Galicia' WHEN '27' THEN 'Galicia'
        WHEN '32' THEN 'Galicia' WHEN '36' THEN 'Galicia'

        WHEN '28' THEN 'Madrid, Comunidad de'
        WHEN '30' THEN 'Murcia, Región de'
        WHEN '31' THEN 'Navarra, Comunidad Foral de'

        WHEN '01' THEN 'País Vasco' WHEN '20' THEN 'País Vasco' WHEN '48' THEN 'País Vasco'

        WHEN '26' THEN 'Rioja, La'
        WHEN '51' THEN 'Ceuta'
        WHEN '52' THEN 'Melilla'
        ELSE NULL
    END;
$$;

COMMENT ON FUNCTION public.fn_ine_ccaa_por_cp(text) IS
'INE/EOTR apdo 6: código postal español → Comunidad/Ciudad Autónoma con la etiqueta exacta del cuestionario.';


-- ---------------------------------------------------------------------
-- 4. País extranjero → una de las 13 casillas del cuestionario
--
--    El cuestionario NO admite "por país" libre: son 13 casillas cerradas
--    (2 Alemania … 14 Resto del mundo). "Resto de la UE" está definido
--    literalmente en la nota al pie 1 del apartado 6.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_ine_grupo_extranjero(p_pais text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v text := public.fn_ine_norm(p_pais);
BEGIN
    IF v = '' THEN
        RETURN NULL;                      -- sin dato → "Sin determinar"
    END IF;

    -- Casillas con país propio
    IF v IN ('DE','DEU','ALEMANIA','GERMANY','DEUTSCHLAND')            THEN RETURN 'Alemania';       END IF;
    IF v IN ('BE','BEL','BELGICA','BELGIUM','BELGIQUE','BELGIE')       THEN RETURN 'Bélgica';        END IF;
    IF v IN ('FR','FRA','FRANCIA','FRANCE','FRANKREICH')               THEN RETURN 'Francia';        END IF;
    IF v IN ('IT','ITA','ITALIA','ITALY','ITALIE')                     THEN RETURN 'Italia';         END IF;
    IF v IN ('NL','NLD','PAISES BAJOS','HOLANDA','NETHERLANDS',
             'THE NETHERLANDS','NEDERLAND','HOLLAND')                  THEN RETURN 'Países Bajos';   END IF;
    IF v IN ('PT','PRT','PORTUGAL')                                    THEN RETURN 'Portugal';       END IF;
    IF v IN ('GB','GBR','UK','REINO UNIDO','UNITED KINGDOM',
             'INGLATERRA','ENGLAND','SCOTLAND','ESCOCIA','WALES',
             'GALES','GREAT BRITAIN')                                  THEN RETURN 'Reino Unido';    END IF;
    IF v IN ('RU','RUS','RUSIA','RUSSIA','RUSSIAN FEDERATION')         THEN RETURN 'Rusia';          END IF;
    IF v IN ('CH','CHE','SUIZA','SWITZERLAND','SUISSE','SCHWEIZ')      THEN RETURN 'Suiza';          END IF;
    IF v IN ('US','USA','ESTADOS UNIDOS','UNITED STATES',
             'UNITED STATES OF AMERICA','EEUU','EE.UU.','EE UU')       THEN RETURN 'Estados Unidos'; END IF;

    -- Casilla 8: "Resto de la UE" — lista literal de la nota al pie del cuestionario
    IF v IN ('AT','AUT','AUSTRIA',
             'BG','BGR','BULGARIA',
             'CY','CYP','CHIPRE','CYPRUS',
             'HR','HRV','CROACIA','CROATIA',
             'DK','DNK','DINAMARCA','DENMARK',
             'SK','SVK','ESLOVAQUIA','SLOVAKIA',
             'SI','SVN','ESLOVENIA','SLOVENIA',
             'EE','EST','ESTONIA',
             'FI','FIN','FINLANDIA','FINLAND',
             'GR','GRC','GRECIA','GREECE',
             'HU','HUN','HUNGRIA','HUNGARY',
             'IE','IRL','IRLANDA','IRELAND',
             'LV','LVA','LETONIA','LATVIA',
             'LT','LTU','LITUANIA','LITHUANIA',
             'LU','LUX','LUXEMBURGO','LUXEMBOURG',
             'MT','MLT','MALTA',
             'PL','POL','POLONIA','POLAND',
             'CZ','CZE','REPUBLICA CHECA','CZECH REPUBLIC','CZECHIA',
             'RO','ROU','RUMANIA','ROMANIA',
             'SE','SWE','SUECIA','SWEDEN')                             THEN RETURN 'Resto de la UE'; END IF;

    -- Casilla 12: "Resto de Europa" (europeos no comunitarios distintos de RU/RU-sia/Suiza)
    IF v IN ('NO','NOR','NORUEGA','NORWAY',
             'IS','ISL','ISLANDIA','ICELAND',
             'UA','UKR','UCRANIA','UKRAINE',
             'BY','BLR','BIELORRUSIA','BELARUS',
             'RS','SRB','SERBIA',
             'BA','BIH','BOSNIA','BOSNIA Y HERZEGOVINA',
             'ME','MNE','MONTENEGRO',
             'MK','MKD','MACEDONIA DEL NORTE','NORTH MACEDONIA',
             'AL','ALB','ALBANIA',
             'MD','MDA','MOLDAVIA','MOLDOVA',
             'TR','TUR','TURQUIA','TURKEY','TURKIYE',
             'AD','AND','ANDORRA',
             'MC','MCO','MONACO',
             'SM','SMR','SAN MARINO',
             'LI','LIE','LIECHTENSTEIN',
             'VA','VAT','CIUDAD DEL VATICANO','VATICAN')               THEN RETURN 'Resto de Europa'; END IF;

    -- Casilla 14: todo lo demás
    RETURN 'Resto del mundo';
END;
$$;

COMMENT ON FUNCTION public.fn_ine_grupo_extranjero(text) IS
'INE/EOTR apdo 6: país de residencia → una de las 13 casillas cerradas de extranjero del Mod. EOTR-21.';


-- ---------------------------------------------------------------------
-- 5. Catálogo de casillas del apartado 6 (para que la pantalla enseñe
--    SIEMPRE las 32 filas en el orden del cuestionario, con ceros donde
--    no hay nadie — así se copia de arriba abajo sin saltarse ninguna).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_ine_casillas_residencia()
RETURNS TABLE (orden int, casilla text, ambito text, grupo text)
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public', 'pg_temp'
AS $$
    VALUES
        (101, '1.1',  'España',     'Andalucía'),
        (102, '1.2',  'España',     'Aragón'),
        (103, '1.3',  'España',     'Asturias, Principado de'),
        (104, '1.4',  'España',     'Balears, Illes'),
        (105, '1.5',  'España',     'Canarias'),
        (106, '1.6',  'España',     'Cantabria'),
        (107, '1.7',  'España',     'Castilla y León'),
        (108, '1.8',  'España',     'Castilla-La Mancha'),
        (109, '1.9',  'España',     'Cataluña'),
        (110, '1.10', 'España',     'Comunitat Valenciana'),
        (111, '1.11', 'España',     'Extremadura'),
        (112, '1.12', 'España',     'Galicia'),
        (113, '1.13', 'España',     'Madrid, Comunidad de'),
        (114, '1.14', 'España',     'Murcia, Región de'),
        (115, '1.15', 'España',     'Navarra, Comunidad Foral de'),
        (116, '1.16', 'España',     'País Vasco'),
        (117, '1.17', 'España',     'Rioja, La'),
        (118, '1.18', 'España',     'Ceuta'),
        (119, '1.19', 'España',     'Melilla'),
        (202, '2',    'Extranjero', 'Alemania'),
        (203, '3',    'Extranjero', 'Bélgica'),
        (204, '4',    'Extranjero', 'Francia'),
        (205, '5',    'Extranjero', 'Italia'),
        (206, '6',    'Extranjero', 'Países Bajos'),
        (207, '7',    'Extranjero', 'Portugal'),
        (208, '8',    'Extranjero', 'Resto de la UE'),
        (209, '9',    'Extranjero', 'Reino Unido'),
        (210, '10',   'Extranjero', 'Rusia'),
        (211, '11',   'Extranjero', 'Suiza'),
        (212, '12',   'Extranjero', 'Resto de Europa'),
        (213, '13',   'Extranjero', 'Estados Unidos'),
        (214, '14',   'Extranjero', 'Resto del mundo'),
        (999, '—',    'Pendiente',  'Sin determinar');
$$;

COMMENT ON FUNCTION public.fn_ine_casillas_residencia() IS
'INE/EOTR: las 32 casillas del apartado 6 + la fila "Sin determinar" (que NO existe en el cuestionario y hay que repartir antes de enviar).';


-- =====================================================================
-- 6. v_ine_mes — UNA fila con las casillas de establecimiento del mes
-- =====================================================================
--
--  CRITERIO DE SOLAPE DE MES (metodología EOTR 5.3 y 5.4, y el ejemplo
--  del apartado 6 del cuestionario):
--    · VIAJERO ENTRADO  → se cuenta UNA sola vez, en el mes que contiene
--      el check_in. Una estancia 28-sep → 3-oct suma sus viajeros a
--      SEPTIEMBRE y cero a octubre.
--    · PERNOCTACIÓN     → se cuenta noche a noche. La misma estancia
--      aporta 3 noches a septiembre (28, 29, 30) y 2 a octubre (1, 2).
--      Con check_out exclusivo, las noches son [check_in, check_out-1].
--  Consecuencia buscada: en un mes puede haber pernoctaciones con cero
--  viajeros entrados (estancia que venía del mes anterior). Es correcto.
--
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
                 AND (bd.source = 'cierre' OR bd.reason ILIKE 'cierre%')
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

COMMENT ON FUNCTION public.v_ine_mes(int, int) IS
'INE/EOTR Mod. EOTR-21: casillas de establecimiento de un mes (apdos 2, 3, 4, 6, 6.1, 7.2) + indicadores de control. Viajero se cuenta en el mes de entrada; pernoctación, noche a noche.';


-- =====================================================================
-- 7. v_ine_mes_residencia — apartado 6, las 32 casillas + sin determinar
-- =====================================================================
--
--  Reparto de personas dentro de una reserva:
--    · Cada `traveler_records` del precheckin aporta 1 viajero con su
--      residencia (país + CP del DOMICILIO, no la nacionalidad: el INE
--      pide lugar de RESIDENCIA).
--    · Si la reserva tiene menos partes que `pax_count`, las personas que
--      faltan van a "Sin determinar". No se inventan.
--    · Las pernoctaciones de cada persona = nº de noches de ESA reserva
--      que caen dentro del mes.
--
CREATE OR REPLACE FUNCTION public.v_ine_mes_residencia(p_year int, p_month int)
RETURNS TABLE (
    orden           int,
    casilla         text,
    ambito          text,
    grupo           text,
    viajeros        int,
    pernoctaciones  int
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
WITH bounds AS (
    SELECT make_date(p_year, p_month, 1) AS d0,
           (make_date(p_year, p_month, 1) + interval '1 month')::date AS d1
),
reservas AS (
    SELECT gb.id, gb.pax_count, gb.check_in, gb.check_out
    FROM public.guest_bookings gb
    WHERE gb.status IN ('confirmed', 'completed')
      AND COALESCE(gb.source, '') <> 'test'      -- reservas de prueba fuera
),
-- Noches de cada reserva que caen dentro del mes, y si entró en el mes.
res_mes AS (
    SELECT r.id,
           r.pax_count,
           (SELECT count(*)::int
              FROM generate_series(r.check_in, r.check_out - 1, interval '1 day') g
             WHERE g::date >= b.d0 AND g::date < b.d1) AS noches_mes,
           (r.check_in >= b.d0 AND r.check_in < b.d1) AS entra_en_mes
    FROM reservas r, bounds b
),
activas AS (
    SELECT * FROM res_mes WHERE noches_mes > 0 OR entra_en_mes
),
-- Personas identificadas por el parte de viajeros
identificados AS (
    SELECT a.id,
           a.noches_mes,
           a.entra_en_mes,
           COALESCE(
               CASE WHEN public.fn_ine_es_espana(t.direccion_pais)
                    THEN public.fn_ine_ccaa_por_cp(t.direccion_cp)
                    ELSE public.fn_ine_grupo_extranjero(t.direccion_pais)
               END,
               'Sin determinar'
           ) AS grupo
    FROM activas a
    JOIN public.traveler_records t ON t.booking_id = a.id
),
-- Personas de la reserva sin parte de viajeros
no_identificados AS (
    SELECT a.id,
           a.noches_mes,
           a.entra_en_mes,
           'Sin determinar'::text AS grupo,
           GREATEST(
               COALESCE(a.pax_count, 0)
               - (SELECT count(*)::int FROM public.traveler_records t WHERE t.booking_id = a.id),
               0
           ) AS personas
    FROM activas a
),
personas AS (
    SELECT id, noches_mes, entra_en_mes, grupo, 1 AS personas FROM identificados
    UNION ALL
    SELECT id, noches_mes, entra_en_mes, grupo, personas FROM no_identificados WHERE personas > 0
),
totales AS (
    SELECT p.grupo,
           SUM(CASE WHEN p.entra_en_mes THEN p.personas ELSE 0 END)::int AS viajeros,
           SUM(p.personas * p.noches_mes)::int AS pernoctaciones
    FROM personas p
    GROUP BY p.grupo
)
SELECT c.orden, c.casilla, c.ambito, c.grupo,
       COALESCE(t.viajeros, 0),
       COALESCE(t.pernoctaciones, 0)
FROM public.fn_ine_casillas_residencia() c
LEFT JOIN totales t ON t.grupo = c.grupo
ORDER BY c.orden;
$$;

COMMENT ON FUNCTION public.v_ine_mes_residencia(int, int) IS
'INE/EOTR apdo 6: viajeros entrados y pernoctaciones por lugar de residencia, en las 32 casillas del Mod. EOTR-21 + "Sin determinar".';


-- =====================================================================
-- 8. v_ine_mes_detalle — auditoría reserva a reserva
--    Para que el número se pueda comprobar a mano sin salir del panel.
-- =====================================================================

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
)
SELECT origen, referencia, apartamento, huesped, entrada, salida, personas,
       noches_en_el_mes, entra_en_el_mes,
       personas * noches_en_el_mes AS pernoctaciones,
       partes_rellenos, residencia
FROM (SELECT * FROM res UNION ALL SELECT * FROM blo) x
WHERE noches_en_el_mes > 0
ORDER BY entrada, apartamento;
$$;

COMMENT ON FUNCTION public.v_ine_mes_detalle(int, int) IS
'INE/EOTR: desglose reserva a reserva (y bloqueo a bloqueo) del mes, para comprobar a mano las casillas antes de enviarlas por IRIA.';


-- =====================================================================
-- 9. Permisos
--    El INE es trabajo NUESTRO, no de la madre (plan §4.0). Estas
--    funciones NO deben quedar al alcance de `anon`.
-- =====================================================================

REVOKE ALL ON FUNCTION public.fn_ine_norm(text)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ine_es_espana(text)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ine_provincia_por_cp(text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ine_ccaa_por_cp(text)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ine_grupo_extranjero(text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ine_casillas_residencia()         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.v_ine_mes(int, int)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.v_ine_mes_residencia(int, int)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.v_ine_mes_detalle(int, int)          FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_ine_norm(text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ine_es_espana(text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ine_provincia_por_cp(text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ine_ccaa_por_cp(text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ine_grupo_extranjero(text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ine_casillas_residencia()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.v_ine_mes(int, int)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.v_ine_mes_residencia(int, int)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.v_ine_mes_detalle(int, int)       TO authenticated;

-- Nota de seguridad: las funciones son SECURITY INVOKER (por defecto) y con
-- `search_path` fijo, así que leen `guest_bookings` y `traveler_records` con
-- la RLS de quien llama y siempre sobre las tablas de `public`.
-- Un `staff` sin permiso sobre esas tablas obtendrá ceros, no un error.
-- Si se quiere restringir a admin de forma explícita, envolverlas en una
-- comprobación `public.is_admin()` — pendiente de decidir (ver docs/INE.md).


-- =====================================================================
-- 10. RECORDATORIO AUTOMÁTICO — la fila de internal_tasks SÍ se aplicó;
--     el cron de aviso empujado sigue comentado (ver final)
-- =====================================================================
--
--  Plazo legal: el cuestionario EOTR-21 dice "se enviará, una vez
--  cumplimentado, en los CINCO DÍAS NATURALES SIGUIENTES" al mes de
--  referencia. Así que el aviso útil es el día 1 y el vencimiento el 5.
--
--  Forma limpia recomendada: una fila recurrente en `internal_tasks`.
--  Ya existe `InternalTasksManager` ("Calendario de mantenimiento") que
--  las pinta y las reprograma, y el patrón `recurrence='monthly'` ya está
--  en uso. No hace falta cron nuevo para que el aviso EXISTA.
--
--  ✅ Aplicada (es una fila de datos, idempotente):

INSERT INTO public.internal_tasks
    (title, description, category, scheduled_date, recurrence, status, priority, auto_reschedule)
SELECT
    'Enviar la encuesta del INE (turismo rural) del mes anterior',
    'Panel → INE. Elegir el mes que acaba de terminar, copiar las casillas en IRIA '
    || '(https://iria.ine.es) y enviar. Plazo: 5 días naturales desde el fin del mes. '
    || 'Los únicos datos que NO salen del sistema son el personal empleado (apdo 5) y '
    || 'las camas supletorias (apdo 4.3): se ponen a mano. Revisar también el aviso de '
    || 'noches de Airbnb sin datos de huésped antes de enviar.',
    'legal',
    date_trunc('month', current_date + interval '1 month')::date,
    'monthly',
    'pending',
    'high',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.internal_tasks
    WHERE title = 'Enviar la encuesta del INE (turismo rural) del mes anterior'
);

--
--  ⏸️  OPCIONAL — aviso EMPUJADO (Slack/WhatsApp) el día 1 a las 09:00.
--      Va con F6 (P6.1), no con F5. Se deja escrito y COMENTADO: no se
--      aplica hasta que exista el canal de avisos y su secreto.
--      Ojo (aprendido en otros proyectos): un cron que "late en verde"
--      no prueba que el aviso llegue. Que la función devuelva error si
--      el POST no es 2xx, y vigilar la frescura del último aviso.
--
-- SELECT cron.schedule(
--     'monthly-ine-reminder',
--     '0 9 1 * *',
--     $CRON$
--     SELECT net.http_post(
--         url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-ine',
--         headers := jsonb_build_object(
--                        'Content-Type',  'application/json',
--                        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
--                    ),
--         body    := jsonb_build_object(
--                        'year',  EXTRACT(YEAR  FROM current_date - interval '1 month')::int,
--                        'month', EXTRACT(MONTH FROM current_date - interval '1 month')::int
--                    )
--     );
--     $CRON$
-- );
--
--  Alternativa sin edge function nueva: reutilizar `monthly-owner-report`
--  añadiéndole un bloque "INE de <mes>" con la salida de `v_ine_mes`.
--  Es menos superficie que mantener y el correo ya llega hoy.

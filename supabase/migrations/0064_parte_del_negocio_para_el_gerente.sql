-- 0064 · The business report the manager reads every morning (fase 2 del gerente, 16-oct-2026)
--
-- One read-only JSON with what a CEO of the house looks at: occupancy and price (this month and
-- ahead), pick-up of the last 7 days by channel, direct share, Booking cancellations, arrivals of
-- the next 7 days with their Ministry status, open problems (`tjm_revisiones`), the house tasks,
-- review requests and where the website stands in Google and in AI answers.
-- No guest names, e-mails or phones: booking codes only. Served by the edge function
-- `parte-gerente` to the manager on the agents' VPS; nobody else can call it.

CREATE OR REPLACE FUNCTION public.tjm_parte_gerente()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_hoy  date := (now() AT TIME ZONE 'Europe/Madrid')::date;
    v_mes0 date := date_trunc('month', v_hoy)::date;
    v_mes1 date := (date_trunc('month', v_hoy) + interval '1 month')::date;
    v_aptos int;
    v_res jsonb;
BEGIN
    SELECT count(*) INTO v_aptos FROM public.apartments WHERE COALESCE(is_active, true);

    WITH vivas AS (
        SELECT * FROM public.guest_bookings
         WHERE status IN ('confirmed', 'completed') AND COALESCE(source, '') <> 'test'
    ),
    noches AS (   -- one row per sold night
        SELECT b.id, b.channel, d::date AS noche,
               b.total_price / NULLIF(b.nights, 0) AS precio_noche
          FROM vivas b, generate_series(b.check_in, b.check_out - 1, interval '1 day') d
    ),
    ventana AS (
        SELECT
            count(*) FILTER (WHERE noche >= v_mes0 AND noche < v_mes1)                   AS mes_noches,
            sum(precio_noche) FILTER (WHERE noche >= v_mes0 AND noche < v_mes1)          AS mes_ingreso,
            count(*) FILTER (WHERE noche >= v_hoy AND noche < v_hoy + 30)                AS p30_noches,
            count(*) FILTER (WHERE noche >= v_hoy AND noche < v_hoy + 60)                AS p60_noches,
            count(*) FILTER (WHERE noche >= v_hoy AND noche < v_hoy + 60 AND channel = 'web') AS p60_directas
          FROM noches
    )
    SELECT jsonb_build_object(
        'fecha', v_hoy,
        'apartamentos_activos', v_aptos,
        'mes_actual', jsonb_build_object(
            'mes', to_char(v_mes0, 'YYYY-MM'),
            'noches_vendidas', w.mes_noches,
            'noches_posibles', v_aptos * (v_mes1 - v_mes0),
            'ocupacion_pct', round(100.0 * w.mes_noches / NULLIF(v_aptos * (v_mes1 - v_mes0), 0), 1),
            'ingreso_bruto', round(COALESCE(w.mes_ingreso, 0)),
            'precio_medio_noche', round(w.mes_ingreso / NULLIF(w.mes_noches, 0))),
        'proximos_30_dias_ocupacion_pct', round(100.0 * w.p30_noches / NULLIF(v_aptos * 30, 0), 1),
        'proximos_60_dias_ocupacion_pct', round(100.0 * w.p60_noches / NULLIF(v_aptos * 60, 0), 1),
        'proximos_60_dias_venta_directa_pct', round(100.0 * w.p60_directas / NULLIF(w.p60_noches, 0), 1),
        'reservas_nuevas_7_dias', (
            SELECT COALESCE(jsonb_object_agg(canal, n), '{}'::jsonb) FROM (
                SELECT COALESCE(channel, source, '?') canal, count(*) n FROM public.guest_bookings
                 WHERE created_at > now() - interval '7 days' AND status IN ('confirmed', 'completed')
                   AND COALESCE(source, '') <> 'test' GROUP BY 1) x),
        'cancelaciones_7_dias', (
            SELECT count(*) FROM public.guest_bookings
             WHERE status = 'cancelled' AND updated_at > now() - interval '7 days' AND COALESCE(source, '') <> 'test'),
        'booking_cancelaciones_90_dias_pct', (
            SELECT round(100.0 * count(*) FILTER (WHERE status = 'cancelled') / NULLIF(count(*), 0), 1)
              FROM public.guest_bookings
             WHERE channel = 'booking' AND created_at > now() - interval '90 days' AND status <> 'expired'),
        'antelacion_media_dias_90', (
            SELECT round(avg(check_in - created_at::date)) FROM vivas
             WHERE created_at > now() - interval '90 days' AND check_in >= created_at::date),   -- imported past stays out
        'estancia_media_noches_90', (
            SELECT round(avg(nights), 1) FROM vivas WHERE created_at > now() - interval '90 days'),
        'llegadas_7_dias', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'codigo', b.booking_code, 'apartamento', a.name, 'entrada', b.check_in, 'salida', b.check_out,
                'canal', b.channel, 'personas', b.pax_count,
                'fichas', (SELECT count(*) FROM public.traveler_records t WHERE t.booking_id = b.id),
                'reserva_comunicada', b.reserva_comunicada_at IS NOT NULL,
                'hora_llegada', b.hora_llegada_prevista) ORDER BY b.check_in), '[]'::jsonb)
              FROM vivas b JOIN public.apartments a ON a.id = b.apartment_id
             WHERE b.check_in BETWEEN v_hoy AND v_hoy + 7),
        'problemas_abiertos', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'proceso', proceso, 'gravedad', gravedad, 'quien', quien, 'que', mensaje,
                'desde', to_char(detectado_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD HH24:MI'))
                ORDER BY gravedad, detectado_at), '[]'::jsonb)
              FROM public.tjm_revisiones WHERE resuelto_at IS NULL),
        'resenas', jsonb_build_object(
            'estancias_terminadas_30_dias', (SELECT count(*) FROM vivas WHERE check_out BETWEEN v_hoy - 30 AND v_hoy - 1),
            'de_ellas_con_peticion_de_resena', (SELECT count(*) FROM vivas WHERE check_out BETWEEN v_hoy - 30 AND v_hoy - 1 AND review_request_sent_at IS NOT NULL)),
        'web_en_google', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('busqueda', consulta, 'puesto_organico', puesto,
                                                         'citada_por_la_ia', citada) ORDER BY consulta), '[]'::jsonb)
              FROM (
                SELECT c.consulta,
                       min(s.puesto) FILTER (WHERE s.es_propio AND s.fuente = 'google_organico') puesto,
                       COALESCE(bool_or(s.es_propio AND s.fuente = 'google_ai_overview'), false) citada
                  FROM public.seo_citas_ia_consultas c
                  LEFT JOIN public.seo_citas_ia s
                         ON s.consulta = c.consulta AND s.proyecto = c.proyecto
                        AND s.fecha = (SELECT max(fecha) FROM public.seo_citas_ia WHERE proyecto = c.proyecto)
                 WHERE c.activa
                 GROUP BY c.consulta) y)
    ) INTO v_res
      FROM ventana w;

    RETURN v_res;
END $function$;

REVOKE ALL ON FUNCTION public.tjm_parte_gerente() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tjm_parte_gerente() TO service_role;
COMMENT ON FUNCTION public.tjm_parte_gerente() IS
    'Parte del negocio para el gerente (0064): ocupación, precio, recogida por canal, venta directa, cancelaciones, llegadas con su estado ante el Ministerio, problemas abiertos, reseñas y posición en Google. Sin nombres ni contactos de huéspedes. Solo service_role (función parte-gerente).';

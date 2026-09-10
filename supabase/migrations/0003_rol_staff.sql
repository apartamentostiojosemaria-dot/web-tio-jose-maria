-- =====================================================================
-- 0003_rol_staff.sql               APLICADA en produccion el 2026-09-10
--
-- Paquete P1.4 del plan: el rol 'staff' (la madre) con permiso para la
-- gestion diaria y SIN acceso a los datos personales del parte de
-- viajeros ni a los ajustes tecnicos.
--
-- El admin conserva TODO lo que ya tenia: no se borra ni se modifica
-- ninguna politica existente, solo se anaden politicas nuevas.
-- Las politicas de service_role no se tocan.
--
-- Dos excepciones necesarias (widening, no restriccion):
--   - profiles_role_check: se recrea anadiendo 'staff'.
--   - is_staff(): se reescribe. Venia copiada de OTRO proyecto
--     (Cuid-Arte) con roles que aqui no existen ni pueden existir
--     (head_coach, coach, closer, endocrino...). Queda ('admin','staff').
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. El rol existe
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin','staff','cliente']));

COMMENT ON COLUMN public.profiles.role IS 'admin = Jesus (todo) · staff = gestion diaria (la madre) · cliente = huesped';

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    (SELECT p.role IN ('admin', 'staff') FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$function$;

COMMENT ON FUNCTION public.is_staff() IS 'Cierto para admin y para staff. check_is_admin()/is_admin() siguen siendo SOLO admin.';


-- ---------------------------------------------------------------------
-- 2. Lo que staff puede leer y escribir
-- ---------------------------------------------------------------------
-- Politicas PERMISIVAS nuevas, con nombre propio (staff_all_*), que
-- conviven con las de admin y las de service_role.

DROP POLICY IF EXISTS staff_all_guest_bookings ON public.guest_bookings;
CREATE POLICY staff_all_guest_bookings ON public.guest_bookings
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS staff_all_booking_payments ON public.booking_payments;
CREATE POLICY staff_all_booking_payments ON public.booking_payments
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS staff_all_customers ON public.customers;
CREATE POLICY staff_all_customers ON public.customers
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS staff_all_customer_notes ON public.customer_notes;
CREATE POLICY staff_all_customer_notes ON public.customer_notes
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS staff_all_cleaning_tasks ON public.cleaning_tasks;
CREATE POLICY staff_all_cleaning_tasks ON public.cleaning_tasks
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS staff_all_blocked_dates ON public.blocked_dates;
CREATE POLICY staff_all_blocked_dates ON public.blocked_dates
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS staff_all_addons ON public.addons;
CREATE POLICY staff_all_addons ON public.addons
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS staff_all_high_seasons ON public.high_seasons;
CREATE POLICY staff_all_high_seasons ON public.high_seasons
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS staff_all_pricing_rules ON public.pricing_rules;
CREATE POLICY staff_all_pricing_rules ON public.pricing_rules
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Facturas: leer si, escribir no. La emision va por RPC (emitir_factura).
DROP POLICY IF EXISTS staff_read_invoices ON public.invoices;
CREATE POLICY staff_read_invoices ON public.invoices
  FOR SELECT TO authenticated USING (public.is_staff());

-- apartments: la lectura ya es publica. NO se anade politica de UPDATE:
-- los precios se cambian solo por set_apartment_prices(), asi staff no
-- puede tocar slug, fotos, iCal, numero de registro ni nada mas.
-- traveler_records: NINGUNA politica para staff. Los datos del documento
-- no se exponen; el estado del parte se mira en v_parte_estado.


-- ---------------------------------------------------------------------
-- 3. RPCs de staff sobre lo que no puede escribir directamente
-- ---------------------------------------------------------------------

-- 3.1 Cambiar SOLO los dos precios de un apartamento
CREATE OR REPLACE FUNCTION public.set_apartment_prices(
    p_apartment_id bigint,
    p_price_low    numeric,
    p_price_high   numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_row record;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
    END IF;

    IF p_price_low IS NULL OR p_price_high IS NULL OR p_price_low <= 0 OR p_price_high <= 0
       OR p_price_low > 10000 OR p_price_high > 10000 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'precio_invalido');
    END IF;

    UPDATE public.apartments
       SET price_low = p_price_low, price_high = p_price_high, updated_at = now()
     WHERE id = p_apartment_id
    RETURNING id, name, price_low, price_high INTO v_row;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'apartamento_no_encontrado');
    END IF;

    RETURN jsonb_build_object('ok', true, 'apartment_id', v_row.id, 'name', v_row.name,
                              'price_low', v_row.price_low, 'price_high', v_row.price_high);
END $function$;

-- 3.2 Emitir la factura de una reserva (envoltura con permiso sobre issue_invoice)
CREATE OR REPLACE FUNCTION public.emitir_factura(
    p_booking_id        bigint,
    p_receptor_nif      text DEFAULT NULL,
    p_receptor_nombre   text DEFAULT NULL,
    p_receptor_direccion text DEFAULT NULL,
    p_receptor_email    text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'   -- extensions: digest() de issue_invoice
AS $function$
DECLARE
    v_inv record;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.guest_bookings gb WHERE gb.id = p_booking_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reserva_no_encontrada');
    END IF;

    SELECT * INTO v_inv
    FROM public.issue_invoice(p_booking_id, p_receptor_nif, p_receptor_nombre,
                              p_receptor_direccion, p_receptor_email);

    RETURN jsonb_build_object('ok', true, 'invoice_id', v_inv.invoice_id,
                              'serie', v_inv.serie, 'numero', v_inv.numero, 'total', v_inv.total);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'error_emision', 'detalle', SQLERRM);
END $function$;


-- ---------------------------------------------------------------------
-- 4. El parte de viajeros SIN datos personales
-- ---------------------------------------------------------------------
-- traveler_records guarda documentos de identidad. staff NO tiene
-- politica sobre esa tabla. Lo que ve es este semaforo: cuantos han
-- rellenado, si falta alguien y si el parte se ha mandado. Nada mas.

CREATE OR REPLACE FUNCTION public.tjm_parte_estado()
 RETURNS TABLE(
    booking_id        bigint,
    booking_code      text,
    guest_name        text,
    apartment_name    text,
    check_in          date,
    check_out         date,
    pax_count         integer,
    viajeros_rellenos integer,
    faltan            boolean,
    faltan_cuantos    integer,
    estado_envio      text,
    ultimo_envio      timestamptz
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT
        gb.id,
        gb.booking_code,
        gb.guest_name,
        a.name,
        gb.check_in,
        gb.check_out,
        gb.pax_count,
        t.n::int,
        (t.n < COALESCE(gb.pax_count, 1)),
        GREATEST(COALESCE(gb.pax_count, 1) - t.n, 0)::int,
        CASE
            WHEN t.n = 0                     THEN 'sin_datos'
            WHEN t.con_error > 0             THEN 'error'
            WHEN t.enviados = t.n            THEN 'enviado'
            ELSE 'pendiente_envio'
        END,
        t.ultimo
    FROM public.guest_bookings gb
    JOIN public.apartments a ON a.id = gb.apartment_id
    CROSS JOIN LATERAL (
        SELECT
            count(*)::int AS n,
            count(*) FILTER (WHERE tr.submitted_at IS NOT NULL)::int AS enviados,
            count(*) FILTER (WHERE tr.mir_response_status IN ('error','retry'))::int AS con_error,
            max(tr.submitted_at) AS ultimo
        FROM public.traveler_records tr
        WHERE tr.booking_id = gb.id
    ) t
    WHERE public.is_staff()
      AND gb.status IN ('confirmed', 'completed')
      AND gb.check_out >= current_date - 90;
$function$;

COMMENT ON FUNCTION public.tjm_parte_estado() IS
  'Semaforo del parte de viajeros. Devuelve 0 filas si quien llama no es staff ni admin. NUNCA expone nombre, documento ni direccion de los viajeros.';

DROP VIEW IF EXISTS public.v_parte_estado;
CREATE VIEW public.v_parte_estado WITH (security_invoker = true) AS
  SELECT * FROM public.tjm_parte_estado();

COMMENT ON VIEW public.v_parte_estado IS
  'Estado del parte de viajeros por reserva, sin datos personales. Es la UNICA via por la que staff toca traveler_records.';


-- ---------------------------------------------------------------------
-- 5. Permisos de ejecucion
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_apartment_prices(bigint, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_apartment_prices(bigint, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_apartment_prices(bigint, numeric, numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.emitir_factura(bigint, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emitir_factura(bigint, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.emitir_factura(bigint, text, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.tjm_parte_estado() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_parte_estado() FROM anon;
GRANT EXECUTE ON FUNCTION public.tjm_parte_estado() TO authenticated, service_role;

REVOKE ALL ON public.v_parte_estado FROM PUBLIC;
REVOKE ALL ON public.v_parte_estado FROM anon;
GRANT SELECT ON public.v_parte_estado TO authenticated, service_role;

-- IMPRESCINDIBLE: una politica RLS que llama a una funcion exige EXECUTE al
-- usuario que consulta. Sin esto, cualquier SELECT sobre guest_bookings desde
-- el navegador muere con "permission denied for function is_staff".
-- is_admin() arrastraba el mismo fallo desde antes de este trabajo (rompia
-- las politicas de apartment_instructions, blog_posts, discount_codes,
-- local_places y routes): se concede tambien.
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

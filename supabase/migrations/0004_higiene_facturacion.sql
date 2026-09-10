-- =====================================================================
-- 0004_higiene_facturacion.sql
-- =====================================================================
-- 1) Retira las dos RPC obsoletas de facturacion.
-- 2) Extrae de `_pendiente_acceso.sql` (descartado) lo unico que aportaba:
--    honrar `profiles.is_active` en `is_staff()`.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. RPC `emitir_factura` — RETIRADA
-- ---------------------------------------------------------------------
-- Envoltura de `issue_invoice` creada en 0003 para el rol staff. Nadie la
-- llama (comprobado el 10-sep-2026: 0 resultados en src/, supabase/functions/,
-- tjm-jobs/ y 0 funciones de la base que la referencien). Estaba EXPUESTA por
-- PostgREST a cualquier sesion con rol staff y habria emitido una factura
-- coja: sin PDF, sin correo, con la huella encadenada con otro criterio y el
-- IVA horneado al 10 % en el SQL, ajeno a `functions/issue-invoice/config.ts`.
-- Una factura asi gasta un numero correlativo real de la serie fiscal y no se
-- puede borrar sin abrir hueco en la serie.
DROP FUNCTION IF EXISTS public.emitir_factura(bigint, text, text, text, text);


-- ---------------------------------------------------------------------
-- 2. RPC `issue_invoice` — RETIRADA
-- ---------------------------------------------------------------------
-- La vieja emisora en PL/pgSQL. Codigo muerto desde que toda la logica fiscal
-- vive en la edge function `issue-invoice`. Mentia si alguien la usaba:
--   * serie 'A'||anio e IVA 10.00 horneados en el cuerpo de la funcion;
--   * encadenaba la huella POR SERIE, mientras la edge function encadena por
--     ORDEN DE REGISTRO (modelo AEAT) -> dos criterios sobre la misma cadena;
--   * no generaba PDF ni mandaba correo (factura sin pdf_url ni email_sent_at).
-- Queda una sola puerta de emision.
DROP FUNCTION IF EXISTS public.issue_invoice(bigint, text, text, text, text);


-- ---------------------------------------------------------------------
-- 3. `is_staff()` honra `profiles.is_active`   [extraido de _pendiente_acceso]
-- ---------------------------------------------------------------------
-- La version de 0003 mira solo el rol: una ficha desactivada (is_active=false)
-- seguia pudiendo gestionar. `profiles.is_active` existe justo para eso, asi
-- que se honra. NULL cuenta como activo (COALESCE), para no cerrarle la puerta
-- a fichas antiguas sin el campo relleno.
-- Comprobado antes de aplicar: los 3 perfiles de produccion tienen
-- is_active = true, asi que nadie pierde acceso con este cambio.
CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    (SELECT p.role IN ('admin', 'staff') AND COALESCE(p.is_active, true)
       FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$function$;

COMMENT ON FUNCTION public.is_staff() IS
  'Cierto para admin y staff con la ficha activa. check_is_admin()/is_admin() siguen siendo SOLO admin.';

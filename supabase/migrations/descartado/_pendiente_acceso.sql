-- =====================================================================
-- DESCARTADO — NO SE APLICA NUNCA.        Decidido el 10-sep-2026.
-- =====================================================================
-- Este fichero es una version ALTERNATIVA de lo que ya esta aplicado en
-- produccion como `0003_rol_staff.sql`. Aplicar los dos dejaria DOS
-- politicas distintas haciendo lo mismo con nombres distintos
-- (`gestion_*` aqui, `staff_all_*` en 0003), que es justo lo que se
-- olvida y confunde al siguiente.
--
-- Comparado linea a linea contra 0003 (aplicado). Resultado:
--
--   · profiles_role_check con 'staff'  -> YA en 0003, identico.
--   · GRANT EXECUTE is_staff/is_admin  -> YA en 0003.
--   · politicas de guest_bookings, customers, cleaning_tasks,
--     blocked_dates                    -> YA en 0003 (staff_all_*), y 0003
--     ademas cubre booking_payments, customer_notes, addons, high_seasons,
--     pricing_rules e invoices (lectura). Este fichero cubre MENOS.
--   · politica FOR ALL sobre `apartments`     -> 0003 la OMITE A PROPOSITO:
--     los precios se cambian solo por set_apartment_prices(), para que staff
--     no pueda tocar slug, fotos, iCal ni el numero de registro turistico.
--     Aplicar esto seria ABRIR acceso, no arreglar nada.
--   · politica FOR ALL sobre `traveler_records` -> 0003 la OMITE A PROPOSITO:
--     son documentos de identidad. staff ve el semaforo `v_parte_estado`,
--     nunca la tabla. Aplicar esto expondria los datos personales.
--   · funcion `puede_gestionar()`      -> duplicado de is_staff(). Lo UNICO
--     que aportaba de verdad era el guardia `COALESCE(is_active, true)`,
--     que hoy is_staff() no tiene. Ese trozo SI se ha extraido y aplicado
--     suelto (ver `0004_higiene_facturacion.sql`, seccion 3). El resto, no.
--
-- Conclusion: no aporta nada que falte, y lo que anadia de mas era peor.
-- Se conserva solo como registro de la decision.
-- =====================================================================

-- ============================================================
-- _pendiente_acceso.sql  ·  NO APLICADO  ·  10-sep-2026
-- ============================================================
-- Lo escribe el agente del panel sencillo (/panel). NO lo ha ejecutado:
-- la base la lleva otro agente. Revísalo y aplícalo tú.
--
-- ⚠ SOLAPE CONOCIDO: `0002_reservas_y_cobros.sql` dice, en su línea sobre
-- booking_payments, "(la politica de staff la anade 0003_rol_staff.sql)".
-- Ese 0003 todavía no existe. Este fichero ES ese contenido. Elegid uno:
-- o se renombra esto a `0003_rol_staff.sql`, o el agente de la base escribe
-- su 0003 y esto se tira. Aplicar los dos no rompe nada (todo es
-- DROP POLICY IF EXISTS + CREATE), pero deja dos políticas que hacen lo
-- mismo con nombres distintos, y eso se olvida y confunde al siguiente.
--
-- POR QUÉ HACE FALTA
-- El panel de /panel está construido y funciona, pero hoy NADIE puede
-- usarlo salvo Jesús, por dos cosas medidas en producción el 10-sep-2026:
--
--   1. `profiles` tiene un CHECK que solo admite dos valores:
--        profiles_role_check: role IN ('admin', 'cliente')
--      O sea: hoy es IMPOSIBLE crear un perfil con role = 'staff'.
--      La fila se rechaza.
--
--   2. Todas las políticas RLS de las tablas que el panel necesita
--      (guest_bookings, cleaning_tasks, traveler_records, customers,
--      blocked_dates, apartments para escribir) exigen role = 'admin'.
--      Un perfil 'staff' entraría al panel y lo vería TODO vacío, sin un
--      solo mensaje de error: las consultas devuelven cero filas.
--
--      Ojo con `public.is_staff()`: existe, pero su lista de roles es de
--      otro proyecto (coach, endocrino, closer, setter…) y NO incluye
--      'staff'. No sirve aquí. Por eso abajo se crea `puede_gestionar()`,
--      que es explícita y solo mira 'admin' y 'staff'.
--
-- ALCANCE
-- Este fichero es solo del ACCESO. Las columnas nuevas de guest_bookings
-- (channel, external_locator, commission_amount, payment_method,
-- paid_amount, pending_amount, invoice_not_needed, internal_notes), la
-- tabla booking_payments, las RPC y la vista v_parte_estado van en la
-- migración del agente de la base. Las políticas de más abajo ya las
-- contemplan, pero los bloques que las tocan están comentados: descoméntalos
-- cuando esas piezas existan, o el script fallará.
--
-- DECISIÓN DE FONDO (consciente): 'staff' ve la FILA ENTERA de las tablas,
-- igual que 'admin'. Es la madre de Jesús gestionando su propio negocio
-- familiar, no un tercero. Si algún día entra alguien de fuera (una persona
-- de limpieza, por ejemplo), NO se le da 'staff': se le hace una vista con
-- las columnas justas y se le da permiso sobre la vista, nunca sobre la tabla.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Permitir el rol 'staff' en profiles
-- ------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'staff', 'cliente'));


-- ------------------------------------------------------------
-- 2. Quién puede gestionar: admin o staff, y con la ficha activa
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.puede_gestionar()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'staff')
          AND COALESCE(is_active, true)
    );
$$;

REVOKE ALL ON FUNCTION public.puede_gestionar() FROM public;
GRANT EXECUTE ON FUNCTION public.puede_gestionar() TO authenticated;


-- ------------------------------------------------------------
-- 3. Políticas para 'staff'
-- ------------------------------------------------------------
-- Son ADICIONALES: las de 'admin' que ya existen se quedan como están.
-- En Postgres las políticas permisivas se suman (OR), así que Jesús sigue
-- entrando por la suya y por esta.

-- Reservas: leer y gestionar
DROP POLICY IF EXISTS "gestion_bookings" ON public.guest_bookings;
CREATE POLICY "gestion_bookings" ON public.guest_bookings
    FOR ALL TO authenticated
    USING (public.puede_gestionar())
    WITH CHECK (public.puede_gestionar());

-- Clientes
DROP POLICY IF EXISTS "gestion_customers" ON public.customers;
CREATE POLICY "gestion_customers" ON public.customers
    FOR ALL TO authenticated
    USING (public.puede_gestionar())
    WITH CHECK (public.puede_gestionar());

-- Limpiezas
DROP POLICY IF EXISTS "gestion_cleaning" ON public.cleaning_tasks;
CREATE POLICY "gestion_cleaning" ON public.cleaning_tasks
    FOR ALL TO authenticated
    USING (public.puede_gestionar())
    WITH CHECK (public.puede_gestionar());

-- Datos de la policía (los rellena el huésped; ella los consulta y los manda)
DROP POLICY IF EXISTS "gestion_travelers" ON public.traveler_records;
CREATE POLICY "gestion_travelers" ON public.traveler_records
    FOR ALL TO authenticated
    USING (public.puede_gestionar())
    WITH CHECK (public.puede_gestionar());

-- Días cerrados / bloqueos (pantalla "No alquilar estos días")
DROP POLICY IF EXISTS "gestion_bloqueos" ON public.blocked_dates;
CREATE POLICY "gestion_bloqueos" ON public.blocked_dates
    FOR ALL TO authenticated
    USING (public.puede_gestionar())
    WITH CHECK (public.puede_gestionar());

-- Apartamentos: leer ya es público; esto es para poder CAMBIAR el precio
DROP POLICY IF EXISTS "gestion_apartments" ON public.apartments;
CREATE POLICY "gestion_apartments" ON public.apartments
    FOR ALL TO authenticated
    USING (public.puede_gestionar())
    WITH CHECK (public.puede_gestionar());

-- Temporadas, reglas de precio y extras (pantalla "Precios")
-- Descomenta según existan y tengan RLS activada:
-- DROP POLICY IF EXISTS "gestion_temporadas" ON public.high_seasons;
-- CREATE POLICY "gestion_temporadas" ON public.high_seasons
--     FOR ALL TO authenticated
--     USING (public.puede_gestionar()) WITH CHECK (public.puede_gestionar());
--
-- DROP POLICY IF EXISTS "gestion_reglas_precio" ON public.pricing_rules;
-- CREATE POLICY "gestion_reglas_precio" ON public.pricing_rules
--     FOR ALL TO authenticated
--     USING (public.puede_gestionar()) WITH CHECK (public.puede_gestionar());
--
-- DROP POLICY IF EXISTS "gestion_extras" ON public.addons;
-- CREATE POLICY "gestion_extras" ON public.addons
--     FOR ALL TO authenticated
--     USING (public.puede_gestionar()) WITH CHECK (public.puede_gestionar());

-- Cobros (cuando exista la tabla del otro agente)
-- DROP POLICY IF EXISTS "gestion_cobros" ON public.booking_payments;
-- CREATE POLICY "gestion_cobros" ON public.booking_payments
--     FOR ALL TO authenticated
--     USING (public.puede_gestionar()) WITH CHECK (public.puede_gestionar());

-- Facturas
-- DROP POLICY IF EXISTS "gestion_facturas" ON public.invoices;
-- CREATE POLICY "gestion_facturas" ON public.invoices
--     FOR ALL TO authenticated
--     USING (public.puede_gestionar()) WITH CHECK (public.puede_gestionar());


-- ------------------------------------------------------------
-- 4. Vistas que usa el panel
-- ------------------------------------------------------------
-- `v_parte_estado` la crea el agente de la base. Recuerda darle permiso de
-- lectura a `authenticated` cuando exista, o el semáforo de los datos de la
-- policía saldrá vacío sin decir por qué:
--
--   GRANT SELECT ON public.v_parte_estado TO authenticated;
--
-- Y, si la vista lleva `security_invoker = true`, comprueba que las políticas
-- de arriba le dejan ver las filas. Si no lo lleva, la vista se salta la RLS
-- de las tablas de debajo: en ese caso la lectura hay que acotarla aquí.


-- ============================================================
-- 5. DAR DE ALTA A LA MADRE  (esto NO es SQL: se hace fuera)
-- ============================================================
-- Falta su usuario. Sin él no hay a quién mandarle el número de acceso.
-- El orden importa:
--
--   a) Crear el usuario en Supabase → Authentication → Users → "Add user" →
--      "Create new user", con su correo. Contraseña: cualquiera larga y al
--      azar; ella nunca la va a usar, entra siempre con el número de 6 cifras.
--      Marca el correo como confirmado.
--
--   b) Con el `id` (uuid) que salga de ahí, crear o corregir su ficha:
--
--        INSERT INTO public.profiles (id, email, full_name, role, is_active)
--        VALUES ('<UUID DEL USUARIO>', '<su correo>', '<su nombre>', 'staff', true)
--        ON CONFLICT (id) DO UPDATE
--          SET role = 'staff', is_active = true,
--              email = EXCLUDED.email, full_name = EXCLUDED.full_name;
--
--      (Si hay un trigger que crea la fila de `profiles` sola al crear el
--       usuario, esta sentencia solo le cambia el rol. Es idempotente.)
--
--   c) Comprobar que entra: tiojosemaria.com/panel → su correo → le llega el
--      número → dentro. La función `request-otp` NO ha habido que tocarla:
--      ya deja pasar a cualquier correo que esté en `profiles`.
--
--   d) Comprobación de que la RLS quedó bien (con su sesión abierta, desde
--      el propio panel): la pantalla de Hoy tiene que enseñar las reservas
--      reales. Si sale "Hoy no llega ni se va nadie" un día que SÍ llega
--      alguien, es que las políticas de arriba no están aplicadas.
-- ============================================================

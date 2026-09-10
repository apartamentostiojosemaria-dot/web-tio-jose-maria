-- =====================================================================
-- 0005_storage_limpiezas.sql
-- =====================================================================
-- El cubo privado donde la madre deja las fotos de las limpiezas.
-- `cleaning_tasks.photos` (jsonb) existe desde el baseline, pero no habia
-- donde dejar el fichero: los cubos de hoy (apartments, calendars,
-- event-posters, internal-docs, invoices) piden todos `check_is_admin()`
-- para escribir, asi que un perfil `staff` no podia subir nada. Por eso el
-- boton "Hacer una foto" esta hoy escondido en LimpiezasPanel.jsx (se
-- comprueba con un list() al arrancar): con esto aplicado, aparece solo.
--
-- El cubo va PRIVADO: son fotos del interior de un apartamento y a veces de
-- un desperfecto. Se leen con URL firmada, nunca por enlace publico.
-- =====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'limpiezas',
    'limpiezas',
    false,
    10485760,                                  -- 10 MB: una foto de movil cabe de sobra
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Quien lleva las limpiezas (admin o staff con la ficha activa, segun
-- is_staff()) sube, ve y borra sus fotos. Nadie mas: `anon` no entra y un
-- perfil `cliente` tampoco.
DROP POLICY IF EXISTS limpiezas_staff_all ON storage.objects;
CREATE POLICY limpiezas_staff_all
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'limpiezas' AND public.is_staff())
    WITH CHECK (bucket_id = 'limpiezas' AND public.is_staff());


-- ---------------------------------------------------------------------
-- NO APLICADO A PROPOSITO: dar `id` propio a `customers`
-- ---------------------------------------------------------------------
-- `customer_notes.customer_email` es hoy la unica forma de atar un apunte a
-- un cliente, y una reserva apuntada por telefono puede no traer correo. La
-- pantalla lo resuelve pidiendole el correo a la madre, asi que no hay nada
-- roto ahora mismo.
--
-- El arreglo de fondo seria dar identidad propia al cliente:
--
--   alter table customers add column id uuid primary key default gen_random_uuid();
--   alter table customer_notes add column customer_id uuid references customers(id);
--   -- + relleno desde customer_email + indice unico por telefono normalizado
--
-- Se deja SIN aplicar: toca `customers`, `customer_notes`, `v_customers_360`
-- y `Customer360.jsx` a la vez sobre datos reales. Es un paquete propio, con
-- su plan y su prueba, no un anadido de esta migracion.

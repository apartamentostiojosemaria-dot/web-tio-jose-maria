-- ============================================
-- RLS Setup para Apartamentos Tio Jose Maria
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Habilitar RLS en TODAS las tablas
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.high_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_config ENABLE ROW LEVEL SECURITY;

-- 2. LECTURA PUBLICA (cualquier visitante puede ver)
CREATE POLICY "Lectura publica de apartamentos" ON public.apartments FOR SELECT USING (true);
CREATE POLICY "Lectura publica de temporadas" ON public.high_seasons FOR SELECT USING (true);
CREATE POLICY "Lectura publica de fechas bloqueadas" ON public.blocked_dates FOR SELECT USING (true);
CREATE POLICY "Lectura publica de rutas" ON public.routes FOR SELECT USING (true);
CREATE POLICY "Lectura publica de lugares" ON public.local_places FOR SELECT USING (true);
CREATE POLICY "Lectura publica de reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Lectura publica de config web" ON public.web_config FOR SELECT USING (true);

-- 3. LECTURA AUTENTICADA (solo usuarios logueados)
CREATE POLICY "Lectura autenticada de guias" ON public.guest_guides FOR SELECT TO authenticated USING (true);

-- 4. LECTURA CON FILTRO POR PERFIL (cada usuario solo ve lo suyo)
CREATE POLICY "Usuarios ven sus propias reservas" ON public.guest_bookings FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Usuarios ven sus propios documentos" ON public.documents FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Usuarios ven su propio perfil" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 5. ESCRITURA SOLO ADMIN (funcion helper)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies de escritura admin para cada tabla
CREATE POLICY "Admin puede insertar apartamentos" ON public.apartments FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar apartamentos" ON public.apartments FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar apartamentos" ON public.apartments FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admin puede insertar fechas bloqueadas" ON public.blocked_dates FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar fechas bloqueadas" ON public.blocked_dates FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar fechas bloqueadas" ON public.blocked_dates FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admin puede insertar temporadas" ON public.high_seasons FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar temporadas" ON public.high_seasons FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar temporadas" ON public.high_seasons FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admin puede insertar guias" ON public.guest_guides FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar guias" ON public.guest_guides FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar guias" ON public.guest_guides FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admin puede gestionar reservas" ON public.guest_bookings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar reservas" ON public.guest_bookings FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar reservas" ON public.guest_bookings FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admin puede gestionar perfiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar perfiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar perfiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede ver todos los perfiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin() OR id = auth.uid());

CREATE POLICY "Admin puede gestionar documentos" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar documentos" ON public.documents FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar documentos" ON public.documents FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admin puede gestionar rutas" ON public.routes FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar rutas" ON public.routes FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar rutas" ON public.routes FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admin puede gestionar lugares" ON public.local_places FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar lugares" ON public.local_places FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar lugares" ON public.local_places FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admin puede gestionar reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar reviews" ON public.reviews FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar reviews" ON public.reviews FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admin puede gestionar config" ON public.web_config FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin puede actualizar config" ON public.web_config FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin puede eliminar config" ON public.web_config FOR DELETE TO authenticated USING (public.is_admin());

-- 6. Permitir que usuarios actualicen su propio perfil
CREATE POLICY "Usuarios pueden actualizar su perfil" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 0074 — Close what the security linter can close without changing the app (26-oct-2026)
--
-- After 0073 the linter still listed four families. Checked one by one against the code and the policies:
--
--   1. Two trigger functions (`tjm_avisar_precheckin_completo`, `tjm_avisar_reserva_nueva`) and one helper used only
--      inside other SECURITY DEFINER functions (`tjm_ficha_reserva_viva`, called by the guest card's invoice and
--      arrival RPCs) were callable through /rest/v1/rpc. A trigger never needs EXECUTE to fire and the owner runs the
--      helper, so the grant goes.
--   2. `vector` and `btree_gist` move to `extensions`. Columns, the `no_overlap_bookings` exclusion and
--      `search_kb_chunks` reference them by OID (and that function looks in `extensions` since 0073).
--      `pg_net` stays in public: it is not relocatable and moving it means dropping the queue the crons use.
--   3. Five tables are written only by edge functions with the service role and had RLS on with no policy (deny by
--      default). An explicit «nobody from outside» policy says the same thing out loud.
--
-- Left on purpose (written down in docs/SECURITY.md): the guest RPCs that take a booking code or a token, which must
-- work without signing in, and the panel RPCs, which open with `tjm_puede_gestionar()` (service role or staff).
-- `check_is_admin()` stays callable by anon because public read policies (apartments, reviews, web_config) call it.

REVOKE EXECUTE ON FUNCTION public.tjm_avisar_precheckin_completo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tjm_avisar_reserva_nueva()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tjm_ficha_reserva_viva(text)     FROM PUBLIC, anon, authenticated;

ALTER EXTENSION vector     SET SCHEMA extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;

CREATE POLICY solo_servidor ON public.otp_codes              FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY solo_servidor ON public.rate_limits            FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY solo_servidor ON public.seo_citas_ia           FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY solo_servidor ON public.seo_citas_ia_consultas FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY solo_servidor ON public.vigia_citas_ia_estado  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

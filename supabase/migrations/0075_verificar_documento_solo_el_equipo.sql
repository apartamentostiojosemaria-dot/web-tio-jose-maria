-- 0075 — Checking a guest's document is for the team only (26-oct-2026)
--
-- `tjm_checkin_verificar` is called from the panel (src/components/panel/checkin/datos.js), always signed in, and
-- answers «no_autorizado» to anyone who is not staff. It was still callable without signing in; that grant goes.

REVOKE EXECUTE ON FUNCTION public.tjm_checkin_verificar(uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.tjm_checkin_verificar(uuid, boolean) TO authenticated, service_role;

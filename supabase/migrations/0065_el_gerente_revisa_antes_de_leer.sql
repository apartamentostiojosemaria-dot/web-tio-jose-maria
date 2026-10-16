-- 0065 · The manager reads fresh problems (16-oct-2026)
-- parte-gerente runs tjm_revisar() right before tjm_parte_gerente(): the first test pass of the manager
-- built a task on two problems already solved, read from the hourly snapshot.
GRANT EXECUTE ON FUNCTION public.tjm_revisar() TO service_role;

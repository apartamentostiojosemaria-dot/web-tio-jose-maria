-- 0073 — Every function looks in a fixed place (26-oct-2026)
--
-- Supabase's linter has flagged `function_search_path_mutable` since 10-sep:
-- 20 functions in `public` resolve names through the caller's search_path, so
-- whoever can create objects earlier in that path could slip in a lookalike.
-- Four of them run as SECURITY DEFINER (cleanup_expired_otps,
-- expire_booking_holds, prune_ai_interaction_logs, prune_traveler_records).
--
-- Only the setting changes, never the body. The value is the path these
-- functions already resolve through on Supabase («$user», public, extensions;
-- no role has its own schema), with pg_temp pinned last so a temporary
-- object can never shadow a real one. `extensions` stays because pgcrypto and
-- uuid-ossp live there; `vector` and `btree_gist` live in public.

ALTER FUNCTION public.check_availability(date, date, integer)                     SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.cleaning_follows_booking()                                  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.cleanup_expired_otps()                                      SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.cleanup_old_rate_limits()                                   SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.create_booking_hold(bigint, date, date, integer, text, text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.expire_booking_holds()                                      SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.generate_booking_code()                                     SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.prune_ai_interaction_logs()                                 SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.prune_traveler_records()                                    SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.schedule_cleaning_on_booking_confirmed()                    SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.search_kb_chunks(vector, double precision, integer, text)   SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.set_updated_at()                                            SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.tjm_clave_telefono(text)                                    SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.tjm_cliente_nombre_bonito_trg()                             SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.tjm_es_relleno(text)                                        SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.tjm_idioma_por_telefono(text)                               SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.tjm_nombre_bonito(text)                                     SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.tjm_nombre_bonito_trg()                                     SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.tjm_siguiente_fecha(date, text)                             SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.update_materials_library_timestamp()                        SET search_path = public, extensions, pg_temp;

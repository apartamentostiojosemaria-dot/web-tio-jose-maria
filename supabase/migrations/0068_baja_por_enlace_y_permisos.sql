-- 2026-10-16 · Security review after the "vibe coding" checklist.
--
-- 1. The unsubscribe page read `customers` by token as anon, but customers has
--    no anon policy: the link never identified anyone and nobody could unsubscribe.
--    Two token-gated functions do it now.
-- 2. record_marketing_consent was callable by anon for any email in both
--    directions. Anon may only opt in (booking form, guide form); revoking or
--    writing an admin_panel source needs an admin. Unsubscribing goes by token.
-- 3. Leftover tables from another project were writable by anyone:
--    portal_events (anon could edit/delete), client_notifications_read and
--    materials_library. Writes now admin only; public reading of visible events stays.

create or replace function public.tjm_baja_leer(p_token text)
returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'nombre', c.canonical_name,
    'email', regexp_replace(c.email, '^(.).*(@.*)$', '\1***\2'),
    'marketing_consent', coalesce(c.marketing_consent, false),
    'review_optout', coalesce(c.review_optout, false))
  from public.customers c
  where p_token is not null and length(p_token) >= 16 and c.unsubscribe_token = p_token
  limit 1;
$$;

create or replace function public.tjm_baja_confirmar(p_token text, p_purpose text, p_user_agent text default null)
returns boolean
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_email text;
begin
  if p_token is null or length(p_token) < 16 then return false; end if;
  select email into v_email from public.customers where unsubscribe_token = p_token limit 1;
  if v_email is null then return false; end if;

  if p_purpose = 'marketing' then
    update public.customers
       set marketing_consent = false, marketing_consent_revoked_at = now(), updated_at = now()
     where email = v_email;
    insert into public.consent_log (customer_email, purpose, granted, source, user_agent, legal_version)
    values (v_email, 'marketing', false, 'unsubscribe_link', p_user_agent, '1.0');
  else
    update public.customers set review_optout = true, updated_at = now() where email = v_email;
    insert into public.consent_log (customer_email, purpose, granted, source, user_agent, legal_version)
    values (v_email, 'review_request', false, 'unsubscribe_link', p_user_agent, '1.0');
  end if;
  return true;
end $$;

revoke all on function public.tjm_baja_leer(text) from public;
revoke all on function public.tjm_baja_confirmar(text, text, text) from public;
grant execute on function public.tjm_baja_leer(text) to anon, authenticated;
grant execute on function public.tjm_baja_confirmar(text, text, text) to anon, authenticated;

create or replace function public.record_marketing_consent(
  p_email text, p_granted boolean, p_source text default 'admin_panel'::text,
  p_ip text default null::text, p_user_agent text default null::text,
  p_legal_version text default '1.0'::text, p_booking_code text default null::text)
returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  log_id uuid;
  norm_email text := lower(trim(p_email));
begin
  if not public.check_is_admin() then
    if not p_granted then
      raise exception 'Para darse de baja use el enlace del correo.';
    end if;
    if coalesce(p_source, '') like 'admin_panel%' then
      raise exception 'Origen no permitido.';
    end if;
  end if;

  insert into public.customers (email) values (norm_email) on conflict (email) do nothing;
  if p_granted then
    update public.customers
       set marketing_consent = true, marketing_consent_at = now(), marketing_consent_source = p_source,
           marketing_consent_revoked_at = null, updated_at = now()
     where email = norm_email;
  else
    update public.customers
       set marketing_consent = false, marketing_consent_revoked_at = now(), updated_at = now()
     where email = norm_email;
  end if;
  insert into public.consent_log (customer_email, purpose, granted, source, ip, user_agent, legal_version, booking_code)
  values (norm_email, 'marketing', p_granted, p_source, p_ip, p_user_agent, p_legal_version, p_booking_code)
  returning id into log_id;
  return log_id;
end $$;

drop policy if exists staff_can_manage_events on public.portal_events;
create policy admin_manage_events on public.portal_events
  for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());

drop policy if exists clients_delete_own_notif_reads on public.client_notifications_read;
drop policy if exists clients_insert_own_notif_reads on public.client_notifications_read;
drop policy if exists clients_read_own_notif_reads on public.client_notifications_read;
create policy admin_manage_notif_reads on public.client_notifications_read
  for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());

drop policy if exists "Authenticated users can delete materials" on public.materials_library;
drop policy if exists "Authenticated users can insert materials" on public.materials_library;
drop policy if exists "Authenticated users can read materials" on public.materials_library;
drop policy if exists "Authenticated users can update materials" on public.materials_library;
create policy admin_manage_materials on public.materials_library
  for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());

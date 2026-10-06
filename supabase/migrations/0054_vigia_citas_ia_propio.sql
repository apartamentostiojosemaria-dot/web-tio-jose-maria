-- 0054 · Vigía de citas IA de TJM, en su propia base (6-oct-2026)
--
-- Until today the weekly AI-citation watcher (DataForSEO, run from Padrón IA's VPS srv923085) kept TJM's 10
-- queries and their results inside OFM's Centro de Mando database. TJM data does not belong in a client's base:
-- the queries and their history move here and OFM keeps only its own.
--
-- Access model (same as OFM's): RLS on, no policies, nothing granted to anon/authenticated on the tables. The
-- watcher only talks through four SECURITY DEFINER functions that check a token. Only the token's SHA-256 lives
-- here (vigia_citas_ia_estado.token_sha256); the token itself is in the VPS .env and never touches the database.

create table if not exists public.seo_citas_ia_consultas (
  id             bigserial primary key,
  proyecto       text not null default 'Tío José María',
  consulta       text not null,
  dominio_propio text not null default 'tiojosemaria.com',
  location_code  integer not null default 2724,
  language_code  text not null default 'es',
  activa         boolean not null default true,
  motivo         text,
  creado_en      timestamptz not null default now(),
  unique (proyecto, consulta)
);
comment on table public.seo_citas_ia_consultas is
  'Búsquedas que vigila cada lunes el vigía de citas IA (DataForSEO): si la IA de Google y el orgánico citan tiojosemaria.com. Traídas del CM de OFM el 6-oct-2026.';

create table if not exists public.seo_citas_ia (
  id         bigserial primary key,
  proyecto   text not null,
  consulta   text not null,
  fecha      date not null,
  fuente     text not null check (fuente in ('google_ai_overview', 'google_organico')),
  seccion    text not null default '',
  dominio    text not null,
  puesto     integer,
  url        text,
  titulo     text,
  es_propio  boolean not null default false,
  origen     text not null default 'dataforseo:serp/google/organic/live/advanced',
  creado_en  timestamptz not null default now(),
  unique (proyecto, consulta, fecha, fuente, seccion, dominio, puesto)
);
create index if not exists seo_citas_ia_proy_cons_fecha on public.seo_citas_ia (proyecto, consulta, fecha);
comment on table public.seo_citas_ia is
  'Una fila por dominio citado (vista de IA) o posicionado (orgánico top 20), por búsqueda y lunes. Historial desde el 16-sep-2026.';

-- Single row: token hash + last heartbeat (TJM has no agent registry; this is the watcher's own state).
create table if not exists public.vigia_citas_ia_estado (
  id              boolean primary key default true check (id),
  token_sha256    text,
  ultimo_ok_en    timestamptz,
  ultimo_error    text,
  ultimo_error_en timestamptz
);
insert into public.vigia_citas_ia_estado (id) values (true) on conflict do nothing;

alter table public.seo_citas_ia_consultas enable row level security;
alter table public.seo_citas_ia           enable row level security;
alter table public.vigia_citas_ia_estado  enable row level security;
revoke all on public.seo_citas_ia_consultas, public.seo_citas_ia, public.vigia_citas_ia_estado from anon, authenticated;

create or replace view public.v_seo_citas_ia_resumen with (security_invoker = true) as
select proyecto, consulta, fecha,
       bool_or(fuente = 'google_ai_overview')                  as hay_vista_ia,
       bool_or(fuente = 'google_ai_overview' and es_propio)    as citado_en_ia,
       count(distinct dominio) filter (where fuente = 'google_ai_overview') as dominios_citados,
       min(puesto) filter (where fuente = 'google_organico' and es_propio)  as puesto_organico_propio,
       (array_agg(dominio order by puesto) filter (where fuente = 'google_organico' and puesto <= 3))[1:3] as top3_organico
from public.seo_citas_ia
group by proyecto, consulta, fecha;
revoke all on public.v_seo_citas_ia_resumen from anon, authenticated;

create or replace function public.vigia_citas_ia_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select token_sha256 = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
                   from public.vigia_citas_ia_estado where id), false)
$$;
revoke all on function public.vigia_citas_ia_token_ok(text) from public, anon, authenticated;

create or replace function public.vigia_citas_ia_consultas(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.vigia_citas_ia_token_ok(p_token) then raise exception 'token no válido'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('proyecto', proyecto, 'consulta', consulta,
                     'dominio_propio', dominio_propio, 'location_code', location_code, 'language_code', language_code)
                     order by id)
                   from public.seo_citas_ia_consultas where activa), '[]'::jsonb);
end $$;

create or replace function public.vigia_citas_ia_ingesta(p_token text, p_filas jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_n int := 0;
begin
  if not public.vigia_citas_ia_token_ok(p_token) then raise exception 'token no válido'; end if;
  insert into public.seo_citas_ia (proyecto, consulta, fecha, fuente, seccion, dominio, puesto, url, es_propio)
  select f->>'proyecto', f->>'consulta', (f->>'fecha')::date, f->>'fuente', coalesce(f->>'seccion', ''), f->>'dominio',
         nullif(f->>'puesto', '')::int, f->>'url', coalesce((f->>'es_propio')::boolean, false)
  from jsonb_array_elements(p_filas) f
  where coalesce(f->>'dominio', '') <> ''
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return jsonb_build_object('insertadas', v_n);
end $$;

create or replace function public.vigia_citas_ia_cambios(p_token text, p_fecha date default current_date)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.vigia_citas_ia_token_ok(p_token) then raise exception 'token no válido'; end if;
  return coalesce((
    with hoy as (select * from public.v_seo_citas_ia_resumen where fecha = p_fecha),
    prev as (select r.* from public.v_seo_citas_ia_resumen r
             join (select proyecto, consulta, max(fecha) f from public.v_seo_citas_ia_resumen
                   where fecha < p_fecha group by 1, 2) u
               on u.proyecto = r.proyecto and u.consulta = r.consulta and u.f = r.fecha)
    select jsonb_agg(jsonb_build_object('proyecto', h.proyecto, 'consulta', h.consulta, 'fecha_prev', p.fecha,
                       'ia_prev', p.citado_en_ia, 'ia_hoy', h.citado_en_ia, 'pos_prev', p.puesto_organico_propio,
                       'pos_hoy', h.puesto_organico_propio, 'hay_vista_ia', h.hay_vista_ia)
                     order by h.proyecto, h.consulta)
    from hoy h left join prev p on p.proyecto = h.proyecto and p.consulta = h.consulta), '[]'::jsonb);
end $$;

create or replace function public.vigia_citas_ia_latido(p_token text, p_ok boolean, p_error text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.vigia_citas_ia_token_ok(p_token) then raise exception 'token no válido'; end if;
  update public.vigia_citas_ia_estado
     set ultimo_ok_en    = case when p_ok then now() else ultimo_ok_en end,
         ultimo_error    = case when p_ok then ultimo_error else p_error end,
         ultimo_error_en = case when p_ok then ultimo_error_en else now() end
   where id;
end $$;

revoke all on function public.vigia_citas_ia_consultas(text), public.vigia_citas_ia_ingesta(text, jsonb),
                       public.vigia_citas_ia_cambios(text, date), public.vigia_citas_ia_latido(text, boolean, text)
  from public;
grant execute on function public.vigia_citas_ia_consultas(text), public.vigia_citas_ia_ingesta(text, jsonb),
                          public.vigia_citas_ia_cambios(text, date), public.vigia_citas_ia_latido(text, boolean, text)
  to anon;

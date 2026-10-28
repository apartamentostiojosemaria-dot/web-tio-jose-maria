-- 0076 · One-time encrypted form for the owner's details (28-oct-2026)
-- The owner's family fills /datos/:token; the browser encrypts the details with an RSA-OAEP public key
-- (private key only in the operator's .env.local) and the edge function `recibir-datos-titular` stores the
-- ciphertext here. Nobody can read this table from the web: RLS on, no policies, no grants to anon/authenticated.
-- The operator reads it with scripts/leer-datos-titular.py (service role), which deletes the row after reading.

create table if not exists public.datos_titular_envio (
    id uuid primary key default gen_random_uuid(),
    token_hash text not null unique,             -- sha256 hex of the link token; the token itself is never stored
    etiqueta text,                               -- what the link is for, e.g. 'stripe-titular'
    cifrado jsonb,                               -- {v, k, iv, c}: RSA-wrapped AES-256-GCM key + ciphertext (base64)
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default now() + interval '7 days',
    recibido_at timestamptz
);

alter table public.datos_titular_envio enable row level security;
revoke all on public.datos_titular_envio from anon, authenticated;

comment on table public.datos_titular_envio is
    'Envíos cifrados del formulario de datos del titular (/datos/:token). Solo service role. Se borra al leer o a los 7 días.';

-- Daily cleanup: expired links and anything left unread for more than 7 days.
select cron.schedule(
    'tjm-purgar-datos-titular',
    '50 3 * * *',
    $$delete from public.datos_titular_envio
      where expires_at < now() - interval '1 day'
         or (recibido_at is not null and recibido_at < now() - interval '7 days')$$
);

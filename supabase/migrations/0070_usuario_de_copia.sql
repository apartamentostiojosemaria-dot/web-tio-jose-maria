-- 2026-10-24 · Read-only login for the nightly backup on the agents' VPS (pg_dump). It can read everything and write
-- nothing. The password lives only on the VPS (/root/.vps-backup/tjm-copia.pass); only its SCRAM verifier is here.
CREATE ROLE tjm_copia LOGIN NOINHERIT PASSWORD 'SCRAM-SHA-256$4096:744E0zGYk9t34kyN5t4+tg==$glWCXLeOQFi/qkLxIUgj+wq+CGhjr4UFldfIN1//yPA=:7Lyaq1rA0NJnOohPIzMFPR8vKlUZAGgig49EPuDb4lo=';
ALTER ROLE tjm_copia INHERIT;
GRANT pg_read_all_data TO tjm_copia;
ALTER ROLE tjm_copia SET default_transaction_read_only = on;
ALTER ROLE tjm_copia CONNECTION LIMIT 2;

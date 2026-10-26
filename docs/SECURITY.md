# Seguridad — tio-jose-maria

> Obligatorio si hay datos de salud, menores o banca. Qué se protege, cómo y qué falta.
> Aplica: hay **documentos de identidad, domicilio y firma de viajeros, menores incluidos** (RD 933/2021) y datos de pago parciales.
> Fuentes: migraciones `0001`–`0060`, `supabase/MANIFEST.md`, `supabase/config.toml`, `nginx.conf`, `security-headers.conf`,
> `docs/legal/`, `docs/seguridad/` (16-oct-2026). Lo legal del parte: `docs/CHECKIN-LEGAL.md` y `docs/PARTE-VIAJEROS.md`.

- Datos sensibles y dónde viven:
  - Viajeros: `traveler_records` (documento, domicilio, nacimiento, parentesco, firma). Menores sin documento obligatorio (`0015`).
  - Libro-registro en PDF: cubo **privado** `libro-registro` (nombre, documento, dirección y firma). No hacerlo público nunca.
  - Facturas PDF con NIF y dirección: cubo **privado** `invoices`, al panel solo URL firmada de 1 h (MANIFEST).
  - Pago: en `guest_bookings` solo marca, **últimos 4 dígitos**, caducidad y titular; un CHECK con `tjm_parece_tarjeta()`
    (`0013`) impide guardar un número de tarjeta completo. El número lo tiene Stripe.
  - Contacto y reservas: `guest_bookings`, `customers`, `customer_notes`, `email_subscribers`, `inbox_messages`.
  - Fotos de limpieza: cubo privado `limpiezas`. Todo en Supabase región UE (Fráncfort).

- Quién entra y cómo (autenticación, segundo factor):
  - Familia y Jesús: `/panel` con **código de 6 dígitos al correo** (`request-otp` lo guarda hasheado → `verify-otp` → magic
    link). Sin contraseñas ni Google desde el 17-sep (`3e57c68`). `/admin` sin sesión redirige a `/panel`.
  - Clientes: mismo sistema en `/clientes`. Huésped sin cuenta: solo por **código de reserva** `TJM-XXXXXX` (aleatorio), y
    `tjm_precheckin_reserva` no devuelve datos personales fuera de la ventana del prechequeo (`0018`).
  - Segundo factor: no hay (el código al correo es el único factor). Protección de contraseñas filtradas de Auth:
    **desactivada** según MANIFEST (10-sep); estado actual pendiente de confirmar.
  - Antiabuso: `rate_limits` por IP (`notify-booking` 1 h, `send-guide` 3/h, `enlace-guia`), Turnstile opcional.

- Quién ve qué (RLS, roles):
  - RLS activada en las 59 tablas que crean el snapshot `0001` y las migraciones. Roles `admin` / `staff` / `cliente`; `is_staff()` exige `is_active`.
  - `traveler_records`: SELECT solo `admin`; `staff` no tiene política y ve el semáforo `v_parte_estado` sin datos del documento.
  - Escritura de logs, partes, comunicaciones y envíos: solo `service_role` (edge functions). Vistas con `security_invoker`.
  - RPC de gestión `SECURITY DEFINER` con `search_path` fijo y guardia interna (`tjm_puede_gestionar()`: clave de servicio o
    equipo); `anon` solo en las de código de reserva o token (ficha, precheckin, baja, vigía) y en `check_is_admin()`, que
    piden las políticas de lectura pública. El linter de Supabase las sigue listando (0028/0029): es a propósito,
    revisado una a una el 26-oct (migr. `0073`-`0075`). `pg_net` sigue en `public` (no se puede mover sin borrar su cola).
  - Pendiente de Jesús: activar «contraseñas filtradas» en Supabase → Authentication → Sign In / Providers → Email.
  - Edge functions con `verify_jwt = false` (23 de las 25 declaradas en `config.toml`) se defienden dentro: firma HMAC de enlaces (`BOOKING_SIGN_SECRET`),
    firma de webhooks (Stripe, Resend), llave de cron en Vault, clave de servicio. Detalle por función en `docs/TRD.md`.
  - Tabla por tabla: `docs/DATABASE.md`.

- Registro de accesos:
  - `envios` (cada correo y su estado), `mail_import_log`, `channel_sync_log`, `ses_comunicaciones`, `ai_interaction_logs`,
    `consent_log`; `traveler_records.documento_verificado_por/_at` deja constancia de quién verificó el documento (`0014`).
  - Registro de quién lee datos de viajeros o entra al panel: no existe en las migraciones (solo los logs de Supabase Auth).
    Retención de esos logs: pendiente de confirmar.

- Secretos (dónde viven, cuándo se rotan):
  - Front: solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (públicas por diseño), como args del build en EasyPanel.
  - Edge functions: secretos de Supabase (Stripe, Resend, firmas, LLM, Turnstile…; lista de nombres en `docs/TRD.md`).
  - **Vault de Supabase**: 5 credenciales del MIR (`0027`), `ses_cron_token` (`0016`), claves VAPID (`0041`). Las migraciones
    crean el hueco vacío; el valor se carga aparte.
  - GitHub: `EASYPANEL_DEPLOY_WEBHOOK`, `TRIGGER_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_EMAIL`.
  - Trigger.dev: variables de `misterplan-correo` (Gmail IMAP). Local: `.env.local` fuera de git; copia en Vaultwarden.
  - Candado `gitleaks` en `.git/hooks/pre-commit`. Las migraciones `0006`/`0055` llevan la clave **publicable** (no secreta,
    marcada `gitleaks:allow`). Calendario de rotación: pendiente de confirmar.

- Copias y restauración probada:
  - Copias (24-oct-2026): cada noche (04:20 Madrid) la copia del VPS de agentes hace `pg_dump` 17 de `public`, `auth`,
    `storage` y `cron` con el usuario de solo lectura `tjm_copia` (migr. 0070-0071), la cifra con el resto del VPS (gpg
    AES256) y la sube a Drive (7 días). Los ficheros de Storage (fotos, libro-registro) NO van dentro: solo sus datos.
    Si falla, el chivato de las 07:00 lo dice. Script: `clients/_personal/padron-ia/projects/centro-operaciones/vps-backup/`.
  - Restauración probada: 24-oct-2026, 0 errores (52 reservas, 21 fichas, 48 clientes, 2 usuarios); se repite sola el
    primer lunes de cada mes (`simulacro-tjm`, resultado en el parte). Restaurar de verdad = proyecto Supabase nuevo y
    `pg_restore --no-owner --no-privileges`.
  - Retención legal aplicada por la base: partes anonimizados a los 3 años (`tjm-purgar-partes`, mensual) y borrados a 3 años +
    30 días (`prune-traveler-records`); logs del bot 12 meses; historial de cron 7 días.

- Requisitos legales antes del primer dato real (RGPD: encargo, EIPD, registro):
  - Ya hay datos reales en producción. Responsable: el titular del alojamiento (ver `docs/legal/dpa/README.md`).
  - Encargos (art. 28): **Supabase firmado** (21-jun-2026, `docs/legal/dpa/`). Stripe, Resend, Anthropic/AWS y Meta figuran como
    pendientes en ese README; estado actual pendiente de confirmar. Trigger.dev y Google (Gmail): no aparecen.
  - Protocolo de brecha (72 h): `docs/seguridad/protocolo-brecha-datos.md` (vigencia 21-jun-2026, revisión anual).
  - Política de privacidad con plazos de conservación: `/privacidad` (`src/pages/PrivacyPolicy.jsx`).
  - EIPD y registro de actividades de tratamiento: no encontrados en el repo; pendiente de confirmar si existen en el OS.

## Qué falta (visto en el código, sin contrastar con producción)
1. `portal_events`: política `staff_can_manage_events` `FOR ALL USING (true)` sin rol → abierta a `anon` para escribir.
   `client_notifications_read`: SELECT/INSERT/DELETE `USING (true)`. `materials_library`: cualquier autenticado lo edita.
   Son tablas heredadas sin uso (`docs/DATABASE.md`): candidatas a borrar o cerrar.
2. ~~`search_path` mutable, extensiones en `public`, `SECURITY DEFINER` sobrantes para `anon`~~ cerrado el 26-oct (migr. `0073`-`0075`); lo que queda es a propósito (arriba). Antes: 3 `SECURITY DEFINER` ejecutables por `anon`
   (`check_is_admin`, `record_marketing_consent`, `submit_traveler_records`), extensiones en `public`.
3. Cuenta de prueba `staff` creada el 10-sep marcada «borrar al terminar» en el MANIFEST: pendiente de confirmar que se borró.
4. Encargos de tratamiento sin firmar (punto anterior) (la copia y su restauración se probaron el 24-oct).

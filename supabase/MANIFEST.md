# MANIFIESTO — Apartamentos TJM (backend Supabase)

> **Fuente de verdad: PRODUCCIÓN.** Este proyecto se ha construido en gran parte vía
> MCP-directo: el esquema y muchas edge functions se aplicaron/desplegaron contra la BD
> viva, no a través del repo. Este archivo es el índice autoritativo de QUÉ hay desplegado
> de verdad, para no volver a dudar. **Mantener actualizado** al desplegar o crear algo.
>
> - Proyecto Supabase: `nmtukksbzbnuzqsksdmw` (región UE — Fráncfort)
> - MCP UUID (en iAmasters OS): `9cbee830`
> - Última reconciliación: 2026-06-30
> - Para traer el código de una función desplegada al repo: MCP `get_edge_function(slug)`
>   (devuelve `files[].content`). Los despliegues se hacen vía MCP `deploy_edge_function`.

## Edge functions

Leyenda repo: ✅ código en `supabase/functions/<slug>/` · ⬇️ desplegada pero **falta** en repo · ⏸️ en repo pero **NO** desplegada (pendiente).

| Función | Live | verify_jwt | Repo | Qué hace |
|---|---|---|---|---|
| `notify-booking` | v14 | false | ✅ | Aviso de nueva solicitud + email con botones confirmar/rechazar 1-click (firma HMAC), rate-limit por IP, Turnstile opcional |
| `booking-status-update` | v12 | false | ✅ | Confirmar/rechazar reserva desde el enlace firmado del email; sugiere apartamentos alternativos |
| `upload-from-url` | v6 | false | ✅ | Sube una imagen desde una URL al storage |
| `request-review` | v6 | false | ✅ | (cron `daily-request-review`) pide reseña tras la estancia |
| `send-guide` | v5 | false | ✅ | Envía la guía al suscriptor del newsletter (`GuiaSection`) |
| `triage-message` | v3 | **true** | ✅ | Clasifica mensajes del inbox |
| `damage-deposit-action` | v3 | **true** | ✅ | Acción sobre fianza (la fianza está revertida en el front — ver memoria) |
| `monthly-owner-report` | v3 | false | ✅ | Informe mensual al propietario |
| `request-otp` | v3 | false | ✅ | OTP login del área cliente (solicita) |
| `verify-otp` | v3 | false | ✅ | OTP login del área cliente (verifica) |
| `send-booking-email` | v8 | false | ✅ | Emails transaccionales (7 plantillas, Resend, idempotente, RGPD) |
| `sync-ical-imports` | v3 | false | ✅ | Importa calendarios iCal de canales (Booking/Airbnb) |
| `ical-export` | v3 | false | ✅ | Exporta iCal por apartamento (`/ical/{slug}.ics`) |
| `create-payment-session` | v2 | false | ✅ | Stripe Checkout (creada 30-jun) |
| `stripe-webhook` | v2 | false | ✅ | Webhook de Stripe (creada 30-jun) |
| `send-booking-reminders` | v1 | false | ✅ | (cron `daily-booking-reminders`) recordatorios 7d/24h/llegada/salida/reactivación (creada 30-jun) |

### En repo pero NO desplegadas (trabajo pendiente — NO están vivas)
- `bot-chat` — bot IA con RAG (AWS Bedrock). Pendiente: alta AWS + `VITE_BOT_ENABLED=true`.
- `issue-invoice` — factura tras pago. **El `stripe-webhook` la llama**, pero al no estar desplegada no se genera factura (no bloqueante).
- `submit-ses-hospedajes` — parte de viajeros al MIR. Pendiente: certificado MIR (stub).
- `submit-verifactu` — Verifactu AEAT. Pendiente: certificado AEAT (stub).
- `provision-access-code` — código de cerradura por reserva. Pendiente: cerraduras físicas.
- `trigger-reel-render` — render de reels (experimental).

## Crons (pg_cron)

| Job | Schedule (UTC) | Acción |
|---|---|---|
| `expire-booking-holds` | `* * * * *` | `SELECT expire_booking_holds()` — libera holds caducados |
| `cleanup-rate-limits` | `15 3 * * *` | limpia `rate_limits` |
| `prune-ai-interaction-logs` | `15 3 * * *` | retención 12m logs del bot |
| `prune-traveler-records` | `30 3 * * *` | retención partes de viajeros |
| `daily-request-review` | `0 8,9 * * *` | `net.http_post` → `request-review` |
| `daily-booking-reminders` | `0 8 * * *` | `net.http_post` → `send-booking-reminders` (creado 30-jun) |

## Estructura de BD (resumen — el detalle vive en la BD)

- **~44 tablas** en `public`. Núcleo reservas: `guest_bookings` (tabla central, NO `bookings`), `apartments`, `blocked_dates`, `high_seasons`, `pricing_rules` (existe, **no conectada** al motor), `booking_addons`/`addons`, `invoices`, `traveler_records` (DNIs), `customers`/`customer_notes`, `email_subscribers`, `consent_log`, `cleaning_tasks`, `access_codes`, `otp_codes`, `reviews` (0 filas), `blog_posts` (0 filas), `kb_chunks`/`ai_interaction_logs` (bot).
- **RLS**: activada en todas. Tablas sensibles verificadas (30-jun): `traveler_records` y `ai_interaction_logs` → solo `service_role`; `customers`/`customer_notes` → solo admin (`check_is_admin()`); `email_subscribers`/`guest_bookings` → INSERT anónimo, SELECT admin/dueño. **Sin fugas.**
- **RPCs de aplicación** (ignorando las de extensiones pgvector/btree_gist): `check_availability`, `create_booking_hold`, `expire_booking_holds`, `generate_booking_code`, `ensure_customer_exists`, `record_marketing_consent`, `submit_traveler_records`, `issue_invoice`, `schedule_cleaning_on_booking_confirmed`, `search_kb_chunks`, `check_is_admin`/`is_admin`/`is_staff`/`get_auth_role`, `cleanup_expired_otps`, `cleanup_old_rate_limits`, `prune_ai_interaction_logs`, `prune_traveler_records`, `set_updated_at`.
- **Triggers de aplicación**: `guest_bookings_ensure_customer`, `guest_bookings_schedule_cleaning`, y varios `*_set_updated_at` (cleaning_tasks, invoices, kb_chunks, pricing_rules, protocols, traveler_records).
- **Extensiones**: `pgvector` (bot RAG), `pg_cron`, `pg_net`, `btree_gist`.

## Estado de reconciliación
- ✅ **2026-06-30**: las 16 edge functions vivas tienen su código en el repo (las 10 que faltaban se trajeron de producción vía `get_edge_function`). El repo ya es espejo de producción a nivel de funciones.

## Pendiente de versionar (deuda de cimientos restante)
- Sin carpeta `migrations/`: el **esquema** sigue sin versionar como migraciones. Siguiente paso: snapshot SQL del esquema + RLS + RPCs + triggers en `supabase/migrations/` o `supabase/snapshot/` (este MANIFEST ya documenta el inventario).
- Las 6 funciones ⏸️ del repo (bot-chat, issue-invoice, submit-ses-hospedajes, submit-verifactu, provision-access-code, trigger-reel-render) siguen SIN desplegar (trabajo pendiente, no desfase).

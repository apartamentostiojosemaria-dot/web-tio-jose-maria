# Documento técnico — tio-jose-maria

> Stack, arquitectura, integraciones y despliegue. «Si no está en la arquitectura, no existe».
> Inventario vivo de funciones y crones en producción: `supabase/MANIFEST.md` (última reconciliación 10-sep-2026; lo
> posterior a la migración 0025 no está reflejado allí). Reglas de código: `CLAUDE.md`. Revisado 16-oct-2026.

## Stack
- **Front**: React 19 + Vite 7 + Tailwind CSS 4, JSX sin TypeScript. Router `react-router-dom` 7, `framer-motion`,
  `lucide-react`, `recharts`, Leaflet (mapa con OpenStreetMap desde 28-sep, commit `9d00157`), PWA con `vite-plugin-pwa`.
- **Build**: `scripts/generate-sitemap.js` → `vite build` → `scripts/prerender.js` (puppeteer, rutas críticas).
- **Back**: Supabase (Postgres + Auth + Storage + Edge Functions en Deno), región UE (Fráncfort). Extensiones: `pg_cron`,
  `pg_net`, `pgvector`, `btree_gist`. Esquema y RLS: `docs/DATABASE.md`.
- **Jobs fuera de la base**: Trigger.dev v4 (`tjm-jobs/`, runtime node-24), una sola tarea viva.
- **Servir**: Docker multi-stage (node:20-alpine + chromium del sistema → nginx:alpine), cabeceras en `security-headers.conf`.

## Arquitectura (piezas y cómo hablan)
1. **Web pública (SPA)** → lee con la clave publicable y RLS (`apartments`, `pricing_rules`, contenido) y llama a RPC
   (`check_availability`, `create_booking_hold`, `record_marketing_consent`, `tjm_precheckin_reserva`, `tjm_ficha_huesped`…).
2. **Reserva directa**: `create_booking_hold` (retención 15 min, `expire-booking-holds` cada minuto) →
   `create-payment-session` (Stripe Checkout, importe total) → `stripe-webhook` confirma, apunta el cobro y dispara factura.
3. **Panel `/panel`** (familia) y **`/admin`** (Jesús): login sin contraseña por código al correo (`request-otp` → `verify-otp`
   → magic link). Gestión vía RPC `SECURITY DEFINER` con guardia de rol (`create_manual_booking`, `move_booking`,
   `cancel_booking`, `register_payment`, `marcar_no_show`…).
4. **Canales**: importación iCal (`sync-ical-imports`, pg_cron cada 15 min) y exportación (`ical-export`, `/ical/{slug}.ics`).
   MisterPlan sigue avisando por correo → `misterplan-correo` (Trigger.dev, IMAP, cada 10 min). Detalle: `docs/CANALES.md`.
5. **Ministerio (SES.HOSPEDAJES, RD 933/2021)**: pg_cron → `tjm_disparar_ses()` → `submit-ses-hospedajes` (SOAP + HTTP basic).
   Detalle: `docs/PARTE-VIAJEROS.md`, `docs/CHECKIN-LEGAL.md`.
6. **Correos**: un solo despachador (`send-booking-reminders` → `send-booking-email`, Resend), estado real por `resend-webhook`
   firmado (tabla `envios`) y vigilancia diaria del dominio (`salud_correo`). Avisos al móvil: `push-enviar` (Web Push, VAPID).

## Edge functions (27 carpetas en `supabase/functions/`, 26 + `_shared`)
| Grupo | Funciones |
|---|---|
| Reserva y cobro | `notify-booking`, `booking-status-update`, `create-payment-session`, `stripe-webhook`, `damage-deposit-action` (fianza retirada del front, `ea0d98f`) |
| Huésped | `request-otp`, `verify-otp`, `enlace-guia`, `documento-admision` (PDF art. 24 Decreto 194/2010), `send-guide`, `request-review` |
| Correo y avisos | `send-booking-email`, `send-booking-reminders`, `resend-webhook`, `push-enviar`, `monthly-owner-report` |
| Canales | `sync-ical-imports`, `ical-export` |
| Legal y fiscal | `submit-ses-hospedajes`, `issue-invoice` (serie A, IVA 10 %), `submit-verifactu` (modo stub) |
| IA y contenido | `bot-chat` (apagado: `VITE_BOT_ENABLED`), `triage-message`, `upload-from-url`, `trigger-reel-render` |
| Sin uso | `provision-access-code` (cerraduras; check-in 100 % en persona desde `7f23a5e`) |
- `verify_jwt` por función en `supabase/config.toml`: 25 declaradas, todas `false` salvo `triage-message` y
  `damage-deposit-action`; `resend-webhook` no está declarada.
  `issue-invoice` figura `true` en el MANIFEST y `false` en `config.toml`: **pendiente de confirmar** en producción.
- Según MANIFEST (10-sep) sin desplegar: `bot-chat`, `submit-verifactu`, `provision-access-code`, `trigger-reel-render`.

## Tareas programadas
**pg_cron** (definidos en migraciones; los seis primeros vienen del snapshot `0001`, documentados, no versionados):
| Job | UTC | Qué |
|---|---|---|
| `expire-booking-holds` | `* * * * *` | libera retenciones caducadas |
| `daily-booking-reminders` | `0 8 * * *` | `send-booking-reminders` (único despachador desde `0033`) |
| `daily-request-review` | `0 8,9 * * *` | `request-review` |
| `cleanup-rate-limits` · `prune-ai-interaction-logs` | `15 3 * * *` | limpieza |
| `prune-traveler-records` | `30 3 * * *` | retención de partes |
| `tjm-sincronizar-canales` | `*/15 * * * *` | `sync-ical-imports`, tope 150 s (`0055`, 9-oct) |
| `tjm-vigilar-canales` | `7 * * * *` | avisa si un canal pasa 2 h sin pasada correcta (`0006`) |
| `tjm-ses-reservas` | `23 * * * *` | comunica reservas y anulaciones pendientes (`0010`) |
| `tjm-parte-viajeros` | `0 8 * * *` | parte de las entradas del día anterior (`0010`) |
| `tjm-parte-acuses` | `15 9 * * *` | lee acuses del MIR (`0042`) |
| `tjm-purgar-partes` | `40 3 1 * *` | anonimiza partes > 3 años (`0010`) |
| `tjm-vigilar-correo` | `30 7 * * *` | salud del dominio de correo (`0043`) |
| `tjm-purgar-historial-cron` | `45 3 * * *` | borra `cron.job_run_details` > 7 días (`0051`) |

**Trigger.dev** (`tjm-jobs`, proyecto `proj_azldqeufdufzorjzhnkk`): solo `misterplan-correo` (cada 10 min). Retiradas a pg_cron:
`daily-ses-submit` (11-sep, `bced9b0`), `daily-booking-emails` (18-sep, `0033`), `sync-ical-channels` (9-oct, `9c24d6b`).
Regla: lo que puede correr en la base corre en pg_cron; nunca dos crones para lo mismo.

## Integraciones (una ficha por servicio externo)
Solo nombres de variable; los valores no se escriben aquí. Los secretos de funciones están en Supabase → Edge Functions →
Secrets salvo los marcados «Vault».
| Servicio | Datos que entran/salen | Dónde vive la clave | Límite | Si falla | Quién paga |
|---|---|---|---|---|---|
| Stripe | Checkout, cargo, últimos 4 dígitos y titular para el parte | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | pendiente de confirmar | el webhook siempre responde 200; si falla la factura deja tarea en `internal_tasks` | pendiente de confirmar |
| Resend | correos transaccionales, OTP, eventos de entrega | `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET` | pendiente de confirmar | `envios` guarda el estado real; `tjm-vigilar-correo` avisa | pendiente de confirmar |
| SES.HOSPEDAJES (MIR) | reservas, anulaciones, partes (XML/SOAP) | 5 credenciales en **Vault** (`0027`); llave de cron `ses_cron_token` en Vault (`0016`) | plazo legal 24 h | reintenta y avisa en el panel; estado `aparcado` para atrasos | — |
| Portales iCal (Airbnb, Booking, EscapadaRural, CasasRurales.net, Holidu) | ocupación entrante/saliente | URLs en `apartments.*_ical_url` | tope 150 s por pasada | vigilante horario; feed vacío no cancela (`a9b71f6`) | — |
| Gmail del negocio (IMAP) | correos de MisterPlan | variables de `tjm-jobs` en Trigger.dev / Vaultwarden (`docs/OPERATIVA.md`) | — | fallos vigilados por Hermes cada hora | — |
| Trigger.dev | ejecución de `misterplan-correo` | `TRIGGER_ACCESS_TOKEN` (secreto de GitHub) | `maxDuration` 300 s, 3 reintentos | correo de Trigger.dev | Padrón IA (org) — pendiente de confirmar |
| Web Push | avisos al móvil del panel | claves VAPID en **Vault** (`0041`) | — | pendiente de confirmar | — |
| Cloudflare Turnstile | antispam del formulario | `TURNSTILE_SECRET` (opcional) | — | se omite si no hay clave | — |
| AWS Bedrock / Anthropic / OpenAI | bot y triage del inbox | `AWS_BEDROCK_*`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `LLM_PROVIDER` | `BOT_RATE_LIMIT_PER_SESSION` | bot apagado por defecto | pendiente de confirmar |
| AEAT Verifactu | registro de facturas | `AEAT_VERIFACTU_ENDPOINT` (sin poner → stub) | — | `VERIFACTU_ENABLED = false` | — |
| GitHub Actions | renders Remotion (hero, reel de reseña, vídeo de bienvenida) | `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` en secretos del repo | — | — | — |
| Google Business Profile / Search Console | ficha y verificación | — | — | — | `docs/GOOGLE_BUSINESS_PROFILE.md` |
| INE (EOTR-21) | encuesta mensual, cálculo en la base | — | — | tarea en `internal_tasks` | `docs/INE.md` |

## Despliegue
- **Web**: cada push a `main` → `.github/workflows/deploy.yml` llama al webhook de EasyPanel (`EASYPANEL_DEPLOY_WEBHOOK`) y
  espera hasta 25 min a que `Last-Modified` de `tiojosemaria.com` cambie; si no cambia, el run sale en rojo (desde 23-sep, `fb02356`).
  EasyPanel construye el `Dockerfile` (args `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). TLS lo termina Traefik.
- **tjm-jobs**: push a `main` que toque `tjm-jobs/**` → `deploy-trigger.yml` (`npm test` + `trigger.dev@4.5.16 deploy --env prod`).
- **Edge functions y migraciones**: por MCP de Supabase (`deploy_edge_function`, `apply_migration`); un solo agente aplica DDL.
  Ver `supabase/MANIFEST.md`.
- **Caducidad de tokens** (EasyPanel, Trigger.dev): pendiente de confirmar.
- **Volver atrás**: web → revertir el commit y push (o redeploy en EasyPanel); funciones → redeplegar la versión anterior del
  repo; esquema → migración nueva que deshace (no hay `down`). Procedimiento probado: pendiente de confirmar.

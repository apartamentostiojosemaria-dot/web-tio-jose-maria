# Operativa pendiente — Apartamentos TJM

> Acciones manuales que el operador debe ejecutar fuera del código.
> Actualizado: 2026-06-22 (v2 — sin MisterPlan).

## Decisión estratégica vigente

TJM construye un **sistema propio autónomo**. **No** se integra con MisterPlan;
el objetivo a medio plazo es **dejar de pagar MisterPlan** una vez el sistema
propio cubra reservas + ficha policial (SES.HOSPEDAJES) + INE + facturación.

Ver memoria `project-tio-jose-maria-sistema-propio` para el racional completo.

## 1. Push de los commits locales al repositorio

Los commits están en local pero no pusheados. El push requiere la cuenta
GitHub `apartamentostiojosemaria-dot` (no `padron-ia`).

```bash
gh auth switch -u apartamentostiojosemaria-dot
git push origin main
```

Easypanel detecta el push y despliega automáticamente.

## 2. Bot IA — activación en producción

### 2.1. AWS — crear IAM user para Bedrock UE

En la consola AWS:

1. IAM → Users → Create user → nombre `tjm-bedrock`.
2. **No** asignar permisos de consola.
3. Adjuntar la siguiente política inline (JSON):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock:InvokeModel"],
    "Resource": [
      "arn:aws:bedrock:eu-central-1::foundation-model/amazon.titan-embed-text-v2:0",
      "arn:aws:bedrock:eu-central-1::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
      "arn:aws:bedrock:eu-central-1:*:inference-profile/eu.anthropic.claude-sonnet-4-5-20250929-v1:0"
    ]
  }]
}
```

4. Crear access key (Use case: "Application running outside AWS"). Anotar:
   - `AWS_BEDROCK_ACCESS_KEY_ID`
   - `AWS_BEDROCK_SECRET_ACCESS_KEY`

### 2.2. AWS — habilitar acceso a los modelos en Bedrock

Consola AWS → Bedrock → en eu-central-1 → "Model access" → "Manage model
access" → activar:

- **Amazon Titan Text Embeddings V2** (provider Amazon)
- **Claude Sonnet 4.5** (provider Anthropic, modo cross-region inference EU)

Anthropic puede pedir info del caso de uso. Ejemplo aceptable:

> "Chatbot informativo para huéspedes de una vivienda turística rural.
> Sólo responde preguntas sobre el alojamiento, el pueblo y la zona usando
> contenido público. No procesa datos personales sensibles. Disclaimer
> art. 50 AI Act + logging anonimizado 12m."

### 2.3. Supabase — añadir secrets a Edge Functions

Panel Supabase (proyecto TJM `nmtukksbzbnuzqsksdmw`) → Edge Functions →
Secrets:

| Secret | Valor |
|---|---|
| `AWS_BEDROCK_ACCESS_KEY_ID` | (el de 2.1) |
| `AWS_BEDROCK_SECRET_ACCESS_KEY` | (el de 2.1) |
| `BOT_RATE_LIMIT_PER_SESSION` | `30` (opcional, default 30 turnos/sesión/día) |

### 2.4. Desplegar la edge function

```bash
supabase functions deploy bot-chat --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
```

### 2.5. Cargar el knowledge base inicial

En local, con `.env.local` configurado:

```
VITE_SUPABASE_URL=https://nmtukksbzbnuzqsksdmw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
AWS_BEDROCK_ACCESS_KEY_ID=AKIA...
AWS_BEDROCK_SECRET_ACCESS_KEY=...
```

Ejecutar:

```bash
node scripts/index-kb.mjs           # incremental
node scripts/index-kb.mjs --reindex # reset total
```

Coste estimado de la carga inicial: ~8-15k tokens ≈ **$0.001** con Titan v2.

### 2.6. Probar el bot

1. Recarga la web.
2. Botón flotante esquina inferior izquierda.
3. Disclaimer AI Act art.50 al abrir + 4 preguntas sugeridas.
4. Hacer una pregunta. Debe responder en castellano con fuentes citadas.

Si falla, revisar Supabase → Edge Functions → bot-chat → Logs.

## 3. Sprint 4 — Lighthouse + WCAG en deploy real

Una vez el push esté en producción:

1. **Lighthouse**: pagespeed.web.dev sobre `tiojosemaria.com`. Objetivo 95+
   en las 4 dimensiones.
2. **aXe** extensión Chrome sobre /, /hinojares, /rutas, /eventos, /reservar,
   /privacidad, /aviso-legal. Anotar issues y resolver.

## 4. Pack legal — confirmar

- **DPA Supabase**: portal Supabase → Settings → Data Privacy → firmar.
- **Procedimiento brecha 72h AEPD**: documento interno (Google Doc/PDF):

```
PROCEDIMIENTO DE NOTIFICACIÓN DE BRECHAS — Apartamentos Tío José María

Responsable: Jesús Martínez Sánchez (NIF 26433801Q)
Fecha de adopción: 2026-06-22

1. Al detectar una brecha: documentar fecha, hora, naturaleza, datos
   afectados, número aproximado de interesados.
2. Aislar el sistema, cambiar credenciales comprometidas.
3. En 24h: análisis preliminar. Si entraña riesgo: preparar notificación AEPD.
4. En menos de 72h desde la detección: notificación a la AEPD vía
   sedeagpd.gob.es.
5. Si riesgo alto: notificación directa al interesado afectado.
6. Conservar registro interno 5 años (art. 33.5 RGPD).
```

## 5. Sprint 5c — Stripe Checkout (acabado a nivel código)

Las edge functions `create-payment-session` y `stripe-webhook` están listas.
Para activarlas:

### 5.1. Crear cuenta Stripe (test)

1. dashboard.stripe.com → Sign up → modo Test por defecto.
2. Settings → API keys → copiar `Secret key` (`sk_test_...`).

### 5.2. Configurar webhook

1. Stripe Dashboard → Developers → Webhooks → "Add endpoint".
2. URL: `https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/stripe-webhook`
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
4. Copiar el **Signing secret** (`whsec_...`).

### 5.3. Secrets en Supabase Edge Functions

| Secret | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` (o `sk_live_...` en producción) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `PUBLIC_SITE_URL` | `https://tiojosemaria.com` |

### 5.4. Desplegar

```bash
supabase functions deploy create-payment-session --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
supabase functions deploy stripe-webhook        --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
```

### 5.5. Probar end-to-end

1. En `/reservar` hacer una búsqueda y reserva con tarjeta de prueba:
   `4242 4242 4242 4242`, fecha futura, CVC 123.
2. Stripe redirige a `/reservar/confirmada?code=TJM-XXXXXX`.
3. La página hace polling de la BD durante ~10s hasta que el webhook
   marca `status=confirmed`.
4. Verificar en Stripe Dashboard → Events que el webhook devolvió 200.

### 5.6. Saltar a producción

Cuando estés listo: en Stripe activar cuenta real, copiar `sk_live_...` y
`whsec_...` de producción a las secrets de Supabase, redeploy.

## 6. Sprint 6 — Email automation (Resend + Trigger.dev)

### 6.1. Resend

1. Crear cuenta en resend.com (o usar la que ya tienes en OFM con multi-dominio).
2. Añadir dominio `tiojosemaria.com`. Resend te da 3 registros DNS (SPF
   TXT + DKIM CNAME + return-path CNAME). Configurarlos donde tengas el
   DNS de TJM (Cloudflare, registrador, etc.).
3. Esperar verificación (5-20 min). Cuando esté verde, copiar la API key.
4. Crear identidad "hola@tiojosemaria.com" o usar la del dominio raíz.

### 6.2. Supabase secrets

| Secret | Valor |
|---|---|
| `RESEND_API_KEY` | `re_...` |

### 6.3. Desplegar edge function

```bash
supabase functions deploy send-booking-email --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
```

### 6.4. Trigger.dev — proyecto `tjm-jobs`

> **Proyecto DEDICADO**, no reutilizar cuidarte-jobs ni ofm/padron-ia-jobs:
> cada negocio con su instancia Supabase y su service-role key aislada
> (misma regla que "nunca mezclar" del ecosistema). Ver decisión 2026-07-01.
>
> Código ya migrado a **Trigger.dev v4** (SDK 4.4.6). Deps `@supabase/supabase-js`
> y `ws` (polyfill WebSocket Node 21) incluidas. `tsc --noEmit` limpio.

> **ESTADO 2026-07-01 — DESPLEGADO, crons neutralizadas.**
> - Proyecto creado: `tjm-jobs` (ref `proj_azldqeufdufzorjzhnkk`, org padron-ia).
> - Env vars Production puestas: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (secret).
> - Desplegado (`trigger deploy`, versión 20260701.2, 3 tasks).
> - **Los `cron` de las 3 tasks están COMENTADOS** → no se disparan solas. Motivo:
>   las edge functions que llaman (`submit-ses-hospedajes`, `sync-ical-imports`,
>   `send-booking-email` + vistas) **NO están desplegadas en el Supabase de TJM**
>   → un test-run de `daily-ses-submit` dio **HTTP 404 NOT_FOUND**. Se neutralizaron
>   para no quemar la cuota Free con 404 en bucle (sync-ical era cada 30 min).
> - **REACTIVAR** (cuando el backend TJM esté desplegado): descomentar el bloque
>   `cron` en `src/trigger/*.ts` + `npm run deploy`. Reaparecen en Schedules.

1. cloud.trigger.dev → org `padron-ia` → New Project → nombre `tjm-jobs`.
   Anotar el `project ref` (forma `proj_xxx_xxx`).
2. En el dashboard del proyecto → Environment Variables (entorno **Production**)
   → añadir:
   - `SUPABASE_URL` = `https://nmtukksbzbnuzqsksdmw.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (service role TJM)
3. Fijar el `project ref` en `trigger.config.ts` (línea `project:`), sustituyendo
   `proj_REPLACE_ME` por el ref real. (Alternativa sin tocar el archivo: exportar
   `TRIGGER_PROJECT_REF=proj_xxx_xxx` en la shell antes de `deploy` — la config lo
   lee.) El ref NO es secreto.
4. En local (`tjm-jobs/`):
   ```bash
   cd tjm-jobs
   npm install                    # ya hecho; repetir si cambia package.json
   npx trigger.dev@latest login   # OAuth por navegador
   npm run dev                    # probar local (opcional)
   npm run deploy                 # subir a cloud (usa trigger.config.ts)
   ```
5. Verificar en dashboard que aparecen las 3 tasks programadas:
   - `daily-booking-emails` — cron `0 9 * * *` (Europe/Madrid)
   - `daily-ses-submit` — cron `0 10 * * *` (Europe/Madrid)
   - `sync-ical-channels` — cron `*/30 * * * *`

> ⚠️ Node 21 no tiene WebSocket nativo → `daily-booking-emails` lleva polyfill `ws`
> antes de `createClient`. Los gotchas de supabase-js/Trigger.dev solo se ven en
> **test run real** desde el dashboard, no en el typecheck. Probar así antes de
> darlo por bueno.
>
> **Orden de activación real:** `daily-ses-submit` ya trabaja (stub mode) en cuanto
> despliegues. `daily-booking-emails` no tiene cola hasta que Stripe esté en live
> (sin reservas, cola=0, no rompe). `sync-ical-channels` está en vacío hasta cargar
> las URLs iCal en `apartments` (bloqueado por 2FA de Booking).

### 6.5. Probar end-to-end

1. Crear reserva de prueba en `/reservar` y completar pago (tarjeta test).
2. El webhook Stripe debe disparar la edge `send-booking-email` con
   `template: confirmation` → email llega en segundos.
3. Para probar los recordatorios sin esperar al cron real, en
   cloud.trigger.dev → tasks → `daily-booking-emails` → "Test task".

## 7. Sprint 7 — SES.HOSPEDAJES (RD 933/2021)

### 7.1. Trámites del operador (bloquean activación real)

Sin estos dos pasos el sistema corre en STUB MODE: genera el XML del parte,
lo guarda en `traveler_records.mir_response_payload` y marca `submitted_at`
con status=`stub_no_credentials`. Esto sirve para validar el flujo y los
datos, pero NO transmite al MIR.

1. **Certificado digital FNMT** de Jesús Martínez Sánchez (persona física).
   - cl.sede.fnmt.gob.es → "Obtenga su certificado de Persona Física".
   - Validación presencial: AEAT o Ayuntamiento de Hinojares (cita previa).
   - Plazo realista: 1-2 semanas.
2. **Alta como sujeto obligado** en sede.mir.gob.es:
   - Web → Servicios → Hospedajes → arrendador de vivienda turística (VTAR).
   - Acceso con el certificado del paso 1.
   - Obtienes: usuario, clave de panel, **código de establecimiento**, y
     credenciales API (cert.cliente para conexión M2M).
3. Solicitar el **certificado de cliente API** (separado del FNMT personal).
   Lo emite el MIR para conexiones máquina-a-máquina contra su API.

### 7.2. Despliegue del módulo (cuando los trámites estén)

Secrets en Supabase Edge Functions:

| Secret | Valor |
|---|---|
| `SES_API_ENDPOINT` | `https://sede.mir.gob.es/ses-hospedajes/api/v1/comunicaciones` (producción) |
| `SES_ESTABLISHMENT_CODE` | el código que da el MIR al alta |
| `SES_CLIENT_CERT_PEM` | certificado X.509 PEM del cert.cliente |
| `SES_CLIENT_KEY_PEM` | clave privada PEM |

```bash
supabase functions deploy submit-ses-hospedajes --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
```

En `tjm-jobs/` (Trigger.dev): la task `daily-ses-submit` ya está definida
(cron diario 10:00 Madrid). Se despliega junto con `npm run deploy`.

### 7.3. Hasta entonces — STUB MODE

Sin `SES_API_ENDPOINT` configurado, la edge function:

1. Recoge los `traveler_records` con `submitted_at IS NULL` cuyo booking ya
   tenga `check_in <= hoy`.
2. Genera el XML completo del Anexo III RD 933/2021.
3. Lo guarda en `mir_response_payload` y marca `submitted_at` con
   `mir_response_status = stub_no_credentials`.

Esto te permite validar que los datos del formulario son correctos antes
de tener la integración real. Cuando llegue el cert.cliente, simplemente
configuras `SES_API_ENDPOINT` y `SES_*_CERT` y los siguientes envíos van
de verdad al MIR.

## 8. Sprint 8 — Channel Manager iCal bidireccional

### 8.1. Importación (canales → nosotros)

Configura en `apartments` las URLs iCal de tus listings. Las puedes obtener:

- **Booking**: Extranet → Habitación → Conectividad iCal → URL "exportar".
- **Airbnb**: Calendar → Availability settings → Export iCal.
- **Vrbo / casasrurales / Ruralka**: cada uno en su panel.

Mete cada URL en la columna correspondiente de `apartments`:

```sql
UPDATE apartments SET
    airbnb_ical_url = 'https://www.airbnb.es/calendar/ical/XXXXX.ics?s=...',
    booking_ical_url = 'https://ical.booking.com/v1/export?...'
WHERE slug = 'albahaca';
```

La task `sync-ical-channels` (Trigger.dev, cada 30min) reconcilia los
bloqueos automáticamente en `blocked_dates`. `check_availability` ya los
excluye.

### 8.2. Exportación (nosotros → canales)

URL pública por apartamento:

```
https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/ical-export?slug=albahaca
```

Mete esta URL como "import iCal" en Booking, Airbnb y los demás. A partir
de ahí, todas las reservas que entren por tu motor propio aparecerán
ocupadas en los canales también.

### 8.3. Desplegar

```bash
supabase functions deploy sync-ical-imports --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
supabase functions deploy ical-export       --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
```

Reseteo manual si hace falta (borra blocked_dates de un source y rehace sync):

```sql
DELETE FROM blocked_dates WHERE source IN ('airbnb', 'booking');
```

## 9. Sprint 9 — Facturación + Verifactu

### 9.1. Trámites del operador (para envío real a AEAT)

1. **Certificado fiscal AEAT** (puede ser el mismo certificado digital FNMT
   del titular si ya lo tiene del Sprint 7).
2. **Alta en Verifactu** en sede.agenciatributaria.gob.es → Verifactu.
   AEAT te da credenciales para conectar a su API de Registro de
   Facturación.
3. Anotar la URL del **endpoint de pruebas** y la de **producción**.

### 9.2. Stub mode (mientras tanto)

Sin `AEAT_VERIFACTU_ENDPOINT` configurado, las facturas se crean con la
numeración correlativa correcta y el hash chain Verifactu calculado, pero
NO se envían al AEAT. `verifactu_status='stub'` queda registrado y el XML
de envío está disponible en `verifactu_response.xml` para auditoría.

Esto te permite operar legalmente con facturas emitidas correctamente
(numeración + datos + IVA 10% turismo) mientras formalizas el alta AEAT.

### 9.3. Secrets cuando los trámites estén

| Secret | Valor |
|---|---|
| `AEAT_VERIFACTU_ENDPOINT` | URL del web service AEAT (pruebas o prod) |
| `AEAT_FISCAL_CERT_PEM` | certificado X.509 PEM del titular |
| `AEAT_FISCAL_KEY_PEM` | clave privada PEM |

### 9.4. Desplegar

```bash
supabase functions deploy issue-invoice    --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
supabase functions deploy submit-verifactu --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
```

`stripe-webhook` ya está conectado: tras `checkout.session.completed`
dispara automáticamente `issue-invoice` (fire-and-forget), que a su vez
llama a `submit-verifactu`.

### 9.5. Consulta de facturas

```sql
SELECT serie, numero, fecha_emision, total, verifactu_status
FROM invoices
ORDER BY fecha_emision DESC, numero DESC
LIMIT 20;
```

PDF: pendiente de iteración futura (Sprint 11). De momento la factura
existe como registro fiscal completo en BD; envío al huésped por email
manual desde el panel admin si lo pide.

## 10. Sprint 10 — Operaciones (limpieza + cerraduras + revenue)

### 10.1. Limpieza/turnover

Cada vez que una reserva pasa a `status='confirmed'`, un trigger BD crea
automáticamente una `cleaning_tasks` para el día de check_out. Estructura:

```sql
SELECT scheduled_date, apartment_id, status, assigned_to
FROM cleaning_tasks
WHERE scheduled_date >= current_date
ORDER BY scheduled_date;
```

La UI admin de gestión de limpieza queda pendiente (iteración futura).
De momento, consultas directas con SQL desde el panel Supabase.

### 10.2. Cerraduras electrónicas

Mapeo apartamento → cerradura:

```sql
UPDATE apartments SET lock_provider = 'nuki', lock_device_id = '17....'
WHERE slug = 'albahaca';
```

Providers soportados:

- **Nuki** — secret `NUKI_API_TOKEN` (Account API → Web Settings → API). Listo
  para producción en cuanto haya cerraduras instaladas.
- **TTLock** — shape preparado (`TTLOCK_*` secrets). La integración real
  se cierra cuando se instale la primera cerradura física (requiere OAuth
  con username+password MD5).
- **manual** — genera código de 6 dígitos al confirmar reserva pero no
  hace nada físico; útil para validar flujo o cerraduras tipo CISA con
  panel de números cambiables.

Despliegue:

```bash
supabase functions deploy provision-access-code --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
```

Disparo (a integrar en stripe-webhook iteración futura, o manual desde
admin):

```bash
curl -X POST .../provision-access-code -d '{"bookingCode":"TJM-XXXXXX"}'
```

### 10.3. Pricing rules (revenue management)

Tabla `pricing_rules` con 5 tipos:

- `weekend_premium` — multiplier o flat_extra los días de `weekday_mask`
- `last_minute` — descuento si la reserva es a <N días del check_in
- `early_bird` — descuento si la reserva es a >N días del check_in
- `min_nights` — fuerza estancia mínima en temporada
- `occupancy_boost` — sube precio si la ocupación del apartamento >% en ese mes

Insertar reglas vía SQL. La aplicación al motor de reservas
(`check_availability`) queda pendiente: por ahora el motor sigue usando
`price_low/price_high + high_seasons`, y `pricing_rules` está disponible
para iteración cuando quieras activarlas.

## 11. Roadmap pendiente

El alojamiento sigue pagando MisterPlan hasta que el sistema propio lo cubra.
Sprints adicionales planificados en `brief.md` (sección "Sprints PENDIENTES"):

- **Sprint 5 (~1-2 sem)** — Motor de reservas propio + Stripe/Redsys
- **Sprint 6 (~1 sem)** — Email automation (Trigger.dev + Resend)
- **Sprint 7 (~2 sem)** — SES.HOSPEDAJES API MIR + INE + DPIA
- **Sprint 8 (~2 sem)** — Channel manager iCal (Booking, Airbnb, Vrbo, Ruralka)
- **Sprint 9 (~1 sem)** — Facturación + Verifactu (obligatorio 2026)
- **Sprint 10 (~1-2 sem)** — Limpieza/turnover + Revenue management + Cerraduras (TTLock/Nuki)
- **Sprint 11 (~1 sem)** — WhatsApp Cloud API + reporting + galería pro

**Hito clave**: cuando Sprint 5 + 7 + 9 estén cerrados → MisterPlan se puede
cancelar y el alojamiento opera 100% autónomo.

## 6. Pendientes operativos del Sprint 7 (SES.HOSPEDAJES) — anticipar

Para construir el envío automático al MIR hace falta:

- **Certificado digital de Jesús Martínez Sánchez** (FNMT o DNIe activo).
  Trámite: cl.sede.fnmt.gob.es → "Obtenga su certificado" → validación
  presencial en oficina AEAT o Ayuntamiento.
- **Alta como sujeto obligado** en sede.mir.gob.es → Hospedajes →
  arrendador de vivienda turística. Da usuario + clave + acceso API.
- **Credenciales API** del MIR (las da el alta, sección "API/Servicios web").

Hasta que esto esté, el flujo SES.HOSPEDAJES se construye contra entorno de
pruebas del MIR.

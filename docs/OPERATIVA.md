# Operativa pendiente — Apartamentos TJM

> Acciones manuales que el operador debe ejecutar fuera del código.
> Actualizado: 2026-06-22.

## 1. Push de los commits locales al repositorio

Los commits `967da79`, `b5e2ef6` y `26c0da7` están en local pero no pusheados.
El push requiere la cuenta GitHub `apartamentostiojosemaria-dot` (no `padron-ia`,
que da 403 en este repo).

```bash
gh auth switch -u apartamentostiojosemaria-dot
git push origin main
```

Easypanel detecta el push y despliega automáticamente.

## 2. MisterPlan — verificación y conexión

### 2.1. Verificar que la integración "Guardia Civil" está activa

En el panel MisterPlan (mrplan.es) del alojamiento, buscar en el menú o
configuración la integración llamada **Guardia Civil** o **Ficha policial**.
Esto es lo que cumple el RD 933/2021 (SES.HOSPEDAJES). Si no está activa,
contactar soporte MisterPlan (info@misterplan.es / +34 912 690 102) para que
la habiliten.

### 2.2. Pedir la URL del motor de reservas

En MisterPlan: panel del alojamiento → módulo "Motor de Reservas". Allí debe
haber un código de integración o una URL pública del motor (algo del estilo
`motor.misterplan.es/?hotel=570568` o similar).

Cuando la tengas, **añadirla al `.env` del proyecto** como:

```
VITE_BOOKING_ENGINE_URL=https://motor.misterplan.es/...
VITE_BOOKING_ENGINE_HEIGHT=900
```

La página `/reservar` la cargará automáticamente como iframe. Hasta que no
esté, `/reservar` muestra un placeholder con CTA a WhatsApp y teléfono.

### 2.3. Preguntar a comercial MisterPlan por API REST y webhooks

```
Para: info@misterplan.es
Asunto: Integración técnica MisterPlan ↔ web custom — TJM

Hola,

Soy [nombre] del equipo de Apartamentos Tío José María (cliente MisterPlan,
alojamiento ID 570568 / VTAR/JA/00044).

Estamos construyendo una web nueva en React custom (no WordPress). El plugin
WordPress no nos sirve. Querríamos saber si tenéis disponibles:

1. API REST documentada para consultar disponibilidad, tarifas y crear/leer
   reservas desde código.
2. Webhooks de eventos (reserva creada, modificada, cancelada, checkin
   completado).
3. Condiciones técnicas / precio adicional / requisitos.

La intención es renderizar el motor en iframe inicialmente y, si la API está
disponible, integrar de forma más limpia en una segunda fase.

Gracias.
```

## 3. Bot IA — activación en producción

### 3.1. AWS — crear IAM user para Bedrock UE

En la consola AWS (cualquier región, eu-central-1 si la cuenta es europea):

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

### 3.2. AWS — habilitar acceso a los modelos en Bedrock

Consola AWS → Bedrock → en eu-central-1 → "Model access" → "Manage model
access" → activar:

- **Amazon Titan Text Embeddings V2** (provider Amazon)
- **Claude Sonnet 4.5** (provider Anthropic, modo cross-region inference EU)

Anthropic puede pedir info del caso de uso. Ejemplo de descripción aceptable:

> "Chatbot informativo para huéspedes de una vivienda turística rural.
> Sólo responde preguntas sobre el alojamiento, el pueblo y la zona usando
> contenido público. No procesa datos personales sensibles. Disclaimer
> art. 50 AI Act + logging anonimizado 12m."

### 3.3. Supabase — añadir secrets a Edge Functions

Panel Supabase (proyecto TJM `nmtukksbzbnuzqsksdmw`) → Edge Functions →
Secrets:

| Secret | Valor |
|---|---|
| `AWS_BEDROCK_ACCESS_KEY_ID` | (el de 3.1) |
| `AWS_BEDROCK_SECRET_ACCESS_KEY` | (el de 3.1) |
| `BOT_RATE_LIMIT_PER_SESSION` | `30` (opcional, default 30 turnos/sesión/día) |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están auto-inyectadas por
Supabase, no hace falta tocarlas.

### 3.4. Desplegar la edge function

Desde la raíz del proyecto, con `supabase` CLI instalada y logueada:

```bash
supabase functions deploy bot-chat --project-ref nmtukksbzbnuzqsksdmw --no-verify-jwt
```

`--no-verify-jwt` porque el bot acepta llamadas desde la web pública (anon).
La función internamente usa `service_role` para escribir logs.

### 3.5. Cargar el knowledge base inicial

En local, con las mismas AWS_* + la `SUPABASE_SERVICE_ROLE_KEY`:

```bash
# .env.local en la raíz del proyecto
VITE_SUPABASE_URL=https://nmtukksbzbnuzqsksdmw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
AWS_BEDROCK_ACCESS_KEY_ID=AKIA...
AWS_BEDROCK_SECRET_ACCESS_KEY=...

# carga incremental (recomendado)
node scripts/index-kb.mjs

# reindexado total (borra todo y recompone)
node scripts/index-kb.mjs --reindex

# sólo una fuente
node scripts/index-kb.mjs --source faq
```

El indexer es **idempotente**: skip si el `content_hash` ya existe.

Coste estimado de la carga inicial (con los datos hardcoded actuales): unos
8.000-15.000 tokens de embeddings ≈ **$0.001** con Titan v2.

### 3.6. Probar el bot

1. Recarga la web (`/`).
2. Botón flotante esquina inferior izquierda con punto amarillo.
3. Al abrir: aparece disclaimer AI Act + 4 preguntas sugeridas.
4. Hacer una pregunta. Debe responder en castellano, con fuentes citadas
   al pie.

Si responde con "ha habido un problema técnico", revisar:
- Supabase Edge Functions → bot-chat → Logs
- Que las secrets están bien copiadas (sin espacios extra).
- Que los modelos están habilitados en Bedrock (3.2).

## 4. Sprint 4 — Lighthouse + WCAG en deploy real

Una vez el push esté en producción:

1. **Lighthouse**: PageSpeed Insights (https://pagespeed.web.dev/) sobre
   `tiojosemaria.com`. Objetivo 95+ en Performance, A11y, Best Practices y SEO.
2. **aXe**: extensión Chrome → ejecutar en cada página crítica (/, /hinojares,
   /rutas, /eventos, /reservar, /privacidad, /aviso-legal). Anotar issues y
   me los pasas para resolver.

## 5. Pack legal — confirmar

- **DPA Supabase**: portal Supabase → Settings → Data Privacy → firmar.
- **Procedimiento brecha 72h AEPD**: documento interno guardado fuera del
  repo (puede ser un Google Doc o PDF). Plantilla:

```
PROCEDIMIENTO DE NOTIFICACIÓN DE BRECHAS — Apartamentos Tío José María

Responsable: Jesús Martínez Sánchez (NIF 26433801Q)
Fecha de adopción: 2026-06-22

1. Al detectar una brecha de seguridad que pueda afectar a datos personales:
   - Documentar fecha, hora, naturaleza, datos afectados, número aproximado
     de interesados afectados.
   - Aislar el sistema afectado, cambiar credenciales comprometidas.
2. En las primeras 24h: análisis preliminar. Si la brecha entraña un riesgo
   para los derechos de los interesados, preparar notificación AEPD.
3. En menos de 72h desde la detección: notificación a la AEPD vía
   https://sedeagpd.gob.es/.../notificaciones-de-brechas-de-seguridad.
4. Si el riesgo es alto: notificación directa al interesado afectado por el
   medio más rápido (email, SMS, llamada). Plantilla:
   "Le informamos de que el [fecha] hemos detectado un acceso no autorizado
   a [tipo de datos]. Las medidas adoptadas son [...]. Sus derechos: [...]"
5. Conservar registro interno de la brecha durante 5 años (art. 33.5 RGPD).
```

## 6. Roadmap pendiente (no urgente)

- **Diseño visual "Rural Premium"**: micro-illustrations Sierra Cazorla,
  paleta estacional, sesión de fotografía profesional. Cuando haya
  presupuesto.
- **Fase B SaaS**: solo cuando Fase A genere 2-3 anfitriones interesados
  reales. Producto = capa visual + IA + welcome package encima de cualquier
  PMS español, NO compite con MisterPlan.

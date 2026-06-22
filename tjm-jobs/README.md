# tjm-jobs — Trigger.dev tasks para Tío José María

Tasks programadas y event-driven que orquestan el sistema:

- `daily-booking-emails` — cron diario 09:00 Europe/Madrid que dispara emails
  transaccionales pendientes (recordatorios, llegada, salida, review,
  reactivación). La confirmación inmediata se dispara desde la edge function
  `stripe-webhook` (no espera al cron).

## Setup

1. Crear proyecto en https://cloud.trigger.dev (org `padron-ia`). Anotar el
   `project ref` (forma `proj_xxx_xxx`).
2. Establecer env vars en el proyecto Trigger:
   - `SUPABASE_URL` — `https://nmtukksbzbnuzqsksdmw.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — service role del proyecto TJM
3. En este directorio (`tjm-jobs/`):
   ```bash
   npm install
   npx trigger.dev@latest login
   # Editar trigger.config.ts → cambiar project: "proj_REPLACE_ME"
   npm run dev       # local, para probar
   npm run deploy    # subir a cloud.trigger.dev
   ```

## Pruebas

Desde el dashboard de Trigger.dev → Tasks → `daily-booking-emails` →
"Test task" → run con payload `{}`. Verifica los logs y que los
`*_email_sent_at` se marcan en `guest_bookings`.

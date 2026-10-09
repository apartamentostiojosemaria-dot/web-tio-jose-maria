# tjm-jobs — Trigger.dev tasks para Tío José María

Proyecto `tjm-jobs` (`proj_azldqeufdufzorjzhnkk`) en cloud.trigger.dev, org Padrón IA.

| Task | Cuándo | Qué hace |
|---|---|---|
| `misterplan-correo` | cada 10 min | Lee el Gmail del negocio por IMAP y apunta lo que MisterPlan avisa (reserva, cancelación, modificación). Idempotente por Message-ID. Se retira cuando se dé de baja MisterPlan. |

Retiradas (corren en pg_cron dentro de la base, regla de la casa):

- `daily-booking-emails` → pg_cron `daily-booking-reminders` (18-sep-2026).
- `daily-ses-submit` → pg_cron `tjm-parte-viajeros` (11-sep-2026, `bced9b0`).
- `sync-ical-channels` → pg_cron `tjm-sincronizar-canales` (9-oct-2026, migración 0055). El vigilante
  `tjm-vigilar-canales` avisa si algún canal pasa más de 2 h sin sincronizar.

## Despliegue

Automático: cada push a `main` que toque `tjm-jobs/` lo despliega
(`.github/workflows/deploy-trigger.yml`, secreto `TRIGGER_ACCESS_TOKEN`). A mano, si hiciera falta:
`npm ci && npx trigger.dev@4.5.16 deploy --env prod` desde este directorio.

## Pruebas

`npm test` (parser de correos) y `npm run misterplan:prueba` (pasada en seco contra el Gmail).
Los fallos de los runs los vigila Hermes (pieza `trigger-vigia` del arnés) cada hora.

# DPAs firmados — Apartamentos Tío José María

Acuerdos de Encargo del Tratamiento (Data Processing Agreements) firmados con los subencargados que tratan datos personales por cuenta del responsable (Jesús Martínez Sánchez, NIF 26433801Q, titular de Apartamentos Rurales Tío José María).

Estos DPAs son **obligatorios** conforme al artículo 28 RGPD para todo proveedor que trate datos personales por nuestra cuenta. Sin DPA firmado, el tratamiento es ilícito.

## Registro

| Subencargado | Servicio | Datos tratados | Fecha firma | Archivo | Observaciones |
|---|---|---|---|---|---|
| **Supabase** | Auth + BD + Storage | Email, nombre, contraseña hash, reservas, perfiles | 2026-06-21 | [supabase-dpa-2026-06-21.pdf](./supabase-dpa-2026-06-21.pdf) | Standard DPA vía PandaDoc. Subprocessors en Schedule 3. Región UE confirmada (sin Schrems II). |

## Pendientes (a firmar cuando se integren)

| Subencargado | Servicio | Cuándo | Prioridad |
|---|---|---|---|
| **Stripe** | Pasarela de pago | Sprint 2 (integración pagos) | Alta — datos financieros |
| **Resend** | Email transaccional | Sprint 3 (automation emails) | Alta — datos contacto |
| **Meta (WhatsApp Cloud API)** | WhatsApp Business | Sprint 5 (bot multicanal) | Alta — comunicación con huésped |
| **Anthropic (Claude)** | Bot conversacional | Sprint 3 (bot web) | Crítica — AI Act + transferencia US |
| **Trigger.dev** | Orquestación workflows | Sprint 3 (automation) | Media |
| **Easypanel / proveedor hosting** | Hosting frontend | Cuando se confirme región | Media |

## Política de actualización

- Revisión anual de todos los DPAs vigentes.
- Cuando un subencargado notifique cambio de subprocessors, valorar y, si afecta, documentar en `subprocessor-changes/<fecha>-<provider>.md`.
- Si un DPA caduca o se modifica unilateralmente, re-firmar antes de continuar el tratamiento.

## Procedimiento de incidencias

Brechas de seguridad notificables por estos subencargados → ver `docs/seguridad/protocolo-brecha-datos.md` (plazo 72h AEPD).

# AGENTS.md — tio-jose-maria

> Puerta de entrada para cualquier IA o persona que programe aquí. Léelo entero antes de tocar nada.
> Kit de repo del método SDF (Padrón IA), instalado el 2026-10-16.

## Qué es
Sistema propio de Apartamentos Tío José María: web pública con reserva directa (Stripe), panel de gestión de la familia, área del huésped, partes al Ministerio (SES.HOSPEDAJES), sincronización de calendarios con portales y correos automáticos.

## Antes de empezar (siempre, en este orden)
1. `docs/PROGRESS.md` — en qué etapa está, qué se hizo la última sesión, qué falta, qué está bloqueado.
2. El documento del mapa que toque a la tarea (abajo). Si la tarea no encaja con `docs/PRD.md` o `docs/PLAN.md`, **para y avisa**:
   no se replanifica en caliente.

## Autonomía (se trabaja por objetivos, no por tareas)
Tu trabajo es acercar los **objetivos de `docs/PRD.md`** siguiendo `docs/PLAN.md`, sin esperar a que te den cada tarea.
- **Decides tú**: cómo construir lo que está en el PRD y el PLAN, arreglos, pruebas, limpieza, documentos, despliegue a
  pruebas. Al cerrar, lo apuntas en `docs/PROGRESS.md`.
- **Necesita OK del operador (Jesús)**: solo **dinero** (precios fuera de la horquilla aprobada, gastos, cobros, devoluciones,
  claves de pago) y **mensajes nuevos a huéspedes** (los de plantilla aprobada salen solos). Cambiar el alcance o el plan, y
  borrar datos reales, también.
- **Decides tú en producción** (16-oct-2026, Jesús: «hazlo de manera autónoma… no preguntar salvo dinero o clientes»): arreglos,
  migraciones que no borran datos, funciones, textos y SEO de la web y desplegar. El push a `main` despliega solo.
- **Avisos a la familia** (limpieza, llegadas, un dato que hay que pedir en persona): por el panel y el móvil, en su lenguaje.
- **Si te bloqueas**: déjalo en «Bloqueado (qué y por quién)» de `docs/PROGRESS.md` con la decisión ya preparada
  (opciones y recomendación) y sigue con lo siguiente del plan. Nada espera sin fecha.

## Mapa de documentos (un papel, un fichero)
| Papel | Fichero | Para qué |
|---|---|---|
| PROGRESS | [`docs/PROGRESS.md`](docs/PROGRESS.md) | Etapa SDF y estado vivo (se lee al empezar, se actualiza al cerrar) |
| PRD | [`docs/PRD.md`](docs/PRD.md) | Qué se construye, para quién y qué no |
| PLAN | [`docs/PLAN.md`](docs/PLAN.md) | Fases con criterio de aceptación |
| APP_FLOW | [`docs/APP_FLOW.md`](docs/APP_FLOW.md) | Pantallas y recorridos por perfil |
| DESIGN_SYSTEM | [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Colores, tipografía, componentes |
| TRD | [`docs/TRD.md`](docs/TRD.md) | Stack, arquitectura, integraciones, despliegue |
| DATABASE | [`docs/DATABASE.md`](docs/DATABASE.md) | Tablas, relaciones y quién ve cada fila (RLS) |
| SECURITY | [`docs/SECURITY.md`](docs/SECURITY.md) | Datos sensibles, accesos, secretos, copias, RGPD |
| DECISIONS | [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decisiones técnicas, inmutables |

Lo que **no** está en este repo (contrato, precio, cliente, controles aprobados, riesgos, borradores legales) vive en el OS del
operador: `clients/tio-jose-maria`. Se enlaza, no se copia.

## Reglas
1. **Cada dato en un solo sitio.** Si ya está escrito en otro documento, enlázalo.
2. **El documento se toca en el mismo commit que el código** que lo cambia: migración → base de datos · pantalla o recorrido →
   flujo · decisión de peso → decisiones · algo que cambia el estado → `docs/PROGRESS.md`.
3. **Cifras, no adjetivos.** Cada afirmación verificable lleva su número o su comprobación.
4. **Cada documento del kit cabe en una o dos pantallas** (≈ 120 líneas). El detalle, a un anexo enlazado.
5. **Nada se da por hecho sin ejecutarlo**: se prueba en la app en marcha, no leyendo el código.
6. **Secretos**: ninguno en el código ni en los documentos. Variables en `.env.local`.

## Al cerrar la sesión (no se cierra sin esto)
Actualiza `docs/PROGRESS.md`: hecho · en curso · bloqueado (y por quién) · siguiente paso · dependencias o variables nuevas.
Relee los documentos que has tocado y confirma que dicen lo mismo que el código. Commit con el documento dentro.

## Comandos
- `npm run dev` (puerto 3000) · `npm run build` · migraciones: carpeta `supabase/migrations/` aplicadas con el conector de
  Supabase de TJM · funciones: `supabase functions deploy <nombre>` · jobs: `tjm-jobs/` (Trigger.dev).

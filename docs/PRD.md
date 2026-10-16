# PRD — tio-jose-maria

> **El encargo de arranque**: qué se construye, para quién y qué NO. Es lo primero que lee cualquier sesión. Dos
> pantallas como máximo. Negocio (precio, contrato, fase) en el OS: `clients/tio-jose-maria` y la ficha `estado.md` del cliente.
> Mapa completo de procesos del negocio (16 procesos) y gerente: `clients/tio-jose-maria/projects/2026-10-16-gerente-tjm/plan.md`.

## Qué es (tres líneas)
- El sistema con el que funciona el negocio **Apartamentos Tío José María** (registro A/JA/00060, apartamentos turísticos,
  modalidad rural, Hinojares, Jaén): 4 apartamentos que se alquilan, 12 plazas, lo llevan los padres de Jesús.
- Web pública con reserva directa (Stripe), panel de la familia, área del huésped, partes al Ministerio (SES.HOSPEDAJES),
  calendarios sincronizados con los portales y correos automáticos.

## Problema (con cifras, base de datos 16-oct-2026)
- Ocupación de octubre ~12 % (15 de 124 noches). Booking: 38 reservas, 19 canceladas (50 %). Venta directa ~15 %.
- Cumplimiento: una reserva (TJM-8A9D74) llevaba 49 intentos sin comunicarse al Ministerio por un dato que nadie pedía.
- Operativa: 8 de 12 limpiezas sin marcar, 5 de 16 tareas recurrentes vencidas sin aviso, petición de reseña a 2 de ~20 estancias.

## Objetivos (con número y fecha: el agente trabaja hacia esto, no por tareas sueltas)
| Objetivo | Cómo se mide | Para cuándo | Estado |
|---|---|---|---|
| O1 · Ocupación 25 % | noches vendidas / noches disponibles, por mes (`guest_bookings`) | sep-2027 | ~12 % (oct-2026) |
| O2 · Precio medio ≥ 80 €/noche | ingreso / noches vendidas | mantener | 87 € |
| O3 · Venta directa 50 % | reservas web / reservas confirmadas | sep-2027 | ~15 % |
| O4 · Cumplimiento con el Ministerio 100 % en 24 h | reservas, anulaciones y partes aceptados en plazo (`ses_comunicaciones`, `traveler_records`) | siempre | con huecos (fase 1) |
| O5 · Nota: Booking ≥ 9,4 · Google ≥ 4,8 · Airbnb ≥ 4,85 | nota de cada portal | siempre | 9,5 · 4,8 · 4,88 |
| O6 · Cancelaciones de Booking < 25 % | canceladas / total Booking | mar-2027 | 50 % |

O1-O3 los decidió Jesús el 16-sep-2026 (plan de captación §13). O4-O6 son las líneas rojas del plan del gerente (16-oct).

## El principio que no se negocia
- **La ley primero**: ninguna reserva, anulación ni parte sin comunicar al Ministerio en 24 h. Si falta un dato, el sistema
  **lo consigue** (lo pide y avisa a quien pueda conseguirlo); nunca reintenta en silencio.
- Nada se promete que no haya en la casa (sin chimenea ni leña en textos: decisión 18-sep).

## Para quién (perfiles y permisos)
| Perfil | Qué necesita | Qué puede hacer |
|---|---|---|
| Huésped | reservar, pagar, dar sus datos, saber llegar | web, `/precheckin`, `/guia/<código>` |
| Familia (staff: Mari Carmen) | ver el día, llegadas, limpiezas, cobros | `/panel` con código |
| Jesús (admin) | todo, informes, dinero | `/admin` |
| Gerente (agente) | estado de cada proceso, arreglar y avisar | lectura de la base + funciones; lo que toca dinero o mensajes nuevos, a Jesús |

## Alcance de la fase actual (fase 1: cimientos)
- Entra: cumplimiento con el Ministerio sin huecos, estados limpios (reservas hechas, limpiezas), tareas recurrentes con fecha,
  vigilante de tareas programadas.
- **No entra**: precio dinámico, cambio de MisterPlan, publicidad, rediseño de la web (fases 2-3 del plan del gerente).

## Entidades y sus estados
| Entidad | Estados y transiciones válidas |
|---|---|
| Reserva (`guest_bookings`) | pending_payment → confirmed → completed (al día siguiente de la salida) · cualquiera → cancelled · pending_payment → expired |
| Comunicación al MIR (`ses_comunicaciones`) | pendiente → aceptado · retry (falta dato o error) → aceptado · rechazado · no_procede |
| Limpieza (`cleaning_tasks`) | pending → done |
| Tarea interna (`internal_tasks`) | pending → done (y la recurrente crea la siguiente) |

## Datos sensibles y claves
- Datos: documentos de identidad, domicilio, fecha de nacimiento y firma de los viajeros (RD 933/2021), menores. Se guardan 3
  años y se purgan. Ver `docs/SECURITY.md` y `docs/PARTE-VIAJEROS.md`.
- Claves por niveles: servidor (`.env`) · despliegue (panel del hosting) · Supabase (secretos de funciones).

## Errores ya conocidos
- Booking oculta el teléfono y el correo del huésped: la comunicación de reserva al MIR se queda sin contacto válido.
- Un cron puede constar «correcto» aunque la función falle por dentro (auditoría 10-oct, P3).
- Supabase en plan gratuito se pausó solo en marzo de 2026.

## Cómo se ve el éxito (prueba de aceptación de la fase 1)
1. Una reserva de Booking sin teléfono ni correo: en menos de 1 h queda pedida la información al huésped o avisada la familia,
   y el panel dice qué falta y a quién.
2. Una reserva que cambia de fechas: el cambio llega al Ministerio.
3. El parte de quien entra hoy sale en la misma mañana o tarde, no al día siguiente.
4. El día después de la salida la reserva pasa sola a «completed»; la limpieza sin marcar avisa la víspera de la siguiente entrada.
5. Cada tarea recurrente tiene fecha, avisa 7 días antes y al marcarla crea la siguiente.
6. Si una tarea programada no hace su trabajo, llega un aviso el mismo día.

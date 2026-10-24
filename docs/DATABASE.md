# Base de datos — tio-jose-maria

> Tablas, relaciones y quién ve cada fila (RLS). Se toca en el mismo commit que cada migración.
> Fuente: `supabase/migrations/0001`–`0060` leídas el 16-oct-2026 (estado final de políticas tras `DROP POLICY`). Contrastado
> con producción: **pendiente de confirmar** (el MANIFEST avisa de que el esquema se construyó por MCP antes del 10-sep).
> Funciones, vistas, triggers y trampas del esquema: `supabase/MANIFEST.md` §«Estructura de BD».

## Cómo se cambia el esquema
- Solo por migración, nunca a mano. Carpeta: `supabase/migrations/`. Numeración `NNNN_frase_en_castellano.sql`.
- `0001_baseline_2026-09-10.sql` es una **foto documental: NO se aplica**. `descartado/` no se aplica.
- Se aplican con el conector MCP de Supabase de TJM; un solo agente aplica DDL. Cada migración, reflejada en el MANIFEST.

## Roles y funciones de guardia
- `profiles.role`: `admin` (Jesús), `staff` (la familia, desde `0003`), `cliente`. `is_staff()` = admin o staff y
  `profiles.is_active` (desde `0004`). `check_is_admin()` / `is_admin()` = admin. `tjm_puede_gestionar()` = guardia de las RPC de gestión.
- `anon` solo entra por RPC con código de reserva de secreto (`tjm_precheckin_reserva`, `tjm_guardar_pagador`,
  `submit_traveler_records`, `tjm_ficha_huesped`…). Todas `SECURITY DEFINER` con `search_path` fijo según MANIFEST.
- Leyenda RLS: **SR** = solo `service_role` (edge functions). Todas las tablas de abajo tienen RLS activada.

## Tablas principales
### Reservas y cobros
| Tabla | Para qué | Quién la lee / escribe (RLS) |
|---|---|---|
| `guest_bookings` | reserva (tabla central; no existe `bookings`). Canal, cobro, datos de pago A.4.d, sellos de correos | anon/auth INSERT solo `pending`/`hold`; SELECT el dueño (email del JWT) o admin; staff y admin todo |
| `booking_payments` | un apunte por cobro (negativo = devolución), recalcula `paid_amount` | staff, admin, SR |
| `apartments` | los 4 apartamentos, precios, URLs iCal de cada canal | SELECT público; escribe admin |
| `blocked_dates` | días cerrados y bloqueos de canal (`external_kind` reserved/closed) | SELECT público; staff y admin escriben |
| `high_seasons` · `pricing_rules` | temporadas y reglas de precio (`special_price`, última hora) | SELECT público (`pricing_rules`: `active`); staff y admin escriben |
| `addons` · `booking_addons` | extras y extras por reserva | `addons` SELECT anon si `active`; escriben staff/admin · `booking_addons` admin |
| `discount_codes` | códigos de descuento | admin; el titular lee los suyos |
| `invoices` | facturas serie A / rectificativas R, huella Verifactu | SELECT admin, staff y el huésped de su reserva; escribe SR |
| `customers` · `customer_notes` | ficha de cliente y notas | staff y admin |

### Huéspedes y partes SES (RD 933/2021) — detalle en `docs/PARTE-VIAJEROS.md`
| Tabla | Para qué | Quién la lee / escribe (RLS) |
|---|---|---|
| `traveler_records` | ficha de cada viajero: documento, domicilio, nacimiento, firma | SELECT admin; escribe SR (y anon solo vía RPC). **staff no tiene política** (ve el semáforo `v_parte_estado`) |
| `ses_comunicaciones` | diario de reservas/anulaciones comunicadas al MIR | SELECT staff/admin; escribe SR |
| `ine_municipios` | catálogo INE para el domicilio español (`0042`, `0056`) | SELECT anon y auth |
| `consent_log` | consentimientos | admin |

- `guest_bookings.modificacion_pendiente_at` / `modificaciones_comunicadas` (`0063`): un cambio de fechas, apartamento o
  personas antes de la entrada en una reserva ya comunicada; el barrido anula la versión anterior y comunica `<código>-M<n>`.
  Lo marca el disparador `trg_marcar_modificacion`; `tjm_ses_pendientes()` lo devuelve con tipo `modificacion`.

### Canales iCal — detalle en `docs/CANALES.md`
| Tabla | Para qué | Quién la lee / escribe (RLS) |
|---|---|---|
| `channel_sync_log` | resultado de cada pasada | SELECT staff; escribe SR |
| `channel_sync_conflicts` | solapes con reserva propia, abiertos hasta cerrarlos | SELECT staff; UPDATE admin |
| `channel_alerts` | antirrepetición de avisos | SELECT staff |
| `mail_import_log` | correos de MisterPlan leídos por `misterplan-correo` (`message_id` único) | SELECT staff; escribe SR |

### Correos y envíos
| Tabla | Para qué | Quién la lee / escribe (RLS) |
|---|---|---|
| `envios` | cada correo enviado y su estado real (webhook Resend) | SELECT `tjm_puede_gestionar()`; escribe SR |
| `salud_correo` | vigilancia diaria del dominio/DKIM | SELECT `tjm_puede_gestionar()` |
| `email_subscribers` | newsletter | INSERT público; SELECT admin |
| `inbox_messages` | mensajes de la web y del bot | INSERT anon (`web_form`, `bot`); admin todo |
| `push_subscriptions` | móviles apuntados a avisos push (`0041`) | cada usuario las suyas |
| `otp_codes` | códigos de acceso hasheados | RLS sin políticas → solo SR (deliberado) |

### Limpieza y operativa — detalle en `docs/OPERATIVA.md`
| Tabla | Para qué | Quién la lee / escribe (RLS) |
|---|---|---|
| `cleaning_tasks` | limpiezas sueltas que apunte la familia; desde `0069` (24-oct) la reserva ya no crea una ni hay aviso | staff y admin; SR |
| `internal_tasks` | tareas internas y recurrentes (INE, facturas fallidas) | admin |
| `protocols` · `internal_documents` | manual y documentos internos | admin; SR |
| `owner_reports` | informe mensual al titular | admin |
| `access_codes` | códigos de cerradura (sin uso: check-in en persona) | SELECT admin; SR |
| `apartment_instructions` | instrucciones del apartamento | SELECT autenticados; admin escribe |

- `tjm_revisiones` (`0061`): una fila por problema abierto de un proceso del negocio (ministerio, mantenimiento,
  canales, correo, sistema), con `quien` (familia · jesus · sistema · gerente). La rellena `tjm_revisar()` cada hora (:40) y
  se cierra sola cuando el problema desaparece. Lee: staff/admin; escribe: solo el servidor. La lee el gerente cada mañana.
- `internal_tasks.assigned_to` = familia · jesus · sistema (`0061`). La familia ve las suyas con `tjm_tareas_casa()` y las
  cierra con `tjm_completar_tarea()`, que programa la siguiente. Aviso a los móviles de la familia a las 07:30 UTC (`tjm_aviso_familia`).
- `tjm_cerrar_estancias()` (`0061`, 02:10 UTC): confirmed → completed el día después de la salida, y cierra limpiezas cuando
  ya entró el siguiente huésped (con nota).

### Contenido web
| Tabla | Para qué | Quién la lee / escribe (RLS) |
|---|---|---|
| `web_config` | ajustes generales | SELECT público; admin |
| `routes` · `local_places` · `local_events` | rutas, directorio del pueblo, eventos | SELECT público; admin |
| `blog_posts` | blog | SELECT público si `published`; admin |
| `reviews` | opiniones | SELECT público; INSERT el autenticado (las suyas); admin |
| `guidebooks` · `guest_guides` | manual digital y guías | SELECT anon / público; admin |
| `documents` | documentos para huéspedes por `visibility` | público si `publico`; autenticado si `solo_clientes`; admin |
| `hinojares_content` · `local_content` · `festival_books` · `festival_book_entries` | contenido del pueblo | SELECT público; admin. Sin referencias en `src/` |

### SEO (`0054`)
| Tabla | Para qué | Quién la lee / escribe (RLS) |
|---|---|---|
| `seo_citas_ia_consultas` · `seo_citas_ia` · `vigia_citas_ia_estado` | vigía propio de citas en IA (token en el VPS, solo su hash aquí) | RLS sin políticas → solo SR |

### Sistema e IA
| Tabla | Para qué | Quién la lee / escribe (RLS) |
|---|---|---|
| `profiles` | rol y estado de cada usuario | cada uno el suyo (SELECT/UPDATE); admin todo; SR |
| `rate_limits` | límites por IP | sin políticas → solo SR |
| `kb_chunks` · `ai_interaction_logs` | RAG del bot y su registro (retención 12 meses) | `kb_chunks` SELECT anon/auth; logs SELECT admin; SR |

### Heredadas sin uso (copiadas de otro proyecto en el snapshot `0001`; 0 referencias en `src/`, funciones y `tjm-jobs`)
`client_weekly_plans`, `client_weekly_manual_checks`, `client_shopping_list_checks`, `client_notifications_read`,
`materials_library`, `portal_events`. Ojo a sus políticas en `docs/SECURITY.md` («Qué falta»).

## Almacenamiento (Storage)
- `limpiezas` (privado, 10 MB, imágenes; `0005`): staff. `libro-registro` (privado, PDF; `0010`): lo escribe SR, lo leen admin y staff.
- `invoices` (privado, PDF de facturas, URL firmada 1 h): según MANIFEST; creación no versionada en migraciones.

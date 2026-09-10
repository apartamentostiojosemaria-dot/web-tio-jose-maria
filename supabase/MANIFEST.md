# MANIFIESTO — Apartamentos TJM (backend Supabase)

> **Fuente de verdad: PRODUCCIÓN.** Este proyecto se ha construido en gran parte vía
> MCP-directo: el esquema y muchas edge functions se aplicaron/desplegaron contra la BD
> viva, no a través del repo. Este archivo es el índice autoritativo de QUÉ hay desplegado
> de verdad, para no volver a dudar. **Mantener actualizado** al desplegar o crear algo.
>
> - Proyecto Supabase: `nmtukksbzbnuzqsksdmw` (región UE — Fráncfort)
> - MCP UUID (en iAmasters OS): `9cbee830`
> - Última reconciliación: **2026-09-10** (migraciones 0001-0008, agente de esquema)
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
| `sync-ical-imports` | v5 | false | ✅ | Importa calendarios iCal de canales (Booking/Airbnb) |
| `ical-export` | v5 | false | ✅ | Exporta iCal por apartamento (`/ical/{slug}.ics`) |
| `create-payment-session` | **v4** | false | ✅ | Stripe Checkout (creada 30-jun). **10-sep-2026 — agujero cerrado**: aceptaba `bookingId` suelto y el id es SECUENCIAL, así que cualquiera podía pedir `{"bookingId":7}` sin autenticarse y recibir una pasarela que enseña **nombre del huésped, fechas, apartamento e importe**. Ahora el `bookingCode` (`TJM-XXXXXX`, aleatorio) es **obligatorio** y el id, si viene, solo filtra: código + id ajeno → `booking_not_found`. Acepta el importe como `amount` (panel) y como `amountEur` (web) |
| `stripe-webhook` | v4 | false | ✅ | Webhook de Stripe (creada 30-jun). **10-sep-2026**: los disparos a otras funciones ya no son `fetch().catch()` —un 404 o un 500 no rechazan la promesa, así que el fallo se perdía en silencio (así estuvo la factura sin emitirse). Ahora se comprueba el status, y si la factura falla queda una tarea en `internal_tasks`. La reserva nunca se rompe por eso: siempre 200 a Stripe |
| `send-booking-reminders` | v1 | false | ✅ | (cron `daily-booking-reminders`) recordatorios 7d/24h/llegada/salida/reactivación (creada 30-jun) |
| `issue-invoice` | v3 | **true** | ✅ | **Toda la facturación, en una sola puerta** (10-sep-2026): emite (idempotente), genera el PDF y lo guarda en Storage, manda el correo con el PDF adjunto, hace rectificativas y firma URLs del PDF. Acciones: `issue`, `send`, `issue_and_send`, `rectify`, `pdf_url`, `status`. **YA NO usa la RPC `issue_invoice`**: la lógica fiscal vive en la propia función y su configuración (serie, IVA, emisor) en `functions/issue-invoice/config.ts`, único sitio |

#### Facturación — cómo funciona desde el 10-sep-2026
- **Serie propia `A`**, para no chocar con la numeración heredada de MisterPlan (series `1-` y `3225-`, que iba por el nº 7 de 2025). En la base se guarda `serie='A2026'` + `numero=1,2,3…` (correlativo por ejercicio, empezando en 1) y se muestra como **`A-2026-0001`**. Las rectificativas van en serie propia `R` → `R-2026-0001`, con importes en negativo.
- **IVA 10 %** (alojamiento, art. 91.Uno.2.2.º Ley 37/1992). Se cambia en `config.ts` y en ningún otro sitio.
- **PDF** generado con `pdf-lib` (sin binarios ni Chrome) y guardado en el bucket **privado** `invoices`, ruta `<año>/<A-2026-0001>.pdf`. `invoices.pdf_url` guarda la ruta canónica del objeto; al panel se le entregan **URLs firmadas de 1 h** con la acción `pdf_url`. **No hacer público ese bucket**: los PDF llevan nombre, NIF y dirección del huésped.
- **Correo** por Resend con el PDF **adjunto** (no un enlace), y marca `invoices.email_sent_at`.
- **Estado de cobro**: sale de `booking_payments` (y de `guest_bookings.paid_amount`/`pending_amount` como respaldo). `pending_amount = 0` → «Pagada»; si queda algo → «Pendiente de cobro».
- **Verifactu NO está activo** (interruptor `VERIFACTU_ENABLED = false`). Aun así cada factura nace con la huella encadenada (`verifactu_hash_previo` → `verifactu_hash`, SHA-256 de `hash_previo|NIF|serie|numero|fecha|total|cuota`, encadenando por **orden de registro**) y `verifactu_status='pending'`, para poder enviar la cadena entera hacia atrás el día que toque.
- ✅ **Las dos RPC obsoletas ya NO existen** (migración `0004`, 10-sep-2026): `issue_invoice` y su envoltura `emitir_factura` se retiraron tras comprobar que no las llamaba nadie (0 resultados en `src/`, `supabase/functions/`, `tjm-jobs/` y 0 funciones de la base que las referenciaran). `emitir_factura` estaba expuesta a `staff` por PostgREST y habría emitido una factura sin PDF, sin correo, con la huella encadenada con otro criterio y el IVA horneado en SQL — gastando un número correlativo real de la serie fiscal, que no se recupera sin dejar hueco. **Queda una sola puerta de emisión: la edge function `issue-invoice`.**

### Desplegadas pero en modo STUB (vivas, no hacen el trabajo final)
- `submit-ses-hospedajes` | v5 | verify_jwt false | ✅ repo — **SÍ está desplegada** (corregido 10-sep-2026: el MANIFEST decía que no). Genera el XML del parte de viajeros y lo deja en `stub_no_credentials`: **no envía nada al MIR**. Pendiente P3.1: reescribirla a SOAP con usuario/contraseña + códigos de arrendador y establecimiento (el MIR NO usa certificado de cliente).
  - ⚠️ **Desfase SOLO de comentarios** (10-sep-2026): tras aplicar `0008` se corrigieron en el repo los comentarios de `config.ts` y `parte-modelo.ts` que decían «cuando se aplique `_pendiente_parte.sql`» (ya aplicado, ya borrado). **No se redesplegó**: no cambia una sola línea ejecutable y la función es un stub. El próximo despliegue resincroniza. Todo lo demás es idéntico a la v5 viva.

### En repo pero NO desplegadas (trabajo pendiente — NO están vivas)
- `bot-chat` — bot IA con RAG (AWS Bedrock). Pendiente: alta AWS + `VITE_BOT_ENABLED=true`.
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
| `tjm-vigilar-canales` | `7 * * * *` | `net.http_post` → `sync-ical-imports?mode=watch` (creado 10-sep, migración 0006). **Vigilante independiente**: el importador corre en Trigger.dev, así que si Trigger.dev se cae no corre y tampoco se queja; este vive en la base y lo canta. No sincroniza nada, solo mira la frescura |

## Estructura de BD (resumen — el detalle vive en la BD)

- **~47 tablas** en `public`. Núcleo reservas: `guest_bookings` (tabla central, NO `bookings`), `booking_payments` (cobros, nueva 10-sep), `apartments`, `blocked_dates`, `high_seasons`, `pricing_rules` (**SÍ conectada** a `check_availability` — corregido 10-sep-2026: el MANIFEST decía lo contrario; lo que falta son las reglas, la tabla tiene 0 filas), `booking_addons`/`addons`, `invoices`, `traveler_records` (DNIs), `customers`/`customer_notes`, `email_subscribers`, `consent_log`, `cleaning_tasks`, `access_codes`, `otp_codes`, `reviews`, `blog_posts` (0 filas), `kb_chunks`/`ai_interaction_logs` (bot). Desde el 10-sep (migración `0006`), tres tablas de canales: `channel_sync_log` (resultado de cada pasada del importador), `channel_sync_conflicts` (solapes con reserva propia, abiertos hasta que una persona los cierra) y `channel_alerts` (antirrepetición de avisos). Las tres con RLS: lectura para `admin`/`staff`, escritura solo `service_role`.
- **RLS**: activada en todas. Roles: `admin` (todo), `staff` (gestión diaria, desde el 10-sep), `cliente`. Tablas sensibles verificadas (30-jun): `traveler_records` y `ai_interaction_logs` → solo `service_role`; `customers`/`customer_notes` → solo admin (`check_is_admin()`); `email_subscribers`/`guest_bookings` → INSERT anónimo, SELECT admin/dueño. **Sin fugas.**
- **RPCs de aplicación** (ignorando las de extensiones pgvector/btree_gist): `check_availability`, `create_booking_hold`, `expire_booking_holds`, `generate_booking_code`, `ensure_customer_exists`, `record_marketing_consent`, `submit_traveler_records`, `schedule_cleaning_on_booking_confirmed`, `search_kb_chunks`, `check_is_admin`/`is_admin`/`is_staff`/`get_auth_role`, `cleanup_expired_otps`, `cleanup_old_rate_limits`, `prune_ai_interaction_logs`, `prune_traveler_records`, `set_updated_at`.
  Desde el 10-sep se suman los de gestión: `create_manual_booking`, `register_payment`, `move_booking`, `cancel_booking`, `set_special_price`, `close_sales`, `set_apartment_prices`, `tjm_quote_price`, `tjm_puede_gestionar`, `tjm_parte_estado`. Todos SECURITY DEFINER con `search_path` fijo, sin acceso para `anon` y con guardia interna de rol.
  Desde el 10-sep (migración `0007`) se suman las **nueve del INE**, todas SECURITY **INVOKER** (leen con la RLS de quien llama) y con `search_path` fijo: `fn_ine_norm`, `fn_ine_es_espana`, `fn_ine_provincia_por_cp`, `fn_ine_ccaa_por_cp`, `fn_ine_grupo_extranjero`, `fn_ine_casillas_residencia`, `v_ine_mes`, `v_ine_mes_residencia`, `v_ine_mes_detalle`. Sin acceso para `anon`.
- **Vistas**: `v_admin_kpis`, `v_admin_upcoming`, `v_admin_revenue_monthly`, `v_customers_360`, `bookings_email_queue` (todas `security_invoker=true`) y **`v_parte_estado`** (10-sep; **14 columnas** desde la migración `0008`: las 12 de siempre más `completo` y `mandado_a_mano`) y **`v_channel_sync_status`** (10-sep, migración 0006, también `security_invoker=true`). Ojo: `v_admin_upcoming.precheckin_done`/`traveler_count` valen 0/false para `staff`, porque esa vista es invoker y `staff` no tiene política sobre `traveler_records`. Para el estado del parte, usar `v_parte_estado`.
- **Triggers de aplicación**: `guest_bookings_ensure_customer`, `guest_bookings_schedule_cleaning`, `booking_payments_recalc` y `guest_bookings_sync_stripe_payment` (10-sep), y varios `*_set_updated_at` (cleaning_tasks, invoices, kb_chunks, pricing_rules, protocols, traveler_records).
- **Extensiones**: `pgvector` (bot RAG), `pg_cron`, `pg_net`, `btree_gist`.

## Estado de reconciliación
- ✅ **2026-06-30**: las 16 edge functions vivas tienen su código en el repo (las 10 que faltaban se trajeron de producción vía `get_edge_function`). El repo ya es espejo de producción a nivel de funciones.

## Migraciones (`supabase/migrations/`) — desde el 10-sep-2026

Antes de esta fecha el esquema NO estaba versionado (se construyó por MCP directo).
A partir de aquí **todo cambio de esquema va como migración numerada y se refleja
en este MANIFEST**. Un único agente aplica DDL; el resto no toca el esquema.

| Fichero | Estado | Qué |
|---|---|---|
| `0001_baseline_2026-09-10.sql` | **NO APLICAR** | Snapshot documental del esquema previo: tablas, PK/FK/CHECK/EXCLUDE, índices, políticas RLS, definición de funciones, triggers, vistas y crons. Es la foto de la que parte todo |
| `0002_reservas_y_cobros.sql` | aplicada | Reserva de canal + cobros: columnas nuevas en `guest_bookings`, tabla `booking_payments`, triggers de cuadre, `special_price` en `pricing_rules`, `check_availability` extendida y 6 RPC de gestión |
| `0003_rol_staff.sql` | aplicada | Rol `staff`, políticas RLS de la gestión diaria, `set_apartment_prices`, `emitir_factura` y la vista `v_parte_estado` |
| `0004_higiene_facturacion.sql` | aplicada | Retira las RPC obsoletas `emitir_factura` e `issue_invoice`; `is_staff()` pasa a honrar `profiles.is_active` |
| `0005_storage_limpiezas.sql` | aplicada | Cubo privado `limpiezas` + política de `storage.objects` para `staff` (las fotos de limpieza ya tienen dónde ir) |
| `0006_canales.sql` | aplicada | Cuatro canales: `external_uid`, URLs de EscapadaRural y CasasRurales, tablas `channel_sync_log`/`channel_sync_conflicts`/`channel_alerts`, índices únicos parciales, vista `v_channel_sync_status`, RLS y el cron vigilante `tjm-vigilar-canales` |
| `0007_ine.sql` | aplicada | Encuesta mensual del INE (EOTR-21): nueve funciones de cálculo (`v_ine_mes`, `v_ine_mes_residencia`, `v_ine_mes_detalle` + utilidades) y la tarea recurrente en `internal_tasks` |
| `descartado/_pendiente_acceso.sql` | **DESCARTADA** | Versión alternativa de `0003`. Aplicarla habría dejado dos políticas haciendo lo mismo con nombres distintos, y además abría `apartments` y `traveler_records` a `staff`, que `0003` cierra a propósito. Lo único que aportaba (el guardia `is_active`) se extrajo a `0004` |
| `0008_parte_viajeros.sql` | aplicada | Parte de viajeros: ensancha los CHECK de `traveler_records` al catálogo del MIR (parentesco y sexo), reescribe `tjm_parte_estado()`/`v_parte_estado` con dos columnas más, índice por `booking_id` y la purga de tres años del RD 933/2021. Era el antiguo `_pendiente_parte.sql`, ya borrado |

### Lo que añadió `0002`
- **`guest_bookings`**: `channel`, `external_locator`, `commission_pct`, `commission_amount`,
  `payment_method`, `vcc_chargeable_from`, `paid_amount`, `pending_amount` (generada),
  `invoice_not_needed`, `created_by`, `internal_notes`. CHECK sobre `channel`
  (`web|booking|airbnb|escapada|casasrurales|telefono|whatsapp|otro`) y sobre
  `payment_method` (`transferencia|bizum|efectivo|tarjeta|stripe|booking`).
- **`booking_payments`**: un apunte por cobro (importe, forma, fecha, nota, quién).
  `amount` negativo = devolución.
- **Triggers**: `booking_payments_recalc` mantiene `guest_bookings.paid_amount` y
  `payment_status` (`pending`/`partial`/`paid`, respetando `refunded`/`failed`);
  `guest_bookings_sync_stripe_payment` apunta **solo la diferencia** cuando Stripe
  marca la reserva pagada, para no duplicar una señal ya registrada.
- **`pricing_rules.night_price`** + `rule_type='special_price'`: precio fijo por noche
  para un rango y, opcionalmente, un apartamento. **Manda sobre `high_seasons`.**
- **RPC**: `create_manual_booking`, `register_payment`, `move_booking`, `cancel_booking`,
  `set_special_price`, `close_sales` (+ helpers `tjm_quote_price`, `tjm_puede_gestionar`).

### Lo que añadió `0003`
- `profiles.role` admite **`staff`**; `is_staff()` reescrita a `('admin','staff')`
  (venía copiada de Cuid-Arte con roles que aquí no existen).
- Políticas `staff_all_*` sobre `guest_bookings`, `booking_payments`, `customers`,
  `customer_notes`, `cleaning_tasks`, `blocked_dates`, `addons`, `high_seasons`,
  `pricing_rules` y `staff_read_invoices`. **Ninguna sobre `traveler_records`.**
- RPC `set_apartment_prices` (solo `price_low`/`price_high`) y `emitir_factura`.
- Vista **`v_parte_estado`**: semáforo del parte de viajeros por reserva
  (cuántos han rellenado, si falta alguien, estado de envío) **sin un solo dato
  personal del documento**. Es la única vía por la que `staff` toca esa información.

### Lo que añadió `0004`
- Retiradas `emitir_factura(bigint,text,text,text,text)` e `issue_invoice(bigint,text,text,text,text)`.
- `is_staff()` ahora exige además `COALESCE(profiles.is_active, true)`: hasta aquí una
  ficha desactivada seguía pudiendo gestionar, y el campo `is_active` era decorativo.
  Comprobado antes de aplicar: los 3 perfiles de producción están activos, nadie perdió acceso.

### Lo que añadió `0005`
- Cubo **privado** `limpiezas` (10 MB, jpeg/png/webp/heic) y política `limpiezas_staff_all`
  sobre `storage.objects`. Sin él, `cleaning_tasks.photos` no tenía dónde guardar el fichero
  y `LimpiezasPanel.jsx` escondía el botón «Hacer una foto».
- **NO** se reestructuró `customers` (dar `id` propio y colgar de ahí `customer_notes`):
  queda comentado en el fichero. Toca `customers`, `customer_notes`, `v_customers_360` y
  `Customer360.jsx` a la vez; es un paquete propio, no un añadido.

### Lo que añadió `0006`
- `blocked_dates.external_uid` y `guest_bookings.external_uid` (idempotencia del importador:
  reejecutar el cron no duplica), `apartments.escapada_ical_url` y `.casasrurales_ical_url`.
- Tablas `channel_sync_log`, `channel_sync_conflicts`, `channel_alerts` + índices únicos
  **parciales** que son la garantía dura contra duplicados.
- Vista `v_channel_sync_status` (`security_invoker=true`): parte de los canales CONFIGURADOS,
  no del log, para que un canal que no ha sincronizado NUNCA salga en rojo en vez de desaparecer.
- Cron `tjm-vigilar-canales`, que vive en la base y no en Trigger.dev a propósito.
- **Dos correcciones al borrador**: las políticas miraban `profiles.is_staff`, una columna que
  no existe (aquí el helper es la *función* `is_staff()`), y la vista se creaba sin
  `security_invoker`, con lo que se habría saltado la RLS de `channel_sync_log`.

### Lo que añadió `0007`
- Nueve funciones de cálculo de la **EOTR-21** del INE. Criterio de solape de mes: el viajero
  se cuenta una sola vez en el mes de entrada; la pernoctación, noche a noche. Un mes puede
  tener pernoctaciones con cero viajeros entrados, y es correcto.
- Las reservas con `source='test'` quedan **fuera** de la estadística por diseño.
- Tarea recurrente en `internal_tasks` («Enviar la encuesta del INE…», mensual, prioridad alta).
  El aviso EMPUJADO por Slack/WhatsApp sigue comentado: va con F6.
- Respecto del borrador se añadió `search_path` fijo a las nueve funciones.

### Lo que añadió `0008`
- **CHECK ensanchados en `traveler_records`**: `parentesco` pasa de cuatro códigos
  (`PA/TU/AB/OT`) a los quince del catálogo **TIPO_PARENTESCO** del MIR
  (`AB,BA,BN,CD,CY,HJ,HR,NI,PM,SB,SG,TI,YN,TU,OT`) **conservando `PA`**, que es
  heredado y la edge function traduce a `PM`. `sexo` admite ahora `H/M/O/X`
  (se añade la `O` del MIR sin quitar la `X` que guarda el formulario).
  Verificado en producción: una fila con `sexo='O'` y `parentesco='HJ'` entra.
- **`tjm_parte_estado()` / `v_parte_estado` reescritas**: la vista sigue exponiendo
  las **mismas doce columnas y en el mismo orden** (`booking_id`, `booking_code`,
  `guest_name`, `apartment_name`, `check_in`, `check_out`, `pax_count`,
  `viajeros_rellenos`, `faltan`, `faltan_cuantos`, `estado_envio`, `ultimo_envio`)
  y añade dos al final: `completo` y `mandado_a_mano`. Comprobado antes de aplicar
  qué lee cada pantalla — `PanelHome.jsx` (`faltan`), `HojaParte.jsx` (`faltan`,
  `faltan_cuantos`, `viajeros_rellenos`), `ParteViajerosPanel.jsx` (`pax_count`,
  `viajeros_rellenos`, `faltan_cuantos`, `estado_envio`, `ultimo_envio`,
  `check_in`, `check_out`) — y las tres piden `select('*')`, así que ninguna se
  rompe. `TravelersManager.jsx` no toca la vista: lee `traveler_records` con la
  política de admin.
- El cómputo de errores cuenta también `mir_response_status='rechazado'`, y
  `mandado_a_mano` marca los partes comunicados por la vía de siempre.
- **Ojo al aplicar algo parecido**: añadir columnas a un `RETURNS TABLE` cambia el
  tipo de retorno y `CREATE OR REPLACE FUNCTION` lo rechaza (42P13). Hay que tirar
  antes la vista y luego la función. El fichero `_pendiente_parte.sql` original no
  lo hacía y habría fallado a medias, con los CHECK ya ensanchados.
- Índice `traveler_records_booking_id_idx` (el semáforo hace un LATERAL por reserva).
- `tjm_purgar_partes_caducados()`: anonimiza los partes con más de 3 años desde la
  salida (art. 5.3 RD 933/2021). Solo `service_role`. **Todavía NO está programada**
  en ningún cron — es lo que queda pendiente de esta migración.

### Dos trampas del esquema que hay que tener presentes
1. `guest_bookings.nights` es **GENERATED ALWAYS AS (check_out - check_in) STORED**:
   no se inserta ni se actualiza a mano.
2. `pgcrypto` (`gen_random_bytes`, `digest`) vive en el esquema **`extensions`**.
   Cualquier función con `search_path` fijo que llame a `generate_booking_code()`
   (o a la obsoleta `issue_invoice()`) tiene que incluirlo o falla en ejecución.
   La facturación ya no depende de eso: la huella se calcula en la edge function.
3. `blocked_dates.end_date` es **inclusiva** (`check_availability` usa `end_date + 1`).

### Deuda que sigue abierta
- **Facturación**: hecho (migración `0004`). Verifactu sigue apagado a propósito: falta el certificado fiscal y no toca por calendario.
- **Parte de viajeros**: hecho (migración `0008`, 10-sep-2026). Queda **programar `tjm_purgar_partes_caducados()`** (pg_cron mensual o job de tjm-jobs) y ampliar la lista `PARENTESCOS` de `src/pages/PrecheckinPage.jsx` al catálogo del MIR, que la base ya admite.
- ⚠️ **CUENTA DE PRUEBA VIVA — BORRAR AL TERMINAR**: `prueba.panel@tiojosemaria.com` (`auth.users` + `profiles`, `role='staff'`, `is_active=true`, id `8acf898f-381d-474e-a98c-35549ef6f5a0`), creada el 10-sep-2026 para poder recorrer el panel como lo hará la madre de Jesús, que hoy no tiene cuenta. **Contraseña conocida, apuntada fuera del repo.** Se borra con `DELETE /auth/v1/admin/users/8acf898f-381d-474e-a98c-35549ef6f5a0` (service role key) + `delete from profiles where id='8acf898f-…'`.
- ✅ El perfil de prueba anterior (`prueba-parte-staff@example.invalid`) **ya no existe**: comprobado el 10-sep-2026 — ni en `profiles` ni en `auth.users`.
- ✅ **Restos de prueba en datos, limpiados** (10-sep-2026): 4 filas de `customers` (`prueba-cobro-a@`, `prueba-cobro-d@tiojosemaria.test`, dos `@example.invalid`), todas con 0 reservas, 0 pagos y 0 facturas colgando. Quedan **2 clientes** (`jjmartinezpadron@`, `jesusmartinezpadron@`) y **3 reservas**: 1 y 2 canceladas de abril y la 14 (`TJM-DD4B28`, «Jesús (prueba sync iCal)», confirmada 20→22-jul, 260 € **sin cobrar**). La 14 no tiene pagos, ni factura, ni parte de viajeros; sí tiene **una limpieza pendiente** para el 22-jul (`9d44bedc-…`). Se deja tal cual a propósito.
- Las 4 funciones ⏸️ del repo (`bot-chat`, `submit-verifactu`, `provision-access-code`,
  `trigger-reel-render`) siguen SIN desplegar (trabajo pendiente, no desfase).
- 15 funciones con `search_path` mutable (eran 16; `issue_invoice` se fue con `0004`) y 3 SECURITY DEFINER accesibles por `anon`
  (`check_is_admin`, `record_marketing_consent`, `submit_traveler_records`): deuda
  anterior a estas migraciones, detallada al final de `0001_baseline_2026-09-10.sql`.
- **`get_advisors(security)` del 10-sep-2026, después de `0008`** — nada de lo que sale lo
  introdujeron `0008` ni el despliegue de `create-payment-session`; todo es deuda previa:
  · 2 tablas con RLS activada y **cero políticas** (`otp_codes`, `rate_limits`) — quedan
    cerradas a todo el mundo salvo `service_role`, que es lo que se quiere, pero conviene
    dejarlo escrito en una política explícita en vez de fiarlo al vacío.
  · 15 funciones con `search_path` mutable (las de arriba). Las dos de `0008`
    (`tjm_parte_estado`, `tjm_purgar_partes_caducados`) lo llevan fijo y **no** salen.
  · 3 extensiones en `public` (`btree_gist`, `pg_net`, `vector`).
  · 3 SECURITY DEFINER ejecutables por `anon` y 13 por `authenticated`. Entre estas últimas
    aparece `tjm_parte_estado()`: es **deliberado** — el `GRANT EXECUTE TO authenticated`
    viene de `0003` y la función lleva su propia guardia `WHERE public.is_staff()`, así que
    un `cliente` autenticado recibe cero filas. Comprobado.
  · Protección de contraseñas filtradas (HaveIBeenPwned) **desactivada** en Auth: un clic en
    el panel de Supabase, sin coste. Pendiente.

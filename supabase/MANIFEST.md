# MANIFIESTO — Apartamentos TJM (backend Supabase)

> **Fuente de verdad: PRODUCCIÓN.** Este proyecto se ha construido en gran parte vía
> MCP-directo: el esquema y muchas edge functions se aplicaron/desplegaron contra la BD
> viva, no a través del repo. Este archivo es el índice autoritativo de QUÉ hay desplegado
> de verdad, para no volver a dudar. **Mantener actualizado** al desplegar o crear algo.
>
> - Proyecto Supabase: `nmtukksbzbnuzqsksdmw` (región UE — Fráncfort)
> - MCP UUID (en iAmasters OS): `9cbee830`
> - Última reconciliación: **2026-09-10** (migraciones 0001-0015, agente de esquema)
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
| `stripe-webhook` | **v5** | false | ✅ | Webhook de Stripe (creada 30-jun). **10-sep-2026 (tarde) — datos del pago del parte de viajeros**: al cobrar, pregunta a Stripe por el cargo (`payment_intents/{id}?expand[]=latest_charge`) y apunta en `guest_bookings` la marca y los **últimos cuatro** (`VISA ****4242`), la caducidad en `MM/AAAA`, el titular que devuelve Stripe y la fecha del cargo — los cuatro campos del anexo I A.4.d que antes no existían, sin que nadie teclee nada. **Nunca el número completo**: Stripe no lo devuelve y la base tiene un CHECK que lo impediría. El titular **no se supone**: si Stripe no da nombre, el campo se queda como estaba. Escucha además `charge.succeeded` como camino alterno, idempotente. **10-sep-2026 (mañana)**: los disparos a otras funciones ya no son `fetch().catch()` —un 404 o un 500 no rechazan la promesa, así que el fallo se perdía en silencio (así estuvo la factura sin emitirse). Ahora se comprueba el status, y si la factura falla queda una tarea en `internal_tasks`. La reserva nunca se rompe por eso: siempre 200 a Stripe |
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

### submit-ses-hospedajes — desplegada el 10-sep-2026

- `submit-ses-hospedajes` | **v7 viva** | verify_jwt false | ✅ repo — el repo y produccion vuelven a coincidir.
  - **Que hay vivo**: las **tres** comunicaciones del RD 933/2021 — parte (`A`+`PV`), reserva (`A`+`RH`) y anulacion (`B`, con lista de `codigoComunicacion`) — mas el archivado del libro-registro en el cubo privado y la accion `libro` para consultarlo por fechas.
  - **Lo desplegado es el codigo del repo SIN COMENTARIOS.** El despliegue por MCP sube los seis ficheros en una sola llamada y con comentarios suman ~110 KB, que no caben; sin ellos son 79 KB y si. **No se cambio ni una linea de logica**: se comprobo pasando el original y la version sin comentarios por `esbuild --minify` y verificando que el md5 del resultado es identico fichero a fichero. La version comentada — la que se lee — sigue siendo la del repo.
  - **Despues de desplegar** se descargo lo vivo con `get_edge_function` y se comprobo que los seis ficheros coinciden byte a byte con lo que se subio. (En la v6 dos espacios duros U+00A0 de `hoja-registro.ts` se habian convertido en espacios normales al transcribir, lo que si cambiaba `winAnsi()`; se corrigio en la v7.)
  - **Arranca**: un GET devuelve `{"error":"metodo_no_permitido"}` (405) generado por el propio codigo. Sin BOOT_ERROR.

  - ⚠️ **PENDIENTE, y no es del despliegue: los crones no pueden entrar.** `tjm-ses-reservas` y `tjm-parte-viajeros` llaman con la llave del Vault (`ses_cron_token`) y la funcion contesta **401 `token_no_valido`**, porque el secreto `SES_CRON_TOKEN` de las Edge Functions no vale o no esta puesto. Ya pasaba con la v5 (llamada de las 16:23 UTC, antes de este despliegue) y `ses_comunicaciones` esta **vacia**: el barrido no ha escrito nunca. Se arregla en Supabase, a mano, en un minuto:
    1. SQL Editor: `select decrypted_secret from vault.decrypted_secrets where name = 'ses_cron_token';`
    2. Settings → Edge Functions → Secrets: crear/actualizar `SES_CRON_TOKEN` con ese valor exacto (sin espacios ni saltos al final: la comparacion es exacta y de longitud).
    Hasta entonces no sale ninguna comunicacion de reserva ni ningun parte, y el plazo del RD 933/2021 es de 24 h.

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
| `tjm-ses-reservas` | `23 * * * *` | `tjm_disparar_ses('barrido-reservas')` → comunica al MIR las **reservas y anulaciones** pendientes (art. 6.3.a, plazo 24 h). Barrido, no trigger: se cura solo tras una caída y cubre lo que ya había pasado (creado 10-sep, migración 0010) |
| `tjm-parte-viajeros` | `0 8 * * *` | `tjm_disparar_ses('tanda')` → manda el **parte de viajeros** de las entradas del día anterior (art. 6.3.b). **Esto no existía**: la tanda sólo salía si alguien tocaba el botón del panel |
| `tjm-purgar-partes` | `40 3 1 * *` | `tjm_purgar_partes_caducados()` — anonimiza los partes de más de 3 años (art. 5.3). Complementa a `prune-traveler-records`, que borra a los 3 años + 30 días |

## Estructura de BD (resumen — el detalle vive en la BD)

- **~47 tablas** en `public`. Núcleo reservas: `guest_bookings` (tabla central, NO `bookings`), `booking_payments` (cobros, nueva 10-sep), `apartments`, `blocked_dates`, `high_seasons`, `pricing_rules` (**SÍ conectada** a `check_availability` — corregido 10-sep-2026: el MANIFEST decía lo contrario; lo que falta son las reglas, la tabla tiene 0 filas), `booking_addons`/`addons`, `invoices`, `traveler_records` (DNIs), `customers`/`customer_notes`, `email_subscribers`, `consent_log`, `cleaning_tasks`, `access_codes`, `otp_codes`, `reviews`, `blog_posts` (0 filas), `kb_chunks`/`ai_interaction_logs` (bot). Desde el 10-sep (migración `0006`), tres tablas de canales: `channel_sync_log` (resultado de cada pasada del importador), `channel_sync_conflicts` (solapes con reserva propia, abiertos hasta que una persona los cierra) y `channel_alerts` (antirrepetición de avisos). Las tres con RLS: lectura para `admin`/`staff`, escritura solo `service_role`. Desde el 10-sep (tarde, migración `0010`) una más: **`ses_comunicaciones`** — el diario de las comunicaciones de **reserva** y **anulación** del art. 6.3.a del RD 933/2021 (una fila por reserva y tipo, con estado, intentos, próximo reintento, lote, `codigos_comunicacion` y el XML mandado). Misma RLS: `service_role` escribe, `admin`/`staff` leen. **El parte de viajeros NO vive aquí**: su rastro sigue en `traveler_records`.
- **RLS**: activada en todas. Roles: `admin` (todo), `staff` (gestión diaria, desde el 10-sep), `cliente`. Tablas sensibles verificadas (30-jun): `traveler_records` y `ai_interaction_logs` → solo `service_role`; `customers`/`customer_notes` → solo admin (`check_is_admin()`); `email_subscribers`/`guest_bookings` → INSERT anónimo, SELECT admin/dueño. **Sin fugas.**
- **RPCs de aplicación** (ignorando las de extensiones pgvector/btree_gist): `check_availability`, `create_booking_hold`, `expire_booking_holds`, `generate_booking_code`, `ensure_customer_exists`, `record_marketing_consent`, `submit_traveler_records`, `schedule_cleaning_on_booking_confirmed`, `search_kb_chunks`, `check_is_admin`/`is_admin`/`is_staff`/`get_auth_role`, `cleanup_expired_otps`, `cleanup_old_rate_limits`, `prune_ai_interaction_logs`, `prune_traveler_records`, `set_updated_at`.
  Desde el 10-sep se suman los de gestión: `create_manual_booking`, `register_payment`, `move_booking`, `cancel_booking`, `set_special_price`, `close_sales`, `set_apartment_prices`, `tjm_quote_price`, `tjm_puede_gestionar`, `tjm_parte_estado`. Todos SECURITY DEFINER con `search_path` fijo, sin acceso para `anon` y con guardia interna de rol.
  Desde el 10-sep (tarde, migraciones `0010`-`0013`) se suman las del check-in legal: `set_payment_details` (los cinco datos de pago del anexo I A.4.d, con guardia contra el número de tarjeta), `tjm_ses_pendientes` + vista `v_ses_pendientes` (qué reserva o anulación queda por comunicar y a cuál se le pasó el plazo de 24 h), `tjm_libro_registro(desde, hasta)` (el libro por rango de fechas, devuelve rutas del cubo privado), `tjm_parece_tarjeta` (la medida única del PAN, usada por el CHECK y por la RPC), `tjm_disparar_ses` (llama a la edge function con la llave de Vault; si falta, NO llama y deja tarea en el panel) y los triggers `guest_bookings_pago_por_plataforma` (el titular del pago de un canal es la plataforma, no el huésped) y `booking_payments_fecha_de_pago`. Desde el 10-sep (migración `0007`) se suman las **nueve del INE**, todas SECURITY **INVOKER** (leen con la RLS de quien llama) y con `search_path` fijo: `fn_ine_norm`, `fn_ine_es_espana`, `fn_ine_provincia_por_cp`, `fn_ine_ccaa_por_cp`, `fn_ine_grupo_extranjero`, `fn_ine_casillas_residencia`, `v_ine_mes`, `v_ine_mes_residencia`, `v_ine_mes_detalle`. Sin acceso para `anon`. Desde el 10-sep (migraciones `0014`-`0015`) se suman las del check-in desde el móvil del huésped: `tjm_clave_viajero` (IMMUTABLE, identifica a una persona dentro de la reserva), `tjm_precheckin_reserva` (**la única accesible a `anon`**, con el código de reserva de secreto y limitada a la ventana del prechequeo), `tjm_guardar_pagador` (también `anon`), `tjm_checkin_personas` y `tjm_checkin_verificar` (ambas solo `authenticated`, con guardia `tjm_puede_gestionar()` dentro), y el trigger `traveler_records_normalizar` (cadena vacía → NULL).
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
| `0009_limpieza_al_apuntar_reserva.sql` | aplicada | El disparador de la limpieza era `AFTER UPDATE OF status`, asi que solo saltaba cuando una reserva CAMBIABA a `confirmed`: las que apunta la madre por telefono nacen ya `confirmed` en un INSERT y nunca generaban su tarea. Pasa a `AFTER INSERT OR UPDATE OF status`. De paso, el extra «Late check-out» se renombra a «Salida tarde, hasta las 14:00» |
| `0010_checkin_rd933.sql` | aplicada | **Los huecos de backend del RD 933/2021.** `guest_bookings`: hora real de entrada/salida, los cinco datos del pago del anexo I A.4.d, referencia del contrato, sellos de reserva/anulación comunicadas y ruta del libro-registro. `apartments`: dormitorios reales, internet y hueco para las URL de los anuncios. `traveler_records`: el parentesco pasa a la ficha del ADULTO (`parentesco_menor_id`) y `consent_privacy_at` se renombra a `informado_privacidad_at`. Tabla nueva `ses_comunicaciones`, vista `v_ses_pendientes`, RPC `set_payment_details` y `tjm_libro_registro`, cubo privado `libro-registro`, triggers de pago por plataforma y fecha de cobro, y los tres crones de arriba |
| `0011_precheckin_parentesco.sql` | aplicada | `submit_traveler_records()` reconoce `parentesco_menor_indice` (contrato nuevo del formulario) y, si el parentesco sigue llegando en la ficha del MENOR, lo pasa solo a la del adulto responsable. **Misma firma**: el front no se entera |
| `0012_guardia_pan_por_rachas.sql` | aplicada | Primer arreglo de la guardia del número de tarjeta de `0010`, que rechazaba el valor legítimo de Booking. Superada por `0013` el mismo día |
| `0013_guardia_pan_por_funcion.sql` | aplicada | `tjm_parece_tarjeta()`: cuenta los dígitos de CADA número por separado, en vez de sumarlos todos o recortar una ventana con un regex. Una sola medida para el CHECK y para la RPC, con su prueba dentro de la propia migración |
| `0014_checkin_desde_el_movil_del_huesped.sql` | aplicada | **El check-in se hace con el móvil DE CADA HUÉSPED, no con uno solo.** `submit_traveler_records()` deja de borrar a los viajeros anteriores (retira solo las fichas sin comunicar de las personas que vienen en ESA entrega, identificadas por `tjm_clave_viajero`: documento, o nombre+apellido+nacimiento para los menores) — antes el segundo móvil dejaba fuera al primero. Añade `tjm_precheckin_reserva(codigo)` para que `anon` pueda LEER su reserva al escanear el QR (el código hace de secreto y solo contesta dentro de la ventana del prechequeo), `tjm_guardar_pagador(codigo, titular)` (solo rellena si está vacío), `tjm_checkin_personas(booking_id)` y `tjm_checkin_verificar(traveler_id, coincide)` + columnas `documento_verificado_at`/`documento_verificado_por` para que quien recibe deje constancia del art. 4.3, y publica `traveler_records` en `supabase_realtime` |
| `0015_los_menores_no_tienen_documento.sql` | aplicada | Un menor puede no tener documento ni domicilio propio: la tabla los exigía a TODOS y reventaba con una niña de 8 años. Quita el `NOT NULL` de `numero_documento`, `tipo_documento` y las cuatro de dirección; a cambio, un ADULTO sin documento lo canta el CHECK `traveler_records_adulto_con_documento` (`NOT VALID`, no revalida histórico) y el trigger `traveler_records_normalizar` convierte las cadenas vacías en NULL, para que un hueco no pase por documento |

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
- Cubo **privado** `libro-registro` (10 MB, sólo `application/pdf`, migración `0010`) y política `libro_registro_staff_read`: lo escribe la edge function con clave de servicio, lo LEEN `admin` y `staff` — porque el apartado segundo.4 de la Orden INT/1922/2003 obliga a **exhibirlo** cuando lo requieran las Fuerzas y Cuerpos de Seguridad, y quien está delante cuando lo piden es la persona del alojamiento. **Que no se le ocurra a nadie hacerlo público**: dentro hay nombre, número de documento, dirección y firma de cada viajero. Ruta: `AAAA/AAAA-MM-DD-TJM-XXXXXX.pdf`
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

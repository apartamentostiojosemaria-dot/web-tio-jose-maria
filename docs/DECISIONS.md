# Decisiones técnicas — tio-jose-maria

> Una decisión de peso = una entrada, inmutable. Si deja de valer, se escribe otra que la sustituye. Las de negocio, en el OS.
> Recopiladas el 16-oct-2026 de los documentos del repo, `supabase/MANIFEST.md`, la nota de cliente del OS y `git log`
> (303 commits, 26-feb → 10-oct-2026). Se incluyen las de negocio que el sistema impone en código, con su commit.
> Commit = hash corto de este repo. «—» = no hay commit que la recoja.

| # | Decisión | Fecha | Por qué (y qué se descartó) | Estado |
|---|---|---|---|---|
| 1 | Sistema propio autónomo; **no** integrarse con MisterPlan, dejar de pagarlo a medio plazo | 22-jun-2026 · `d90781b` | `docs/OPERATIVA.md` v2. Mientras conviva, sus avisos entran por correo (#27) | vigente |
| 2 | Check-in **100 % en persona**, de 16:00 a 20:00, sin cerraduras electrónicas | 22-jun-2026 · `7f23a5e` | Lo hace la familia al dar las llaves; `provision-access-code` queda sin uso. Texto en `/condiciones` §5 | vigente |
| 3 | **Sin fianza** | 22-jun-2026 · `ea0d98f` | Se retiró la fianza con Stripe añadida ese mismo día (`37c5b3d`). `/condiciones` §6: «No se solicita ni se cobra fianza» | vigente |
| 4 | Bot IA oculto por defecto (`VITE_BOT_ENABLED`); LLM en AWS Bedrock UE | 22-jun-2026 · `200e7ca`, `b5e2ef6` | Se enciende cuando Bedrock y la base de conocimiento estén verificados | vigente (apagado) |
| 5 | Fuentes autoalojadas con `@fontsource`, sin Google Fonts | 30-jun-2026 · `dd84c39` | Legal (sin petición a terceros) y rendimiento | vigente |
| 6 | Pago con **Stripe al 100 %** al reservar en `/reservar`, retención de 15 min | 30-jun-2026 · `a11e8f9` | `create-payment-session` cobra `total_price` en el hold. Se descartó señal + resto (comentario en la función). Fuente del 100 %: estudio de cancelación del OS (18-sep) | vigente |
| 7 | **Cancelación gratis hasta 7 días** antes (100 % devuelto); con menos, un cambio de fechas gratis en 12 meses; no-show pierde el importe | 17-jul-2026 · `73fe38a` | Ratificada por Jesús el 18-sep (`4a2f922`: fecha límite en la confirmación y antes de pagar). Se descartaron 14 días, escalonada y doble tarifa (OS: `projects/2026-09-10-sustituir-misterplan/2026-09-18-politica-de-cancelacion.md` §5 bis). Un cambio posterior a 14 días: **no encontrado en repo ni OS, pendiente de confirmar** | vigente (7 días en código) |
| 8 | Esquema **solo por migración** desde el 10-sep; `0001` es una foto que no se aplica; un solo agente aplica DDL | 10-sep-2026 · `3a2387c` | Antes el esquema se hizo por MCP directo y no estaba versionado | vigente |
| 9 | Rol `staff` para la familia; **`traveler_records` cerrado a staff** (ve solo el semáforo `v_parte_estado`) | 10-sep-2026 · `3a2387c` (`0003`) | Se descartó `_pendiente_acceso.sql`, que abría `apartments` y `traveler_records` a staff | vigente |
| 10 | Facturación en **una sola puerta** (`issue-invoice`), serie propia `A` / rectificativas `R`; Verifactu apagado con huella encadenada | 10-sep-2026 · `3a2387c` (`0004`) | Se retiraron las RPC `issue_invoice` y `emitir_factura`. Serie propia para no chocar con la de MisterPlan | vigente |
| 11 | Check-in **desde el móvil de cada huésped**; no se borran las fichas de otro móvil | 10-sep-2026 · `0ffb309` (`0014`) | RD 933/2021; antes el segundo móvil dejaba fuera al primero | vigente |
| 12 | La llave del cron del MIR se lee de **Vault**; fuera el cron duplicado de Trigger.dev | 11-sep-2026 · `bced9b0` | 401 cada hora por un paso manual que nunca se dio | vigente |
| 13 | Holidu como canal con iCal y «lo paga el portal» (`ota`) como forma de cobro | 15-sep-2026 · `8ecb20b` | Holidu cobra al huésped y abona después | vigente |
| 14 | Correo al huésped al cambiar o cancelar desde el panel, solo reservas directas | 15-sep-2026 · `ccd3675` | Los portales avisan ellos | vigente |
| 15 | Registro turístico **A/JA/00060** (apartamentos turísticos, conjunto rural, 1 llave) | 16-sep-2026 · `7e8ae85` | Sustituye a VTAR/JA/00044 de `29fe995` (mismo día). Un dato legal se contrasta con el documento oficial | vigente |
| 16 | Casa del **siglo XVII** en textos públicos | 16-sep-2026 · `29fe995`; 28-sep · `9d00157` (`0053`) | Sustituye a XVIII (`b550468`, 17-jul) y XIX (`7b0bc1e`, abr) | vigente |
| 17 | Descuento de última hora −10 % si se entra en **≤ 2 días** | 16-sep-2026 · `97c355b` | Primero 5 días (`3bd4927`); Jesús: «5 son muchos» | vigente |
| 18 | MIR: los cuatro apartamentos van como **un solo establecimiento**; servicio web SOAP con HTTP basic, sin certificado de cliente | 17-sep-2026 · `cb4d0e5`, `6dfe244` | `docs/PARTE-VIAJEROS.md` | vigente |
| 19 | Las cinco credenciales del MIR, en **Vault** (no en el panel de Supabase) | 17-sep-2026 · `65a7873` (`0027`) | Una sola fuente | vigente |
| 20 | Acceso sin contraseña: **código al correo**; fuera contraseña + Google | 17-sep-2026 · `3e57c68` | Google no estaba activado y nadie tenía contraseña | vigente |
| 21 | IVA 10 % (alojamiento), en un solo sitio: `functions/issue-invoice/config.ts` | 17-sep-2026 · `893fbc6` | Art. 91.Uno.2.2.º Ley 37/1992 (MANIFEST) | vigente |
| 22 | Reservas de prueba (`source='test'`) no van a la policía ni al INE | 17-sep-2026 · `ff955f0` (`0031`) | `0007` ya las sacaba del INE | vigente |
| 23 | Huéspedes de Booking, Airbnb y Holidu reciben el correo de 7 días y el de la víspera | 17-sep-2026 · `7b98e1c` (`0030`) | Para pedirles los datos del parte | vigente |
| 24 | **Sin chimenea ni leña** en ningún texto público (web, `llms.txt`, fichas, amenities, correos, extras) | 18-sep-2026 · `32d1dcb` (`0039`) | Remates: `572dbdf` (`0044`), `8ffff24` (`0048`, fuera el extra de leña), `9d00157` (`0053`). Desde el invierno de 2026 no se sube leña. Matiz 28-sep: las **fotos** con chimenea se quedan (nota de cliente del OS, sin commit) | vigente |
| 25 | **Un solo despachador** de correos (`send-booking-reminders`); fuera llegada y salida; correo de 7 días en la ventana 7-2 | 18-sep-2026 · `a8bb333` (`0033`) | Se retiró `daily-booking-emails` de Trigger.dev y la vista `bookings_email_queue` | vigente |
| 26 | Estado `no_show` y función `marcar_no_show` | 18-sep-2026 · `4a2f922` (`0034`) | El dinero se queda; las noches que faltan quedan libres | vigente |
| 27 | Las reservas que MisterPlan avisa por correo entran solas (`misterplan-correo`, IMAP cada 10 min) | 16-sep-2026 · `6e4d172` | Se retira cuando se dé de baja MisterPlan | vigente |
| 28 | **Cada push a `main` despliega** en EasyPanel y comprueba que la web cambió | 23-sep-2026 · `fb02356` | Sustituye a «un push no despliega, se dispara a mano» (`1ac2872`, 17-sep) | vigente |
| 29 | Un feed iCal vacío **no cancela** reservas | 26-sep-2026 · `a9b71f6` (`0052`) | Holidu entra en el vigilante de canales | vigente |
| 30 | Mapa con **OpenStreetMap** | 28-sep-2026 · `9d00157` | Carto pide clave | vigente |
| 31 | Vigía de citas en IA propio, en la base de TJM | 6-oct-2026 · `fcb6459` (`0054`) | El token vive en el VPS; en la base solo su hash | vigente |
| 32 | **Lo que puede correr en la base corre en pg_cron**: el iCal pasa de Trigger.dev a `tjm-sincronizar-canales` | 9-oct-2026 · `9c24d6b` (`0055`) | El 28-sep Trigger.dev mató dos pasadas de > 120 s. Nunca dos crones para lo mismo | vigente |
| 33 | **La ley primero**: si falta un dato para el MIR, el sistema dice cuál y de quién y abre solo esa casilla; nunca reintenta en silencio | 2-oct-2026 · `55968d1`; 10-oct · `05df221` (`0060`) | TJM-8A9D74: 49 intentos sin comunicar por un dato que nadie pedía (`docs/PRD.md`) | vigente |

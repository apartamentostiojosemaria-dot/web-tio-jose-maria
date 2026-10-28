# Progreso — tio-jose-maria

> Estado vivo. **Se actualiza al cerrar cada sesión de código**, en el mismo commit. Tope: dos pantallas; lo viejo sale a
> `docs/historico/` o al log de git. Es la fuente del estado que se le enseña al cliente (en PDF, en llano).

## Etapa
- Talla: grande · Modo: professional
- Estado: OPERANDO (en producción desde may-2026; fase 1 de cimientos en curso)  <!-- IDEA · DEFINIDO · DISEÑADO · PREPARADO · CONSTRUIDO · VALIDADO · PUBLICADO · OPERANDO · MEJORANDO -->
- Negocio (contrato, fase, siguiente paso con el cliente): `estado.md` del cliente en el OS (`clients/tio-jose-maria`).

## Controles aprobados (una línea cada uno; no hay otro registro)
<!-- AAAA-MM-DD · Control NN (nombre) · aprobado por <persona y función> · prueba: <dónde está la evidencia> -->
- ninguno todavía

## Última sesión (2026-10-27)
- **Cuenta Stripe vista en el panel (28-oct)**: cuenta real `acct_1To4EoCgEreqdrCB` «Apartamentos Tio Jose Maria», correo `apartamentostiojosemaria@gmail.com`, **sin verificar**; activación empezada (tipo de empresa «Vendedor», España) y parada en «Datos personales». Pasos que quedan: datos personales (nombre, apellidos, fecha de nacimiento, domicilio, móvil, ¿ciudadano español?), datos de la empresa, productos o servicios, datos públicos, texto del cargo en el extracto, banco (IBAN), asegurar la cuenta (2FA), elementos adicionales y enviar. Las claves de la web (`sk_test`) son del entorno de prueba `acct_1To4F2CY8ixCuICR` (saldo de prueba 173,90 €).
- **Formulario cifrado de datos del titular** (`/datos/:token`, migr. `0076`, función `recibir-datos-titular` v1): para activar Stripe sin pasar DNI ni IBAN por WhatsApp. Se cifra en el navegador con la clave pública (`src/constants/datosTitularClave.js`); la privada solo en `.env.local` del OS. Probado con datos falsos: avisos de DNI/IBAN, nada en claro en la red, enlace de un uso, abusos rechazados, tabla cerrada a anónimos, lectura y borrado con el script. Campos según la lista oficial de Stripe para persona física en España (endpoint `get-requirements-for-setups`, 28-oct): nombre, apellidos, domicilio, fecha de nacimiento, móvil, correo, nacionalidad e IBAN; DNI opcional (solo si Stripe pide verificar con documento).
- **Stripe está en MODO PRUEBA** (28-oct, comprobado con una retención de prueba en nov-2027, ya borrada): `create-payment-session` devuelve `cs_test_…`. Ningún huésped puede pagar hoy en la web. Para activarlo: cuenta Stripe activada a nombre del titular (DNI, IBAN) → `sk_live` y `whsec` live con `pegar-clave.py` → webhook live → cobro real pequeño + devolución. Bloqueado por: datos del titular (Jesús con sus padres).
- «Casona» fuera de toda la web (28-oct, Jesús: «es más del norte»): ahora «casa» / «casa de pueblo» en código, `llms.txt`, JSON-LD y base (`web_config`, apartamentos, 2 artículos, historia del pueblo).
- **La casona es del siglo XVIII** (Jesús, 27-oct, confirmando lo que dijo su padre el 17-jul; el plan del 13-sep la había
  vuelto a XVII para cuadrar con los portales). Cambiado en `index.html` (JSON-LD), `public/llms.txt`, `HomePage.jsx`,
  `GuiaCazorla.jsx` y en la base (`web_config` footer/hero/intro, Albahaca, Lavanda y el artículo
  `donde-alojarse-sierra-de-cazorla-hinojares`). La iglesia de San Marcos sí es del XVII y no se toca. Pendiente fuera de la
  web: Booking, Airbnb y la ficha de Google siguen diciendo XVII.
- **Portada de prueba `/prueba/portada`** (noindex, sin enlaces): el diseño «La casa» del lienzo del 27-oct con movimiento
  (arco que se abre sobre el pueblo, ramita de olivo, fotos que se destapan y rutas que se dibujan al bajar; CSS con
  `animation-timeline: view()` y `prefers-reduced-motion`), textos de `textos-portada.md` del OS, rutas del estudio del
  entorno. `/reservar` acepta ahora `?entrada=&salida=&personas=` y busca sola: probado de la portada a la lista de
  libres (30-oct → 1-nov, Lavanda 120 €/noche). Pendiente: OK de Jesús para sustituir la portada.
- `docs/GOOGLE_BUSINESS_PROFILE.md` sin chimenea (atributo, descripción y fotos), por la regla del 18-sep.

## Sesión anterior (2026-10-26)
- Correos a direcciones tapadas: MisterPlan tapa algunas («n***@***.com») y el lector las guardaba tal cual; el de los 7 días
  de TJM-513DC3 (entra el 31-oct) falló el 24 y el 25-oct (Resend 422). Lector (`tjm-jobs`) las descarta y avisa; migr.
  `0072` aplicada (6 fichas y 6 reservas → relleno); `send-booking-email` v22 se salta lo no válido (`invalid_email`),
  probado con una reserva de prueba ya borrada. Las 3 reservas futuras (513DC3, 1682E4, 387400) no tienen correo real:
  tienen teléfono.
- `search_path` fijo: migr. `0073` aplicada; las 20 funciones de `public` que lo tenían mutable (4 `SECURITY DEFINER`) buscan
  ya en `public, extensions, pg_temp`. Probado antes en la base con vuelta atrás (mismos resultados y disparadores de
  reservas, clientes y precios bien); linter `function_search_path_mutable` a 0. T-10 del gerente cerrada (el obrero
  había fallado dos veces: c60c24, d1ec8b).
- Resto de avisos de seguridad (migr. `0074`, `0075`): fuera el permiso público de 2 funciones de disparador, de
  `tjm_ficha_reserva_viva` y de `tjm_checkin_verificar` para quien no ha entrado; `vector` y `btree_gist` a `extensions`;
  política explícita «solo el servidor» en 5 tablas. Probado: web 200, lecturas públicas 200, ficha y factura del huésped
  responden, reservas solapadas siguen rechazadas. Avisos del linter: de 93 a 60 (17 + 41 de funciones de huésped y de panel, a propósito; `pg_net`; contraseñas filtradas, de Jesús).

## Sesión anterior (2026-10-24)
- Limpieza fuera del sistema (Jesús: «lo lleva bien, no hace falta que avise»; se acumulaban 10 sin marcar del 11-sep al
  20-oct): migr. `0069` aplicada; la reserva confirmada ya no crea limpieza, `tjm_revisar()` ya no avisa y las 10 se cerraron
  con nota. Comprobado en la base: 0 pendientes, 0 avisos de limpieza, `tjm_revisar()` corre (4 abiertos, todos de Jesús).
- Copia de la base (migr. `0070`-`0071`, usuario `tjm_copia` de solo lectura): dentro de la copia nocturna cifrada del VPS,
  restaurada con 0 errores; simulacro mensual. Token de Supabase `claude-code-tjm`: caduca el 16-dic, aviso el 2-dic.
- SEO de marca: la portada cayó del top 20 del 12 al 19-oct («apartamentos tio jose maria hinojares») y hoy vuelve al 2.º
  orgánico. Datos estructurados: un solo `@id`, 7 perfiles en `sameAs` comprobados, sin chimenea. El vigía cuenta ya el
  orden orgánico (antes, la posición absoluta).
- Mantenimiento (`internal_tasks`, plantilla del 22-jun): retiradas caldera (no hay; radiadores eléctricos), piscina y tasa
  anual del registro (no existe); extintores esperan las fechas reales de Jesús.

## Sesión de antes (2026-10-16)
- Hecho: kit de repo instalado; PRD con objetivos O1-O6; fase 1 entera (1.1-1.6): parte cada hora, dato que falta se consigue,
  reglas M1-M7, F1, F4, cambios de reserva al Ministerio (F5), estancias y limpiezas que se cierran solas, tareas con responsable
  y «Tareas de la casa» en el panel, `tjm_revisiones` + vigilante de tareas programadas (migr. 0061-0063 aplicadas; función
  `submit-ses-hospedajes`, `request-review` y `send-booking-reminders` desplegadas).
- Seguridad (revisión del 16-oct, migr. 0068): el enlace de baja de los correos **no identificaba a nadie** (leía
  `customers` sin sesión y RLS no lo deja) → ahora `tjm_baja_leer` / `tjm_baja_confirmar` por token; probado en local
  con token real (muestra la cuenta) y falso (error), y la baja en la base con rollback. `record_marketing_consent` ya no
  deja dar de baja ni firmar como `admin_panel` sin ser admin. `portal_events`, `client_notifications_read` y
  `materials_library` (restos de otro proyecto) ya no se pueden escribir sin ser admin (antes, `portal_events` lo borraba cualquiera).
- 18-oct: `misterplan-correo` (Trigger.dev) se pasó de 120 s el 15 y el 18-oct **con** los límites del 9-oct puestos (la
  versión `20261009.1` es el commit 9c24d6b): eran por operación, no por pasada. Ahora busca en el servidor solo el correo de
  RuralGest/MisterPlan (41 = los 41 del registro desde el 11-sep) y un reloj corta la pasada a los 95 s sin error (la siguiente
  recoge el resto). Pasada en seco: 9 s; corte forzado a 1,5 s: termina limpia. Ningún correo se perdió en esos fallos.

## En curso
- Fase 2 hecha el 16-oct: `tjm_parte_gerente()` (0064) + función `parte-gerente` (llave GERENTE_TOKEN; GET = parte del
  negocio con revisiones frescas, POST = aviso a la familia, máx. 3/día). El gerente corre en la oficina de Hermes (VPS)
  laborables 07:10 y 15:10 y fines de semana 07:10, **en sombra** hasta ~23-oct. Plazos de pg_net corregidos (0066, 0067).

## Bloqueado (qué y por quién)
- TJM-8A9D74 (Booking, entra 30-oct): sin teléfono ni correo real del titular → fuera de plazo con el Ministerio. Lo consigue
  la familia en la extranet de Booking o MisterPlan (los avisos ya lo dicen) o sale solo si el huésped rellena su ficha.

## Siguiente paso
- Revisar una semana lo que propone el gerente en #p-tjm y pasarlo a activo (proyectos.json `modo`). Fase 3: crecimiento.

## Entorno
- Dependencias o variables nuevas desde la última sesión: ninguna.

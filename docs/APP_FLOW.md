# Flujo de la app — tio-jose-maria

> Pantallas, qué contiene cada una, qué perfil la ve y cómo se llega. Se toca en el mismo commit que una pantalla nueva.
> Fuente: rutas de `src/App.jsx`, menús de `src/components/panel/PanelApp.jsx` y `src/components/admin/AdminDashboard.jsx`
> (16-oct-2026). nginx sirve `/admin`, `/clientes`, `/auth`, `/panel` siempre con el shell de la SPA (`nginx.conf`).

## Perfiles
- **Visitante / huésped** (sin sesión): web pública, reserva, prechequeo y ficha por código de reserva.
- **Cliente** (sesión por código al correo): `/clientes`.
- **Familia** (`staff`, Mari Carmen) y **Jesús** (`admin`): `/panel` (código al correo). Solo `admin`: `/admin`.

## Web pública
| Pantalla | Perfil | Qué hace | Desde dónde se llega |
|---|---|---|---|
| `/` Home | todos | portada, apartamentos, reseñas, widget de solicitud (`notify-booking`) | buscadores, portales |
| `/apartamento/:slug` | todos | ficha, galería, disponibilidad (`check_availability`), solicitud | Home; `/apartamentos/:slug` redirige 301 |
| `/reservar` | todos | reserva con pago: hold 15 min → Stripe Checkout; recuadro de cancelación con fecha antes de pagar | Home, fichas |
| `/reservar/confirmada` | huésped | resultado del pago; enlaza a su ficha (`tjm_ficha_huesped`) | vuelta de Stripe |
| `/condiciones` | todos | condiciones de reserva (pago, check-in 16-20 h, sin fianza, cancelación 7 días) | pie, `/reservar` |
| `/privacidad` · `/aviso-legal` · `/baja` | todos | legal; baja de newsletter (`record_marketing_consent`) | pie, correos |
| `/hinojares` · `/rutas` · `/eventos` · `/guia-cazorla` | todos | pueblo, mapa de rutas (Leaflet), eventos, guía de la zona | menú |
| `/blog` · `/blog/:slug` | todos | artículos publicados | menú, buscadores |
| `*` | todos | 404 | — |

## Huésped con reserva (sin cuenta, por código `TJM-XXXXXX`)
| Pantalla | Perfil | Qué hace | Desde dónde se llega |
|---|---|---|---|
| `/precheckin` | cada viajero, desde su móvil | datos del parte (RD 933/2021) en ES/EN/DE/FR; dice cuándo se abre; el 2.º móvil solo rellena lo que falta; enlace directo a un dato que falta (`tjm_completar_dato`) | correo de confirmación, de 7 días, víspera si faltan datos; QR |
| `/guia` · `/guia/:code` | huésped | ficha viva desde la confirmación hasta 30 días tras la salida: hora de llegada, pedir factura, documento de admisión (PDF); sin código, «he perdido el enlace» (`enlace-guia`) | correos («tu guía de la casa»), `/reservar/confirmada` |
| `/admin/respuesta` | admin | pantalla visual tras confirmar/rechazar una solicitud desde el correo (`booking-status-update`) | botón del correo al dueño |

## Área de cliente `/clientes`
Sin sesión → `ClientLogin` (código al correo: `request-otp` → `verify-otp`). Con sesión → `ClientArea`, barra inferior en móvil:
Estancia · Casa (solo con reserva) · La zona · Reservas; secciones Guía completa · Extras (solo antes de llegar y si hay extras)
· Documentos. Uso real por huéspedes: pendiente de confirmar.

## Panel de la familia `/panel` (`PanelPage` → `PanelApp`)
Entra `staff` o `admin` con `is_active` ≠ false; los demás ven un aviso. Botón «vista completa» solo para admin (`b050c3f`).
| Pantalla | Qué hace |
|---|---|
| Hoy | quién llega y quién se va, avisos, salud del sistema (`tjm_salud`), «avisarme en este móvil» (push) |
| Calendario | libre / ocupado, distingue reserva de portal y cierre de canal |
| Apuntar reserva | reserva por teléfono/WhatsApp/portal (`create_manual_booking`), aviso de convivencia con MisterPlan |
| Reservas → ficha | una a una; cobrar, factura, cambiar, cancelar (con correo al huésped), no presentado; botones solo si hay algo que hacer |
| Clientes | teléfonos, notas, quién ya vino |
| Dinero | cobrado y pendiente, quién paga |
| Precios | precio por noche, temporadas, días cerrados |
| Limpiezas | qué apartamento toca (semana a la vista), fotos al cubo `limpiezas` |
| Datos de la policía / Hacer el check-in | semáforo del parte, recordatorio por WhatsApp firmado por Mari Carmen, verificación del documento en persona (art. 4.3) |

## Administración `/admin` (solo `admin`; sin sesión redirige a `/panel`)
| Grupo | Secciones |
|---|---|
| Día a día | Inicio · Calendario de reservas · Lista de reservas · Limpiezas · Parte de viajeros · Correos y avisos · Bloquear fechas |
| Dinero | Facturas · Recargos y descuentos · Temporada alta y baja |
| Huéspedes | Bandeja de mensajes · Sincronizar con Airbnb y Booking · Manual digital · Extras · Acceso de huéspedes · Opiniones |
| Tu página web | Apartamentos · Rutas · Eventos · Restaurantes y servicios · Blog · Guía para el huésped · Instrucciones |
| Ayuda | Manual y protocolos · Documentos internos · Calendario de mantenimiento |
| Más | Conversaciones del asistente · Informes del mes · Encuesta del INE · Documentos para huéspedes · Códigos QR · Ajustes generales |
Sesión con perfil no admin → pantalla «Esta cuenta no tiene acceso al panel» (`AdminNoPermission`).

## Recorridos clave
1. **Reserva directa**: ficha → `/reservar` → hold → Stripe → `stripe-webhook` confirma, cobro y factura → correo de
   confirmación con fecha límite de cancelación y enlace al prechequeo → `/guia/<código>`.
2. **Llegada**: correo de 7 días (ventana 7-2) y víspera si faltan datos → cada viajero en `/precheckin` → aviso push/correo a la
   familia → check-in en persona 16-20 h en el panel → `tjm-parte-viajeros` manda el parte a las 08:00 UTC del día siguiente.
3. **Reserva de portal**: iCal (15 min) o correo de MisterPlan (10 min) → reserva/bloqueo → comunicación al MIR (`tjm-ses-reservas`).
Elementos solo públicos: bot (apagado por `VITE_BOT_ENABLED`) y aviso de cookies; no se montan en `/admin`, `/clientes`, `/panel`.

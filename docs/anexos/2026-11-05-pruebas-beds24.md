# Pruebas de la tubería Beds24 — 5-nov-2026

> Cuenta de prueba de Beds24 (propiedad 366113, prueba gratis hasta el 19-nov). Base de producción de TJM con datos de
> prueba marcados (`source='test'`, correo `@tiojosemaria.local`, motivo «PRUEBA beds24») en noviembre de 2027, fuera de
> las ventanas de correos automáticos; todo borrado al acabar (comprobado: 0 reservas, 0 bloqueos, 0 clientes de prueba).
> Migraciones `0077`–`0079`, función `beds24-sync`. Scripts de la batería: fuera del repo (scratchpad de la sesión).

## Resultado

| Bloque | Pruebas | Superadas |
|---|---|---|
| TJM → Beds24 (bloqueos, reservas, estados, cambios de apartamento, interruptor, llave, fallo y reintento) | 22 | **22** |
| Beds24 → TJM (nueva, cambios, solicitud, grupo, aviso perdido, cambios seguidos, cancelación, modo espejo) | 12 + 4 | **16** (3 repetidas con margen real, ver abajo) |
| Cuadre noche a noche, 4 apartamentos, hoy → 31-dic-2027 | 1.688 noches | **0 diferencias** |

## Lo que encontró la batería y se arregló (no estaba en v1)

1. **Cambiar una reserva o un bloqueo de apartamento dejaba cerrado el viejo** en Beds24 (T3, T7 fallaban). El disparador
   solo mandaba el nuevo. → `0079`: cola `beds24_pendientes` con el viejo y el nuevo.
2. **Un envío rechazado (429, límite de 100 créditos / 5 min) se perdía** hasta el repaso de 10 min. → `0079`: lo
   pendiente solo se borra si Beds24 lo acepta; reintento cada minuto (T15: rechazado → pendiente con 2 intentos → enviado
   solo a los 60 s).
3. **Cada llamada pedía un token nuevo** (gasta créditos). → token de 24 h guardado en Vault (`beds24_access_token`) y
   reutilizado; comprobado: un único token en toda la batería.
4. **La URL era pública**: cualquiera podía pedir pasadas y leer ids y estados de reservas. → `0078`: llave aleatoria en
   Vault (`beds24_cron_token`) para la base y el repaso; sin llave solo se acepta el aviso de Beds24 (relee reservas,
   máx. 1 cada 30 s, responde `{ok}`) (T13).
5. **Beds24 puede contestar 200 con fallos dentro** → se trata como error.
6. **Nadie se enteraba de un fallo** → correo al operador si fallan dos pasadas seguidas (una vez cada 6 h). Se disparó de
   verdad durante el corte por créditos (11:06 Madrid) y llegó al buzón de los apartamentos.

## Medidas

- TJM → Beds24: el cambio se ve en Beds24 en **< 1 s** (la batería mide ~4,6 s porque comprueba cada 4 s).
- Beds24 → TJM: **lo que tarda Beds24 en avisar: 5–75 s** (medido con su `modifiedTime` y la llegada del aviso
  «Booking Notifier»); nuestra parte, < 1 s. Por eso P1–P3 fallaron con 60 s de espera y pasaron con 180 s (10, 16, 5 s).
- Aviso perdido o frenado: lo recoge el repaso de 10 min (P6, P7).
- Coste: ~1 crédito por envío de un apartamento, 2,1 por pasada completa. Batería entera + uso: 80,5 créditos en 2 h.

## Notas para producción

- Lo creado o cambiado **por la API** solo avisa con `actions.allowWebhooks = true`; lo de los portales y el panel, siempre.
- Beds24 **cierra sola toda fecha sin precio**: hay precios hasta el 31-dic-2027.
- El espejo no pagina más de 20 páginas de 100 reservas por pasada (de sobra para 4 apartamentos).
- Las reservas de Beds24 siguen en espejo (`promover_reservas = false`): pasarlas a `guest_bookings` es la pieza siguiente.

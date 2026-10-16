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

## Última sesión (2026-10-16)
- Hecho: kit de repo instalado; PRD con objetivos O1-O6; fase 1 entera (1.1-1.6): parte cada hora, dato que falta se consigue,
  reglas M1-M7, F1, F4, cambios de reserva al Ministerio (F5), estancias y limpiezas que se cierran solas, tareas con responsable
  y «Tareas de la casa» en el panel, `tjm_revisiones` + vigilante de tareas programadas (migr. 0061-0063 aplicadas; función
  `submit-ses-hospedajes`, `request-review` y `send-booking-reminders` desplegadas).

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

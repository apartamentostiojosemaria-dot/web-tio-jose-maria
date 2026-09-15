-- 0019 · Un bloqueo de canal dice si es una reserva o un cierre
-- ==============================================================
-- Hasta hoy todo lo que llegaba por iCal de otra web era «Ocupado por otra
-- web» en el calendario de la madre, tanto un huésped de Airbnb («Reserved»)
-- como un cierre que MisterPlan empuja a Airbnb («Airbnb (Not available)»).
-- Para ella no es lo mismo: en uno entra alguien, en el otro no se vende.
-- Medido el 15-sep-2026 en los cuatro feeds: 1 «Reserved» y 37 «Not available».
--
-- El importador (sync-ical-imports v8) lee el SUMMARY y lo deja aquí. NULL =
-- fila anterior a esta migración que el importador aún no ha repasado: el
-- panel la sigue enseñando como «Ocupado», que es el lado seguro.

ALTER TABLE public.blocked_dates
  ADD COLUMN IF NOT EXISTS external_kind text
  CHECK (external_kind IN ('reserved', 'closed'));

COMMENT ON COLUMN public.blocked_dates.external_kind IS
  'Qué es el bloqueo según el canal de origen: reserved = un huésped ocupa las noches; closed = el canal las tiene cerradas (nadie entra). NULL = bloqueo propio (source manual/cierre) o de canal aún sin clasificar.';

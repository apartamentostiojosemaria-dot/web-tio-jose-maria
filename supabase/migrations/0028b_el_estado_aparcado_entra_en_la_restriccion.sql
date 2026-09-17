-- 0028b · 'aparcado' entra en la restriccion de estados
-- ====================================================
-- La tabla solo admitia los ocho estados conocidos y rechazo el UPDATE de
-- 0028 con un 23514. La restriccion estaba bien puesta: hizo su trabajo.

ALTER TABLE public.ses_comunicaciones
  DROP CONSTRAINT ses_comunicaciones_estado_check;

ALTER TABLE public.ses_comunicaciones
  ADD CONSTRAINT ses_comunicaciones_estado_check CHECK (
    estado = ANY (ARRAY[
      'pendiente'::text, 'pendiente_de_alta'::text, 'enviado_pendiente_acuse'::text,
      'aceptado'::text, 'rechazado'::text, 'retry'::text, 'no_procede'::text,
      'enviado_a_mano'::text, 'aparcado'::text
    ])
  );

COMMENT ON CONSTRAINT ses_comunicaciones_estado_check ON public.ses_comunicaciones IS
  'Estados validos de una comunicacion al MIR. "aparcado" (17-sep-2026) = procede mandarla pero se ha decidido esperar; el barrido la salta y no se pierde. Desaparcar = volver a pendiente_de_alta.';

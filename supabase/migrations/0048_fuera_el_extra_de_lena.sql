-- 0048 — Fuera el extra «Saco de leña extra» (23-sep-2026).
-- Sin chimenea ni leña en nada desde el 18-sep (0039/0044). Estaba apagado y
-- ninguna reserva lo había pedido nunca; se borra para que nadie lo encienda.
-- (Aplicado el 23-sep con el conector; se deja aquí para el repo.)
DELETE FROM public.addons a
 WHERE a.id = 'f8cd5c2f-f35b-4772-810e-712501a9a292'
   AND NOT EXISTS (SELECT 1 FROM public.booking_addons ba WHERE ba.addon_id = a.id);

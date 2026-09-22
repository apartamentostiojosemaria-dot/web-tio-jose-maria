-- 0044 — Remata la 0039: el código 'fireplace' seguía en apartments.amenities.
-- La web ya no lo pintaba (sin etiqueta), pero el dato estaba ahí y cualquier
-- exportador (schema, portales, IA) podía volver a prometer chimenea.
update apartments
   set amenities = (select jsonb_agg(a) from jsonb_array_elements(amenities) a where a::text <> '"fireplace"')
 where amenities::text like '%fireplace%';

-- 0059 — «Mi pueblo no aparece»: nadie se queda sin poder terminar el formulario.
--
-- Auditoría del 10-oct-2026 (clients/tio-jose-maria/projects/2026-10-10-auditoria-parte-viajeros.md, B1):
-- la 0057 hizo obligatorio el municipio de la lista y la base rechazaba el que no reconocía.
-- Un huésped de una pedanía, con una grafía antigua o con una falta de ortografía no podía
-- terminar. Ahora:
--   1. tjm_validar_viajeros deja pasar el municipio sin código INE. El parte se queda en
--      faltan_datos, el panel lo pinta en rojo con el motivo (0058) y avisa a Jesús, que
--      elige el código desde el panel (tjm_fijar_municipio_viajero, 0042).
--   2. Más nombres en castellano o antiguos, comprobados uno a uno contra ine_municipios.
--      Un código por fila con su lista de alias (UPDATE … FROM aplica una sola fila por
--      municipio).

-- 1. (aplicado en producción con un reemplazo sobre la definición viva de la 0057: se quita
--    el bloque que devolvía «el municipio … no está en la lista del INE»; el resto igual.)
--    Para reconstruir desde cero, en la 0057 sustituir ese IF … END IF por este comentario:
--      -- Municipio sin código INE: se acepta («mi pueblo no aparece»). El parte se queda en
--      -- faltan_datos y avisa a Jesús, que lo elige desde el panel.

-- 2. Alias
UPDATE public.ine_municipios m
   SET nombres_norm = (SELECT array_agg(DISTINCT x)
                         FROM unnest(m.nombres_norm || ARRAY(SELECT public.fn_ine_norm(a) FROM unnest(v.alias) a)) x)
  FROM (VALUES
    ('32054', ARRAY['Orense']),
    ('15030', ARRAY['La Coruña', 'Coruña']),
    ('36051', ARRAY['Sanjenjo', 'Sangenjo']),
    ('07032', ARRAY['Mahón', 'Mahon']),
    ('07026', ARRAY['Ibiza']),
    ('46220', ARRAY['Puerto de Sagunto', 'Puerto de Sagunt']),
    ('36060', ARRAY['Villagarcía de Arosa', 'Villagarcia de Arosa']),
    ('15072', ARRAY['Rianjo']),
    ('36042', ARRAY['Puenteareas']),
    ('48057', ARRAY['Lequeitio']),
    ('20036', ARRAY['Fuenterrabía', 'Fuenterrabia']),
    ('20067', ARRAY['Rentería', 'Renteria']),
    ('48044', ARRAY['Guecho'])
  ) AS v(codigo, alias)
 WHERE m.codigo = v.codigo;

-- Las fichas españolas que se quedaron sin código vuelven a intentarlo.
UPDATE public.traveler_records t
   SET direccion_municipio_ine = public.tjm_ine_municipio(t.direccion_municipio, t.direccion_cp)
 WHERE t.direccion_municipio_ine IS NULL
   AND public.fn_ine_es_espana(t.direccion_pais)
   AND public.tjm_ine_municipio(t.direccion_municipio, t.direccion_cp) IS NOT NULL;

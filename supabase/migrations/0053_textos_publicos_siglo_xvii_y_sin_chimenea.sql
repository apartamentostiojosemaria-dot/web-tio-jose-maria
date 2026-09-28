-- 0053 — Textos y fotos públicos que se escaparon a las decisiones del 16 y el 18-sep (auditoría de la portada, 28-sep-2026).
--
-- 1. Siglo: la casa es del XVII (16-sep). La portada seguía diciendo XVIII en el subtítulo y en «historia viva».
-- 2. Sin chimenea ni leña en nada público (18-sep, migr. 0039/0044): quedaban tres artículos del blog.
--    El artículo dedicado a la chimenea (escapada-en-pareja-chimenea-sierra-cazorla) va aparte: cambia la URL.
-- 3. Cliente elegido: parejas; dos parejas juntas se aceptan; grupos no (plan de captación §4.3). Romero decía
--    «perfecto para familias o grupos».
-- (Aplicado el 28-sep con el conector de Supabase; se deja para el repo.)

update web_config set value = 'Cuatro apartamentos con alma en una casona del siglo XVII', updated_at = now()
 where key = 'hero_subtitle' and value ilike '%XVIII%';
update web_config set value = replace(value, 'siglo XVIII', 'siglo XVII'), updated_at = now()
 where key = 'intro_text' and value ilike '%XVIII%';

update apartments set description = replace(replace(description,
  'perfecto para familias o grupos que quieren espacio sin sacrificar carácter',
  'perfecto para dos parejas que viajan juntas o una familia que quiere espacio sin sacrificar carácter'),
  'Para familias que vienen a desconectar de verdad.',
  'Para los que vienen a desconectar de verdad.')
 where slug = 'romero';

update blog_posts set content = replace(content,
  '<h2>5. Cena junto a la chimenea</h2><p>En invierno, no hay nada mejor que una cena casera junto a la chimenea de leña. Todos nuestros apartamentos tienen chimenea — trae vino de la zona y disfrutad.</p>',
  '<h2>5. Una noche de estrellas</h2><p>De noche, sin contaminación lumínica, el cielo del valle del Guadiana Menor se llena de estrellas. Cena en casa, abrígate y sal al balcón o a las afueras del pueblo; en agosto, las Perseidas.</p>'),
  updated_at = now()
 where slug = '10-cosas-que-hacer-en-hinojares';

update blog_posts set content = replace(replace(content,
  '<p>Todos tienen chimenea, cocina completa y precios',
  '<p>Todos tienen calefacción, aire acondicionado, cocina completa y precios'),
  'siglo XVIII', 'siglo XVII'),
  updated_at = now()
 where slug = 'donde-alojarse-sierra-de-cazorla-hinojares';

update blog_posts set content = replace(replace(content,
  'La sierra en invierno: rutas en soledad y chimenea al volver.',
  'La sierra en invierno: rutas en soledad y la casa caliente al volver.'),
  'El invierno tiene su premio: rutas en soledad y chimenea al volver.',
  'El invierno tiene su premio: rutas en soledad y la casa caliente al volver.'),
  updated_at = now()
 where slug = 'itinerario-2-3-5-dias-sierra-cazorla-hinojares';

update blog_posts set seo_description = replace(seo_description, 'siglo XVIII', 'siglo XVII'), updated_at = now()
 where slug = 'donde-alojarse-sierra-de-cazorla-hinojares';

-- 4. Fotos rotas en /rutas: tres rutas seguían apuntando a la web antigua de WordPress (404).
--    Las mismas imágenes están en el almacenamiento propio.
update routes set image_url = replace(image_url, 'https://www.tiojosemaria.com/wp-content/uploads/2018/12/', 'https://nmtukksbzbnuzqsksdmw.supabase.co/storage/v1/object/public/apartments/website/general/'),
 images = replace(images::text, 'https://www.tiojosemaria.com/wp-content/uploads/2018/12/', 'https://nmtukksbzbnuzqsksdmw.supabase.co/storage/v1/object/public/apartments/website/general/')::jsonb
 where image_url ilike '%wp-content%' or images::text ilike '%wp-content%';

-- 0084 · The couples' getaway post still promised a fireplace (5-nov-2026 audit).
-- Rule (Jesús, 18-sep-2026): no fireplace or firewood in anything public; «casona» is never used (28-oct).
-- The URL had «chimenea» in it: new slug + 301 from the old one in nginx.conf (SEO: same post, same authority).
-- Also: «check-in» → «la entrada», and the price range matches the real one (60–75 €, not 60–90 €).
UPDATE public.blog_posts SET
  slug = 'escapada-en-pareja-sierra-cazorla',
  title = 'Escapada rural en pareja en la Sierra de Cazorla',
  excerpt = 'Cuarenta y ocho horas en una casa del siglo XVIII, rutas sin prisa y el cielo más estrellado de Jaén. Así se hace una escapada de pareja en el sur de Cazorla, sin coche a todas horas ni planes apretados.',
  seo_title = 'Escapada rural en pareja — Sierra de Cazorla, Hinojares',
  seo_description = '48 horas en una casa del siglo XVIII: rutas fáciles, el embalse de la Bolera y el cielo más estrellado de Jaén. Sin masificación y con reserva directa.',
  tags = array_remove(tags, 'chimenea'),
  content = replace(replace(replace(replace(replace(replace(replace(content,
    'La chimenea hace el resto.', 'El silencio hace el resto.'),
    'copa junto al fuego por la noche', 'una copa en casa por la noche'),
    'Los dos tienen chimenea, cocina completa para no depender de nadie, y cuestan entre 60 y 90 €',
    'Los dos tienen calefacción y aire acondicionado, cocina completa para no depender de nadie, y cuestan entre 60 y 75 €'),
    '(el check-in es de 16:00 a 20:00', '(la entrada es de 16:00 a 20:00'),
    'Cena en casa, chimenea encendida y una botella de la zona.', 'Cena en casa, sin prisa, y una botella de la zona.'),
    'La chimenea pide otoño e invierno — la berrea del ciervo en octubre y las noches largas junto al fuego.',
    'El otoño y el invierno traen la berrea del ciervo en octubre y las noches largas y tranquilas.'),
    'Y el verano cambia la chimenea por las pozas del río Turrilla.', 'Y el verano trae las pozas del río Turrilla.'),
  updated_at = now()
WHERE id = 5 AND slug = 'escapada-en-pareja-chimenea-sierra-cazorla';

-- Internal links in other posts follow the new address.
UPDATE public.blog_posts
   SET content = replace(content, '/blog/escapada-en-pareja-chimenea-sierra-cazorla', '/blog/escapada-en-pareja-sierra-cazorla')
 WHERE content LIKE '%/blog/escapada-en-pareja-chimenea-sierra-cazorla%';

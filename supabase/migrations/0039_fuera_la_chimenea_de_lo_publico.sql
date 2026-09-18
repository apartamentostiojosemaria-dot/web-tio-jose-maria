-- 0039 — Fuera la chimenea de todo lo público (decisión de Jesús, 18-sep-2026).
--
-- Desde el invierno de 2026 no se sube leña a los apartamentos: sus padres
-- no van a hacerlo. Prometer chimenea en la web, en las fichas de los
-- apartamentos o en la guía de la casa sería vender lo que no se da. Los
-- textos del código se cambian en el mismo commit; aquí va lo que vive en la
-- base. (Aplicado el 18-sep con la API de gestión; se deja para el repo.)
update apartments set features = (select jsonb_agg(f) from jsonb_array_elements(features) f where f::text not ilike '%chimenea%') where features::text ilike '%chimenea%';
update apartments set description = replace(replace(replace(description,
  'Salón con chimenea, cocina equipada', 'Salón, cocina equipada'),
  'Salón con chimenea, cocina completa', 'Salón, cocina completa'),
  'con muros de piedra a la vista y la chimenea encendida cuando aprieta el frío', 'con muros de piedra a la vista y calefacción para cuando aprieta el frío')
 where description ilike '%chimenea%';
update apartments set short_description = regexp_replace(short_description, '\s*[^.]*[Cc]himenea[^.]*\.', '', 'g') where short_description ilike '%chimenea%';
update web_config set value = 'Calefacción y aire acondicionado en cada apartamento', updated_at = now() where key = 'intro_bullet_2';
delete from apartment_instructions where category = 'chimenea';
update apartment_instructions set content = 'Cada apartamento tiene radiadores eléctricos; el termostato está en el salón. En invierno, dejadlos a mínimo por la noche.' where category = 'calefaccion';
update apartment_instructions set content = replace(content, ' Si usaste la chimenea, asegurate de que el fuego esta completamente apagado.', '') where category = 'salida';

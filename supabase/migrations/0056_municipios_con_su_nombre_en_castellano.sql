-- 0056 — Municipios que el huésped escribe en castellano y el INE tiene en valenciano o catalán.
--
-- 10-oct-2026: el parte de la reserva 111 lleva dos días parado en «faltan datos» porque
-- el huésped escribió «San Juan De Alicante» (CP 03550) y el INE lo tiene como
-- «Sant Joan d'Alacant» (03119). tjm_ine_municipio no casa y el parte no sale.
-- Se añaden las formas en castellano de los municipios con nombre solo cooficial más
-- habituales (Alicante, Valencia, Castellón, Baleares, Cataluña).
-- Las variantes van normalizadas con fn_ine_norm, igual que las de 0042.

UPDATE public.ine_municipios m
   SET nombres_norm = (SELECT array_agg(DISTINCT x) FROM unnest(m.nombres_norm || public.fn_ine_norm(v.alias)) x)
  FROM (VALUES
    -- Comprobados uno a uno contra ine_municipios el 10-oct-2026. Solo los que
    -- no casaban ya (los bilingües del INE y los acentos, «Sagunt/Sagunto» o «València», ya casan).
    -- Un código por fila: UPDATE … FROM solo aplica una fila por municipio.
    ('03119', 'San Juan de Alicante'),
    ('03047', 'Calpe'),
    ('03011', 'Alfaz del Pi'),
    ('07040', 'Palma de Mallorca'),
    ('12040', 'Castellon'),
    ('12135', 'Villarreal'),
    ('46184', 'Onteniente'),
    ('17079', 'Gerona'),
    ('25120', 'Lerida')
  ) AS v(codigo, alias)
 WHERE m.codigo = v.codigo;

-- Las fichas españolas que se quedaron sin código vuelven a intentarlo.
UPDATE public.traveler_records t
   SET direccion_municipio_ine = public.tjm_ine_municipio(t.direccion_municipio, t.direccion_cp)
 WHERE t.direccion_municipio_ine IS NULL
   AND public.fn_ine_es_espana(t.direccion_pais)
   AND public.tjm_ine_municipio(t.direccion_municipio, t.direccion_cp) IS NOT NULL;

-- Tests des fonctions catalogue / stock et des règles photos, après application des migrations.
-- Chaque cas s'exécute avec le rôle et les réglages d'un appel réel (anon, client, équipe sans / avec AAL2).
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

CREATE FUNCTION pg_temp.en_tant_que(role text, perms text, aal text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('test.permissions', perms, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', role, 'aal', aal)::text, false);
  EXECUTE format('SET ROLE %I', role);
END $$;

-- Vérifie qu'une requête échoue avec le code SQLSTATE attendu.
CREATE FUNCTION pg_temp.echoue(sql text, code text, cas text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> code THEN RAISE EXCEPTION 'ÉCHEC [%] : erreur % (%), attendu %', cas, SQLSTATE, SQLERRM, code; END IF;
    RAISE NOTICE 'ok - %', cas;
    RETURN;
  END;
  RAISE EXCEPTION 'ÉCHEC [%] : aucune erreur, attendu %', cas, code;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.en_tant_que(text, text, text), pg_temp.echoue(text, text, text) TO PUBLIC;

\set produit '\'{"id":"11111111-1111-1111-1111-111111111111","name":"iPhone 15","slug":"iphone-15","is_active":true}\''
\set variante '\'[{"capacity":"128 Go","color":"Noir","price":"450000"}]\''

-- Visiteur anonyme : aucun droit d'exécution.
SELECT pg_temp.en_tant_que('anon', '', 'aal1');
SELECT pg_temp.echoue(format('SELECT public.kyr_save_catalogue_product(%L::jsonb, %L::jsonb)', :produit, :variante), '42501', 'anon ne peut pas enregistrer un produit');
SELECT pg_temp.echoue('SELECT public.kyr_set_stock(gen_random_uuid(), 1)', '42501', 'anon ne peut pas modifier le stock');
RESET ROLE;

-- Client connecté sans permission.
SELECT pg_temp.en_tant_que('authenticated', '', 'aal2');
SELECT pg_temp.echoue(format('SELECT public.kyr_save_catalogue_product(%L::jsonb, %L::jsonb)', :produit, :variante), '42501', 'client sans permission refusé');
RESET ROLE;

-- Équipe avec permission mais SANS double authentification (correctif 20261020).
SELECT pg_temp.en_tant_que('authenticated', 'catalogue.manage,inventory.manage', 'aal1');
SELECT pg_temp.echoue(format('SELECT public.kyr_save_catalogue_product(%L::jsonb, %L::jsonb)', :produit, :variante), '42501', 'catalogue refusé sans AAL2');
SELECT pg_temp.echoue('SELECT public.kyr_deactivate_catalogue_product(gen_random_uuid())', '42501', 'désactivation refusée sans AAL2');
SELECT pg_temp.echoue('SELECT public.kyr_set_stock(gen_random_uuid(), 1)', '42501', 'stock refusé sans AAL2');
SELECT pg_temp.echoue($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('product-images', 'products/x.webp')$q$, '42501', 'envoi de photo refusé sans AAL2');
RESET ROLE;

-- Équipe avec permission ET AAL2 : cas nominaux et contrôles de prix.
SELECT pg_temp.en_tant_que('authenticated', 'catalogue.manage,inventory.manage', 'aal2');
DO $$ BEGIN
  IF public.kyr_save_catalogue_product(
       '{"id":"11111111-1111-1111-1111-111111111111","name":"iPhone 15","slug":"iphone-15","is_active":true}',
       '[{"capacity":"128 Go","color":"Noir","price":"450000","compare_at_price":"500000"}]')
     <> '11111111-1111-1111-1111-111111111111' THEN RAISE EXCEPTION 'ÉCHEC : identifiant renvoyé'; END IF;
  RAISE NOTICE 'ok - enregistrement avec AAL2';
END $$;
SELECT pg_temp.echoue(format('SELECT public.kyr_save_catalogue_product(%L::jsonb, %L::jsonb)', :produit,
  '[{"capacity":"256 Go","color":"Noir","price":"450000","compare_at_price":"450000"}]'), '22023', 'prix comparatif égal au prix refusé');
SELECT pg_temp.echoue(format('SELECT public.kyr_save_catalogue_product(%L::jsonb, %L::jsonb)', :produit,
  '[{"capacity":"256 Go","color":"Noir","price":"0"}]'), '22023', 'prix nul refusé');
SELECT pg_temp.echoue(format('SELECT public.kyr_save_catalogue_product(%L::jsonb, %L::jsonb)', :produit,
  '[{"capacity":"128 Go","color":"Noir","price":"460000"}]'), '22023', 'variante active en double refusée');
SELECT pg_temp.echoue(format('SELECT public.kyr_save_catalogue_product(%L::jsonb, %L::jsonb)',
  '{"id":"11111111-1111-1111-1111-111111111111","name":"iPhone 15","slug":"autre-slug"}', '[]'), '22023', 'changement de slug refusé');
SELECT pg_temp.echoue(format('SELECT public.kyr_save_catalogue_product(%L::jsonb, %L::jsonb)',
  '{"name":"X","slug":"x","image_url":"javascript:alert(1)"}', '[]'), '22023', 'image javascript: refusée');
INSERT INTO storage.objects (bucket_id, name) VALUES ('product-images', 'products/ok.webp');
SELECT pg_temp.echoue($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('autre-bucket', 'x')$q$, '42501', 'autre bucket refusé');
RESET ROLE;

-- Stock : la variante enregistrée plus haut.
SELECT id AS variante_id FROM public.product_variants WHERE capacity = '128 Go' \gset
SELECT pg_temp.en_tant_que('authenticated', 'inventory.manage', 'aal2');
DO $$ BEGIN
  IF public.kyr_set_stock((SELECT id FROM public.product_variants WHERE capacity = '128 Go'), 5, 'comptage') <> 5 THEN
    RAISE EXCEPTION 'ÉCHEC : stock créé'; END IF;
  RAISE NOTICE 'ok - stock créé à 5';
END $$;
RESET ROLE;
UPDATE public.inventory SET reserved_quantity = 3 WHERE variant_id = :'variante_id';
SELECT pg_temp.en_tant_que('authenticated', 'inventory.manage', 'aal2');
SELECT pg_temp.echoue(format('SELECT public.kyr_set_stock(%L::uuid, 2)', :'variante_id'), '22023', 'stock inférieur au réservé refusé');
SELECT pg_temp.echoue(format('SELECT public.kyr_set_stock(%L::uuid, -1)', :'variante_id'), '22023', 'stock négatif refusé');
SELECT pg_temp.echoue('SELECT public.kyr_set_stock(gen_random_uuid(), 1)', 'P0002', 'variante inconnue refusée');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM app.audit_log WHERE action = 'stock_set') <> 1 THEN RAISE EXCEPTION 'ÉCHEC : journal d''audit'; END IF;
  RAISE NOTICE 'ok - modification de stock journalisée';
END $$;
\echo 'TOUS LES TESTS SQL SONT PASSÉS'

-- Catalogue editor v1. Creates an atomic, RLS-preserving save RPC.
-- PRE-FLIGHT REQUIRED: verify deployed column types, constraints, table DML grants,
-- policies, helper definitions, and that this exact function signature is absent.
-- This migration is intentionally not executed here.
BEGIN;

CREATE FUNCTION public.kyr_save_catalogue_product(p_product jsonb, p_variants jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, app
AS $function$
DECLARE
  v_product_id uuid;
  v_existing_slug text;
  v_variant jsonb;
  v_variant_id uuid;
BEGIN
  IF NOT app.has_permission('catalogue.manage') THEN
    RAISE EXCEPTION 'Permission refusée pour gérer le catalogue' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_product) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Données produit invalides' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_variants) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'La liste des variantes est invalide' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT ids.variant_id
    FROM (
      SELECT nullif(btrim(item->>'id'), '')::uuid AS variant_id
      FROM jsonb_array_elements(p_variants) AS entries(item)
      WHERE jsonb_typeof(item) = 'object'
        AND nullif(btrim(item->>'id'), '') IS NOT NULL
    ) AS ids
    GROUP BY ids.variant_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Une variante ne peut apparaître qu’une fois dans la demande' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_product->>'name'), '') IS NULL OR nullif(btrim(p_product->>'slug'), '') IS NULL THEN
    RAISE EXCEPTION 'Le nom et le slug du produit sont obligatoires' USING ERRCODE = '22023';
  END IF;
  IF btrim(p_product->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_product->>'image_url'), '') ~* '^(javascript|data):' THEN
    RAISE EXCEPTION 'Le chemin d’image fourni n’est pas accepté' USING ERRCODE = '22023';
  END IF;

  v_product_id := coalesce(nullif(p_product->>'id', '')::uuid, gen_random_uuid());
  SELECT slug INTO v_existing_slug FROM public.products WHERE id = v_product_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing_slug IS DISTINCT FROM p_product->>'slug' THEN
      RAISE EXCEPTION 'Le slug existant ne peut pas être modifié' USING ERRCODE = '22023';
    END IF;
    UPDATE public.products SET
      brand_id = nullif(p_product->>'brand_id', '')::uuid,
      category_id = nullif(p_product->>'category_id', '')::uuid,
      name = btrim(p_product->>'name'),
      description = p_product->>'description',
      image_url = nullif(btrim(p_product->>'image_url'), ''),
      is_active = coalesce((p_product->>'is_active')::boolean, false),
      is_featured = coalesce((p_product->>'is_featured')::boolean, false)
    WHERE id = v_product_id;
  ELSE
    INSERT INTO public.products (id, brand_id, category_id, name, slug, description, image_url, is_active, is_featured)
    VALUES (
      v_product_id,
      nullif(p_product->>'brand_id', '')::uuid,
      nullif(p_product->>'category_id', '')::uuid,
      btrim(p_product->>'name'),
      btrim(p_product->>'slug'),
      p_product->>'description',
      nullif(btrim(p_product->>'image_url'), ''),
      coalesce((p_product->>'is_active')::boolean, false),
      coalesce((p_product->>'is_featured')::boolean, false)
    );
  END IF;

  FOR v_variant IN SELECT value FROM jsonb_array_elements(p_variants)
  LOOP
    IF jsonb_typeof(v_variant) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Une variante est invalide' USING ERRCODE = '22023';
    END IF;
    IF nullif(btrim(v_variant->>'price'), '') IS NOT NULL AND
       ((btrim(v_variant->>'price'))::numeric <= 0 OR (btrim(v_variant->>'price'))::numeric::text IN ('NaN', 'Infinity', '-Infinity')) THEN
      RAISE EXCEPTION 'Le prix d’une variante doit être strictement positif' USING ERRCODE = '22023';
    END IF;
    IF nullif(btrim(v_variant->>'compare_at_price'), '') IS NOT NULL AND
       ((btrim(v_variant->>'compare_at_price'))::numeric <= 0 OR (btrim(v_variant->>'compare_at_price'))::numeric::text IN ('NaN', 'Infinity', '-Infinity')) THEN
      RAISE EXCEPTION 'Le prix comparatif doit être strictement positif' USING ERRCODE = '22023';
    END IF;
    v_variant_id := nullif(v_variant->>'id', '')::uuid;
    IF coalesce((v_variant->>'is_active')::boolean, true) THEN
      PERFORM 1
      FROM public.product_variants pv
      WHERE pv.product_id = v_product_id
        AND pv.is_active IS TRUE
        AND pv.id IS DISTINCT FROM v_variant_id
        AND pv.capacity IS NOT DISTINCT FROM nullif(btrim(v_variant->>'capacity'), '')
        AND pv.color IS NOT DISTINCT FROM nullif(btrim(v_variant->>'color'), '')
        AND pv.sim_type IS NOT DISTINCT FROM nullif(btrim(v_variant->>'sim_type'), '')
        AND pv.condition_label IS NOT DISTINCT FROM nullif(btrim(v_variant->>'condition_label'), '')
      FOR UPDATE;
      IF FOUND THEN
        RAISE EXCEPTION 'Une variante active avec les mêmes options existe déjà' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF v_variant_id IS NULL THEN
      v_variant_id := gen_random_uuid();
      INSERT INTO public.product_variants (id, product_id, sku, capacity, color, price, compare_at_price, is_active, sim_type, condition_label)
      VALUES (
        v_variant_id, v_product_id, nullif(btrim(v_variant->>'sku'), ''),
        nullif(btrim(v_variant->>'capacity'), ''), nullif(btrim(v_variant->>'color'), ''),
        nullif(btrim(v_variant->>'price'), '')::numeric, nullif(btrim(v_variant->>'compare_at_price'), '')::numeric,
        coalesce((v_variant->>'is_active')::boolean, true),
        nullif(btrim(v_variant->>'sim_type'), ''), nullif(btrim(v_variant->>'condition_label'), '')
      );
    ELSE
      UPDATE public.product_variants SET
        sku = nullif(btrim(v_variant->>'sku'), ''),
        capacity = nullif(btrim(v_variant->>'capacity'), ''),
        color = nullif(btrim(v_variant->>'color'), ''),
        price = nullif(btrim(v_variant->>'price'), '')::numeric,
        compare_at_price = nullif(btrim(v_variant->>'compare_at_price'), '')::numeric,
        is_active = coalesce((v_variant->>'is_active')::boolean, true),
        sim_type = nullif(btrim(v_variant->>'sim_type'), ''),
        condition_label = nullif(btrim(v_variant->>'condition_label'), '')
      WHERE id = v_variant_id AND product_id = v_product_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante introuvable pour ce produit' USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  RETURN v_product_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.kyr_save_catalogue_product(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kyr_save_catalogue_product(jsonb, jsonb) TO authenticated;

-- Returns true only when an active product was deactivated. No row is deleted.
CREATE FUNCTION public.kyr_deactivate_catalogue_product(p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, app
AS $function$
DECLARE
  v_rows integer;
BEGIN
  IF NOT app.has_permission('catalogue.manage') THEN
    RAISE EXCEPTION 'Permission refusée pour gérer le catalogue' USING ERRCODE = '42501';
  END IF;
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Identifiant produit obligatoire' USING ERRCODE = '22023';
  END IF;

  UPDATE public.products
  SET is_active = false
  WHERE id = p_product_id AND is_active IS TRUE;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.kyr_deactivate_catalogue_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kyr_deactivate_catalogue_product(uuid) TO authenticated;

COMMIT;

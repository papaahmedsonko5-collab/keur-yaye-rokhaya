-- Restauré depuis le commit 73e5358 (fichier supprimé du dépôt par 04c236a alors que admin-catalogue.js appelle kyr_set_stock).
-- AVANT EXÉCUTION : vérifier en lecture seule si la fonction existe déjà en production :
--   SELECT pg_get_functiondef('public.kyr_set_stock(uuid,integer,text)'::regprocedure);
-- Si elle existe, NE PAS relancer ce fichier (CREATE FUNCTION échouerait) : comparer le corps et le garder comme trace.
-- Modification du stock par le propriétaire (quantité comptée en boutique).
-- Suit le modèle des fonctions staff_* existantes : SECURITY DEFINER, search_path vide, permission + AAL2 vérifiées par app.require_permission.
-- Écrit uniquement dans public.inventory (quantité, date) et dans le journal d'audit. Ne supprime rien.
BEGIN;

CREATE FUNCTION public.kyr_set_stock(p_variant_id uuid, p_quantity integer, p_reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_old integer;
  v_reserved integer;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 200), '');
BEGIN
  PERFORM app.require_permission('inventory.manage');
  IF p_variant_id IS NULL THEN
    RAISE EXCEPTION 'KYR_INVALID: variante obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 1000000 THEN
    RAISE EXCEPTION 'KYR_INVALID: la quantité doit être un entier entre 0 et 1 000 000' USING ERRCODE = '22023';
  END IF;

  SELECT i.quantity, i.reserved_quantity INTO v_old, v_reserved
  FROM public.inventory i WHERE i.variant_id = p_variant_id FOR UPDATE;

  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id = p_variant_id) THEN
      RAISE EXCEPTION 'KYR_NOT_FOUND: variante' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.inventory (variant_id, quantity) VALUES (p_variant_id, p_quantity);
    PERFORM app.audit_event('stock_set', 'inventory', p_variant_id::text,
      jsonb_build_object('old_quantity', NULL, 'new_quantity', p_quantity, 'reason', v_reason));
    RETURN p_quantity;
  END IF;

  IF p_quantity < v_reserved THEN
    RAISE EXCEPTION 'KYR_INVALID: la quantité ne peut pas être inférieure au stock réservé (%)', v_reserved USING ERRCODE = '22023';
  END IF;
  IF p_quantity = v_old THEN
    RETURN p_quantity;                                   -- idempotent : rien à écrire
  END IF;

  UPDATE public.inventory SET quantity = p_quantity, updated_at = now() WHERE variant_id = p_variant_id;
  PERFORM app.audit_event('stock_set', 'inventory', p_variant_id::text,
    jsonb_build_object('old_quantity', v_old, 'new_quantity', p_quantity, 'reason', v_reason));
  RETURN p_quantity;
END;
$function$;

REVOKE ALL ON FUNCTION public.kyr_set_stock(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kyr_set_stock(uuid, integer, text) TO authenticated;

COMMIT;

-- Stockage des photos produits (envoi depuis l'admin).
-- NON EXÉCUTÉE : à lancer par le propriétaire dans le SQL Editor Supabase.
-- Pré-requis : la fonction app.has_permission(text) existe (utilisée par kyr_save_catalogue_product).
-- Lecture publique des images (bucket public) ; écriture réservée à 'catalogue.manage'.
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 2097152, ARRAY['image/webp','image/jpeg','image/png'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS kyr_product_images_insert ON storage.objects;
CREATE POLICY kyr_product_images_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND app.has_permission('catalogue.manage'));

DROP POLICY IF EXISTS kyr_product_images_update ON storage.objects;
CREATE POLICY kyr_product_images_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND app.has_permission('catalogue.manage'))
  WITH CHECK (bucket_id = 'product-images' AND app.has_permission('catalogue.manage'));

DROP POLICY IF EXISTS kyr_product_images_delete ON storage.objects;
CREATE POLICY kyr_product_images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND app.has_permission('catalogue.manage'));

COMMIT;

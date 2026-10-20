-- Doublures minimales de Supabase et du schéma KYR, pour tester les migrations sur un Postgres local jetable.
-- Ce ne sont PAS les définitions de production (absentes du dépôt) : seulement ce que les migrations utilisent.
-- Réglages de test : request.jwt.claims (comme PostgREST) et test.permissions (liste séparée par des virgules).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;

CREATE SCHEMA auth;
CREATE SCHEMA app;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA auth, app, storage, public TO anon, authenticated;

CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(auth.jwt()->>'sub', '')::uuid $$;

CREATE FUNCTION app.has_permission(p text) RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT p = ANY (string_to_array(coalesce(current_setting('test.permissions', true), ''), ',')) $$;
CREATE FUNCTION app.require_permission(p text) RETURNS void LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF NOT app.has_permission(p) OR coalesce(auth.jwt()->>'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE = '42501';
  END IF;
END $$;
CREATE TABLE app.audit_log (action text, entity text, entity_id text, details jsonb, at timestamptz DEFAULT now());
CREATE FUNCTION app.audit_event(a text, e text, id text, d jsonb) RETURNS void LANGUAGE sql AS
$$ INSERT INTO app.audit_log (action, entity, entity_id, details) VALUES (a, e, id, d) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth, app TO anon, authenticated;

CREATE TABLE public.products (
  id uuid PRIMARY KEY, brand_id uuid, category_id uuid, name text NOT NULL, slug text NOT NULL UNIQUE,
  description text, image_url text, is_active boolean NOT NULL DEFAULT false, is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES public.products(id), sku text UNIQUE,
  capacity text, color text, price numeric, compare_at_price numeric, is_active boolean NOT NULL DEFAULT true,
  sim_type text, condition_label text
);
CREATE TABLE public.inventory (
  variant_id uuid PRIMARY KEY REFERENCES public.product_variants(id), quantity integer NOT NULL DEFAULT 0,
  reserved_quantity integer NOT NULL DEFAULT 0, updated_at timestamptz DEFAULT now()
);
-- Fonctions SECURITY INVOKER : en production, l'accès passe par les règles RLS ; ici, droits directs.
GRANT SELECT, INSERT, UPDATE ON public.products, public.product_variants TO authenticated;

CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

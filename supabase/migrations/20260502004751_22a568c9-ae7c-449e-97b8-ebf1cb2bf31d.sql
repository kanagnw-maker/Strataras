ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING gin(tags);
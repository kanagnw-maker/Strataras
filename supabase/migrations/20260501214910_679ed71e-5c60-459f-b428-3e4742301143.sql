
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name JSONB NOT NULL DEFAULT '{}'::jsonb, -- {el, en, de, tr, fr, es}
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories" ON public.categories
  FOR SELECT TO anon, authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage categories" ON public.categories
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  price NUMERIC(10,2),
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT TO anon, authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage products" ON public.products
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_products_category ON public.products(category_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for menu images
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true);

CREATE POLICY "Public can view menu images" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'menu-images');

CREATE POLICY "Admins upload menu images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update menu images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete menu images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'admin'));

-- Seed categories
INSERT INTO public.categories (slug, sort_order, name) VALUES
  ('menu-imeras', 1, '{"el":"Μενού Ημέρας","en":"Daily Menu","de":"Tagesmenü","tr":"Günün Menüsü","fr":"Menu du Jour","es":"Menú del Día"}'),
  ('menu-kyriakis', 2, '{"el":"Μενού Κυριακής","en":"Sunday Menu","de":"Sonntagsmenü","tr":"Pazar Menüsü","fr":"Menu du Dimanche","es":"Menú del Domingo"}'),
  ('salates', 3, '{"el":"Σαλάτες","en":"Salads","de":"Salate","tr":"Salatalar","fr":"Salades","es":"Ensaladas"}'),
  ('orektika', 4, '{"el":"Ορεκτικά","en":"Appetizers","de":"Vorspeisen","tr":"Mezeler","fr":"Entrées","es":"Entrantes"}'),
  ('mezeklikia', 5, '{"el":"Μεζεκλίκια","en":"Small Plates","de":"Kleine Gerichte","tr":"Meze Tabakları","fr":"Petits Plats","es":"Tapas"}'),
  ('kyrios-piata', 6, '{"el":"Κυρίως Πιάτα","en":"Main Courses","de":"Hauptgerichte","tr":"Ana Yemekler","fr":"Plats Principaux","es":"Platos Principales"}'),
  ('epidorpia', 7, '{"el":"Επιδόρπια","en":"Desserts","de":"Desserts","tr":"Tatlılar","fr":"Desserts","es":"Postres"}'),
  ('anapsyktika', 8, '{"el":"Αναψυκτικά","en":"Soft Drinks","de":"Erfrischungsgetränke","tr":"Meşrubatlar","fr":"Boissons","es":"Refrescos"}'),
  ('fiales-krasion', 9, '{"el":"Φιάλες Κρασιών","en":"Wine Bottles","de":"Weinflaschen","tr":"Şişe Şaraplar","fr":"Bouteilles de Vin","es":"Botellas de Vino"}'),
  ('ouza-tsipoura', 10, '{"el":"Ούζα & Τσίπουρα","en":"Ouzo & Tsipouro","de":"Ouzo & Tsipouro","tr":"Uzo & Çipuro","fr":"Ouzo & Tsipouro","es":"Ouzo y Tsipouro"}');

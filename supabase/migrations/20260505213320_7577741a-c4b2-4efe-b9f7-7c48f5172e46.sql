
-- 1. Restrict public read on restaurant_settings to only opening_hours key
DROP POLICY IF EXISTS "Anyone can view settings" ON public.restaurant_settings;

CREATE POLICY "Public can view opening hours only"
ON public.restaurant_settings
FOR SELECT
TO anon, authenticated
USING (key = 'opening_hours' OR has_role(auth.uid(), 'admin'::app_role));

-- 2. Revoke EXECUTE on SECURITY DEFINER function from public roles
-- (RLS policies still evaluate it internally; user-callable EXECUTE is unnecessary)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- 3. Restrict listing of menu-images bucket; public URLs still work (public bucket)
DROP POLICY IF EXISTS "Public can view menu images" ON storage.objects;

CREATE POLICY "Admins can list menu images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'menu-images' AND has_role(auth.uid(), 'admin'::app_role));

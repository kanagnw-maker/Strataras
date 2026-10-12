-- Allow public SELECT on the orders_enabled setting (in addition to opening_hours).
DROP POLICY IF EXISTS "Public can view opening hours only" ON public.restaurant_settings;

CREATE POLICY "Public can view public settings"
ON public.restaurant_settings
FOR SELECT
TO anon, authenticated
USING (key IN ('opening_hours', 'orders_enabled') OR has_role(auth.uid(), 'admin'::app_role));

-- Seed default value (enabled=true). Idempotent.
INSERT INTO public.restaurant_settings (key, value)
VALUES ('orders_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
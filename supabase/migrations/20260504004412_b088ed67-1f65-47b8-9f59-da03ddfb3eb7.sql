CREATE TABLE public.restaurant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings"
ON public.restaurant_settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins manage settings"
ON public.restaurant_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER restaurant_settings_set_updated_at
BEFORE UPDATE ON public.restaurant_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.restaurant_settings (key, value) VALUES (
  'opening_hours',
  '{
    "timezone": "Europe/Athens",
    "days": {
      "mon": {"closed": false, "slots": [{"open":"12:00","close":"23:30"}]},
      "tue": {"closed": false, "slots": [{"open":"12:00","close":"23:30"}]},
      "wed": {"closed": false, "slots": [{"open":"12:00","close":"23:30"}]},
      "thu": {"closed": false, "slots": [{"open":"12:00","close":"23:30"}]},
      "fri": {"closed": false, "slots": [{"open":"12:00","close":"00:30"}]},
      "sat": {"closed": false, "slots": [{"open":"12:00","close":"00:30"}]},
      "sun": {"closed": false, "slots": [{"open":"12:00","close":"23:30"}]}
    },
    "note": {"el":"","en":"","de":"","fr":"","es":"","tr":""}
  }'::jsonb
);
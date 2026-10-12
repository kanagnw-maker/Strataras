REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;

DROP POLICY IF EXISTS "Anyone can place orders" ON public.orders;
CREATE POLICY "Anyone can place orders"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  table_number IS NOT NULL
  AND table_number BETWEEN 1 AND 999
  AND total >= 0
  AND total <= 9999
  AND status = 'pending'
  AND (notes IS NULL OR length(notes) <= 1000)
  AND (lang IS NULL OR length(lang) <= 5)
);

DROP POLICY IF EXISTS "Anyone can add order items" ON public.order_items;
CREATE POLICY "Anyone can add order items"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  quantity BETWEEN 1 AND 99
  AND unit_price >= 0
  AND unit_price <= 9999
  AND length(name_snapshot) BETWEEN 1 AND 200
  AND (notes IS NULL OR length(notes) <= 500)
);
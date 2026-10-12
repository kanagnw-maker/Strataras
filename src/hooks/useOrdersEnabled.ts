import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useOrdersEnabled() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("value")
        .eq("key", "orders_enabled")
        .maybeSingle();
      if (!mounted) return;
      const v = (data?.value as { enabled?: boolean } | null) ?? null;
      setEnabled(v?.enabled !== false);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { enabled, loading };
}

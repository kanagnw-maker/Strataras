import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  table_number: z.number().int().min(1).max(999),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
        notes: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(30),
  notes: z.string().max(500).optional(),
  lang: z.string().min(2).max(5).optional().default("el"),
});

function pickName(value: unknown, lang: string): string {
  if (!value || typeof value !== "object") return "";
  const obj = value as Record<string, string | undefined>;
  return obj[lang] || obj["el"] || obj["en"] || Object.values(obj).find(Boolean) || "";
}

export const submitOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    // Respect the global "orders_enabled" toggle.
    const { data: setting } = await supabaseAdmin
      .from("restaurant_settings")
      .select("value")
      .eq("key", "orders_enabled")
      .maybeSingle();
    const enabled = (setting?.value as { enabled?: boolean } | null)?.enabled !== false;
    if (!enabled) {
      return { error: "Οι παραγγελίες είναι προσωρινά ανενεργές.", order_id: null, total: 0 };
    }

    const ids = data.items.map((i) => i.product_id);
    const { data: products, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id,name,price,active,stock_quantity")
      .in("id", ids);

    if (prodErr || !products) {
      return { error: "Αδυναμία ανάκτησης πιάτων.", order_id: null, total: 0 };
    }

    const map = new Map(products.map((p) => [p.id, p]));
    const itemsToInsert: Array<{
      product_id: string;
      name_snapshot: string;
      unit_price: number;
      quantity: number;
      notes?: string;
    }> = [];
    let total = 0;

    for (const it of data.items) {
      const p = map.get(it.product_id);
      if (!p || !p.active || p.price == null) continue;
      const price = Number(p.price);
      total += price * it.quantity;
      itemsToInsert.push({
        product_id: p.id,
        name_snapshot: pickName(p.name, data.lang),
        unit_price: price,
        quantity: it.quantity,
        notes: it.notes,
      });
    }

    if (itemsToInsert.length === 0) {
      return { error: "Κανένα έγκυρο πιάτο στην παραγγελία.", order_id: null, total: 0 };
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        table_number: data.table_number,
        total: Number(total.toFixed(2)),
        notes: data.notes,
        lang: data.lang,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("submitOrder: order insert failed", orderErr);
      return { error: "Αποτυχία αποθήκευσης παραγγελίας.", order_id: null, total: 0 };
    }

    const { error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .insert(itemsToInsert.map((it) => ({ ...it, order_id: order.id })));

    if (itemsErr) {
      console.error("submitOrder: items insert failed", itemsErr);
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      return { error: "Αποτυχία αποθήκευσης πιάτων.", order_id: null, total: 0 };
    }

    return { error: null as string | null, order_id: order.id, total: Number(total.toFixed(2)) };
  });
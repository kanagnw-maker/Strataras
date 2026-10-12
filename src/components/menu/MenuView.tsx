import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pickLocalized, t, type LangCode } from "@/lib/i18n";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AssistantBanner } from "./AssistantBanner";

type Category = { id: string; slug: string; name: any; sort_order: number };
type Product = { id: string; category_id: string; name: any; description: any; price: number | null; image_url: string | null; sort_order: number; is_favorite: boolean; stock_quantity: number };

export function MenuView({ lang }: { lang: LangCode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<Product | null>(null);

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase.from("categories").select("*").eq("active", true).order("sort_order");
      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("is_favorite", { ascending: false })
        .order("sort_order", { ascending: true });
      setCategories(cats ?? []);
      setProducts(prods ?? []);
      if (cats && cats.length > 0) setActiveCat(cats[0].id);
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const arr = map.get(p.category_id) ?? [];
      arr.push(p);
      map.set(p.category_id, arr);
    }
    return map;
  }, [products]);

  const scrollTo = (id: string) => {
    setActiveCat(id);
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-4">
      <AssistantBanner lang={lang} />

      {/* Sticky category nav */}
      <nav className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => scrollTo(c.id)}
                className={cn(
                  "shrink-0 px-5 py-2.5 rounded-full text-[15px] font-medium transition-all whitespace-nowrap border",
                  activeCat === c.id
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                )}
              >
                {pickLocalized(c.name, lang)}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </nav>

      <div className="py-8 space-y-14">
        {categories.map((cat) => {
          const items = grouped.get(cat.id) ?? [];
          return (
            <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-20">
              <div className="flex items-center gap-4 mb-7">
                <h2 className="text-2xl font-display font-semibold text-primary sm:text-5xl font-sans shadow-xl">{pickLocalized(cat.name, lang)}</h2>
                <div className="flex-1 h-px bg-border" />
              </div>

              {items.length === 0 ? (
                <p className="text-muted-foreground italic text-sm">—</p>
              ) : (
                <div className="space-y-6">
                  {items.map((p) => {
                    const sold = (p.stock_quantity ?? 0) <= 0;
                    return (
                    <article
                      key={p.id}
                      className={cn(
                        "flex gap-5 pb-6 border-b border-border/40 last:border-b-0 transition-all sm:hover:bg-card/40 sm:rounded-lg sm:p-3 sm:-mx-3",
                        sold && "opacity-60"
                      )}
                    >
                      {p.image_url && (
                        <img
                          src={p.image_url}
                          alt={pickLocalized(p.name, lang)}
                          onClick={() => !sold && setZoomed(p)}
                          className={cn(
                            "w-24 h-24 sm:w-28 sm:h-28 rounded-lg object-cover shrink-0 transition-transform",
                            sold ? "grayscale" : "cursor-zoom-in active:scale-95"
                          )}
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-end gap-2">
                          <h3 className="font-display text-[19px] sm:text-xl font-semibold text-foreground leading-snug shrink-0 max-w-[70%] truncate-0">
                            {pickLocalized(p.name, lang)}
                          </h3>
                          {sold ? (
                            <>
                              <span aria-hidden className="flex-1 border-b border-dotted border-border/70 mb-1.5 min-w-4" />
                              <span className="text-xs font-semibold uppercase tracking-wide text-destructive whitespace-nowrap leading-none px-2 py-1 rounded-full border border-destructive/40">
                                {t(lang, "outOfStock")}
                              </span>
                            </>
                          ) : p.price != null && (
                            <>
                              <span aria-hidden className="flex-1 border-b border-dotted border-border/70 mb-1.5 min-w-4" />
                              <span className="font-display text-xl sm:text-2xl font-bold text-accent whitespace-nowrap leading-none">
                                {Number(p.price).toFixed(2)}€
                              </span>
                            </>
                          )}
                        </div>
                        {pickLocalized(p.description, lang) && (
                          <p className="mt-2 text-[15px] leading-relaxed text-foreground/70">
                            {pickLocalized(p.description, lang)}
                          </p>
                        )}
                      </div>
                    </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Dialog open={!!zoomed} onOpenChange={(open) => !open && setZoomed(null)}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-2xl p-0 bg-transparent border-0 shadow-none"
          onClick={() => setZoomed(null)}
        >
          <DialogTitle className="sr-only">
            {zoomed ? pickLocalized(zoomed.name, lang) : ""}
          </DialogTitle>
          {zoomed?.image_url && (
            <div className="flex flex-col items-center gap-3 animate-scale-in">
              <img
                src={zoomed.image_url}
                alt={pickLocalized(zoomed.name, lang)}
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
              <p className="font-display text-xl text-primary-foreground bg-background/80 backdrop-blur px-4 py-2 rounded-full">
                {pickLocalized(zoomed.name, lang)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { Plus, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LangCode } from "@/lib/i18n";

export type SuggestedItem = {
  product_id: string;
  quantity: number;
  name: string;
  price: number;
};

const COPY: Record<string, { add: string; addAll: string; title: string }> = {
  el: { add: "Πρόσθεσε", addAll: "Πρόσθεσέ τα όλα", title: "Προτεινόμενο τραπέζι" },
  en: { add: "Add", addAll: "Add all", title: "Suggested table" },
  de: { add: "Hinzu", addAll: "Alle hinzufügen", title: "Vorschlag" },
  fr: { add: "Ajouter", addAll: "Tout ajouter", title: "Table suggérée" },
  es: { add: "Añadir", addAll: "Añadir todo", title: "Mesa sugerida" },
  tr: { add: "Ekle", addAll: "Hepsini ekle", title: "Önerilen sofra" },
};

export function CartSuggestCard({
  items,
  lang,
  onAdd,
  onAddAll,
}: {
  items: SuggestedItem[];
  lang: LangCode;
  onAdd: (item: SuggestedItem) => void;
  onAddAll: (items: SuggestedItem[]) => void;
}) {
  const c = COPY[lang] ?? COPY.el;
  if (items.length === 0) return null;
  const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-background p-3 not-prose">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-2">
        <ShoppingBasket className="h-3.5 w-3.5" />
        {c.title}
      </div>
      <ul className="space-y-1.5 mb-3">
        {items.map((it) => (
          <li key={it.product_id} className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground tabular-nums w-6 text-right">{it.quantity}×</span>
            <span className="flex-1 truncate text-foreground">{it.name}</span>
            <span className="text-accent font-semibold tabular-nums whitespace-nowrap">
              {(it.price * it.quantity).toFixed(2)}€
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={() => onAdd(it)}
              aria-label={c.add}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">≈ {total.toFixed(2)}€</span>
        <Button size="sm" onClick={() => onAddAll(items)} className="h-8">
          <Plus className="h-3.5 w-3.5 mr-1" />
          {c.addAll}
        </Button>
      </div>
    </div>
  );
}
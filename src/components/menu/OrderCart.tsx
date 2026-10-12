import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, Trash2, Loader2 } from "lucide-react";
import type { LangCode } from "@/lib/i18n";

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
};

const COPY: Record<string, {
  title: string; total: string; submit: string; submitting: string;
  empty: string; tableLabel: string; tablePh: string; tableHint: string;
  generalNotes: string; itemNotes: string;
}> = {
  el: {
    title: "Η παραγγελία σου",
    total: "Σύνολο",
    submit: "Στείλε παραγγελία",
    submitting: "Στέλνεται…",
    empty: "Άδειο καλάθι.",
    tableLabel: "Τραπέζι #",
    tablePh: "π.χ. 5",
    tableHint: "Σκάναρε το QR του τραπεζιού σου ή γράψε τον αριθμό.",
    generalNotes: "Σημειώσεις (προαιρετικά)",
    itemNotes: "Σημείωση",
  },
  en: { title: "Your order", total: "Total", submit: "Send order", submitting: "Sending…", empty: "Empty cart.", tableLabel: "Table #", tablePh: "e.g. 5", tableHint: "Scan your table QR or type the number.", generalNotes: "Notes (optional)", itemNotes: "Note" },
  de: { title: "Deine Bestellung", total: "Summe", submit: "Bestellung senden", submitting: "Sende…", empty: "Leerer Korb.", tableLabel: "Tisch #", tablePh: "z.B. 5", tableHint: "QR scannen oder Tischnummer eingeben.", generalNotes: "Notizen (optional)", itemNotes: "Notiz" },
  fr: { title: "Ta commande", total: "Total", submit: "Envoyer la commande", submitting: "Envoi…", empty: "Panier vide.", tableLabel: "Table #", tablePh: "ex. 5", tableHint: "Scanne le QR ou saisis le numéro.", generalNotes: "Notes (facultatif)", itemNotes: "Note" },
  es: { title: "Tu pedido", total: "Total", submit: "Enviar pedido", submitting: "Enviando…", empty: "Carrito vacío.", tableLabel: "Mesa #", tablePh: "p.ej. 5", tableHint: "Escanea el QR o escribe el número.", generalNotes: "Notas (opcional)", itemNotes: "Nota" },
  tr: { title: "Siparişin", total: "Toplam", submit: "Siparişi gönder", submitting: "Gönderiliyor…", empty: "Sepet boş.", tableLabel: "Masa #", tablePh: "örn. 5", tableHint: "QR'ı tara veya masa numarasını yaz.", generalNotes: "Notlar (isteğe bağlı)", itemNotes: "Not" },
};

export function OrderCart({
  open,
  onOpenChange,
  items,
  setItems,
  tableNumber,
  setTableNumber,
  onSubmit,
  submitting,
  lang,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: CartItem[];
  setItems: (next: CartItem[]) => void;
  tableNumber: number | null;
  setTableNumber: (n: number | null) => void;
  onSubmit: (notes: string) => void;
  submitting: boolean;
  lang: LangCode;
}) {
  const c = COPY[lang] ?? COPY.el;
  const [notes, setNotes] = useState("");
  const [tableInput, setTableInput] = useState<string>(tableNumber ? String(tableNumber) : "");

  const total = items.reduce((s, it) => s + it.price * it.quantity, 0);

  const updateQty = (id: string, delta: number) => {
    setItems(
      items
        .map((it) => (it.product_id === id ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it))
        .filter((it) => it.quantity > 0),
    );
  };

  const remove = (id: string) => setItems(items.filter((it) => it.product_id !== id));

  const handleSubmit = () => {
    const n = parseInt(tableInput, 10);
    if (!Number.isFinite(n) || n < 1 || n > 999) return;
    setTableNumber(n);
    onSubmit(notes);
  };

  const canSubmit =
    !submitting &&
    items.length > 0 &&
    Number.isFinite(parseInt(tableInput, 10)) &&
    parseInt(tableInput, 10) >= 1 &&
    parseInt(tableInput, 10) <= 999;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0 gap-0 rounded-t-2xl">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="font-display text-lg">{c.title}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">{c.empty}</p>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.product_id} className="flex items-start gap-3 pb-3 border-b border-border/40 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-foreground truncate">{it.name}</span>
                      <span className="text-accent font-semibold tabular-nums whitespace-nowrap ml-auto">
                        {(it.price * it.quantity).toFixed(2)}€
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(it.product_id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm tabular-nums">{it.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(it.product_id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto text-destructive" onClick={() => remove(it.product_id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{c.generalNotes}</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                className="text-sm"
              />
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t bg-background px-4 py-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{c.tableLabel}</label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                placeholder={c.tablePh}
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                className="text-base"
              />
              {!tableNumber && <p className="text-[11px] text-muted-foreground mt-1">{c.tableHint}</p>}
            </div>

            <div className="flex items-center justify-between text-base">
              <span className="font-medium">{c.total}</span>
              <span className="font-display text-xl font-bold text-accent tabular-nums">
                {total.toFixed(2)}€
              </span>
            </div>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full" size="lg">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> {c.submitting}
                </>
              ) : (
                c.submit
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
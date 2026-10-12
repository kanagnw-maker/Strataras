import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, pickLocalized } from "@/lib/i18n";
import { Plus, Pencil, Trash2, Upload, ImageIcon, Star, ArrowUp, ArrowDown, Clock, X, QrCode, Printer, ShoppingBasket } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const PRODUCT_TAGS = [
  { id: "vegan", label: "🌱 Vegan" },
  { id: "vegetarian", label: "🥗 Vegetarian" },
  { id: "pescetarian", label: "🐟 Pescetarian" },
  { id: "gluten_free", label: "🌾 Χωρίς γλουτένη" },
  { id: "contains_nuts", label: "🥜 Περιέχει ξηρούς καρπούς" },
  { id: "contains_dairy", label: "🥛 Περιέχει γαλακτοκομικά" },
  { id: "contains_seafood", label: "🐟 Περιέχει θαλασσινά" },
  { id: "spicy", label: "🌶️ Πικάντικο" },
] as const;

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type Category = { id: string; slug: string; name: any; sort_order: number; active: boolean };
type Product = { id: string; category_id: string; name: any; description: any; price: number | null; image_url: string | null; sort_order: number; active: boolean; is_favorite: boolean; tags: string[]; stock_quantity: number };

function AdminDashboard() {
  return (
    <Tabs defaultValue="products">
      <TabsList className="mb-6">
        <TabsTrigger value="products">Προϊόντα</TabsTrigger>
        <TabsTrigger value="categories">Κατηγορίες</TabsTrigger>
        <TabsTrigger value="hours">Ώρες</TabsTrigger>
        <TabsTrigger value="voice">Φωνή</TabsTrigger>
        <TabsTrigger value="qrcodes">QR Τραπεζιών</TabsTrigger>
        <TabsTrigger value="orders">Παραγγελίες</TabsTrigger>
      </TabsList>
      <TabsContent value="products"><ProductsManager /></TabsContent>
      <TabsContent value="categories"><CategoriesManager /></TabsContent>
      <TabsContent value="hours"><HoursManager /></TabsContent>
      <TabsContent value="voice"><VoiceManager /></TabsContent>
      <TabsContent value="qrcodes"><QRCodesManager /></TabsContent>
      <TabsContent value="orders"><OrdersSettingsManager /></TabsContent>
    </Tabs>
  );
}

/* ---------------- ORDERS SETTINGS ---------------- */

function OrdersSettingsManager() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("value")
        .eq("key", "orders_enabled")
        .maybeSingle();
      const v = (data?.value as { enabled?: boolean } | null) ?? null;
      setEnabled(v?.enabled !== false);
      setLoaded(true);
    })();
  }, []);

  const toggle = async (v: boolean) => {
    setBusy(true);
    const prev = enabled;
    setEnabled(v);
    const { error } = await supabase
      .from("restaurant_settings")
      .upsert({ key: "orders_enabled", value: { enabled: v } as any }, { onConflict: "key" });
    setBusy(false);
    if (error) {
      setEnabled(prev);
      toast.error(error.message);
    } else {
      toast.success(v ? "Οι παραγγελίες ενεργοποιήθηκαν" : "Οι παραγγελίες απενεργοποιήθηκαν");
    }
  };

  if (!loaded) return <p className="text-muted-foreground">…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="font-display text-2xl text-primary flex items-center gap-2">
        <ShoppingBasket className="h-6 w-6" /> Παραγγελίες μέσω Στρατάρα
      </h2>
      <Card className="p-5 flex items-center gap-4">
        <div className="flex-1">
          <div className="font-display text-lg">{enabled ? "Ενεργές" : "Ανενεργές"}</div>
          <p className="text-sm text-muted-foreground mt-1">
            Όταν είναι ανενεργές, ο Στρατάρας δεν προτείνει καλάθι/παραγγελία και οι πελάτες δεν μπορούν να στείλουν παραγγελία από το τραπέζι. Το μενού και οι συστάσεις παραμένουν διαθέσιμα.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} disabled={busy} />
      </Card>
    </div>
  );
}

/* ---------------- QR CODES ---------------- */

function QRCodesManager() {
  const [count, setCount] = useState(10);
  const [start, setStart] = useState(1);
  const [qrLang, setQrLang] = useState<string>("el");
  const [qrs, setQrs] = useState<Array<{ n: number; dataUrl: string }>>([]);
  const [busy, setBusy] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const buildUrl = (n: number) => `${baseUrl}/?table=${n}&lang=${qrLang}`;

  const generate = async () => {
    setBusy(true);
    try {
      const out: Array<{ n: number; dataUrl: string }> = [];
      for (let i = 0; i < count; i++) {
        const n = start + i;
        const url = buildUrl(n);
        const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
        out.push({ n, dataUrl });
      }
      setQrs(out);
    } catch (e: any) {
      toast.error(e.message ?? "Σφάλμα");
    } finally {
      setBusy(false);
    }
  };

  const printAll = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const items = qrs
      .map(
        (q) => `
        <div class="card">
          <img src="${q.dataUrl}" />
          <div class="num">Τραπέζι ${q.n}</div>
          <div class="brand">Παράταιρον</div>
        </div>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><title>QR Τραπεζιών</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: system-ui, sans-serif; margin: 0; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10mm; }
        .card { border: 1px dashed #ccc; padding: 8mm; text-align: center; page-break-inside: avoid; }
        .card img { width: 70mm; height: 70mm; }
        .num { font-size: 22pt; font-weight: 700; margin-top: 4mm; }
        .brand { font-size: 11pt; color: #666; margin-top: 2mm; }
      </style></head><body><div class="grid">${items}</div>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-2xl text-primary flex items-center gap-2">
          <QrCode className="h-6 w-6" /> QR Codes Τραπεζιών
        </h2>
        {qrs.length > 0 && (
          <Button onClick={printAll} variant="outline">
            <Printer className="h-4 w-4 mr-2" /> Εκτύπωση όλων
          </Button>
        )}
      </div>

      <Card className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Κάθε QR ανοίγει το μενού με τον αριθμό τραπεζιού και τη γλώσσα ήδη ρυθμισμένα. Παράδειγμα URL:
          <code className="ml-1 px-1 py-0.5 bg-muted rounded text-xs">{baseUrl}/?table=5&lang={qrLang}</code>
        </p>
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          <div>
            <Label>Από τραπέζι #</Label>
            <Input type="number" min={1} max={999} value={start} onChange={(e) => setStart(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div>
            <Label>Πλήθος</Label>
            <Input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Math.min(200, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <Label>Γλώσσα QR</Label>
            <Select value={qrLang} onValueChange={setQrLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={generate} disabled={busy}>
          <QrCode className="h-4 w-4 mr-2" /> Δημιουργία
        </Button>
      </Card>

      {qrs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {qrs.map((q) => (
            <Card key={q.n} className="p-3 flex flex-col items-center gap-2">
              <img src={q.dataUrl} alt={`Τραπέζι ${q.n}`} className="w-full max-w-[180px]" />
              <div className="font-display text-lg">Τραπέζι {q.n}</div>
              <a
                href={q.dataUrl}
                download={`trapezi-${q.n}.png`}
                className="text-xs text-primary hover:underline"
              >
                Λήψη PNG
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- CATEGORIES ---------------- */

function CategoriesManager() {
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCats(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (c: Category) => {
    const { error } = await supabase.from("categories").update({ active: !c.active }).eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Ενημερώθηκε"); load(); }
  };

  const remove = async (c: Category) => {
    if (!confirm(`Διαγραφή "${pickLocalized(c.name, "el")}";`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Διαγράφηκε"); load(); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-2xl text-primary">Κατηγορίες</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" />Νέα</Button>
          </DialogTrigger>
          <CategoryDialog category={editing} onSaved={() => { setOpen(false); load(); }} />
        </Dialog>
      </div>

      <div className="grid gap-3">
        {cats.map((c) => (
          <Card key={c.id} className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="font-display text-lg">{pickLocalized(c.name, "el")}</div>
              <div className="text-xs text-muted-foreground">σειρά: {c.sort_order} · {c.slug}</div>
            </div>
            <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
              </DialogTrigger>
              <CategoryDialog category={c} onSaved={() => load()} />
            </Dialog>
            <Button variant="ghost" size="icon" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CategoryDialog({ category, onSaved }: { category: Category | null; onSaved: () => void }) {
  const [name, setName] = useState<Record<string, string>>({});
  const [slug, setSlug] = useState("");
  const [sort, setSort] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(category?.name ?? {});
    setSlug(category?.slug ?? "");
    setSort(category?.sort_order ?? 0);
  }, [category]);

  const save = async () => {
    if (!slug || !name.el) { toast.error("Συμπληρώστε slug και ελληνικό όνομα"); return; }
    setBusy(true);
    const payload = { slug, name, sort_order: sort };
    const { error } = category
      ? await supabase.from("categories").update(payload).eq("id", category.id)
      : await supabase.from("categories").insert({ ...payload, active: true });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Αποθηκεύτηκε"); onSaved(); }
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{category ? "Επεξεργασία" : "Νέα"} κατηγορία</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
          <div><Label>Σειρά</Label><Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} /></div>
        </div>
        {LANGUAGES.map((l) => (
          <div key={l.code}>
            <Label>{l.flag} Όνομα ({l.label})</Label>
            <Input value={name[l.code] ?? ""} onChange={(e) => setName({ ...name, [l.code]: e.target.value })} />
          </div>
        ))}
      </div>
      <DialogFooter><Button onClick={save} disabled={busy}>Αποθήκευση</Button></DialogFooter>
    </DialogContent>
  );
}

/* ---------------- HOURS ---------------- */

type Slot = { open: string; close: string };
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type DayConfig = { closed: boolean; slots: Slot[] };
type Hours = { timezone: string; days: Record<DayKey, DayConfig>; note?: Record<string, string> };

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Δευτέρα" },
  { key: "tue", label: "Τρίτη" },
  { key: "wed", label: "Τετάρτη" },
  { key: "thu", label: "Πέμπτη" },
  { key: "fri", label: "Παρασκευή" },
  { key: "sat", label: "Σάββατο" },
  { key: "sun", label: "Κυριακή" },
];

const DEFAULT_HOURS: Hours = {
  timezone: "Europe/Athens",
  days: Object.fromEntries(
    DAYS.map((d) => [d.key, { closed: false, slots: [{ open: "12:00", close: "23:30" }] }]),
  ) as Record<DayKey, DayConfig>,
  note: {},
};

function HoursManager() {
  const [hours, setHours] = useState<Hours>(DEFAULT_HOURS);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("value")
        .eq("key", "opening_hours")
        .maybeSingle();
      if (data?.value) {
        const v = data.value as Hours;
        // merge with defaults to be safe
        setHours({
          timezone: v.timezone || DEFAULT_HOURS.timezone,
          days: { ...DEFAULT_HOURS.days, ...(v.days ?? {}) },
          note: v.note ?? {},
        });
      }
      setLoaded(true);
    })();
  }, []);

  const setDay = (k: DayKey, patch: Partial<DayConfig>) => {
    setHours((h) => ({ ...h, days: { ...h.days, [k]: { ...h.days[k], ...patch } } }));
  };
  const setSlot = (k: DayKey, idx: number, patch: Partial<Slot>) => {
    setHours((h) => {
      const slots = h.days[k].slots.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      return { ...h, days: { ...h.days, [k]: { ...h.days[k], slots } } };
    });
  };
  const addSlot = (k: DayKey) => {
    setHours((h) => ({
      ...h,
      days: { ...h.days, [k]: { ...h.days[k], slots: [...h.days[k].slots, { open: "18:00", close: "23:00" }] } },
    }));
  };
  const removeSlot = (k: DayKey, idx: number) => {
    setHours((h) => ({
      ...h,
      days: { ...h.days, [k]: { ...h.days[k], slots: h.days[k].slots.filter((_, i) => i !== idx) } },
    }));
  };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("restaurant_settings")
      .update({ value: hours as any })
      .eq("key", "opening_hours");
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Αποθηκεύτηκε");
  };

  if (!loaded) return <p className="text-muted-foreground">…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-primary flex items-center gap-2">
          <Clock className="h-6 w-6" /> Ώρες λειτουργίας
        </h2>
        <Button onClick={save} disabled={busy}>Αποθήκευση</Button>
      </div>

      <Card className="p-4 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3 items-center">
        <Label>Ζώνη ώρας</Label>
        <Input value={hours.timezone} onChange={(e) => setHours({ ...hours, timezone: e.target.value })} placeholder="Europe/Athens" />
      </Card>

      <div className="grid gap-3">
        {DAYS.map(({ key, label }) => {
          const cfg = hours.days[key];
          return (
            <Card key={key} className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="font-display text-lg w-28">{label}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{cfg.closed ? "Κλειστά" : "Ανοιχτά"}</span>
                  <Switch checked={!cfg.closed} onCheckedChange={(v) => setDay(key, { closed: !v })} />
                </div>
              </div>
              {!cfg.closed && (
                <div className="mt-3 space-y-2">
                  {cfg.slots.map((s, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input type="time" value={s.open} onChange={(e) => setSlot(key, i, { open: e.target.value })} className="w-32" />
                      <span>—</span>
                      <Input type="time" value={s.close} onChange={(e) => setSlot(key, i, { close: e.target.value })} className="w-32" />
                      <Button variant="ghost" size="icon" onClick={() => removeSlot(key, i)} title="Αφαίρεση">
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addSlot(key)}>
                    <Plus className="h-3 w-3 mr-1" /> Προσθήκη βάρδιας
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-4 space-y-3">
        <Label className="text-base font-semibold">Σημείωση (π.χ. αργίες) ανά γλώσσα</Label>
        {LANGUAGES.map((l) => (
          <div key={l.code} className="grid grid-cols-[80px_1fr] gap-2 items-center">
            <span className="text-sm">{l.flag} {l.code.toUpperCase()}</span>
            <Input
              value={hours.note?.[l.code] ?? ""}
              onChange={(e) => setHours({ ...hours, note: { ...(hours.note ?? {}), [l.code]: e.target.value } })}
              placeholder="—"
            />
          </div>
        ))}
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>Αποθήκευση</Button>
      </div>
    </div>
  );
}

/* ---------------- PRODUCTS ---------------- */

function ProductsManager() {
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data: c } = await supabase.from("categories").select("*").order("sort_order");
    const { data: p } = await supabase
      .from("products")
      .select("*")
      .order("is_favorite", { ascending: false })
      .order("sort_order", { ascending: true });
    setCats(c ?? []); setProducts(p ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = filterCat === "all" ? products : products.filter((p) => p.category_id === filterCat);

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message); else load();
  };

  const toggleFavorite = async (p: Product) => {
    const { error } = await supabase.from("products").update({ is_favorite: !p.is_favorite }).eq("id", p.id);
    if (error) toast.error(error.message); else load();
  };

  const updateStock = async (p: Product, delta: number) => {
    const next = Math.max(0, (p.stock_quantity ?? 0) + delta);
    if (next === p.stock_quantity) return;
    const { error } = await supabase.from("products").update({ stock_quantity: next }).eq("id", p.id);
    if (error) toast.error(error.message); else load();
  };

  const move = async (p: Product, direction: "up" | "down") => {
    // Find neighbours in same category AND same favorite group
    const siblings = products
      .filter((x) => x.category_id === p.category_id && x.is_favorite === p.is_favorite)
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    const idx = siblings.findIndex((x) => x.id === p.id);
    const neighbour = direction === "up" ? siblings[idx - 1] : siblings[idx + 1];
    if (!neighbour) return;
    // Swap sort_order. If equal, bump to ensure a difference.
    const a = p.sort_order;
    const b = neighbour.sort_order;
    const newA = a === b ? (direction === "up" ? b - 1 : b + 1) : b;
    const newB = a === b ? a : a;
    const [r1, r2] = await Promise.all([
      supabase.from("products").update({ sort_order: newA }).eq("id", p.id),
      supabase.from("products").update({ sort_order: newB }).eq("id", neighbour.id),
    ]);
    if (r1.error || r2.error) toast.error((r1.error || r2.error)!.message);
    else load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`Διαγραφή "${pickLocalized(p.name, "el")}";`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success("Διαγράφηκε"); load(); }
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h2 className="font-display text-2xl text-primary">Προϊόντα</h2>
        <div className="flex gap-2 items-center">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλες οι κατηγορίες</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{pickLocalized(c.name, "el")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" />Νέο</Button>
            </DialogTrigger>
            <ProductDialog product={editing} categories={cats} defaultCategoryId={filterCat !== "all" ? filterCat : null} onSaved={() => { setOpen(false); load(); }} />
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map((p) => {
          const cat = cats.find((c) => c.id === p.category_id);
          return (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              {p.image_url ? (
                <img src={p.image_url} alt="" className="w-16 h-16 rounded-md object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg truncate flex items-center gap-2">
                  {p.is_favorite && <Star className="h-4 w-4 fill-accent text-accent shrink-0" />}
                  <span className="truncate">{pickLocalized(p.name, "el")}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {cat ? pickLocalized(cat.name, "el") : "—"} {p.price != null && `· ${Number(p.price).toFixed(2)}€`}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Απόθεμα:</span>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateStock(p, -1)} disabled={(p.stock_quantity ?? 0) <= 0} title="-1">−</Button>
                  <span className={cn(
                    "text-xs font-semibold tabular-nums min-w-[2ch] text-center",
                    (p.stock_quantity ?? 0) === 0 && "text-destructive"
                  )}>
                    {(p.stock_quantity ?? 0) === 0 ? "Εξαντλήθηκε" : p.stock_quantity}
                  </span>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateStock(p, +1)} title="+1">+</Button>
                </div>
              </div>
              <div className="flex flex-col">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(p, "up")} title="Πάνω">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(p, "down")} title="Κάτω">
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleFavorite(p)}
                title={p.is_favorite ? "Αφαίρεση από αγαπημένα" : "Σήμανση ως αγαπημένο"}
              >
                <Star className={p.is_favorite ? "h-4 w-4 fill-accent text-accent" : "h-4 w-4 text-muted-foreground"} />
              </Button>
              <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} />
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                </DialogTrigger>
                <ProductDialog product={p} categories={cats} defaultCategoryId={null} onSaved={() => load()} />
              </Dialog>
              <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-muted-foreground text-center py-8">Καμία καταχώρηση.</p>}
      </div>
    </div>
  );
}

function ProductDialog({ product, categories, defaultCategoryId, onSaved }:
  { product: Product | null; categories: Category[]; defaultCategoryId: string | null; onSaved: () => void }) {
  const [name, setName] = useState<Record<string, string>>({});
  const [description, setDescription] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [sort, setSort] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [stock, setStock] = useState<string>("0");

  useEffect(() => {
    setName(product?.name ?? {});
    setDescription(product?.description ?? {});
    setPrice(product?.price != null ? String(product.price) : "");
    setCategoryId(product?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "");
    setSort(product?.sort_order ?? 0);
    setImageUrl(product?.image_url ?? null);
    setTags(product?.tags ?? []);
    setStock(String(product?.stock_quantity ?? 0));
  }, [product, defaultCategoryId, categories]);

  const upload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("menu-images").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
  };

  const save = async () => {
    if (!name.el || !categoryId) { toast.error("Όνομα (EL) και κατηγορία απαιτούνται"); return; }
    setBusy(true);
    const payload = {
      category_id: categoryId,
      name, description,
      price: price ? Number(price) : null,
      image_url: imageUrl,
      sort_order: sort,
      tags,
      stock_quantity: Math.max(0, Math.floor(Number(stock) || 0)),
    };
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert({ ...payload, active: true });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Αποθηκεύτηκε"); onSaved(); }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{product ? "Επεξεργασία" : "Νέο"} προϊόν</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label>Κατηγορία</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Επιλέξτε" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{pickLocalized(c.name, "el")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Σειρά</Label><Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} /></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label>Τιμή (€)</Label><Input type="number" step="0.10" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="προαιρετική" /></div>
          <div>
            <Label>Απόθεμα</Label>
            <Input type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Φωτογραφία</Label>
            <div className="flex gap-2 items-center">
              <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} disabled={uploading} />
              {uploading && <span className="text-xs text-muted-foreground"><Upload className="h-3 w-3 inline animate-pulse" /></span>}
            </div>
            {imageUrl && <img src={imageUrl} alt="" className="mt-2 w-20 h-20 object-cover rounded-md" />}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">Όνομα</Label>
          {LANGUAGES.map((l) => (
            <div key={l.code} className="grid grid-cols-[80px_1fr] gap-2 items-center">
              <span className="text-sm">{l.flag} {l.code.toUpperCase()}</span>
              <Input value={name[l.code] ?? ""} onChange={(e) => setName({ ...name, [l.code]: e.target.value })} />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">Περιγραφή</Label>
          {LANGUAGES.map((l) => (
            <div key={l.code} className="grid grid-cols-[80px_1fr] gap-2 items-start">
              <span className="text-sm pt-2">{l.flag} {l.code.toUpperCase()}</span>
              <Textarea rows={2} value={description[l.code] ?? ""} onChange={(e) => setDescription({ ...description, [l.code]: e.target.value })} />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">Ετικέτες (αλλεργίες & διατροφή)</Label>
          <p className="text-xs text-muted-foreground">Βοηθούν τον AI βοηθό να δίνει σωστές προτάσεις στους πελάτες.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {PRODUCT_TAGS.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted transition-colors"
              >
                <Checkbox
                  checked={tags.includes(tag.id)}
                  onCheckedChange={(v) =>
                    setTags((prev) => (v ? [...prev, tag.id] : prev.filter((t) => t !== tag.id)))
                  }
                />
                <span className="text-sm">{tag.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter><Button onClick={save} disabled={busy}>Αποθήκευση</Button></DialogFooter>
    </DialogContent>
  );
}

/* ---------------- VOICE ---------------- */

type VoiceConfig = {
  voice_id: string;
  model_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
};

const VOICE_DEFAULTS: VoiceConfig = {
  voice_id: "JBFqnCBsd6RMkjVDRZzb",
  model_id: "eleven_multilingual_v2",
  stability: 0.45,
  similarity_boost: 0.8,
  style: 0.35,
  use_speaker_boost: true,
  speed: 1.0,
};

function VoiceManager() {
  const [cfg, setCfg] = useState<VoiceConfig>(VOICE_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("value")
        .eq("key", "voice")
        .maybeSingle();
      if (data?.value) setCfg({ ...VOICE_DEFAULTS, ...(data.value as Partial<VoiceConfig>) });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("restaurant_settings")
      .upsert({ key: "voice", value: cfg as any }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Αποθηκεύτηκε");
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Γεια σου! Είμαι ο Στρατάρας από τη Μυτιλήνη. Καλωσήρθες στο τραπέζι μου!",
          override: cfg,
        }),
      });
      if (!res.ok) {
        toast.error(`Σφάλμα δοκιμής (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
    } catch (e: any) {
      toast.error(e?.message ?? "Σφάλμα");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Φόρτωση…</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-2xl text-primary mb-1">Φωνή Στρατάρα</h2>
        <p className="text-sm text-muted-foreground">Ρυθμίσεις ElevenLabs για το TTS του βοηθού.</p>
      </div>

      <Card className="p-5 space-y-5">
        <div className="space-y-2">
          <Label>Voice ID</Label>
          <Input
            value={cfg.voice_id}
            onChange={(e) => setCfg({ ...cfg, voice_id: e.target.value.trim() })}
            placeholder="π.χ. JBFqnCBsd6RMkjVDRZzb"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Στο ElevenLabs → Voices → πάτα το κουμπί <strong>ID</strong> πάνω στη φωνή σου.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Model</Label>
          <Select value={cfg.model_id} onValueChange={(v) => setCfg({ ...cfg, model_id: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="eleven_multilingual_v2">Multilingual v2 (καλύτερη ποιότητα)</SelectItem>
              <SelectItem value="eleven_turbo_v2_5">Turbo v2.5 (γρηγορότερο)</SelectItem>
              <SelectItem value="eleven_v3">v3 (alpha)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SliderRow label="Σταθερότητα (Stability)" value={cfg.stability} min={0} max={1} step={0.05} onChange={(v) => setCfg({ ...cfg, stability: v })} />
        <SliderRow label="Ομοιότητα (Similarity Boost)" value={cfg.similarity_boost} min={0} max={1} step={0.05} onChange={(v) => setCfg({ ...cfg, similarity_boost: v })} />
        <SliderRow label="Στυλ (Style)" value={cfg.style} min={0} max={1} step={0.05} onChange={(v) => setCfg({ ...cfg, style: v })} />
        <SliderRow label="Ταχύτητα (Speed)" value={cfg.speed} min={0.7} max={1.2} step={0.05} onChange={(v) => setCfg({ ...cfg, speed: v })} />

        <div className="flex items-center justify-between">
          <Label>Speaker Boost</Label>
          <Switch checked={cfg.use_speaker_boost} onCheckedChange={(v) => setCfg({ ...cfg, use_speaker_boost: v })} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={test} disabled={testing} variant="outline" className="flex-1">
            {testing ? "Δοκιμή…" : "🔊 Δοκιμή φωνής"}
          </Button>
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? "Αποθήκευση…" : "Αποθήκευση"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        <span className="text-sm font-mono text-muted-foreground">{value.toFixed(2)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Volume2, VolumeX, Square, Loader2, Sparkles, RotateCcw, ShoppingBasket } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askMenuAssistant } from "@/server/menu-assistant.functions";
import { submitOrder } from "@/lib/orders.functions";
import { useTTS } from "@/hooks/useTTS";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { LangCode } from "@/lib/i18n";
import strataras from "@/assets/strataras.png";
import { CartSuggestCard, type SuggestedItem } from "./CartSuggestCard";
import { OrderCart, type CartItem } from "./OrderCart";
import { useTableNumber } from "@/hooks/useTableNumber";
import { useOrdersEnabled } from "@/hooks/useOrdersEnabled";

type Msg = { role: "user" | "assistant"; content: string; suggested?: SuggestedItem[] };

const SUGGESTIONS: Record<string, string[]> = {
  el: [
    "Είμαστε 4, στήσε τραπέζι 🍽️",
    "Τι να πάρω για αρχή;",
    "Έχω 50€, τι λες;",
    "Vegan είμαι, βάλε μου κάτι",
  ],
  en: [
    "We're 4 — set the table 🍽️",
    "What should I start with?",
    "I've got €50, what do you say?",
    "I'm vegan, hook me up",
  ],
  de: ["Wir sind zu 4 — deck den Tisch 🍽️", "Womit soll ich anfangen?", "Ich hab 50€, was meinst du?", "Ich bin vegan, leg los"],
  fr: ["On est 4 — dresse la table 🍽️", "Par quoi je commence ?", "J'ai 50€, tu dis quoi ?", "Je suis végan, vas-y"],
  es: ["Somos 4 — monta la mesa 🍽️", "¿Por dónde empiezo?", "Tengo 50€, ¿qué dices?", "Soy vegano, ponme algo"],
  tr: ["4 kişiyiz — sofrayı kur 🍽️", "Ne ile başlayayım?", "50€ var, ne dersin?", "Veganım, bana göre ayarla"],
};

const PLACEHOLDERS: Record<string, string> = {
  el: "Ρώτα κάτι για το μενού…",
  en: "Ask anything about the menu…",
  de: "Frag etwas zur Speisekarte…",
  fr: "Posez une question sur le menu…",
  es: "Pregunta sobre el menú…",
  tr: "Menü hakkında sor…",
};

const TITLES: Record<string, string> = {
  el: "Στρατάρας",
  en: "Strataras",
  de: "Strataras",
  fr: "Strataras",
  es: "Strataras",
  tr: "Strataras",
};

const INTRO: Record<string, string> = {
  el: "Καλώς τον! Στρατάρας εδώ, από Μυτιλήνη. Πες μου πόσοι είστε και τι σας γουστάρει — σου στήνω τραπέζι να γλείφεις τα δάχτυλα. 🔥🍷",
  en: "Yo! Strataras here, from Mytilene. Tell me how many you are and what you're into — I'll set you a table you'll remember. 🔥🍷",
  de: "Hey! Strataras hier, aus Mytilini. Sag mir wie viele ihr seid und worauf ihr Bock habt — ich deck euch einen Tisch zum Niederknien. 🔥🍷",
  fr: "Salut ! Strataras, de Mytilène. Dis-moi combien vous êtes et ce qui vous tente — je te dresse une table dont tu te souviendras. 🔥🍷",
  es: "¡Eh! Strataras aquí, de Mitilene. Dime cuántos sois y qué os apetece — os monto una mesa de las que se recuerdan. 🔥🍷",
  tr: "Selam! Ben Strataras, Midilli'den. Kaç kişisiniz, ne seversiniz söyle — sana unutulmaz bir sofra kurarım. 🔥🍷",
};

const TTS_LABELS: Record<string, { read: string; stop: string; replay: string; mute: string; unmute: string }> = {
  el: { read: "Διάβασε", stop: "Σταμάτα", replay: "Επανάληψη", mute: "Σίγαση", unmute: "Ενεργοποίηση ήχου" },
  en: { read: "Read", stop: "Stop", replay: "Replay", mute: "Mute", unmute: "Unmute" },
  de: { read: "Vorlesen", stop: "Stopp", replay: "Wiederholen", mute: "Stumm", unmute: "Ton an" },
  fr: { read: "Lire", stop: "Arrêter", replay: "Répéter", mute: "Muet", unmute: "Activer le son" },
  es: { read: "Leer", stop: "Detener", replay: "Repetir", mute: "Silenciar", unmute: "Activar sonido" },
  tr: { read: "Oku", stop: "Dur", replay: "Tekrarla", mute: "Sessiz", unmute: "Sesi aç" },
};

const CART_LABELS: Record<string, { view: string; items: string; sent: string; sentBody: string; followUp: string }> = {
  el: { view: "Δες παραγγελία", items: "πιάτα", sent: "✅ Παραγγελία στάλθηκε!", sentBody: "Έγινε αδέρφι, σε λίγο φτάνει στο τραπέζι σου. Θες κάτι άλλο; 🍷", followUp: "Έγινε! Η παραγγελία πήγε στην κουζίνα. Θες να σου βάλω κάτι ακόμα;" },
  en: { view: "View order", items: "items", sent: "✅ Order sent!", sentBody: "Done, mate — coming right up. Anything else? 🍷", followUp: "Done! Order's in. Want anything else?" },
  de: { view: "Bestellung ansehen", items: "Stk.", sent: "✅ Bestellung gesendet!", sentBody: "Erledigt — kommt gleich. Noch was? 🍷", followUp: "Bestellung ist drin. Noch was?" },
  fr: { view: "Voir la commande", items: "plats", sent: "✅ Commande envoyée !", sentBody: "C'est parti — ça arrive. Autre chose ? 🍷", followUp: "Commande envoyée. Autre chose ?" },
  es: { view: "Ver pedido", items: "platos", sent: "✅ ¡Pedido enviado!", sentBody: "Hecho — ya viene. ¿Algo más? 🍷", followUp: "Pedido enviado. ¿Algo más?" },
  tr: { view: "Siparişi gör", items: "ürün", sent: "✅ Sipariş gönderildi!", sentBody: "Tamamdır — geliyor. Başka bir şey? 🍷", followUp: "Sipariş mutfakta. Başka bir şey?" },
};

const ERR_MSG: Record<string, string> = {
  el: "Κάτι πήγε στραβά",
  en: "Something went wrong",
  de: "Etwas ist schiefgelaufen",
  fr: "Une erreur est survenue",
  es: "Algo salió mal",
  tr: "Bir şeyler ters gitti",
};

export function AssistantChat({
  open,
  onOpenChange,
  lang,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lang: LangCode;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askMenuAssistant);
  const sendOrder = useServerFn(submitOrder);
  const { speak, stop, replay, speaking } = useTTS(lang);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const { tableNumber, setTableNumber } = useTableNumber();
  const { enabled: ordersEnabled } = useOrdersEnabled();
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("strataras_tts_muted") === "1";
  });
  const lastSpokenRef = useRef<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("strataras_tts_muted", muted ? "1" : "0");
    }
    if (muted) stop();
  }, [muted, stop]);

  // Auto-play disabled: voice plays only when the user taps the button.

  const suggestions = SUGGESTIONS[lang] ?? SUGGESTIONS.el;
  const placeholder = PLACEHOLDERS[lang] ?? PLACEHOLDERS.el;
  const title = TITLES[lang] ?? TITLES.el;
  const intro = INTRO[lang] ?? INTRO.el;
  const ttsLabels = TTS_LABELS[lang] ?? TTS_LABELS.el;
  const cartLabels = CART_LABELS[lang] ?? CART_LABELS.el;

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: intro }]);
    }
  }, [open, intro, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const history = messages.filter((m) => m !== messages[0] || messages.length > 1);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await ask({
        data: {
          message: trimmed,
          history: history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          lang,
        },
      });

      if (result.error) {
        toast.error(result.error);
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${result.error}` }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.reply, suggested: result.suggested ?? [] },
        ]);
      }
    } catch (e) {
      console.error(e);
      toast.error(ERR_MSG[lang] ?? ERR_MSG.el);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: SuggestedItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === item.product_id);
      if (existing) {
        return prev.map((c) =>
          c.product_id === item.product_id
            ? { ...c, quantity: Math.min(20, c.quantity + item.quantity) }
            : c,
        );
      }
      return [...prev, { product_id: item.product_id, name: item.name, price: item.price, quantity: item.quantity }];
    });
  };

  const addAllToCart = (items: SuggestedItem[]) => {
    items.forEach(addToCart);
    toast.success(`+${items.length} ${cartLabels.items}`);
  };

  const handleSubmitOrder = async (notes: string) => {
    if (cart.length === 0 || tableNumber == null) return;
    setSubmittingOrder(true);
    try {
      const result = await sendOrder({
        data: {
          table_number: tableNumber,
          items: cart.map((it) => ({ product_id: it.product_id, quantity: it.quantity })),
          notes: notes || undefined,
          lang,
        },
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(cartLabels.sent);
        setCart([]);
        setCartOpen(false);
        setMessages((prev) => [...prev, { role: "assistant", content: cartLabels.sentBody }]);
      }
    } catch (e) {
      console.error(e);
      toast.error(ERR_MSG[lang] ?? ERR_MSG.el);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const cartCount = cart.reduce((s, it) => s + it.quantity, 0);
  const cartTotal = cart.reduce((s, it) => s + it.price * it.quantity, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] flex flex-col p-0 gap-0 rounded-t-2xl">
        <SheetHeader className="px-5 py-4 border-b bg-gradient-to-r from-primary to-primary/85 text-primary-foreground rounded-t-2xl">
          <SheetTitle className="text-primary-foreground flex items-center gap-2.5">
            <span className="rounded-full overflow-hidden h-10 w-10 ring-2 ring-white/30 bg-white/10 shrink-0">
              <img src={strataras} alt={title} className="h-full w-full object-cover" />
            </span>
            <span className="font-display text-xl">{title}</span>
            {tableNumber != null && (
              <span className="ml-auto text-xs bg-white/15 px-2 py-1 rounded-full font-mono">
                #{tableNumber}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
                   m.role === "user"
                     ? "bg-primary text-primary-foreground rounded-br-sm font-mono"
                     : "bg-muted text-foreground rounded-bl-sm font-mono",
                )}
              >
                {m.role === "assistant" ? (
                  <>
                     <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-foreground font-mono">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    {m.suggested && m.suggested.length > 0 && (
                      ordersEnabled && (
                      <CartSuggestCard
                        items={m.suggested}
                        lang={lang}
                        onAdd={addToCart}
                        onAddAll={addAllToCart}
                      />
                      )
                    )}
                    {(
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {speaking ? (
                          <Button size="sm" variant="ghost" onClick={stop} className="h-7 gap-1 text-xs">
                            <Square className="h-3 w-3" /> {ttsLabels.stop}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => speak(m.content)}
                              className="h-7 gap-1 text-xs"
                            >
                              <Volume2 className="h-3 w-3" /> {ttsLabels.read}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => replay()}
                              className="h-7 gap-1 text-xs"
                              title={ttsLabels.replay}
                            >
                              <RotateCcw className="h-3 w-3" /> {ttsLabels.replay}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setMuted((v) => !v)}
                              className="h-7 gap-1 text-xs"
                              title={muted ? ttsLabels.unmute : ttsLabels.mute}
                            >
                              {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}{" "}
                              {muted ? ttsLabels.unmute : ttsLabels.mute}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Σου στήνω τραπέζι…
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div
            className="px-4 pb-2 shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none"
            style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain", touchAction: "pan-x" }}
          >
            <div className="flex gap-2 pb-2 w-max">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={loading}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs bg-secondary text-secondary-foreground border border-border hover:bg-muted transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <Sparkles className="h-3 w-3" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {ordersEnabled && cart.length > 0 && (
          <button
            onClick={() => setCartOpen(true)}
            className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-accent text-accent-foreground px-4 py-2.5 shadow-md hover:opacity-90 transition-opacity"
          >
            <ShoppingBasket className="h-4 w-4 shrink-0" />
            <span className="text-sm font-semibold tabular-nums">
              {cartCount} {cartLabels.items} · {cartTotal.toFixed(2)}€
            </span>
            <span className="ml-auto text-xs underline-offset-2 underline">{cartLabels.view}</span>
          </button>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t p-3 flex gap-2 bg-background"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            maxLength={500}
            className="text-base"
          />
          <Button type="submit" disabled={loading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>

      <OrderCart
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={cart}
        setItems={setCart}
        tableNumber={tableNumber}
        setTableNumber={setTableNumber}
        onSubmit={handleSubmitOrder}
        submitting={submittingOrder}
        lang={lang}
      />
    </Sheet>
  );
}
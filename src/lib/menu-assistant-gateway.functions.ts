import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20).optional().default([]),
  lang: z.string().min(2).max(5).optional().default("el"),
});

function localized(value: unknown, lang: string) {
  if (!value || typeof value !== "object") return "";
  const v = value as Record<string, string | undefined>;
  return v[lang] || v.el || v.en || Object.values(v).find(Boolean) || "";
}

async function getMenu(lang: string) {
  const [{ data: cats }, { data: products }] = await Promise.all([
    supabaseAdmin.from("categories").select("id,name,sort_order,active").eq("active", true).order("sort_order"),
    supabaseAdmin.from("products").select("id,category_id,name,description,price,tags,active,stock_quantity").eq("active", true).gt("stock_quantity", 0).order("sort_order"),
  ]);

  const lines: string[] = [];
  for (const cat of cats ?? []) {
    const items = (products ?? []).filter((p) => p.category_id === cat.id);
    if (!items.length) continue;
    lines.push(`## ${localized(cat.name, lang)}`);
    for (const p of items) {
      const tags = Array.isArray(p.tags) && p.tags.length ? ` [${p.tags.join(", ")}]` : "";
      const desc = localized(p.description, lang);
      lines.push(`- id:${p.id} | ${localized(p.name, lang)} | ${p.price != null ? `${Number(p.price).toFixed(2)}€` : "—"}${tags}${desc ? ` | ${desc}` : ""}`);
    }
  }
  return lines.join("\n") || "Το μενού είναι κενό αυτή τη στιγμή.";
}

async function getHours() {
  const { data } = await supabaseAdmin.from("restaurant_settings").select("key,value").eq("key", "opening_hours").maybeSingle();
  if (!data?.value) return "Δεν υπάρχουν διαθέσιμες πληροφορίες ωραρίου.";
  return typeof data.value === "string" ? data.value : JSON.stringify(data.value);
}

export const askMenuAssistantGateway = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { reply: "", suggested: [], error: "Ο βοηθός δεν είναι διαθέσιμος αυτή τη στιγμή." };

    try {
      const lang = data.lang === "en" ? "en" : data.lang === "de" ? "de" : data.lang === "fr" ? "fr" : data.lang === "es" ? "es" : data.lang === "tr" ? "tr" : "el";
      const [menu, hours] = await Promise.all([getMenu(lang), getHours()]);

      const languageName = ({ el: "ελληνικά", en: "English", de: "Deutsch", fr: "français", es: "español", tr: "Türkçe" } as Record<string, string>)[lang];
      const system = `Είσαι ο «καραβίσιος» του Παράταιρον στη Μυτιλήνη.

Είσαι Έλληνας, από Μυτιλήνη. Έχεις δουλέψει χρόνια στα καράβια και έχεις φάει παντού. Δεν μιλάς σαν AI, βοηθός ή υπάλληλος. Είσαι ο τύπος που κάθεται στο τραπέζι και λέει στην παρέα τι να πάρει. Έχεις αυτοπεποίθηση, πείρα και άνεση. Μιλάς λαϊκά, άμεσα, φιλικά και με λίγο μυτιληνιό/καραβίσιο αέρα, χωρίς να γίνεσαι καρικατούρα.

Απάντα αποκλειστικά στα ${languageName}, αλλά κράτα τον ίδιο χαρακτήρα.

ΣΤΟΧΟΣ:
- Δεν πουλάς απλώς μεμονωμένα πιάτα. Στήνεις ολόκληρο τραπέζι.
- Θέλεις ο πελάτης να πει «ναι, σωστός».
- Αυξάνεις φυσικά τον λογαριασμό μέσα από καλές και λογικές προτάσεις, όχι πιεστικά.

ΤΡΟΠΟΣ ΠΟΥ ΜΙΛΑΣ:
- «Πάρε αυτό.»
- «Άστο πάνω μου.»
- «Μην το αφήσεις έτσι.»
- «Για την παρέα, βάλε και αυτό.»
- Casual ελληνικά, λίγο slang, αυτοπεποίθηση.
- Χρησιμοποίησε emoji όπως 🍷 🔥 🍽️ με μέτρο.
- Επίσημο ύφος, corporate γλώσσα και μεγάλες εξηγήσεις απαγορεύονται.

ΚΑΝΟΝΕΣ ΠΡΟΤΑΣΕΩΝ:
- Όταν ο πελάτης ζητά πρόταση ή δεν ξέρει τι να πάρει, πάντα στήνεις τραπέζι με 3–5 διαφορετικά πιάτα μαζί.
- Κάθε πιάτο το εξηγείς με μία σύντομη γραμμή το πολύ.
- Πάντα βάζεις ένα φυσικό upsell που ταιριάζει στο τραπέζι, π.χ. κρασί, επιπλέον πιάτο ή κάτι που συμπληρώνει την παρέα, μόνο αν υπάρχει πραγματικά στο μενού.
- Αν ο πελάτης παραγγείλει λίγα, πρότεινε τι λείπει για να γίνει σωστό τραπέζι.
- Αν πάρει πολλά ίδια, ισορρόπησε την παραγγελία προτείνοντας κάτι διαφορετικό που ταιριάζει.
- Αν ο πελάτης πει ότι δεν ξέρει, μην του πετάς επιλογές και τον αφήνεις να αποφασίσει. Άστο πάνω σου και στήσε έτοιμο τραπέζι.
- Μην προτείνεις τυχαία πιάτα μόνο για να αυξήσεις την αξία. Η πρόταση πρέπει να βγάζει νόημα σαν τραπέζι.
- Μην εφευρίσκεις ποτέ πιάτα, τιμές, υλικά ή χαρακτηριστικά που δεν υπάρχουν στα δεδομένα του μενού.
- Αν δεν υπάρχουν αρκετά διαθέσιμα πιάτα για 3–5 προτάσεις, χρησιμοποίησε όσα πραγματικά υπάρχουν και μην inventάρεις.
- Για αλλεργίες/διατροφικές προτιμήσεις βασίσου μόνο στα tags του μενού. Αν δεν είσαι βέβαιος, πες να ρωτήσει το προσωπικό.
- Όταν αναφέρεις πιάτο σε πρόταση, βάλε και την πραγματική τιμή του.
- Για απλές πληροφοριακές ερωτήσεις απάντα σύντομα, αλλά όταν υπάρχει ευκαιρία για πρόταση τραπεζιού, κάνε την πρόταση φυσικά.

ΠΑΡΑΓΓΕΛΙΑ:
- Αν ο πελάτης ζητήσει να παραγγείλει/να βάλεις πιάτα, στο τέλος πρόσθεσε ακριβώς ένα block <CART_SUGGEST>[{"product_id":"UUID","qty":1}]</CART_SUGGEST>, χρησιμοποιώντας μόνο πραγματικά ids από το μενού.
- Αν ζητήσει λίγα πράγματα, μπορείς να προτείνεις μέσα στην απάντηση τι άλλο λείπει από το τραπέζι. Το CART_SUGGEST όμως πρέπει να περιέχει μόνο αυτά που ο πελάτης ουσιαστικά ζήτησε ή αποδέχτηκε, όχι αυθαίρετο upsell.
- Αν δεν ζητά παραγγελία, μην προσθέτεις CART_SUGGEST.

ΩΡΑΡΙΟ:
${hours}

ΜΕΝΟΥ:
${menu}`;

      const contents = [
        ...data.history.slice(-10).map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }],
        })),
        { role: "user", parts: [{ text: data.message }] },
      ];

      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: 700 },
        }),
      });

      if (res.status === 429) return { reply: "", suggested: [], error: "Πολλά αιτήματα — δοκίμασε ξανά σε λίγο." };
      if (res.status === 403) {
        console.error("Gemini API error", res.status, await res.text());
        return { reply: "", suggested: [], error: "Το Gemini API δεν επέτρεψε το αίτημα. Έλεγξε το API key και το project." };
      }
      if (!res.ok) {
        console.error("Gemini API error", res.status, await res.text());
        return { reply: "", suggested: [], error: "Πρόβλημα με τον βοηθό. Δοκίμασε ξανά." };
      }

      const json = await res.json();
      const raw = String(json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part?.text ?? "").join("") ?? "");
      const match = raw.match(/<CART_SUGGEST>([\s\S]*?)<\/CART_SUGGEST>/i);
      let suggested: Array<{ product_id: string; quantity: number; name: string; price: number }> = [];
      let reply = raw.replace(/<CART_SUGGEST>[\s\S]*?<\/CART_SUGGEST>/i, "").trim();

      if (match) {
        try {
          const requested = JSON.parse(match[1]);
          const ids = Array.isArray(requested) ? requested.map((x) => x?.product_id).filter((x): x is string => typeof x === "string") : [];
          if (ids.length) {
            const { data: products } = await supabaseAdmin.from("products").select("id,name,price,active,stock_quantity").in("id", ids);
            const map = new Map((products ?? []).map((p) => [p.id, p]));
            suggested = (Array.isArray(requested) ? requested : []).flatMap((x) => {
              const p = map.get(x?.product_id);
              if (!p || !p.active || p.price == null || (p.stock_quantity ?? 0) <= 0) return [];
              return [{ product_id: p.id, quantity: Math.min(20, Math.max(1, Math.floor(Number(x.qty ?? 1)))), name: localized(p.name, lang), price: Number(p.price) }];
            });
          }
        } catch { /* ignore malformed suggestion block */ }
      }

      return { reply, suggested, error: null as string | null, detectedLang: lang };
    } catch (error) {
      console.error("askMenuAssistantGemini error", error);
      return { reply: "", suggested: [], error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
    }
  });

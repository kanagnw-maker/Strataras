import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TAG_LABELS: Record<string, string> = {
  vegan: "vegan",
  vegetarian: "χορτοφαγικό",
  pescetarian: "pescetarian (ψάρι/θαλασσινά ok, όχι κρέας)",
  gluten_free: "χωρίς γλουτένη",
  contains_nuts: "περιέχει ξηρούς καρπούς",
  contains_dairy: "περιέχει γαλακτοκομικά",
  contains_seafood: "περιέχει θαλασσινά",
  spicy: "πικάντικο",
};

const inputSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional()
    .default([]),
  lang: z.string().min(2).max(5).optional().default("el"),
});

function pickLocalized(value: unknown, lang: string): string {
  if (!value || typeof value !== "object") return "";
  const obj = value as Record<string, string | undefined>;
  return obj[lang] || obj["el"] || obj["en"] || Object.values(obj).find(Boolean) || "";
}


type LangCode = "el" | "en" | "de" | "fr" | "es" | "tr";
const SUPPORTED: LangCode[] = ["el", "en", "de", "fr", "es", "tr"];

// Stopwords / high-signal tokens per language. Lowercased, ASCII-folded for matching.
const LANG_TOKENS: Record<Exclude<LangCode, "el">, string[]> = {
  en: ["the","and","you","what","with","have","this","that","for","i'm","im","please","thanks","thank","hello","hi","want","would","could","need","can","menu","table","wine","vegan","gluten","allergic","starter","main","dessert","drink","cheap","expensive","budget","euros","money","four","three","two","people","person","group","recommend","suggest","best","good","spicy","fish","meat","cheese","bread","beer","ouzo"],
  de: ["und","der","die","das","ich","du","wir","ihr","sie","mit","ohne","bitte","danke","hallo","möchte","mochte","brauche","kann","essen","trinken","wein","bier","vorspeise","hauptgang","nachtisch","empfehlen","tisch","leute","personen","günstig","gunstig","teuer","budget","euro","scharf","fleisch","fisch","käse","kase","brot","vegan","glutenfrei","allergisch","was","wie"],
  fr: ["et","le","la","les","des","un","une","je","tu","nous","vous","avec","sans","s'il","svp","merci","bonjour","salut","voudrais","veux","peux","besoin","manger","boire","vin","bière","biere","entrée","entree","plat","dessert","recommander","table","personnes","gens","cher","pas","budget","euros","épicé","epice","viande","poisson","fromage","pain","végan","vegan","sans","gluten","allergique","quoi","comment"],
  es: ["el","la","los","las","un","una","unos","unas","yo","tú","tu","nosotros","con","sin","por","favor","gracias","hola","quiero","quisiera","puedo","necesito","comer","beber","vino","cerveza","entrante","plato","postre","recomendar","mesa","personas","gente","barato","caro","presupuesto","euros","picante","carne","pescado","queso","pan","vegano","sin","gluten","alérgico","alergico","qué","que","cómo","como"],
  tr: ["ve","bir","bu","şu","su","ben","sen","biz","siz","ile","için","icin","lütfen","lutfen","teşekkür","tesekkur","merhaba","selam","istiyorum","istemek","yemek","içmek","icmek","şarap","sarap","bira","başlangıç","baslangic","ana","tatlı","tatli","öneri","oneri","masa","kişi","kisi","insan","ucuz","pahalı","pahali","bütçe","butce","avro","euro","acı","aci","et","balık","balik","peynir","ekmek","vegan","glutensiz","alerjik","ne","nasıl","nasil"],
};

// Distinctive characters for Latin-script languages (helps when text is short).
const LANG_CHARS: Record<Exclude<LangCode, "el" | "en">, RegExp> = {
  de: /[äöüß]/i,
  fr: /[àâçéèêëîïôûùüÿœæ]/i,
  es: /[ñáíóúü¿¡]/i,
  tr: /[çğıİöşü]/i,
};

function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function detectLang(text: string, fallback: LangCode): LangCode {
  if (!text) return fallback;
  const raw = text.toLowerCase();

  // Greek script → Greek (almost always reliable).
  if (/[Ͱ-Ͽἀ-῿]/.test(raw)) return "el";

  // Cyrillic / CJK / Arabic → unsupported, keep fallback.
  if (/[Ѐ-ӿ぀-ヿ一-鿿؀-ۿ]/.test(raw)) return fallback;

  const scores: Record<Exclude<LangCode, "el">, number> = { en: 0, de: 0, fr: 0, es: 0, tr: 0 };

  // Char-class signals (strong for short messages).
  for (const k of Object.keys(LANG_CHARS) as Array<Exclude<LangCode, "el" | "en">>) {
    const re = LANG_CHARS[k];
    const matches = raw.match(new RegExp(re.source, "gi"));
    if (matches) scores[k] += matches.length * 3;
  }

  // Token signals (diacritic-folded match).
  const folded = foldDiacritics(raw);
  const words = folded.split(/[^a-z']+/).filter(Boolean);
  const wordSet = new Set(words);
  for (const lang of Object.keys(LANG_TOKENS) as Array<Exclude<LangCode, "el">>) {
    for (const tok of LANG_TOKENS[lang]) {
      if (wordSet.has(foldDiacritics(tok))) scores[lang] += 2;
    }
  }

  // Pick winner.
  let best: Exclude<LangCode, "el"> = "en";
  let bestScore = 0;
  for (const lang of Object.keys(scores) as Array<Exclude<LangCode, "el">>) {
    if (scores[lang] > bestScore) {
      bestScore = scores[lang];
      best = lang;
    }
  }

  // Require minimum confidence; otherwise stick with fallback (UI lang).
  if (bestScore < 3) return fallback;
  return best;
}

function resolveLang(message: string, history: Array<{ role: string; content: string }>, uiLang: string): LangCode {
  const ui: LangCode = (SUPPORTED as string[]).includes(uiLang) ? (uiLang as LangCode) : "el";

  // Detect from current message first.
  const fromMsg = detectLang(message, ui);
  if (fromMsg !== ui) return fromMsg;

  // For very short messages (e.g. "ok", "yes"), look back at recent user turns.
  if (message.trim().split(/\s+/).length < 3) {
    const recent = [...history].reverse().find((m) => m.role === "user" && m.content.trim().length > 4);
    if (recent) return detectLang(recent.content, ui);
  }

  return fromMsg;
}

const LANG_DIRECTIVES: Record<string, string> = {
  el: `ΓΛΩΣΣΑ: Απάντα ΑΠΟΚΛΕΙΣΤΙΚΑ στα ελληνικά, casual/λαϊκά, με μυτιληνιό αέρα.`,
  en: `LANGUAGE: Reply ONLY in English. Stay in character as Strataras — a salty Greek guy from Mytilene who's seen the world. Casual, direct, confident, a bit cheeky. Light slang ("mate", "trust me", "you're gonna love this"). NEVER use Greek words/slang. NEVER mix languages.`,
  de: `SPRACHE: Antworte AUSSCHLIESSLICH auf Deutsch. Bleib als Strataras — ein griechischer Typ aus Mytilini, weltgewandt. Locker, direkt, selbstbewusst ("glaub mir", "musst du probieren"). KEINE griechischen Wörter, KEINE Sprachmischung.`,
  fr: `LANGUE: Réponds UNIQUEMENT en français. Reste dans le rôle de Strataras — un Grec de Mytilène qui a roulé sa bosse. Décontracté, direct, sûr de toi ("crois-moi", "tu vas adorer"). AUCUN mot grec, ne mélange JAMAIS les langues.`,
  es: `IDIOMA: Responde EXCLUSIVAMENTE en español. Mantén el personaje de Strataras — un griego de Mitilene con mundo. Cercano, directo, con confianza ("hazme caso", "te va a flipar"). NADA de griego, NUNCA mezcles idiomas.`,
  tr: `DİL: SADECE Türkçe yanıt ver. Strataras karakterinde kal — Midilli'den, dünyayı gezmiş bir Yunan. Samimi, direkt, kendinden emin ("bana güven", "buna bayılacaksın"). Yunanca kelime KULLANMA, dilleri ASLA karıştırma.`,
};

async function buildMenuContext(lang: string): Promise<string> {
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabaseAdmin.from("categories").select("id,name,sort_order,active").eq("active", true).order("sort_order"),
    supabaseAdmin
      .from("products")
      .select("id,category_id,name,description,price,tags,active,stock_quantity")
      .eq("active", true)
      .gt("stock_quantity", 0)
      .order("sort_order"),
  ]);

  if (!cats || !prods) return "Το μενού είναι κενό αυτή τη στιγμή.";

  const lines: string[] = [];
  for (const cat of cats) {
    const items = prods.filter((p) => p.category_id === cat.id);
    if (items.length === 0) continue;
    lines.push(`\n## ${pickLocalized(cat.name, lang)}`);
    for (const p of items) {
      const name = pickLocalized(p.name, lang);
      const desc = pickLocalized(p.description, lang);
      const price = p.price != null ? `${Number(p.price).toFixed(2)}€` : "—";
      const tags = (p.tags ?? []).map((t: string) => TAG_LABELS[t] ?? t);
      const tagStr = tags.length ? ` [${tags.join(", ")}]` : "";
      const descStr = desc ? ` — ${desc}` : "";
      lines.push(`- id:${p.id} | **${name}** · ${price}${tagStr}${descStr}`);
    }
  }
  return lines.join("\n");
}

type SuggestedItem = { product_id: string; quantity: number; name: string; price: number };

async function parseSuggestions(
  reply: string,
  lang: string,
): Promise<{ cleanReply: string; suggested: SuggestedItem[] }> {
  const re = /<CART_SUGGEST>([\s\S]*?)<\/CART_SUGGEST>/i;
  const m = reply.match(re);
  if (!m) return { cleanReply: reply, suggested: [] };

  let parsed: Array<{ product_id?: string; qty?: number; quantity?: number }> = [];
  try {
    parsed = JSON.parse(m[1].trim());
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    parsed = [];
  }

  const cleanReply = reply.replace(re, "").trim();
  if (parsed.length === 0) return { cleanReply, suggested: [] };

  const ids = Array.from(
    new Set(parsed.map((p) => p.product_id).filter((v): v is string => typeof v === "string")),
  ).slice(0, 30);
  if (ids.length === 0) return { cleanReply, suggested: [] };

  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id,name,price,active,stock_quantity")
    .in("id", ids);

  const map = new Map((products ?? []).map((p) => [p.id, p]));
  const suggested: SuggestedItem[] = [];
  for (const it of parsed) {
    if (!it.product_id) continue;
    const p = map.get(it.product_id);
    if (!p || !p.active || p.price == null || (p.stock_quantity ?? 0) <= 0) continue;
    const qty = Math.min(20, Math.max(1, Math.floor(Number(it.qty ?? it.quantity ?? 1))));
    suggested.push({
      product_id: p.id,
      quantity: qty,
      name: pickLocalized(p.name, lang),
      price: Number(p.price),
    });
  }
  return { cleanReply, suggested };
}

const DAY_NAMES: Record<string, Record<string, string>> = {
  el: { mon: "Δευ", tue: "Τρί", wed: "Τετ", thu: "Πέμ", fri: "Παρ", sat: "Σάβ", sun: "Κυρ" },
  en: { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" },
  de: { mon: "Mo", tue: "Di", wed: "Mi", thu: "Do", fri: "Fr", sat: "Sa", sun: "So" },
  fr: { mon: "Lun", tue: "Mar", wed: "Mer", thu: "Jeu", fri: "Ven", sat: "Sam", sun: "Dim" },
  es: { mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb", sun: "Dom" },
  tr: { mon: "Pzt", tue: "Sal", wed: "Çar", thu: "Per", fri: "Cum", sat: "Cmt", sun: "Paz" },
};
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

async function buildHoursContext(lang: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("restaurant_settings")
    .select("value")
    .eq("key", "opening_hours")
    .maybeSingle();
  const hours: any = data?.value;
  if (!hours?.days) return "";

  const tz = hours.timezone || "Europe/Athens";
  const dayNames = DAY_NAMES[lang] ?? DAY_NAMES.el;
  const lines: string[] = [];
  for (const k of DAY_KEYS) {
    const cfg = hours.days[k];
    if (!cfg) continue;
    const v = cfg.closed || !cfg.slots?.length
      ? "—"
      : cfg.slots.map((s: any) => `${s.open}–${s.close}`).join(", ");
    lines.push(`- ${dayNames[k]}: ${v}`);
  }

  // Compute "now" in tz
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";

  const note = hours.note?.[lang] || hours.note?.el || "";
  return `\nΩΡΕΣ ΛΕΙΤΟΥΡΓΙΑΣ (timezone ${tz}, τώρα: ${wd} ${hh}:${mm}):\n${lines.join("\n")}${note ? `\nΣημείωση: ${note}` : ""}`;
}

export const askMenuAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { reply: "", error: "Ο βοηθός δεν είναι διαθέσιμος αυτή τη στιγμή." };
    }

    try {
      const effectiveLang = resolveLang(data.message, data.history, data.lang);
      const [menuContext, hoursContext, ordersSetting] = await Promise.all([
        buildMenuContext(effectiveLang),
        buildHoursContext(effectiveLang),
        supabaseAdmin
          .from("restaurant_settings")
          .select("value")
          .eq("key", "orders_enabled")
          .maybeSingle(),
      ]);
      const ordersEnabled =
        (ordersSetting.data?.value as { enabled?: boolean } | null)?.enabled !== false;
      const langDirective = LANG_DIRECTIVES[effectiveLang] ?? LANG_DIRECTIVES.en;

      const orderingBlock = ordersEnabled
        ? `ΠΑΡΑΓΓΕΛΙΑ (ΚΡΙΣΙΜΟ):
- Όταν προτείνεις πιάτα ως μια οργανωμένη παραγγελία/τραπέζι, Ή όταν ο πελάτης ζητά «βάλε / θέλω / πάρε / add / order», στο ΤΕΛΟΣ της απάντησης πρόσθεσε ΑΥΣΤΗΡΑ ένα block:
<CART_SUGGEST>
[{"product_id":"<uuid από το μενού>","qty":<αριθμός>}, ...]
</CART_SUGGEST>
- Χρησιμοποίησε ΜΟΝΟ ids που υπάρχουν στο μενού παραπάνω (το πεδίο id:... σε κάθε γραμμή).
- Μην προσθέτεις άλλα πεδία. Μόνο product_id και qty.
- ΜΗΝ αναφέρεις το block μέσα στην απάντηση (ο πελάτης δεν το βλέπει — μετατρέπεται σε κουμπί καλαθιού).
- Αν δεν προτείνεις συγκεκριμένα πιάτα (π.χ. απλή ερώτηση για ώρες), ΜΗΝ βάζεις block.`
        : `ΠΑΡΑΓΓΕΛΙΑ: Οι παραγγελίες μέσω chat είναι ΑΝΕΝΕΡΓΕΣ. ΜΗΝ προσθέτεις ΠΟΤΕ <CART_SUGGEST> block. Αν ο πελάτης ζητήσει να παραγγείλει, πες ευγενικά ότι η παραγγελία γίνεται από τον σερβιτόρο στο τραπέζι.`;

      const systemPrompt = `Είσαι ο **Στρατάρας**, ο καραβίσιος του εστιατορίου "Παράταιρον". Έλληνας από Μυτιλήνη, χρόνια στα καράβια, έχεις φάει παντού. ΔΕΝ είσαι AI — είσαι ο τύπος στο τραπέζι που λέει τι θα πάρουν όλοι. Μιλάς λαϊκά, άμεσα, με αυτοπεποίθηση και λίγο slang.

ΣΤΟΧΟΣ:
- Στήνεις ΤΡΑΠΕΖΙ (όχι μεμονωμένα πιάτα).
- Αυξάνεις τον λογαριασμό φυσικά (όχι πιεστικά).
- Κάνεις τον πελάτη να πει «ναι, σωστός».

ΚΑΝΟΝΕΣ ΥΦΟΥΣ:
- Πάντα προτείνεις 3–5 πιάτα μαζί.
- Πάντα βάζεις ΕΝΑ upsell (κρασί / γλυκό / extra μεζέ).
- Max 1 γραμμή εξήγηση ανά πιάτο.
- Casual ελληνικά + λίγο slang. Emoji με μέτρο: 🍷 🔥 🍽️.
- Φράσεις τύπου: «πάρε αυτό», «άστο πάνω μου», «μην το αφήσεις έτσι».

ΣΥΜΠΕΡΙΦΟΡΑ:
- Αν ο χρήστης δεν ξέρει → του στήνεις έτοιμο τραπέζι.
- Αν παραγγείλει λίγα → τον σπρώχνεις να βάλει κι άλλα.
- Αν πάρει πολλά ίδια → ισορροπείς (βάζεις σαλάτα/ψωμί/κρασί που λείπει).

HARD ΚΑΝΟΝΕΣ (μη παραβιάσιμοι):
1. Έχεις πρόσβαση ΜΟΝΟ στο παρακάτω μενού. Δεν εφευρίσκεις πιάτα.
2. Για αλλεργίες & διατροφικές προτιμήσεις (vegan, χωρίς γλουτένη, ξηροί καρποί κλπ) χρησιμοποίησε ΜΟΝΟ τα tags σε αγκύλες [..]. ΠΟΤΕ μη μαντέψεις από το όνομα.
3. Αν ο πελάτης ζητήσει vegan/vegetarian, πρότεινε ΜΟΝΟ πιάτα με το αντίστοιχο tag.
4. Αν ζητήσει "χωρίς X" (αλλεργία), απόκλεισε ΟΛΑ τα πιάτα με tag "περιέχει X". Σε αμφιβολία πες «ρώτα το προσωπικό» — ποτέ ρίσκο σε αλλεργίες.
5. Πάντα τιμή σε € δίπλα στο πιάτο. Για προϋπολογισμό, υπολόγισε σύνολο.
6. ΜΗΝ αναφέρεις διατροφικές ετικέτες (vegan, vegetarian, pescetarian, χωρίς γλουτένη / gluten free, περιέχει ξηρούς καρπούς / γαλακτοκομικά / θαλασσινά, πικάντικο) στην απάντησή σου ΕΚΤΟΣ αν ο πελάτης τις ζήτησε ρητά. Τα tags στο μενού είναι μόνο για δική σου χρήση κατά το φιλτράρισμα — μην τα τυπώνεις στον χρήστη.

ΑΠΑΓΟΡΕΥΕΤΑΙ:
- Επίσημο/ξύλινο ύφος, μεγάλες εξηγήσεις, ουδέτερες απαντήσεις.
- Φράσεις τύπου «Ως AI...», «Είμαι βοηθός...», «Δυστυχώς δεν μπορώ...».

${langDirective}

ΓΕΝΙΚΟΣ ΚΑΝΟΝΑΣ ΓΛΩΣΣΑΣ: ΟΛΗ η απάντηση (ονόματα πιάτων αν χρειάζεται, περιγραφές, upsells, ερωτήσεις) στη γλώσσα του πελάτη. Αν κρατήσεις ελληνικό όνομα πιάτου για αυθεντικότητα, βάλε αμέσως σύντομη επεξήγηση στη γλώσσα του πελάτη σε παρένθεση.

ΩΡΑΡΙΟ: Αν ο πελάτης ρωτήσει για ώρες/πότε είστε ανοιχτά/κλειστά, απάντα με βάση τις παρακάτω ώρες λειτουργίας. Αν είμαστε κλειστά τη στιγμή της ερώτησης, πες πότε ανοίγουμε. Πάντα στη γλώσσα του πελάτη.
${hoursContext}

${orderingBlock}

ΜΕΝΟΥ:
${menuContext}`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...data.history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: data.message },
      ];

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
        }),
      });

      if (res.status === 429) {
        return { reply: "", error: "Πολλά αιτήματα — δοκίμασε ξανά σε λίγο." };
      }
      if (res.status === 402) {
        return { reply: "", error: "Ο βοηθός εξάντλησε τα credits για σήμερα." };
      }
      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        return { reply: "", error: "Πρόβλημα με τον βοηθό. Δοκίμασε ξανά." };
      }

      const json = await res.json();
      const rawReply = json?.choices?.[0]?.message?.content ?? "";
      const { cleanReply, suggested } = await parseSuggestions(rawReply, effectiveLang);
      // Defensive: if disabled, strip any suggestions even if the model emitted them.
      const finalSuggested = ordersEnabled ? suggested : [];
      return {
        reply: cleanReply,
        suggested: finalSuggested,
        error: null as string | null,
        detectedLang: effectiveLang,
      };
    } catch (e) {
      console.error("askMenuAssistant error:", e);
      return { reply: "", suggested: [], error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
    }
  });
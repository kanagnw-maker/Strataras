import { useCallback, useEffect, useRef, useState } from "react";

const LANG_MAP: Record<string, string> = {
  el: "el-GR",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  tr: "tr-TR",
};

// Known male voice names per language (iOS/macOS/Windows/Android).
const MALE_VOICE_HINTS: Record<string, string[]> = {
  el: ["stefanos", "nikos", "dimitris"],
  en: ["daniel", "alex", "fred", "aaron", "arthur", "oliver", "tom", "george", "guy", "ryan", "david"],
  de: ["markus", "yannick", "stefan", "viktor", "boris", "conrad"],
  fr: ["thomas", "nicolas", "daniel", "henri", "jacques"],
  es: ["jorge", "diego", "juan", "pablo", "carlos", "enrique"],
  tr: ["cem", "tolga", "yelda"], // Turkish: very few male names available; may fallback
};
const MALE_KEYWORDS = ["male", "man ", "homme", "hombre", "männlich", "erkek", "άντρας"];
const FEMALE_KEYWORDS = ["female", "woman", "femme", "mujer", "weiblich", "kadın", "γυναίκα"];

const EURO_WORD: Record<string, string> = {
  el: "ευρώ",
  en: "euros",
  de: "Euro",
  fr: "euros",
  es: "euros",
  tr: "avro",
};

const CENTS_WORD: Record<string, string> = {
  el: "λεπτά",
  en: "cents",
  de: "Cent",
  fr: "centimes",
  es: "céntimos",
  tr: "kuruş",
};

const AND_WORD: Record<string, string> = {
  el: "και",
  en: "and",
  de: "und",
  fr: "et",
  es: "y",
  tr: "ve",
};

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\s*\d+[\.\)]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

// Defensive: strip any leaked CART_SUGGEST blocks the assistant might emit.
function stripCartBlocks(text: string): string {
  return text.replace(/<CART_SUGGEST>[\s\S]*?<\/CART_SUGGEST>/gi, "").trim();
}

// Split spoken text into ~800-char chunks at sentence boundaries so a long
// reply can be streamed in sequential GET requests (URL length stays safe).
function chunkForStreaming(text: string): string[] {
  const MAX = 800;
  if (text.length <= MAX) return [text];
  const sentences = text.split(/(?<=[.!?;])\s+/).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (s.length > MAX) {
      if (buf) { out.push(buf); buf = ""; }
      let rest = s;
      while (rest.length > MAX) {
        const cut = Math.max(rest.lastIndexOf(", ", MAX), rest.lastIndexOf(" ", MAX));
        const end = cut > 200 ? cut : MAX;
        out.push(rest.slice(0, end).trim());
        rest = rest.slice(end).trim();
      }
      if (rest) buf = rest;
      continue;
    }
    const next = buf ? `${buf} ${s}` : s;
    if (next.length > MAX) { out.push(buf); buf = s; }
    else buf = next;
  }
  if (buf) out.push(buf);
  return out;
}

// Strip pictographs/emoji that some TTS engines spell out literally.
function stripEmoji(text: string): string {
  try {
    return text.replace(/\p{Extended_Pictographic}/gu, "");
  } catch {
    return text;
  }
}

function normalizeForSpeech(input: string, lang: string): string {
  const euro = EURO_WORD[lang] ?? EURO_WORD.el;
  const cents = CENTS_WORD[lang] ?? CENTS_WORD.el;
  const and = AND_WORD[lang] ?? AND_WORD.el;

  let t = stripEmoji(input);

  // Greek reference pronouns written with comma: "ό,τι" / "ό,τιδήποτε" — the
  // engine reads the bare letter "ό" alphabetically ("όμικρον"). Merge them.
  if (lang === "el") {
    t = t.replace(/\bΌ,τιδήποτε\b/g, "Οτιδήποτε");
    t = t.replace(/\bό,τιδήποτε\b/g, "οτιδήποτε");
    t = t.replace(/\bΌ,τι\b/g, "Ότι");
    t = t.replace(/\bό,τι\b/g, "ότι");
  }

  // Prices like 12,50€ / 12.50 € / €12,50 / 12,50 EUR
  const priceWithDecimals = /(?:€\s*)?(\d{1,4})[.,](\d{1,2})\s*(?:€|eur|euro|ευρώ)?/gi;
  t = t.replace(priceWithDecimals, (_m, whole: string, frac: string) => {
    const f = parseInt(frac.padEnd(2, "0").slice(0, 2), 10);
    return f === 0 ? `${whole} ${euro}` : `${whole} ${euro} ${and} ${f} ${cents}`;
  });

  // Whole-number prices: 8€ / €8 / 8 EUR
  t = t.replace(/€\s*(\d{1,4})\b/g, (_m, n) => `${n} ${euro}`);
  t = t.replace(/\b(\d{1,4})\s*€/g, (_m, n) => `${n} ${euro}`);
  t = t.replace(/\b(\d{1,4})\s*(?:eur|euro|ευρώ)\b/gi, (_m, n) => `${n} ${euro}`);

  // Any leftover € symbol → word
  t = t.replace(/€/g, ` ${euro} `);

  // Bullets / dashes → comma for natural pause
  t = t.replace(/[•·]/g, ", ");
  t = t.replace(/\s[–—]\s/g, ", ");

  // Newlines → sentence breaks
  t = t.replace(/\n{2,}/g, ". ");
  t = t.replace(/\n/g, ", ");

  // Ensure space after sentence punctuation (NOT comma — splitting "ό,τι"
  // makes the engine spell out the lone Greek letter as "όμικρον").
  t = t.replace(/([.;:!?])(\S)/g, "$1 $2");
  // For comma, only insert a space when the next char is a digit or an
  // uppercase letter — keeps in-word commas like "ό,τι" intact.
  t = t.replace(/,(\d|[A-ZΑ-ΩΆΈΉΊΌΎΏ])/g, ", $1");

  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

function splitSentences(text: string): string[] {
  // Group sentences into ~250-char chunks for more natural flow & fewer pauses.
  const sentences = text.split(/(?<=[.!?;])\s+/).filter(Boolean);
  const MAX = 250;
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (s.length > MAX) {
      if (buf) { out.push(buf); buf = ""; }
      out.push(...s.split(/(?<=,)\s+/).filter(Boolean));
      continue;
    }
    if ((buf + " " + s).trim().length > MAX) {
      if (buf) out.push(buf);
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function splitForElevenLabs(text: string): string[] {
  const MAX = 420;
  const sentences = text.split(/(?<=[.!?;:])\s+/).filter(Boolean);
  const out: string[] = [];
  let buf = "";

  const pushLong = (part: string) => {
    let rest = part.trim();
    while (rest.length > MAX) {
      const cut = Math.max(rest.lastIndexOf(", ", MAX), rest.lastIndexOf(" ", MAX));
      const end = cut > 120 ? cut : MAX;
      out.push(rest.slice(0, end).trim());
      rest = rest.slice(end).trim();
    }
    if (rest) out.push(rest);
  };

  for (const sentence of sentences) {
    if (sentence.length > MAX) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      pushLong(sentence);
      continue;
    }
    const next = buf ? `${buf} ${sentence}` : sentence;
    if (next.length > MAX) {
      if (buf) out.push(buf);
      buf = sentence;
    } else {
      buf = next;
    }
  }

  if (buf) out.push(buf);
  return out;
}

function pickMaleVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const target = LANG_MAP[lang] ?? "el-GR";
  const langPrefix = lang.toLowerCase();
  const hints = MALE_VOICE_HINTS[lang] ?? [];

  const sameLang = voices.filter(
    (v) => v.lang === target || v.lang.toLowerCase().startsWith(langPrefix),
  );
  if (sameLang.length === 0) return undefined;

  const score = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    let s = 0;
    if (v.lang === target) s += 5;
    if (hints.some((h) => name.includes(h))) s += 20;
    if (MALE_KEYWORDS.some((k) => name.includes(k))) s += 15;
    if (FEMALE_KEYWORDS.some((k) => name.includes(k))) s -= 30;
    // Prefer enhanced/premium voices when available
    if (name.includes("enhanced") || name.includes("premium") || name.includes("neural")) s += 3;
    if (v.localService) s += 1;
    return s;
  };

  return [...sameLang].sort((a, b) => score(b) - score(a))[0];
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesCache && voicesCache.length > 0) return Promise.resolve(voicesCache);
  if (voicesPromise) return voicesPromise;
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      voicesCache = existing;
      resolve(existing);
      return;
    }
    const handler = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      const v = window.speechSynthesis.getVoices();
      voicesCache = v;
      resolve(v);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    // Safety timeout
    setTimeout(() => {
      const v = window.speechSynthesis.getVoices();
      voicesCache = v;
      resolve(v);
    }, 1000);
  });
}

// Module-level caches: persist across hook instances and language switches.
let voicesCache: SpeechSynthesisVoice[] | null = null;
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;
const voicePerLangCache = new Map<string, SpeechSynthesisVoice | undefined>();

async function getVoiceForLang(lang: string): Promise<SpeechSynthesisVoice | undefined> {
  if (voicePerLangCache.has(lang)) return voicePerLangCache.get(lang);
  const voices = await loadVoices();
  const picked = pickMaleVoice(voices, lang);
  voicePerLangCache.set(lang, picked);
  return picked;
}

// Pre-warm voices once on module load (idempotent, fire-and-forget).
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  voicesPromise = loadVoices();
}

export function useTTS(lang: string = "el") {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const lastTextRef = useRef<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const elevenQuotaUntilRef = useRef<number>(0);
  const playIdRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported("speechSynthesis" in window);
  }, []);

  const hardStop = useCallback(() => {
    if (typeof window === "undefined") return;
    playIdRef.current += 1; // invalidate any in-flight playback
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      } catch { /* noop */ }
      audioRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    hardStop();
    setSpeaking(false);
  }, [hardStop]);

  const speakBrowser = useCallback(
    async (rawText: string, myId: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const cleaned = normalizeForSpeech(stripMarkdown(rawText), lang);
      if (!cleaned) return;

      const targetLang = LANG_MAP[lang] ?? "el-GR";
      const voice = await getVoiceForLang(lang);
      if (myId !== playIdRef.current) return;

      const chunks = splitSentences(cleaned);
      if (chunks.length === 0) return;

      setSpeaking(true);

      let i = 0;
      const speakNext = () => {
        if (myId !== playIdRef.current) return;
        if (i >= chunks.length) {
          if (myId === playIdRef.current) setSpeaking(false);
          return;
        }
        const utter = new SpeechSynthesisUtterance(chunks[i]);
        utter.lang = targetLang;
        const jitter = (Math.random() - 0.5) * 0.04;
        utter.rate = 0.97 + jitter;
        utter.pitch = 0.85 + jitter;
        utter.volume = 1;
        if (voice) utter.voice = voice;
        utter.onend = () => {
          i += 1;
          speakNext();
        };
        utter.onerror = () => {
          i += 1;
          speakNext();
        };
        window.speechSynthesis.speak(utter);
      };
      speakNext();
    },
    [lang],
  );

  const speakInternal = useCallback(
    async (rawText: string) => {
      // Stop anything currently playing and claim a new generation id.
      hardStop();
      const myId = ++playIdRef.current;

      if (Date.now() < elevenQuotaUntilRef.current) {
        if (myId === playIdRef.current) setSpeaking(false);
        return;
      }

      // Prepare a short, clean payload — mobile-friendly.
      const cleaned = normalizeForSpeech(
        stripMarkdown(stripCartBlocks(rawText)),
        lang,
      );
      const chunks = chunkForStreaming(cleaned);
      if (chunks.length === 0) {
        if (myId === playIdRef.current) setSpeaking(false);
        return;
      }

      setSpeaking(true);

      // Play chunks sequentially so the entire reply is read aloud.
      const playChunk = (idx: number) => {
        if (myId !== playIdRef.current) return;
        if (idx >= chunks.length) {
          if (myId === playIdRef.current) setSpeaking(false);
          return;
        }
        const url = `/api/tts?text=${encodeURIComponent(chunks[idx])}&lang=${encodeURIComponent(lang)}`;
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = url;
        audioRef.current = audio;
        audio.onended = () => {
          if (audioRef.current === audio) audioRef.current = null;
          playChunk(idx + 1);
        };
        audio.onerror = () => {
          elevenQuotaUntilRef.current = Date.now() + 60_000;
          if (audioRef.current === audio) audioRef.current = null;
          if (myId === playIdRef.current) setSpeaking(false);
        };
        audio.onpause = () => {
          if (myId !== playIdRef.current && audioRef.current === audio) {
            audioRef.current = null;
          }
        };
        audio.play().catch((e) => {
          console.error("Audio playback failed:", e);
          if (myId === playIdRef.current) setSpeaking(false);
        });
      };
      playChunk(0);
    },
    [lang, hardStop],
  );

  const speak = useCallback(
    (text: string) => {
      lastTextRef.current = text;
      speakInternal(text);
    },
    [speakInternal],
  );

  const replay = useCallback(() => {
    if (lastTextRef.current) speakInternal(lastTextRef.current);
  }, [speakInternal]);

  useEffect(() => () => stop(), [stop]);

  return { speak, stop, replay, speaking, supported, hasLast: () => !!lastTextRef.current };
}

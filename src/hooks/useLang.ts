import { useEffect, useState } from "react";
import { DEFAULT_LANG, type LangCode, LANGUAGES } from "@/lib/i18n";

const STORAGE_KEY = "paratairon.lang";

export function useLang(): [LangCode, (l: LangCode) => void, boolean] {
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);
  const [chosen, setChosen] = useState<boolean>(false);

  useEffect(() => {
    try {
      // 1) URL ?lang= overrides everything (QR code use case)
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const fromUrl = url.searchParams.get("lang") as LangCode | null;
        if (fromUrl && LANGUAGES.some((l) => l.code === fromUrl)) {
          setLangState(fromUrl);
          try { localStorage.setItem(STORAGE_KEY, fromUrl); } catch {}
          setChosen(true);
          // Strip the param so manual switcher takes over afterwards
          url.searchParams.delete("lang");
          const qs = url.searchParams.toString();
          window.history.replaceState(
            {},
            "",
            url.pathname + (qs ? `?${qs}` : "") + url.hash,
          );
          return;
        }
      }
      const saved = localStorage.getItem(STORAGE_KEY) as LangCode | null;
      if (saved && LANGUAGES.some((l) => l.code === saved)) {
        setLangState(saved);
        setChosen(true);
      }
    } catch {}
  }, []);

  const setLang = (l: LangCode) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
    setChosen(true);
  };

  return [lang, setLang, chosen];
}

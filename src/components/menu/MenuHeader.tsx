import logo from "@/assets/logo-paratairon.jpeg";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { LangCode } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { OpeningHoursBadge } from "./OpeningHours";

export function MenuHeader({ lang, setLang }: { lang: LangCode; setLang: (l: LangCode) => void }) {
  return (
    <header
      className="relative overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />

      <div className="relative max-w-3xl mx-auto px-4 pt-4 pb-8">
        <div className="flex justify-between items-center gap-2">
          <OpeningHoursBadge lang={lang} />
          <LanguageSwitcher lang={lang} onChange={setLang} />
        </div>
        <div className="flex flex-col items-center text-center mt-2">
          <img src={logo} alt="Made with love by me™ Konstantinos Anagnostopoulos" className="w-40 h-40 sm:w-48 sm:h-48 rounded-full object-cover shadow-2xl ring-4 ring-white/20" />
          <p className="mt-4 text-primary-foreground/80 italic font-display text-lg">
            {t(lang, "tagline")}
          </p>
        </div>
      </div>
      <div className="h-3" style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }} />
    </header>
  );
}

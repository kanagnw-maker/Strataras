import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LANGUAGES, type LangCode } from "@/lib/i18n";
import strataras from "@/assets/strataras.png";

const PROMPTS: Record<LangCode, string> = {
  el: "Διάλεξε γλώσσα",
  en: "Choose your language",
  de: "Sprache wählen",
  fr: "Choisissez votre langue",
  es: "Elige tu idioma",
  tr: "Dil seçin",
};

// Greek first, then the rest in their existing order
const ORDERED = [
  LANGUAGES.find((l) => l.code === "el")!,
  ...LANGUAGES.filter((l) => l.code !== "el"),
];

export function LanguageGate({
  open,
  onPick,
}: {
  open: boolean;
  onPick: (l: LangCode) => void;
}) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-sm rounded-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center gap-2">
          <span className="rounded-full overflow-hidden h-16 w-16 ring-2 ring-primary/30 bg-muted">
            <img src={strataras} alt="" className="h-full w-full object-cover" />
          </span>
          <DialogTitle className="font-display text-xl">
            {PROMPTS.el}
            <span className="block text-sm text-muted-foreground font-sans mt-1">
              {ORDERED.filter((l) => l.code !== "el")
                .map((l) => PROMPTS[l.code as LangCode])
                .join(" · ")}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 mt-2">
          {ORDERED.map((l) => (
            <button
              key={l.code}
              onClick={() => onPick(l.code as LangCode)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary hover:bg-muted transition-colors text-left"
            >
              <span className="text-2xl leading-none">{l.flag}</span>
              <span className="font-medium">{l.label}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
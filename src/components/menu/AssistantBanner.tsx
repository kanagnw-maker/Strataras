import { useState } from "react";
import { Sparkles, ChevronRight } from "lucide-react";
import { AssistantChat } from "./AssistantChat";
import type { LangCode } from "@/lib/i18n";
import strataras from "@/assets/strataras.png";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const COPY: Record<string, { title: string; sub: string }> = {
  el: {
    title: "Ρωτήστε τον Στρατάρα 😉",
    sub: "Σου στήνει τραπέζι, όχι απλά πιάτα. Άστο πάνω του.",
  },
  en: {
    title: "Ask Strataras 😉",
    sub: "He sets the whole table — leave it to him.",
  },
  de: {
    title: "Frag Strataras 😉",
    sub: "Er stellt dir den ganzen Tisch zusammen — überlass es ihm.",
  },
  fr: {
    title: "Demandez à Strataras 😉",
    sub: "Il vous compose toute la table — laissez-le faire.",
  },
  es: {
    title: "Pregúntale a Strataras 😉",
    sub: "Te monta la mesa entera — déjalo en sus manos.",
  },
  tr: {
    title: "Strataras'a sor 😉",
    sub: "Sofranı o kurar — bırak ona.",
  },
};

export function AssistantBanner({ lang }: { lang: LangCode }) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const copy = COPY[lang] ?? COPY.el;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full mt-4 mb-2 group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 hover:from-primary/10 hover:to-accent/10 transition-all px-4 py-3.5 flex items-center gap-3 text-left shadow-sm hover:shadow-md"
      >
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setZoomed(true); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setZoomed(true); } }}
          className="shrink-0 rounded-full overflow-hidden shadow-md ring-2 ring-primary/30 h-11 w-11 bg-background cursor-zoom-in transition-transform active:scale-95"
        >
          <img src={strataras} alt="Στρατάρας" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 font-display font-semibold text-[15px] sm:text-base text-primary">
            {copy.title}
            <Sparkles className="h-3.5 w-3.5 text-accent" />
          </div>
          <div className="text-xs sm:text-[13px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
            {copy.sub}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-primary/60 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </button>

      <AssistantChat open={open} onOpenChange={setOpen} lang={lang} />

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-2xl p-0 bg-transparent border-0 shadow-none"
          onClick={() => setZoomed(false)}
        >
          <DialogTitle className="sr-only">Στρατάρας</DialogTitle>
          <div className="flex items-center justify-center animate-scale-in">
            <img
              src={strataras}
              alt="Στρατάρας"
              className="w-auto h-auto max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type LangCode } from "@/lib/i18n";
import { computeStatus, DAY_ORDER, useOpeningHours, type DayKey } from "@/hooks/useOpeningHours";

const DAY_LABEL_KEYS: Record<DayKey, "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"> = {
  mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun",
};

export function OpeningHoursBadge({ lang, className }: { lang: LangCode; className?: string }) {
  const { hours } = useOpeningHours();
  const [open, setOpen] = useState(false);
  const status = useMemo(() => computeStatus(hours), [hours]);
  const note = hours.note?.[lang] || hours.note?.el || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border backdrop-blur transition-colors",
            status.isOpen
              ? "bg-emerald-500/15 text-emerald-100 border-emerald-300/40 hover:bg-emerald-500/25"
              : "bg-red-500/15 text-red-100 border-red-300/40 hover:bg-red-500/25",
            className,
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              status.isOpen ? "bg-emerald-400 animate-pulse" : "bg-red-400",
            )}
          />
          <Clock className="h-3 w-3" />
          <span>
            {status.isOpen ? t(lang, "open") : t(lang, "closed")}
            {!status.isOpen && status.nextChange ? ` · ${t(lang, "opensAt")} ${status.nextChange}` : ""}
            {status.isOpen && status.nextChange ? ` · ${t(lang, "closesAt")} ${status.nextChange}` : ""}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="font-display text-base mb-2 text-primary">{t(lang, "hours")}</div>
        <ul className="space-y-1 text-sm">
          {DAY_ORDER.map((d) => {
            const cfg = hours.days[d];
            return (
              <li key={d} className="flex justify-between gap-3">
                <span className="text-muted-foreground w-10">{t(lang, DAY_LABEL_KEYS[d])}</span>
                <span className="text-foreground text-right flex-1">
                  {cfg.closed || cfg.slots.length === 0
                    ? t(lang, "closed")
                    : cfg.slots.map((s) => `${s.open}–${s.close}`).join(", ")}
                </span>
              </li>
            );
          })}
        </ul>
        {note && <p className="mt-3 text-xs text-muted-foreground italic">{note}</p>}
      </PopoverContent>
    </Popover>
  );
}
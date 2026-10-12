import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Slot = { open: string; close: string };
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type DayConfig = { closed: boolean; slots: Slot[] };
export type OpeningHours = {
  timezone: string;
  days: Record<DayKey, DayConfig>;
  note?: Record<string, string>;
};

export const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DEFAULT_HOURS: OpeningHours = {
  timezone: "Europe/Athens",
  days: Object.fromEntries(
    DAY_ORDER.map((d) => [d, { closed: false, slots: [{ open: "12:00", close: "23:30" }] }]),
  ) as Record<DayKey, DayConfig>,
  note: {},
};

function nowInTz(tz: string): { dayIdx: number; minutes: number } {
  // Returns local weekday index (0=Mon..6=Sun) and minutes since midnight.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const mm = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return { dayIdx: map[wd] ?? 0, minutes: hh * 60 + mm };
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export type OpenStatus = {
  isOpen: boolean;
  /** "HH:MM" of next change in local tz, or null if not applicable */
  nextChange: string | null;
  /** day index (0=Mon..6=Sun) of next change */
  nextChangeDay: number | null;
};

export function computeStatus(h: OpeningHours): OpenStatus {
  const { dayIdx, minutes } = nowInTz(h.timezone || "Europe/Athens");
  const today = h.days[DAY_ORDER[dayIdx]];
  // Check today's slots (handle close past midnight by treating close<open as next day)
  if (today && !today.closed) {
    for (const s of today.slots) {
      const o = toMin(s.open);
      let c = toMin(s.close);
      if (c <= o) c += 24 * 60; // crosses midnight
      if (minutes >= o && minutes < c) {
        return { isOpen: true, nextChange: s.close, nextChangeDay: dayIdx };
      }
    }
    // find next slot today
    const upcoming = today.slots
      .map((s) => toMin(s.open))
      .filter((o) => o > minutes)
      .sort((a, b) => a - b)[0];
    if (upcoming != null) {
      const hh = String(Math.floor(upcoming / 60)).padStart(2, "0");
      const mm = String(upcoming % 60).padStart(2, "0");
      return { isOpen: false, nextChange: `${hh}:${mm}`, nextChangeDay: dayIdx };
    }
  }
  // Check yesterday's slot crossing midnight (still open)
  const yIdx = (dayIdx + 6) % 7;
  const y = h.days[DAY_ORDER[yIdx]];
  if (y && !y.closed) {
    for (const s of y.slots) {
      const o = toMin(s.open);
      const c = toMin(s.close);
      if (c <= o) {
        // crosses midnight -> still open today between 0 and c
        if (minutes < c) {
          return { isOpen: true, nextChange: s.close, nextChangeDay: dayIdx };
        }
      }
    }
  }
  // Find next opening day
  for (let i = 1; i <= 7; i++) {
    const idx = (dayIdx + i) % 7;
    const d = h.days[DAY_ORDER[idx]];
    if (d && !d.closed && d.slots.length > 0) {
      const first = [...d.slots].map((s) => s.open).sort()[0];
      return { isOpen: false, nextChange: first, nextChangeDay: idx };
    }
  }
  return { isOpen: false, nextChange: null, nextChangeDay: null };
}

export function useOpeningHours() {
  const [hours, setHours] = useState<OpeningHours | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("value")
        .eq("key", "opening_hours")
        .maybeSingle();
      if (!mounted) return;
      setHours((data?.value as OpeningHours) ?? DEFAULT_HOURS);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { hours: hours ?? DEFAULT_HOURS, loading };
}
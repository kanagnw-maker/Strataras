import { useEffect, useState } from "react";

const KEY = "parateron.table_number";

function readInitial(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("table");
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0 && n < 1000) {
        sessionStorage.setItem(KEY, String(n));
        return n;
      }
    }
    const stored = sessionStorage.getItem(KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (Number.isFinite(n) && n > 0 && n < 1000) return n;
    }
  } catch {
    // ignore
  }
  return null;
}

export function useTableNumber() {
  const [tableNumber, setTableNumberState] = useState<number | null>(() => readInitial());

  useEffect(() => {
    if (tableNumber == null) {
      const v = readInitial();
      if (v != null) setTableNumberState(v);
    }
  }, [tableNumber]);

  const setTableNumber = (n: number | null) => {
    if (typeof window !== "undefined") {
      try {
        if (n == null) sessionStorage.removeItem(KEY);
        else sessionStorage.setItem(KEY, String(n));
      } catch {
        // ignore
      }
    }
    setTableNumberState(n);
  };

  return { tableNumber, setTableNumber };
}
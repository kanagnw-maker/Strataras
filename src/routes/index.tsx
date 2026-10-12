import { createFileRoute, Link } from "@tanstack/react-router";
import { MenuHeader } from "@/components/menu/MenuHeader";
import { MenuView } from "@/components/menu/MenuView";
import { LanguageGate } from "@/components/menu/LanguageGate";
import { useLang } from "@/hooks/useLang";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [lang, setLang, chosen] = useLang();

  return (
    <div className="min-h-screen bg-background">
      <LanguageGate open={!chosen} onPick={setLang} />
      <MenuHeader lang={lang} setLang={setLang} />
      <main>
        <MenuView lang={lang} />
      </main>
      <footer className="mt-16 py-10 text-center text-sm text-muted-foreground border-t border-border">
        <div className="max-w-3xl mx-auto px-4 break-words">
          <p className="font-display text-primary text-sm sm:text-base leading-tight">
            <span className="block sm:inline">Made with love by me™</span>{" "}
            <span className="block sm:inline">Konstantinos Anagnostopoulos</span>
          </p>
          <p className="mt-2 text-xs sm:text-sm">
            <span className="sm:hidden">© {new Date().getFullYear()} · Παράταιρον</span>
            <span className="hidden sm:inline">© {new Date().getFullYear()} · Παράταιρον — Μεζεδοπωλείο · All rights reserved</span>
          </p>
          <Link to="/admin" className="inline-flex items-center gap-1 mt-3 text-xs text-muted-foreground/60 hover:text-primary">
            <Lock className="h-3 w-3" /> Διαχείριση
          </Link>
        </div>
      </footer>
    </div>
  );
}

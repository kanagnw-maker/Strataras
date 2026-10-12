import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { LANGUAGES, type LangCode } from "@/lib/i18n";

export function LanguageSwitcher({ lang, onChange }: { lang: LangCode; onChange: (l: LangCode) => void }) {
  const current = LANGUAGES.find((l) => l.code === lang);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-primary-foreground/90 hover:text-primary-foreground hover:bg-white/10">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{current?.flag} {current?.label}</span>
          <span className="sm:hidden">{current?.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => onChange(l.code)} className="gap-2">
            <span>{l.flag}</span><span>{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, ChefHat, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, roleChecked, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>;

  if (!user) {
    return <LoginScreen />;
  }

  if (!roleChecked) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-foreground">Ο λογαριασμός σας δεν έχει δικαιώματα διαχειριστή.</p>
        <Button variant="outline" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Αποσύνδεση
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg">
            <ChefHat className="h-5 w-5" />
            <span>Παράταιρον · Διαχείριση</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-primary-foreground hover:bg-white/10">
              <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Μενού</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}
              className="text-primary-foreground hover:bg-white/10">
              <LogOut className="h-4 w-4 mr-1" />Έξοδος
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6"><Outlet /></main>
    </div>
  );
}

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import logo from "@/assets/logo-paratairon.jpeg";
import { toast } from "sonner";

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Λογαριασμός δημιουργήθηκε. Ζητήστε από διαχειριστή να σας δώσει δικαιώματα.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Σφάλμα");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-cream)" }}>
      <Card className="w-full max-w-sm p-6 shadow-[var(--shadow-warm)]">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Παράταιρον" className="w-24 h-24 rounded-full object-cover shadow-md" />
          <h1 className="font-display text-2xl mt-3 text-primary">Διαχείριση</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Κωδικός</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "login" ? "Σύνδεση" : "Εγγραφή"}
          </Button>
          <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-xs text-muted-foreground hover:text-primary w-full text-center">
            {mode === "login" ? "Πρώτη φορά; Δημιουργία λογαριασμού" : "Έχετε ήδη λογαριασμό; Σύνδεση"}
          </button>
        </form>
      </Card>
    </div>
  );
}

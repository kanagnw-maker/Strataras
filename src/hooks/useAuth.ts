import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);
  const manualSignOutRef = useRef(false);
  const roleCheckedRef = useRef(false);

  const signOut = async () => {
    manualSignOutRef.current = true;
    await supabase.auth.signOut();
    lastUserIdRef.current = null;
    roleCheckedRef.current = true;
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    setRoleChecked(true);
  };

  useEffect(() => {
    let cancelled = false;

    const clearAuth = () => {
      lastUserIdRef.current = null;
      roleCheckedRef.current = true;
      setSession(null);
      setUser(null);
      setIsAdmin(false);
      setRoleChecked(true);
    };

    const checkRole = (userId: string, attempt = 0) => {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle()
        .then(({ data, error }) => {
          if (cancelled || lastUserIdRef.current !== userId) return;
          if (error) {
            // transient error: keep previous isAdmin value, do not boot user out
            if (attempt < 2) {
              setTimeout(() => checkRole(userId, attempt + 1), 500);
            }
            return;
          }
          setIsAdmin(!!data);
          roleCheckedRef.current = true;
          setRoleChecked(true);
        });
    };

    const applySession = (nextSession: Session | null) => {
      if (!nextSession) {
        clearAuth();
        return;
      }

      manualSignOutRef.current = false;
      setSession(nextSession);
      setUser(nextSession.user);
      const newId = nextSession.user.id;
      if (newId !== lastUserIdRef.current) {
        lastUserIdRef.current = newId;
        roleCheckedRef.current = false;
        setRoleChecked(false);
        checkRole(newId);
      }
    };

    const recoverSessionBeforeClearing = () => {
      setLoading(false);
      setTimeout(async () => {
        if (cancelled || manualSignOutRef.current) return;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          applySession(data.session);
        } else {
          clearAuth();
        }
      }, 800);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED" && s) {
        setSession(s);
        setUser(s.user);
        return;
      }

      if (!s && lastUserIdRef.current && !manualSignOutRef.current) {
        recoverSessionBeforeClearing();
        return;
      }

      applySession(s);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user, isAdmin, roleChecked, loading, signOut };
}

"use client";

import { createContext, useContext } from "react";
import { useAuth, type AuthUser } from "./useAuth";

const AuthCtx = createContext<{ user: AuthUser | null; logout: () => void }>({
  user: null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth(true);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground">
        Memuat...
      </div>
    );
  }

  return <AuthCtx.Provider value={{ user, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuthContext() {
  return useContext(AuthCtx);
}

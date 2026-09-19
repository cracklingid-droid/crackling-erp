"use client";

import { createContext, useContext } from "react";
import { LoadingState } from "@/app/components/LoadingState";
import { useAuth, type AuthUser } from "./useAuth";

const AuthCtx = createContext<{ user: AuthUser | null; logout: () => void }>({
  user: null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth(true);

  if (loading || !user) {
    return (
      <LoadingState variant="screen" />
    );
  }

  return <AuthCtx.Provider value={{ user, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuthContext() {
  return useContext(AuthCtx);
}

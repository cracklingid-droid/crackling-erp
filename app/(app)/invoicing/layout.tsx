"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "../../components/AuthContext";
import { canAccessInvoicing } from "@/lib/roles";

// Modul Invoicing: owner/developer saja, sama pola dgn accounting/layout.tsx
// (permintaan Kevin 2026-09-15 - "cukup owner & developer dulu"). PENTING:
// ini cuma UX (redirect halus) - proteksi SEBENARNYA di server, tiap route
// API Invoicing cek canAccessInvoicing sendiri (lib/roles.ts).
export default function InvoicingLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const router = useRouter();
  const allowed = !user || canAccessInvoicing(user);

  useEffect(() => {
    if (user && !canAccessInvoicing(user)) router.replace("/");
  }, [user, router]);

  if (!allowed) return null;
  return children;
}

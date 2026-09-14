"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "../../components/AuthContext";
import { canAccessAccounting } from "@/lib/roles";

// Modul Accounting: HANYA owner/developer, tidak ada peran lain yang boleh
// bahkan MEMBUKA halamannya sama sekali (permintaan Kevin 2026-09-14,
// "tidak ada orang lain yang diperbolehkan untuk buka") - beda dari pola
// Cost Center (halaman tetap render, ditolak diam-diam 403 di API). Di sini
// seluruh /accounting/* di-redirect keluar utk role selain owner/developer.
// PENTING: ini cuma UX (redirect halus) - proteksi SEBENARNYA ada di server,
// tiap route API Accounting cek canAccessAccounting sendiri (lib/roles.ts),
// tidak bisa dilewati lewat panggilan API langsung.
export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const router = useRouter();
  const allowed = !user || canAccessAccounting(user);

  useEffect(() => {
    if (user && !canAccessAccounting(user)) router.replace("/");
  }, [user, router]);

  if (!allowed) return null;
  return children;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "../../components/AuthContext";

// Role "manager" (Cost Center, permintaan Kevin 2026-09-12) HANYA boleh
// akses Cost Center - dilempar keluar dari seluruh modul HR di sini,
// satu tempat, supaya tidak perlu tambah cek di tiap halaman HR satu-satu.
export default function HrLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === "manager") {
      router.replace("/cost-center");
    }
  }, [user, router]);

  if (user?.role === "manager") return null;
  return children;
}

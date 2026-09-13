"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthContext } from "../../components/AuthContext";

// Role "manager" (permintaan Kevin 2026-09-12 - Cost Center, diperluas
// 2026-09-13 - view-only Database Karyawan & Payroll RESTO) - boleh masuk
// /hr, /hr/karyawan (resto saja) & /hr/payroll/outlet/*, TAPI TIDAK BOLEH
// masuk Rekrutmen/Roster/Payroll Kantor sama sekali. PENTING: ini cuma UX
// (sembunyikan menu, redirect halus) - proteksi SEBENARNYA ada di server
// (lib/hr-access.ts, dipakai tiap route API) supaya tidak bisa dilewati
// lewat panggilan API langsung.
function isManagerAllowedPath(pathname: string): boolean {
  if (pathname === "/hr" || pathname === "/hr/payroll") return true;
  if (pathname.startsWith("/hr/karyawan")) return true;
  if (pathname.startsWith("/hr/payroll/outlet")) return true;
  return false;
}

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = !pathname || isManagerAllowedPath(pathname);

  useEffect(() => {
    if (user && user.role === "manager" && !allowed) router.replace("/hr/karyawan");
  }, [user, allowed, router]);

  if (user?.role === "manager" && !allowed) return null;
  return children;
}

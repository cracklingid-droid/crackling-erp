"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export type PortalEmployee = {
  id: number;
  name: string;
  employeeCode: string | null;
  position: string | null;
  outlet: string | null;
  photoUrl: string | null;
  mustResetPassword: boolean;
};

export function usePortalAuth(redirectIfMissing = true) {
  const router = useRouter();
  const pathname = usePathname();
  const [employee, setEmployee] = useState<PortalEmployee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/me")
      .then(async (r) => {
        if (r.status === 401) {
          setEmployee(null);
          if (redirectIfMissing) router.push("/portal/login");
          return;
        }
        const data = await r.json();
        setEmployee(data.employee);
        // Wajib ganti password pertama kali sebelum bisa akses halaman lain
        // manapun - permintaan Kevin 2026-09-18.
        if (data.employee?.mustResetPassword && pathname !== "/portal/reset-password") {
          router.push("/portal/reset-password");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
  }

  return { employee, loading, logout };
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type PortalEmployee = {
  id: number;
  name: string;
  employeeCode: string | null;
  position: string | null;
  outlet: string | null;
  photoUrl: string | null;
};

export function usePortalAuth(redirectIfMissing = true) {
  const router = useRouter();
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useAuthContext } from "./AuthContext";
import { hasHrWriteAccess } from "@/lib/roles";
import { ATTENDANCE_ISSUES_CHANGED_EVENT } from "@/lib/attendance-issue-types";

const REFRESH_MS = 5 * 60 * 1000;

// Lonceng "Absen Perlu Dicek" di header - cuma utk role yang boleh isi absen
// manual (HR/owner/developer). Angka diambil ulang tiap pindah halaman, tiap
// 5 menit, & langsung begitu ada import/penyelesaian masalah (event).
// Permintaan 2026-09-15.
export function AttendanceIssuesBell() {
  const { user } = useAuthContext();
  const pathname = usePathname();
  const canSee = !!user && hasHrWriteAccess(user);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!canSee) return;
    let cancelled = false;
    function load() {
      fetch("/api/payroll/attendance/issues/count")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data) setCount(data.count);
        })
        .catch(() => {});
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    window.addEventListener(ATTENDANCE_ISSUES_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(ATTENDANCE_ISSUES_CHANGED_EVENT, load);
    };
  }, [canSee, pathname]);

  if (!canSee) return null;

  const label = count ? `${count} absen perlu dicek` : "Tidak ada absen yang perlu dicek";
  return (
    <Link
      href="/hr/payroll/absensi/masalah"
      title={label}
      aria-label={label}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Bell className="h-4 w-4" />
      {!!count && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

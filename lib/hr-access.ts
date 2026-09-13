import { NextResponse } from "next/server";
import { getCurrentUser } from "./current-user";
import { hasHrWriteAccess } from "./roles";

// Guard endpoint yang MENULIS (create/update/delete) - dipakai di awal tiap
// route Rekrutmen/Roster/Payroll/Karyawan selain GET murni. "manager"
// SENGAJA tidak termasuk - lihat requireHrReadUser utk baca resto-scoped.
// Permintaan Kevin 2026-09-13 (menutup celah: sebelumnya semua endpoint API
// HR cuma cek login, tanpa cek role sama sekali).
export async function requireHrWriteUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null as never, error: NextResponse.json({ error: "Belum login" }, { status: 401 }) };
  if (!hasHrWriteAccess(user)) {
    return { user: null as never, error: NextResponse.json({ error: "Tidak punya akses" }, { status: 403 }) };
  }
  return { user, error: null as null };
}

// Guard endpoint GET yang boleh dibaca "manager" TAPI cuma scope Outlet
// (Database Karyawan & Payroll Outlet, termasuk slip gaji) - permintaan
// Kevin 2026-09-13. Role HR penuh selalu boleh baca semua.
export async function requireHrReadUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null as never, error: NextResponse.json({ error: "Belum login" }, { status: 401 }) };
  if (!hasHrWriteAccess(user) && user.role !== "manager") {
    return { user: null as never, error: NextResponse.json({ error: "Tidak punya akses" }, { status: 403 }) };
  }
  return { user, error: null as null };
}

// True kalau user boleh melihat data kategori ini - "manager" dibatasi
// outlet saja, role HR penuh boleh semua kategori.
export function canViewCategory(user: { role: string }, category: string): boolean {
  if (hasHrWriteAccess(user)) return true;
  if (user.role === "manager") return category === "outlet";
  return false;
}

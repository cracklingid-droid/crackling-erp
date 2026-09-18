// Cek role murni (tanpa import server-only spt next/headers/prisma) - aman
// dipakai di client component (mis. TopBar) MAUPUN server. Pemisahan ini
// perlu krn lib/current-user.ts import next/headers (lewat lib/session.ts),
// yang bikin build error kalau di-import langsung dari "use client".

// Role dgn akses penuh ke semua modul - owner & developer (akun asli) +
// "developer2" (akun developer kedua, permintaan Kevin 2026-09-15).
const FULL_ACCESS_ROLES = new Set(["owner", "developer", "developer2"]);

export function hasFullAccess(user: { role: string }): boolean {
  return FULL_ACCESS_ROLES.has(user.role);
}

// Role "manager" (Cost Center, permintaan Kevin 2026-09-12) - namanya
// sengaja disamakan dgn role "manager" yang sudah ada di Crackling
// Warehouse (akses semua outlet, lihat laporan, tidak bisa input transaksi)
// karena orangnya sama. HANYA boleh akses Cost Center, TIDAK boleh akses
// modul HR lain (Rekrutmen/Karyawan/Payroll/Roster) - lihat guard di
// app/(app)/hr/layout.tsx.
export function canAccessCostCenter(user: { role: string }): boolean {
  return hasFullAccess(user) || user.role === "manager";
}

// Role yang boleh MENULIS apapun di modul HR (Rekrutmen/Karyawan/Payroll/
// Roster) - owner & developer (akses penuh) + hr_manager/hr_staff (kerja
// harian HR). Role "manager" TIDAK PERNAH termasuk di sini, cuma boleh baca
// lewat lib/hr-access.ts (requireHrReadUser/canViewCategory). Permintaan
// Kevin 2026-09-13 - menutup celah: sebelumnya SEMUA endpoint API HR cuma
// cek login, siapa pun role-nya bisa menulis lewat panggilan API langsung
// (curl/devtools), bukan cuma lewat tampilan.
export function hasHrWriteAccess(user: { role: string }): boolean {
  return hasFullAccess(user) || user.role === "hr_manager" || user.role === "hr_staff";
}

// Deteksi otomatis posisi SPV dari string jabatan (bukan field baru di
// Employee) - dipakai utk buka menu "Lembur" di Portal Karyawan. Permintaan
// Kevin 2026-09-14: "jika posisi spv ada menu bisa mengajukan lembur".
export function isSpvPosition(position: string | null | undefined): boolean {
  return !!position && position.toLowerCase().includes("spv");
}

// Fitur Pengajuan Lembur SPV (permintaan Kevin 2026-09-14) - approval 2
// tahap: "manager" memutuskan tahap pending_manager, HR (hr_manager/hr_staff)
// memutuskan tahap pending_hr. owner/developer (hasFullAccess) boleh
// memutuskan di kedua tahap krn mereka sudah akses penuh ke semua modul HR.
// Ditaruh di sini (bukan lib/hr-access.ts) krn logikanya murni dari
// user.role/status - aman dipakai di client component (tombol approve/tolak).
export function canViewOvertimeRequests(user: { role: string }): boolean {
  return hasFullAccess(user) || user.role === "manager" || hasHrWriteAccess(user);
}

export function canDecideOvertimeStage(user: { role: string }, status: string): boolean {
  // Cek status DULU, sebelum cek role - bug ditemukan lewat verifikasi live
  // 2026-09-14: hasFullAccess yang di-cek duluan bikin owner/developer bisa
  // "memutuskan ulang" request yang statusnya sudah "approved"/"rejected"
  // (bahkan membalik "rejected" jadi "approved" krn else-branch di route
  // decide menganggap status apa pun selain "pending_manager" = tahap HR).
  if (status !== "pending_manager" && status !== "pending_hr") return false;
  if (hasFullAccess(user)) return true;
  if (status === "pending_manager") return user.role === "manager";
  return hasHrWriteAccess(user);
}

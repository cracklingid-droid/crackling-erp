// Cek role murni (tanpa import server-only spt next/headers/prisma) - aman
// dipakai di client component (mis. TopBar) MAUPUN server. Pemisahan ini
// perlu krn lib/current-user.ts import next/headers (lewat lib/session.ts),
// yang bikin build error kalau di-import langsung dari "use client".

// owner & developer selalu akses penuh ke semua modul HR.
export function hasFullAccess(user: { role: string }): boolean {
  return user.role === "owner" || user.role === "developer";
}

// Role "manager" (Cost Center, permintaan Kevin 2026-09-12) - namanya
// sengaja disamakan dgn role "manager" yang sudah ada di Crackling
// Warehouse (akses semua outlet, lihat laporan, tidak bisa input transaksi)
// karena orangnya sama. HANYA boleh akses Cost Center, TIDAK boleh akses
// modul HR lain (Rekrutmen/Karyawan/Payroll/Roster) - lihat guard di
// app/(app)/hr/layout.tsx.
export function canAccessCostCenter(user: { role: string }): boolean {
  return user.role === "owner" || user.role === "developer" || user.role === "manager";
}

// Role yang boleh MENULIS apapun di modul HR (Rekrutmen/Karyawan/Payroll/
// Roster) - owner & developer (akses penuh) + hr_manager/hr_staff (kerja
// harian HR). Role "manager" TIDAK PERNAH termasuk di sini, cuma boleh baca
// lewat lib/hr-access.ts (requireHrReadUser/canViewCategory). Permintaan
// Kevin 2026-09-13 - menutup celah: sebelumnya SEMUA endpoint API HR cuma
// cek login, siapa pun role-nya bisa menulis lewat panggilan API langsung
// (curl/devtools), bukan cuma lewat tampilan.
export function hasHrWriteAccess(user: { role: string }): boolean {
  return user.role === "owner" || user.role === "developer" || user.role === "hr_manager" || user.role === "hr_staff";
}

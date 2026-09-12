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

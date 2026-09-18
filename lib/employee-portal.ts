// Login Portal Karyawan: ID = kode ID otomatis (employeeCode). Password
// AWAL (sebelum pernah diganti) = kode + tahun lahir, mis. "GS-0001" +
// 1995 -> "GS-00011995". Sejak 2026-09-18, karyawan WAJIB ganti password
// ini sendiri saat login pertama kali (lihat Employee.portalPasswordEnc di
// schema.prisma & app/api/portal/login) - default di bawah cuma berlaku
// selama portalPasswordEnc masih null, atau setelah HR klik "Reset ke
// Default". Permintaan awal Kevin 2026-09-12, kewajiban reset 2026-09-18.
export function derivePortalPassword(employeeCode: string, birthDate: Date | string): string {
  const year = new Date(birthDate).getFullYear();
  return `${employeeCode}${year}`;
}

export function canUsePortal(employee: { employeeCode: string | null; birthDate: Date | string | null }): boolean {
  return !!employee.employeeCode && !!employee.birthDate;
}

export function mustResetPortalPassword(employee: { portalPasswordEnc?: string | null }): boolean {
  return !employee.portalPasswordEnc;
}

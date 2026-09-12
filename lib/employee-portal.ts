// Login Portal Karyawan: ID = kode ID otomatis (employeeCode), password =
// kode + tahun lahir (mis. "GS-0001" + 1995 -> "GS-00011995") - sengaja
// tetap & tidak bisa diganti sendiri, supaya HR selalu bisa lihat &
// kasih tahu ke karyawan kapan saja tanpa perlu fitur reset. Permintaan
// Kevin 2026-09-12.
export function derivePortalPassword(employeeCode: string, birthDate: Date | string): string {
  const year = new Date(birthDate).getFullYear();
  return `${employeeCode}${year}`;
}

export function canUsePortal(employee: { employeeCode: string | null; birthDate: Date | string | null }): boolean {
  return !!employee.employeeCode && !!employee.birthDate;
}

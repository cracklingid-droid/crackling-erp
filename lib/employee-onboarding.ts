// Field yang wajib diisi HR sebelum karyawan bisa diaktifkan (status
// "onboarding" -> "active") - permintaan Kevin 2026-09-10: karyawan yang
// otomatis masuk dari Rekrutmen (Diterima) tetap harus dilengkapi datanya
// dulu sebelum resmi onboard. NPWP & BPJS sengaja tidak wajib karena di
// praktiknya sering baru terbit beberapa hari setelah karyawan mulai kerja.
export const REQUIRED_ONBOARDING_FIELDS: { key: string; label: string }[] = [
  { key: "employeeCode", label: "NIK/ID Karyawan" },
  { key: "position", label: "Jabatan" },
  { key: "outlet", label: "Outlet/Cabang" },
  { key: "employmentStatus", label: "Status Kepegawaian" },
  { key: "joinDate", label: "Tanggal Mulai Kerja" },
  { key: "baseSalary", label: "Gaji Pokok" },
  { key: "bankName", label: "Nama Bank" },
  { key: "bankAccountNumber", label: "No. Rekening" },
];

type EmployeeLike = Record<string, unknown>;

export function getMissingOnboardingFields(employee: EmployeeLike, hasKtp: boolean): string[] {
  const missing: string[] = [];
  for (const f of REQUIRED_ONBOARDING_FIELDS) {
    const v = employee[f.key];
    if (v === null || v === undefined || v === "") missing.push(f.label);
  }
  if (!hasKtp) missing.push("Upload KTP");
  return missing;
}

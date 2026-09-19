// Label & warna badge status karyawan - SATU sumber utk Database Karyawan
// (list + detail) dan Portal Karyawan. Sebelumnya tiap halaman punya map
// sendiri (list menampilkan nilai mentah "pkwt"/"kontrak" dgn `capitalize`,
// portal tidak kenal "probation" jadi tampil mentah). Perbaikan UI
// menyeluruh 2026-09-19.
export const EMPLOYEE_STATUS_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  active: "Aktif",
  resigned: "Resign",
};

export const EMPLOYEE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  onboarding: "outline",
  active: "default",
  resigned: "secondary",
};

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "tetap", label: "Karyawan Tetap" },
  { value: "kontrak", label: "Kontrak" },
  { value: "pkwt", label: "PKWT" },
  { value: "magang", label: "Magang" },
  { value: "probation", label: "Probation" },
] as const;

export function employmentStatusLabel(value: string | null | undefined): string {
  if (!value) return "-";
  return EMPLOYMENT_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

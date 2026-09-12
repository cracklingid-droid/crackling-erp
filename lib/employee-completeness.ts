// Daftar field "paket standar" yang dianggap wajib supaya profil karyawan
// disebut 100% lengkap - lebih luas dari REQUIRED_ONBOARDING_FIELDS (yang
// cuma gerbang minimal sebelum status "Aktif"). Dipakai di Database
// Karyawan (indikator per baris) & halaman detail (checklist kelengkapan).
// Permintaan Kevin 2026-09-12.
export const COMPLETENESS_FIELDS: { key: string; label: string }[] = [
  { key: "ktpNumber", label: "No. KTP/NIK" },
  { key: "phone", label: "No. HP" },
  { key: "address", label: "Alamat" },
  { key: "birthDate", label: "Tanggal Lahir" },
  { key: "bankName", label: "Nama Bank" },
  { key: "bankAccountNumber", label: "No. Rekening" },
  { key: "bankAccountHolder", label: "Atas Nama Rekening" },
  { key: "npwp", label: "NPWP" },
  { key: "bpjsKesehatanNumber", label: "BPJS Kesehatan" },
  { key: "bpjsKetenagakerjaanNumber", label: "BPJS Ketenagakerjaan" },
];

type EmployeeLike = Record<string, unknown>;

export function computeCompleteness(employee: EmployeeLike, hasKtpDocument: boolean) {
  const missing: string[] = [];
  for (const f of COMPLETENESS_FIELDS) {
    const v = employee[f.key];
    if (v === null || v === undefined || v === "") missing.push(f.label);
  }
  if (!hasKtpDocument) missing.push("Dokumen KTP");

  const total = COMPLETENESS_FIELDS.length + 1;
  const filled = total - missing.length;
  const percent = Math.round((filled / total) * 100);
  return { missing, filled, total, percent };
}

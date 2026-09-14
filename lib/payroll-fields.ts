// Daftar kolom PayrollItem yang bisa diedit HR + mana yang jadi
// penambah/pengurang gaji bersih - dipakai bareng oleh halaman detail
// periode gaji dan halaman slip gaji supaya tidak ketikan ulang di 2
// tempat (permintaan Kevin 2026-09-11 saat menambah fitur slip gaji).
export type FieldDef = { key: string; label: string };

// "Lembur (Rp)" SENGAJA TIDAK ADA di sini - Kevin 2026-09-14 minta
// dihapus total (bukan cuma dimatikan otomatisnya): shift resto Crackling
// 12 jam tetap, tidak ada acuan lembur yang bisa diturunkan dari absensi.
// Field overtimePay tetap ada di DB (locked, selalu 0) tapi tidak
// ditampilkan/diedit di mana pun sampai ada keputusan lebih lanjut.
//
// "BPJS Kesehatan"/"BPJS Ketenagakerjaan" JUGA SENGAJA TIDAK ADA - keputusan
// Kevin 2026-09-14: karyawan resto tidak pernah dikenakan BPJS sama sekali
// (kebijakan resto, bukan kasus per-karyawan). Field bpjsKesehatanDeduction/
// bpjsKetenagakerjaanDeduction tetap ada di DB (selalu 0) tapi tidak
// ditampilkan/diedit lagi. Payroll Kantor punya mekanisme BPJS SENDIRI
// (bpjsAllowance/bpjsEmployerObligation/bpjsRemittance di KANTOR_FIELDS) -
// TIDAK terpengaruh perubahan ini.
//
// "PPh21" JUGA SENGAJA TIDAK ADA di sini - keputusan Kevin 2026-09-14:
// karyawan resto/outlet tidak kena pajak PPh21 sama sekali. Field
// pph21Deduction tetap ada di DB (selalu 0 utk item Outlet) tapi tidak
// ditampilkan/diedit lagi di Payroll Outlet. Payroll Kantor TETAP punya
// PPh21 (lihat pph21Deduction di KANTOR_BASE_FIELDS) - TIDAK terpengaruh.
export const BASE_FIELDS: FieldDef[] = [
  { key: "baseSalary", label: "Gaji Pokok" },
  { key: "partTimePay", label: "Gaji Part Time" },
  { key: "mealAllowance", label: "Uang Makan" },
  { key: "transportReimbursement", label: "Reimb. Transport" },
  { key: "attendanceDeduction", label: "Potongan Absensi" },
  { key: "loanDeduction", label: "Kasbon" },
];

// Kategori tambahan khusus Payroll Outlet, ikut logika spreadsheet gaji
// outlet Crackling (permintaan Kevin 2026-09-11) - tidak tampil di Kantor.
export const OUTLET_FIELDS: FieldDef[] = [
  { key: "lateDeduction", label: "Potongan Telat" },
  { key: "incidentDeduction", label: "Potongan Kejadian" },
  { key: "warningLetterDeduction", label: "Potongan SP" },
  { key: "depositDeduction", label: "Bayar Deposit" },
  { key: "depositRefund", label: "Kembali Deposit" },
  { key: "serviceCharge", label: "Service Charge" },
  { key: "bonus", label: "Bonus" },
];

// Field dasar khusus Payroll Kantor (Gaji Pokok TIDAK diprorata, dst) -
// TERPISAH dari BASE_FIELDS (Outlet) supaya slip Kantor tidak menampilkan
// baris nol yang tidak relevan (Gaji Part Time, Reimb. Transport, BPJS
// Kesehatan/Ketenagakerjaan rumus umum, Potongan Absensi - itu semua
// konsep Outlet). Permintaan Kevin 2026-09-13.
export const KANTOR_BASE_FIELDS: FieldDef[] = [
  { key: "bonus", label: "Bonus" },
  { key: "baseSalary", label: "Gaji Pokok" },
  { key: "mealAllowance", label: "Uang Makan" },
  { key: "pph21Deduction", label: "PPh21" },
  { key: "lateDeduction", label: "Potongan Telat" },
  { key: "loanDeduction", label: "Kasbon" },
];

// Kategori tambahan khusus Payroll Kantor, ikut logika spreadsheet gaji
// kantor "2608 rekap gaji FINAL.xlsx" (permintaan Kevin 2026-09-13) - tidak
// tampil di Outlet. "Potongan" generik kantor pakai TAIL_FIELDS
// (otherAdjustment) yang sudah ada - field itu "boleh minus".
export const KANTOR_FIELDS: FieldDef[] = [
  { key: "bonusSales", label: "Bonus Atas Penjualan" },
  { key: "bpjsAllowance", label: "Tunjangan BPJS Kar" },
  { key: "bpjsEmployerObligation", label: "Kewajiban BPJS Ktr" },
  { key: "incompleteClockInDeduction", label: "Absen Tdk Lengkap Clock In" },
  { key: "incompleteClockOutDeduction", label: "Absen Tdk Lengkap Clock Out" },
  { key: "bpjsRemittance", label: "Setoran ke BPJS" },
];

export const TAIL_FIELDS: FieldDef[] = [{ key: "otherAdjustment", label: "Penyesuaian Lain" }];

export const DEDUCTION_FIELD_KEYS = new Set([
  "attendanceDeduction",
  "bpjsKesehatanDeduction",
  "bpjsKetenagakerjaanDeduction",
  "pph21Deduction",
  "loanDeduction",
  "lateDeduction",
  "incidentDeduction",
  "warningLetterDeduction",
  "depositDeduction",
  "incompleteClockInDeduction",
  "incompleteClockOutDeduction",
  "bpjsRemittance",
]);

export function fieldsForCategory(category: string): FieldDef[] {
  if (category === "outlet") return [...BASE_FIELDS, ...OUTLET_FIELDS, ...TAIL_FIELDS];
  if (category === "kantor") return [...KANTOR_BASE_FIELDS, ...KANTOR_FIELDS, ...TAIL_FIELDS];
  return [...BASE_FIELDS, ...TAIL_FIELDS];
}

// Field non-uang (referensi HR, bukan komponen gaji) per kategori - dulu
// diduplikat lokal di beberapa halaman, disatukan di sini. Permintaan
// Kevin 2026-09-13.
export const OUTLET_INFO_FIELDS: FieldDef[] = [{ key: "lateCount", label: "Jml Telat" }];
export const KANTOR_INFO_FIELDS: FieldDef[] = [
  { key: "lateCount", label: "Jml Telat" },
  { key: "incompleteClockInCount", label: "Hari Tdk Lengkap Clock In" },
  { key: "incompleteClockOutCount", label: "Hari Tdk Lengkap Clock Out" },
];
export function infoFieldsForCategory(category: string): FieldDef[] {
  if (category === "outlet") return OUTLET_INFO_FIELDS;
  if (category === "kantor") return KANTOR_INFO_FIELDS;
  return [];
}

export function computeNetPay(item: Record<string, number>, fields: FieldDef[]): number {
  let total = 0;
  for (const f of fields) {
    const v = item[f.key] ?? 0;
    total += DEDUCTION_FIELD_KEYS.has(f.key) ? -v : v;
  }
  return total;
}

// Daftar kolom PayrollItem yang bisa diedit HR + mana yang jadi
// penambah/pengurang gaji bersih - dipakai bareng oleh halaman detail
// periode gaji dan halaman slip gaji supaya tidak ketikan ulang di 2
// tempat (permintaan Kevin 2026-09-11 saat menambah fitur slip gaji).
export type FieldDef = { key: string; label: string };

export const BASE_FIELDS: FieldDef[] = [
  { key: "baseSalary", label: "Gaji Pokok" },
  { key: "partTimePay", label: "Gaji Part Time" },
  { key: "mealAllowance", label: "Uang Makan" },
  { key: "transportReimbursement", label: "Reimb. Transport" },
  { key: "overtimePay", label: "Lembur (Rp)" },
  { key: "attendanceDeduction", label: "Potongan Absensi" },
  { key: "bpjsKesehatanDeduction", label: "BPJS Kesehatan" },
  { key: "bpjsKetenagakerjaanDeduction", label: "BPJS Ketenagakerjaan" },
  { key: "pph21Deduction", label: "PPh21" },
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
]);

export function fieldsForCategory(category: string): FieldDef[] {
  return category === "outlet" ? [...BASE_FIELDS, ...OUTLET_FIELDS, ...TAIL_FIELDS] : [...BASE_FIELDS, ...TAIL_FIELDS];
}

export function computeNetPay(item: Record<string, number>, fields: FieldDef[]): number {
  let total = 0;
  for (const f of fields) {
    const v = item[f.key] ?? 0;
    total += DEDUCTION_FIELD_KEYS.has(f.key) ? -v : v;
  }
  return total;
}

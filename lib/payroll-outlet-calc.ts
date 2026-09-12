import {
  calcOutletBaseSalary,
  calcOutletMealAllowance,
  calcOutletTransportAllowance,
  calcOutletOvertimePay,
  calcBpjsKesehatan,
  calcBpjsKetenagakerjaan,
} from "./payroll-config";

// Field PayrollItem Outlet yang SEMUANYA berasal dari data absensi/konfigurasi
// karyawan (bukan input manual HR) - dikunci (read-only) di halaman detail
// periode & ditolak endpoint PATCH-nya, supaya tidak ada ruang HR salah
// ketik/salah edit. Dihitung ulang otomatis tiap kali absensi diupload utk
// periode yang masih draft. Keputusan Kevin 2026-09-12.
export const OUTLET_LOCKED_FIELD_KEYS = new Set([
  "baseSalary",
  "partTimePay",
  "mealAllowance",
  "transportReimbursement",
  "overtimePay",
  "bpjsKesehatanDeduction",
  "bpjsKetenagakerjaanDeduction",
]);

export type OutletEmployeeInput = {
  baseSalary: number | null;
  dailyMealRate: number | null;
  dailyTransportRate: number | null;
  dailyBaseRate: number | null;
};

export function computeOutletPayrollFields(emp: OutletEmployeeInput, daysPresent: number, overtimeMinutes: number) {
  const baseSalary = emp.baseSalary ?? 0;
  const dailyMealRate = emp.dailyMealRate ?? 0;
  const dailyTransportRate = emp.dailyTransportRate ?? 0;
  // Karyawan part time (gaji harian) tidak punya gaji pokok bulanan - gajinya
  // cuma rate harian x hari hadir, terpisah dari baseSalary.
  const partTimePay = emp.dailyBaseRate != null ? emp.dailyBaseRate * daysPresent : 0;
  // Gaji pokok diprorata kalau hari hadir < 24 hari.
  const proratedBaseSalary = calcOutletBaseSalary(baseSalary, daysPresent);

  return {
    daysPresent,
    overtimeMinutes,
    baseSalary: proratedBaseSalary,
    partTimePay,
    mealAllowance: calcOutletMealAllowance(dailyMealRate, daysPresent),
    transportReimbursement: calcOutletTransportAllowance(dailyTransportRate, daysPresent),
    overtimePay: calcOutletOvertimePay(dailyMealRate, overtimeMinutes),
    bpjsKesehatanDeduction: calcBpjsKesehatan(baseSalary),
    bpjsKetenagakerjaanDeduction: calcBpjsKetenagakerjaan(baseSalary),
  };
}

import { calcOutletBaseSalary, calcOutletMealAllowance, calcOutletTransportAllowance } from "./payroll-config";

// Field PayrollItem Outlet yang SEMUANYA berasal dari data absensi/konfigurasi
// karyawan (bukan input manual HR) - dikunci (read-only) di halaman detail
// periode & ditolak endpoint PATCH-nya, supaya tidak ada ruang HR salah
// ketik/salah edit. Dihitung ulang otomatis tiap kali absensi diupload utk
// periode yang masih draft. Keputusan Kevin 2026-09-12.
//
// bpjsKesehatanDeduction/bpjsKetenagakerjaanDeduction SENGAJA TIDAK ADA di
// sini lagi - keputusan Kevin 2026-09-14: "karyawan resto tidak ada yang
// dikenakan BPJS sama sekali" - bukan kasus per-karyawan, tapi kebijakan
// resto secara keseluruhan. Field tetap ada di DB (selalu 0) tapi tidak
// dihitung/ditampilkan lagi (beda dari Payroll Kantor yang punya mekanisme
// BPJS sendiri - bpjsAllowance/bpjsEmployerObligation/bpjsRemittance,
// TIDAK disentuh oleh perubahan ini).
export const OUTLET_LOCKED_FIELD_KEYS = new Set([
  "baseSalary",
  "partTimePay",
  "mealAllowance",
  "transportReimbursement",
  "overtimePay",
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
    // overtimeMinutes selalu 0 (lihat lib/attendance-summary.ts) - Lembur
    // TIDAK dihitung otomatis dari absensi. Keputusan Kevin 2026-09-14.
    overtimeMinutes,
    baseSalary: proratedBaseSalary,
    partTimePay,
    mealAllowance: calcOutletMealAllowance(dailyMealRate, daysPresent),
    transportReimbursement: calcOutletTransportAllowance(dailyTransportRate, daysPresent),
    overtimePay: 0,
    // BPJS TIDAK dikenakan ke karyawan resto sama sekali - keputusan Kevin
    // 2026-09-14 (lihat catatan OUTLET_LOCKED_FIELD_KEYS di atas).
    bpjsKesehatanDeduction: 0,
    bpjsKetenagakerjaanDeduction: 0,
  };
}

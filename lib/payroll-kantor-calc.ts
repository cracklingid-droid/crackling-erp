import {
  calcKantorLateDeduction,
  calcKantorIncompleteClockDeduction,
} from "./payroll-config";

// Field PayrollItem Kantor yang berasal dari absensi/konfigurasi karyawan
// (bukan input manual HR) - dikunci (read-only) di halaman detail periode &
// ditolak endpoint PATCH-nya, pola sama dgn Outlet (lib/payroll-outlet-
// calc.ts, OUTLET_LOCKED_FIELD_KEYS) tapi field/rumusnya beda total. bonusSales,
// pph21Deduction, otherAdjustment ("Potongan" generik), fuelKm tetap manual -
// tidak ada sumber datanya di sistem. Keputusan Kevin 2026-09-13.
export const KANTOR_LOCKED_FIELD_KEYS = new Set([
  "baseSalary",
  "mealAllowance",
  "overtimePay",
  "lateCount",
  "lateDeduction",
  "incompleteClockInCount",
  "incompleteClockInDeduction",
  "incompleteClockOutCount",
  "incompleteClockOutDeduction",
  "bpjsAllowance",
  "bpjsEmployerObligation",
  "bpjsRemittance",
]);

export type KantorEmployeeInput = {
  baseSalary: number | null;
  dailyMealRate: number | null;
  kantorOvertimeRate: number | null;
  kantorLateRate: number | null;
  kantorIncompleteClockRate: number | null;
  kantorBpjsAllowance: number | null;
  kantorBpjsEmployerObligation: number | null;
  kantorBpjsRemittance: number | null;
};

export type KantorAttendanceInput = {
  daysPresent: number;
  overtimeMinutes: number;
  lateCount: number;
  incompleteClockInCount: number;
  incompleteClockOutCount: number;
};

export function computeKantorPayrollFields(emp: KantorEmployeeInput, att: KantorAttendanceInput) {
  const lateRate = emp.kantorLateRate ?? 0;
  const incompleteRate = emp.kantorIncompleteClockRate ?? 0;

  return {
    daysPresent: att.daysPresent,
    // overtimeMinutes selalu 0 (lihat lib/attendance-summary.ts) - Lembur
    // TIDAK dihitung otomatis dari absensi. Keputusan Kevin 2026-09-14.
    overtimeMinutes: att.overtimeMinutes,
    baseSalary: emp.baseSalary ?? 0, // TIDAK diprorata - beda dari Outlet
    mealAllowance: (emp.dailyMealRate ?? 0) * att.daysPresent,
    overtimePay: 0,
    lateCount: att.lateCount,
    lateDeduction: calcKantorLateDeduction(lateRate, att.lateCount),
    incompleteClockInCount: att.incompleteClockInCount,
    incompleteClockInDeduction: calcKantorIncompleteClockDeduction(incompleteRate, att.incompleteClockInCount),
    incompleteClockOutCount: att.incompleteClockOutCount,
    incompleteClockOutDeduction: calcKantorIncompleteClockDeduction(incompleteRate, att.incompleteClockOutCount),
    bpjsAllowance: emp.kantorBpjsAllowance ?? 0,
    bpjsEmployerObligation: emp.kantorBpjsEmployerObligation ?? 0,
    bpjsRemittance: emp.kantorBpjsRemittance ?? 0,
  };
}

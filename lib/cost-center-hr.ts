import { prisma } from "./db";
import {
  OUTLET_PRORATE_STANDARD_DAYS,
  calcOutletMealAllowance,
  calcOutletTransportAllowance,
  calcOutletOvertimePay,
} from "./payroll-config";

export type DailyEmployeeCost = {
  employeeId: number;
  employeeName: string;
  outletName: string;
  overtimeMinutes: number;
  baseSalary: number;
  partTimePay: number;
  mealAllowance: number;
  transportReimbursement: number;
  overtimePay: number;
  cost: number;
};

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Biaya gaji per TANGGAL SEBENARNYA (bukan rata-rata periode) - dari
// AttendanceRecord langsung. Cuma karyawan yang PUNYA catatan absen pada
// tanggal itu yang muncul & menyumbang biaya ke tanggal itu:
// - Uang Makan & Reimb. Transport = tarif harian penuh (memang sudah tarif
//   per-hari, bukan hasil bagi apa pun).
// - Gaji Pokok = gaji bulanan / 24 hari kerja standar (lib/payroll-config.ts
//   OUTLET_PRORATE_STANDARD_DAYS) - tarif "1 hari kerja standar", SAMA utk
//   setiap hari dia hadir (bukan dibagi rata ke SEMUA hari kalender
//   periode termasuk hari dia tidak masuk).
// - Lembur = dihitung dari jam kerja aktual HARI ITU SAJA (clockIn/
//   clockOut record itu), bukan dari total lembur 1 periode.
// - Karyawan part time (dailyBaseRate) = tarif harian penuh.
// Perbaikan permintaan Kevin 2026-09-12: sebelumnya biaya gaji harian =
// total gaji 1 periode dibagi rata jumlah HARI KALENDER periode, jadi
// karyawan yang cuma hadir 9 dari 30 hari tetap "dibiayakan" di SEMUA 30
// hari termasuk hari dia tidak masuk - salah secara akuntansi. Sekarang
// TIDAK bergantung pada PayrollPeriod sama sekali - murni dari konfigurasi
// tarif Employee + AttendanceRecord aktual, jadi selalu akurat walau
// periode belum dibuat/difinalisasi.
export async function getPayrollCostByDate(startDate: Date, endDate: Date, outletNames: string[]): Promise<Map<string, DailyEmployeeCost[]>> {
  const byDate = new Map<string, DailyEmployeeCost[]>();
  if (outletNames.length === 0) return byDate;

  const employees = await prisma.employee.findMany({ where: { status: "active", outlet: { in: outletNames } } });
  if (employees.length === 0) return byDate;
  const empById = new Map(employees.map((e) => [e.id, e]));

  const records = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) }, date: { gte: startDate, lte: endDate } },
  });

  for (const r of records) {
    const emp = empById.get(r.employeeId);
    if (!emp) continue;

    const dailyMealRate = emp.dailyMealRate ?? 0;
    const dailyTransportRate = emp.dailyTransportRate ?? 0;
    const overtimeMinutes =
      r.clockIn && r.clockOut ? Math.max(0, Math.round((r.clockOut.getTime() - r.clockIn.getTime()) / 60000 - 8 * 60)) : 0;

    const entry: DailyEmployeeCost = {
      employeeId: emp.id,
      employeeName: emp.name,
      outletName: emp.outlet ?? "(Tanpa Outlet)",
      overtimeMinutes,
      baseSalary: emp.baseSalary ? Math.round(emp.baseSalary / OUTLET_PRORATE_STANDARD_DAYS) : 0,
      partTimePay: emp.dailyBaseRate ?? 0,
      mealAllowance: calcOutletMealAllowance(dailyMealRate, 1),
      transportReimbursement: calcOutletTransportAllowance(dailyTransportRate, 1),
      overtimePay: calcOutletOvertimePay(dailyMealRate, overtimeMinutes),
      cost: 0,
    };
    entry.cost = entry.baseSalary + entry.partTimePay + entry.mealAllowance + entry.transportReimbursement + entry.overtimePay;

    const key = dateKey(r.date);
    const arr = byDate.get(key) ?? [];
    arr.push(entry);
    byDate.set(key, arr);
  }

  return byDate;
}

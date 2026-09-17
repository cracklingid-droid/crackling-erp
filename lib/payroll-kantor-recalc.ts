import { prisma } from "./db";
import { employeeCategory } from "./payroll-config";
import { computeKantorPayrollFields } from "./payroll-kantor-calc";
import { computeAttendanceSummaries } from "./attendance-summary";

export type RecalcResult = { updated: number } | { error: string };

// Hitung ulang field terkunci Payroll Kantor (Gaji Pokok, Uang Makan, Lembur,
// Keterlambatan, Absen Tidak Lengkap, BPJS) dari data AttendanceRecord yang
// ADA SEKARANG di database - pola sama dgn recalcOutletPeriod (lib/payroll-
// outlet-recalc.ts), field/rumusnya beda total. BEDA PENTING dari Outlet:
// `schedules` map DIKIRIM ke computeAttendanceSummaries supaya Keterlambatan
// dihitung otomatis (Outlet sengaja tidak - lateCount/lateDeduction Outlet
// manual). Cuma periode kategori "kantor" & masih "draft" yang boleh.
// Permintaan Kevin 2026-09-13.
export async function recalcKantorPeriod(periodId: number): Promise<RecalcResult> {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { items: { include: { employee: true } } },
  });
  if (!period) return { error: "Periode tidak ditemukan" };
  if (period.category !== "kantor") return { error: "Cuma periode Payroll Kantor yang bisa di-refresh dari absensi" };
  if (period.status !== "draft") return { error: "Periode sudah final - buka kembali dulu sebelum refresh" };

  const employeeIds = period.items.map((it) => it.employeeId);
  const schedules = new Map(period.items.map((it) => [it.employeeId, it.employee.scheduleStart]));
  const summaries = await computeAttendanceSummaries(employeeIds, period.startDate, period.endDate, schedules);

  let updated = 0;
  for (const item of period.items) {
    if (employeeCategory(item.employee.outlet) !== "kantor") continue;
    const s = summaries.get(item.employeeId) ?? {
      daysPresent: 0,
      overtimeMinutes: 0,
      totalMinutes: 0,
      lateCount: 0,
      incompleteClockInCount: 0,
      incompleteClockOutCount: 0,
    };
    await prisma.payrollItem.update({
      where: { id: item.id },
      data: computeKantorPayrollFields(item.employee, s),
    });
    updated++;
  }

  return { updated };
}

import { prisma } from "./db";
import { employeeCategory } from "./payroll-config";
import { computeOutletPayrollFields } from "./payroll-outlet-calc";
import { computeAttendanceSummaries } from "./attendance-summary";

export type RecalcResult = { updated: number } | { error: string };

// Hitung ulang field terkunci (Gaji Pokok, Uang Makan, Reimb. Transport,
// Lembur, BPJS) SEMUA baris PayrollItem di 1 periode Payroll Outlet dari
// data AttendanceRecord yang ADA SEKARANG di database - SATU-SATUNYA
// tempat (dipakai otomatis begitu absensi diupload, lihat
// app/api/payroll/attendance/import/route.ts, MAUPUN manual lewat tombol
// "Refresh dari Absensi" di halaman detail periode - permintaan Kevin
// 2026-09-12: "HR tinggal jalankan refresh untuk rekalkulasi ulang").
// Cuma periode kategori "outlet" & masih "draft" yang boleh - periode
// "final" tidak boleh berubah sendiri.
export async function recalcOutletPeriod(periodId: number): Promise<RecalcResult> {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { items: { include: { employee: true } } },
  });
  if (!period) return { error: "Periode tidak ditemukan" };
  if (period.category !== "outlet") return { error: "Cuma periode Payroll Outlet yang bisa di-refresh dari absensi" };
  if (period.status !== "draft") return { error: "Periode sudah final - buka kembali dulu sebelum refresh" };

  const employeeIds = period.items.map((it) => it.employeeId);
  const summaries = await computeAttendanceSummaries(employeeIds, period.startDate, period.endDate);

  let updated = 0;
  for (const item of period.items) {
    if (employeeCategory(item.employee.outlet) !== "outlet") continue;
    const { daysPresent, overtimeMinutes } = summaries.get(item.employeeId) ?? { daysPresent: 0, overtimeMinutes: 0, totalMinutes: 0, lateCount: 0 };
    await prisma.payrollItem.update({
      where: { id: item.id },
      data: computeOutletPayrollFields(item.employee, daysPresent, overtimeMinutes),
    });
    updated++;
  }

  return { updated };
}

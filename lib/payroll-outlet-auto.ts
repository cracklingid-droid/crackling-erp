import { prisma } from "./db";
import { employeeCategory, CONTRACT_DEPOSIT_INSTALLMENT, CONTRACT_DEPOSIT_INSTALLMENT_COUNT } from "./payroll-config";
import { computeOutletPayrollFields } from "./payroll-outlet-calc";
import { nextOutletPeriodRange, outletPeriodLabel } from "./payroll-outlet-schedule";
import { computeAttendanceSummaries } from "./attendance-summary";

export type AutoCreateResult =
  | { created: true; period: { id: number; label: string; startDate: Date; endDate: Date } }
  | { created: false; reason: string };

// Logic pembuatan periode Payroll Outlet berikutnya - SATU-SATUNYA tempat
// (dipakai endpoint manual POST /api/payroll/periods DAN cron otomatis
// /api/cron/create-outlet-period, lihat file itu). Aman dipanggil tanpa
// campur tangan HR krn jadwal tanggalnya sudah dikunci sepenuhnya
// (lib/payroll-outlet-schedule.ts). createdById null = dibuat sistem
// (cron), bukan HR manual. Permintaan Kevin 2026-09-12.
export async function createNextOutletPeriod(createdById: number | null): Promise<AutoCreateResult> {
  const lastPeriod = await prisma.payrollPeriod.findFirst({
    where: { category: "outlet" },
    orderBy: { endDate: "desc" },
  });
  if (!lastPeriod) {
    return { created: false, reason: "Belum ada periode outlet sebelumnya - hubungi developer utk seed periode pertama." };
  }

  const range = nextOutletPeriodRange(lastPeriod.endDate);
  const dup = await prisma.payrollPeriod.findFirst({ where: { category: "outlet", startDate: range.start, endDate: range.end } });
  if (dup) return { created: false, reason: `Periode "${dup.label}" utk rentang ini sudah ada.` };

  const label = outletPeriodLabel(range.end);
  const employees = await prisma.employee.findMany({ where: { status: "active" } });
  const inCategory = employees.filter((e) => employeeCategory(e.outlet) === "outlet");
  const summaries = await computeAttendanceSummaries(inCategory.map((e) => e.id), range.start, range.end);

  const period = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollPeriod.create({
      data: { label, category: "outlet", startDate: range.start, endDate: range.end, createdById: createdById ?? undefined },
    });

    for (const emp of inCategory) {
      const { daysPresent, overtimeMinutes } = summaries.get(emp.id) ?? { daysPresent: 0, overtimeMinutes: 0, totalMinutes: 0, lateCount: 0 };

      // Deposit wajib karyawan kontrak - Rp250rb otomatis di 2 periode
      // pertama, berhenti sendiri setelahnya. Permintaan Kevin 2026-09-11.
      const isContractDepositDue = emp.employmentStatus === "kontrak" && emp.depositInstallmentsPaid < CONTRACT_DEPOSIT_INSTALLMENT_COUNT;
      const depositDeduction = isContractDepositDue ? CONTRACT_DEPOSIT_INSTALLMENT : 0;

      await tx.payrollItem.create({
        data: {
          periodId: created.id,
          employeeId: emp.id,
          ...computeOutletPayrollFields(emp, daysPresent, overtimeMinutes),
          depositDeduction,
        },
      });

      if (isContractDepositDue) {
        await tx.employee.update({
          where: { id: emp.id },
          data: { depositInstallmentsPaid: { increment: 1 }, depositBalance: { increment: CONTRACT_DEPOSIT_INSTALLMENT } },
        });
      }
    }

    return created;
  });

  return { created: true, period: { id: period.id, label: period.label, startDate: period.startDate, endDate: period.endDate } };
}

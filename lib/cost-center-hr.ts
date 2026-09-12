import { prisma } from "./db";
import { fieldsForCategory, DEDUCTION_FIELD_KEYS } from "./payroll-fields";

export type HrOutletCost = { outletName: string; grossPayrollCost: number; daysInPeriod: number; dailyCost: number };

// Total biaya gaji KOTOR per outlet dalam 1 periode Payroll Outlet yang
// sudah final - "kotor" krn yang dihitung Cost Center adalah total uang yang
// benar-benar dikeluarkan perusahaan utk menggaji (base+transport+makan+
// lembur+bonus+dst), BUKAN net pay ke karyawan (potongan spt BPJS/kasbon/
// deposit cuma realokasi internal, bukan penghematan biaya perusahaan).
// "biaya harian yang harus disiapkan" = total ini / jumlah hari periode.
// Permintaan Kevin 2026-09-12 (Cost Center).
function computeGrossPayrollCost(item: Record<string, number>, fields: { key: string }[]): number {
  let total = 0;
  for (const f of fields) {
    if (DEDUCTION_FIELD_KEYS.has(f.key)) continue;
    total += item[f.key] ?? 0;
  }
  return total;
}

export async function getPayrollCostByOutlet(periodId: number): Promise<{
  outlets: HrOutletCost[];
  period: { id: number; label: string; startDate: Date; endDate: Date };
} | null> {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { items: { include: { employee: { select: { outlet: true } } } } },
  });
  if (!period || period.category !== "outlet") return null;

  const daysInPeriod = Math.round((period.endDate.getTime() - period.startDate.getTime()) / 86400000) + 1;
  const fields = fieldsForCategory("outlet");

  const costByOutlet = new Map<string, number>();
  for (const item of period.items) {
    const outletName = item.employee.outlet ?? "(Tanpa Outlet)";
    const cost = computeGrossPayrollCost(item as unknown as Record<string, number>, fields);
    costByOutlet.set(outletName, (costByOutlet.get(outletName) ?? 0) + cost);
  }

  const outlets = Array.from(costByOutlet.entries()).map(([outletName, grossPayrollCost]) => ({
    outletName,
    grossPayrollCost,
    daysInPeriod,
    dailyCost: Math.round(grossPayrollCost / daysInPeriod),
  }));

  return { outlets, period: { id: period.id, label: period.label, startDate: period.startDate, endDate: period.endDate } };
}

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

export type DailyPayrollRate = { outletName: string; dailyCost: number };

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Peta tanggal -> biaya gaji harian per outlet, dari periode Payroll Outlet
// APA PUN statusnya (draft ATAU final) yang cakupan tanggalnya menyentuh
// rentang diminta - dipakai Dashboard Harian Cost Center supaya tetap ada
// angka gaji walau periode belum di-final-kan (final cuma disyaratkan utk
// laporan resmi per-periode, bukan dashboard ringkasan harian). Kalau 1
// tanggal tidak masuk periode manapun (mis. periode berikutnya belum
// dibuat HR), tanggal itu sengaja tidak muncul di Map - dashboard
// menampilkannya sbg "belum ada data gaji". Permintaan Kevin 2026-09-12.
export async function getPayrollDailyRatesByOutlet(startDate: Date, endDate: Date): Promise<Map<string, DailyPayrollRate[]>> {
  const periods = await prisma.payrollPeriod.findMany({
    where: { category: "outlet", startDate: { lte: endDate }, endDate: { gte: startDate } },
    include: { items: { include: { employee: { select: { outlet: true } } } } },
  });

  const fields = fieldsForCategory("outlet");
  const byDate = new Map<string, DailyPayrollRate[]>();

  for (const period of periods) {
    const daysInPeriod = Math.round((period.endDate.getTime() - period.startDate.getTime()) / 86400000) + 1;
    const costByOutlet = new Map<string, number>();
    for (const item of period.items) {
      const outletName = item.employee.outlet ?? "(Tanpa Outlet)";
      const cost = computeGrossPayrollCost(item as unknown as Record<string, number>, fields);
      costByOutlet.set(outletName, (costByOutlet.get(outletName) ?? 0) + cost);
    }
    const rates: DailyPayrollRate[] = Array.from(costByOutlet.entries()).map(([outletName, total]) => ({
      outletName,
      dailyCost: total / daysInPeriod,
    }));

    const from = period.startDate > startDate ? period.startDate : startDate;
    const to = period.endDate < endDate ? period.endDate : endDate;
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      byDate.set(dateKey(d), rates);
    }
  }

  return byDate;
}

export type PayrollDailyDetailEmployee = {
  employeeName: string;
  outletName: string;
  daysPresent: number;
  overtimeMinutes: number;
  baseSalary: number;
  partTimePay: number;
  mealAllowance: number;
  transportReimbursement: number;
  overtimePay: number;
  grossCost: number;
  dailyCost: number;
};
export type PayrollDailyDetail = {
  periodId: number;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  daysInPeriod: number;
  employees: PayrollDailyDetailEmployee[];
} | null;

// Rincian per-karyawan di balik 1 angka Biaya Gaji harian (1 tanggal,
// dibatasi ke `outletNames` - PENTING tetap dikirim daftar outlet
// penjualan waktu filter dashboard "Semua Outlet", bukan seluruh outlet
// payroll, supaya totalnya cocok dgn angka yang diklik: karyawan Joglo/
// Central Kitchen TIDAK ikut, sama seperti getPayrollDailyRatesByOutlet +
// filter SELLING_OUTLETS di /api/cost-center/daily) - dipakai popup "lihat
// rinciannya". Biaya Gaji harian = total gaji kotor periode Payroll Outlet
// yang mencakup tanggal itu, dibagi rata jumlah hari periode (BUKAN
// nominal yang benar-benar keluar hari itu saja - gaji dibayar per
// periode, bukan harian). Permintaan Kevin 2026-09-12 ("bagaimana
// perhitungannya").
export async function getPayrollDailyDetailForDate(date: Date, outletNames: string[]): Promise<PayrollDailyDetail> {
  const period = await prisma.payrollPeriod.findFirst({
    where: { category: "outlet", startDate: { lte: date }, endDate: { gte: date } },
    include: { items: { include: { employee: { select: { name: true, outlet: true } } } } },
  });
  if (!period) return null;

  const fields = fieldsForCategory("outlet");
  const daysInPeriod = Math.round((period.endDate.getTime() - period.startDate.getTime()) / 86400000) + 1;

  const employees: PayrollDailyDetailEmployee[] = period.items
    .filter((item) => item.employee.outlet && outletNames.includes(item.employee.outlet))
    .map((item) => {
      const grossCost = computeGrossPayrollCost(item as unknown as Record<string, number>, fields);
      return {
        employeeName: item.employee.name,
        outletName: item.employee.outlet ?? "(Tanpa Outlet)",
        daysPresent: item.daysPresent,
        overtimeMinutes: item.overtimeMinutes,
        baseSalary: item.baseSalary,
        partTimePay: item.partTimePay,
        mealAllowance: item.mealAllowance,
        transportReimbursement: item.transportReimbursement,
        overtimePay: item.overtimePay,
        grossCost,
        dailyCost: grossCost / daysInPeriod,
      };
    })
    .sort((a, b) => b.dailyCost - a.dailyCost);

  return {
    periodId: period.id,
    periodLabel: period.label,
    periodStart: period.startDate,
    periodEnd: period.endDate,
    daysInPeriod,
    employees,
  };
}

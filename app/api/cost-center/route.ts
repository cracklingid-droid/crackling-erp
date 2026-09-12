import { NextResponse } from "next/server";
import { getCurrentUser, canAccessCostCenter } from "@/lib/current-user";
import { getPayrollCostByOutlet } from "@/lib/cost-center-hr";
import { getWarehouseUsageCostByOutlet, WAREHOUSE_OUTLET_TO_HR_NAME } from "@/lib/cost-center-warehouse";

// Laporan biaya operasional per outlet (Tahap 1 Cost Center, 2026-09-12):
// Biaya Gaji (dari HR, periode Payroll Outlet yang final) + Biaya Pemakaian
// Stok/Central Kitchen (dibaca READ-ONLY dari database Warehouse). Belum
// ada Omzet/Gross Profit - itu nunggu link Google Sheets omzet harian dari
// Kevin (lihat plan). Akses: owner/developer/manager saja.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessCostCenter(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const periodId = Number(new URL(req.url).searchParams.get("periodId"));
  if (!periodId) return NextResponse.json({ error: "periodId wajib diisi" }, { status: 400 });

  const hrResult = await getPayrollCostByOutlet(periodId);
  if (!hrResult) return NextResponse.json({ error: "Periode tidak ditemukan / bukan periode Outlet" }, { status: 404 });

  let warehouseCosts: Awaited<ReturnType<typeof getWarehouseUsageCostByOutlet>> = [];
  let warehouseError: string | null = null;
  try {
    warehouseCosts = await getWarehouseUsageCostByOutlet(hrResult.period.startDate, hrResult.period.endDate);
  } catch (e) {
    // Warehouse adalah sistem terpisah di luar kendali crackling-erp - kalau
    // koneksinya gagal, laporan biaya gaji TETAP tampil, cuma kolom
    // pemakaian Warehouse-nya kosong + pesan error jelas, bukan 500 total.
    warehouseError = e instanceof Error ? e.message : "Gagal membaca data Warehouse";
  }

  const allOutletNames = new Set<string>([
    ...hrResult.outlets.map((o) => o.outletName),
    ...Object.values(WAREHOUSE_OUTLET_TO_HR_NAME),
  ]);

  const rows = Array.from(allOutletNames).map((outletName) => {
    const hr = hrResult.outlets.find((o) => o.outletName === outletName);
    const wh = warehouseCosts.find((o) => o.hrOutletName === outletName);
    const grossPayrollCost = hr?.grossPayrollCost ?? 0;
    const usageCost = wh?.usageCost ?? 0;
    return {
      outletName,
      grossPayrollCost,
      dailyPayrollCost: hr?.dailyCost ?? 0,
      usageCost,
      hasWarehouseData: !!wh,
      totalCost: grossPayrollCost + usageCost,
    };
  });
  rows.sort((a, b) => a.outletName.localeCompare(b.outletName));

  const daysInPeriod = Math.round((hrResult.period.endDate.getTime() - hrResult.period.startDate.getTime()) / 86400000) + 1;

  return NextResponse.json({
    period: hrResult.period,
    daysInPeriod,
    rows,
    grandTotal: rows.reduce((s, r) => s + r.totalCost, 0),
    warehouseError,
  });
}

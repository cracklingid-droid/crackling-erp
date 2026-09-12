import { NextResponse } from "next/server";
import { getCurrentUser, canAccessCostCenter } from "@/lib/current-user";
import { getPayrollCostByOutlet } from "@/lib/cost-center-hr";
import { getWarehouseUsageCostByOutlet, WAREHOUSE_OUTLET_TO_HR_NAME } from "@/lib/cost-center-warehouse";
import { getOmzetByOutlet } from "@/lib/cost-center-sales";

// Laporan biaya & Gross Profit per outlet (Cost Center, 2026-09-12): Biaya
// Gaji (HR, periode Payroll Outlet final) + Biaya Pemakaian Stok/Central
// Kitchen (READ-ONLY dari database Warehouse) + Omzet (disinkron manual dari
// Google Sheets penjualan POS, lihat /api/cost-center/sync-sales). Akses:
// owner/developer/manager saja.
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

  const omzets = await getOmzetByOutlet(hrResult.period.startDate, hrResult.period.endDate);

  const allOutletNames = new Set<string>([
    ...hrResult.outlets.map((o) => o.outletName),
    ...Object.values(WAREHOUSE_OUTLET_TO_HR_NAME),
    ...omzets.map((o) => o.outletName),
  ]);

  const rows = Array.from(allOutletNames).map((outletName) => {
    const hr = hrResult.outlets.find((o) => o.outletName === outletName);
    const wh = warehouseCosts.find((o) => o.hrOutletName === outletName);
    const sales = omzets.find((o) => o.outletName === outletName);
    const grossPayrollCost = hr?.grossPayrollCost ?? 0;
    const usageCost = wh?.usageCost ?? 0;
    const totalCost = grossPayrollCost + usageCost;
    const omzet = sales?.totalOmzet ?? 0;
    return {
      outletName,
      grossPayrollCost,
      dailyPayrollCost: hr?.dailyCost ?? 0,
      usageCost,
      hasWarehouseData: !!wh,
      totalCost,
      omzet,
      hasSalesData: !!sales,
      lastSalesSyncAt: sales?.lastSyncedAt ?? null,
      grossProfit: omzet - totalCost,
    };
  });
  rows.sort((a, b) => a.outletName.localeCompare(b.outletName));

  const daysInPeriod = Math.round((hrResult.period.endDate.getTime() - hrResult.period.startDate.getTime()) / 86400000) + 1;

  return NextResponse.json({
    period: hrResult.period,
    daysInPeriod,
    rows,
    grandTotal: rows.reduce((s, r) => s + r.totalCost, 0),
    grandOmzet: rows.reduce((s, r) => s + r.omzet, 0),
    grandGrossProfit: rows.reduce((s, r) => s + r.grossProfit, 0),
    warehouseError,
  });
}

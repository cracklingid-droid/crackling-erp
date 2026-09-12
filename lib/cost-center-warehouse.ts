import { warehouseDb } from "./warehouse-db";

// Kode outlet Warehouse -> nama outlet HR (persis string yang dipakai
// Employee.outlet & lib/payroll-config.ts OUTLET_NAMES) - dipakai buat
// gabungkan baris Biaya Gaji (HR) & Biaya Pemakaian (Warehouse) jadi 1
// baris per outlet di Cost Center. Fatgai sengaja tidak ada di sini -
// belum di-setup ke Warehouse (keputusan Kevin 2026-09-12).
export const WAREHOUSE_OUTLET_TO_HR_NAME: Record<string, string> = {
  JOGLO: "Joglo (Central Kitchen)",
  GS: "Gading Serpong",
  KG: "Kelapa Gading",
};

export type WarehouseOutletCost = { hrOutletName: string; warehouseOutletCode: string; usageCost: number };

// Biaya pemakaian per outlet dalam 1 rentang tanggal - definisi "keluar"
// SAMA PERSIS dengan laporan Pemakaian Harian Warehouse sendiri
// (lib/fifo.ts getDailyMovementReport di crackling-warehouse: qty < 0 =
// keluar/pemakaian, apapun `type`-nya) - supaya angkanya selalu cocok
// dengan yang Warehouse tampilkan, tidak ada definisi baru yang beda.
// Otomatis mencakup Central Kitchen (Joglo) juga - movement Daily
// Closing-nya (CPB/Chasiu) sama-sama tercatat qty negatif per outletId.
export async function getWarehouseUsageCostByOutlet(startDate: Date, endDate: Date): Promise<WarehouseOutletCost[]> {
  const [outlets, movements] = await Promise.all([
    warehouseDb.outlet.findMany(),
    warehouseDb.stockMovement.findMany({
      where: { moveDate: { gte: startDate, lte: endDate }, qty: { lt: 0 } },
      select: { outletId: true, totalCost: true },
    }),
  ]);

  const costByOutletId = new Map<number, number>();
  for (const m of movements) {
    costByOutletId.set(m.outletId, (costByOutletId.get(m.outletId) ?? 0) + Math.abs(Number(m.totalCost)));
  }

  return outlets
    .filter((o) => WAREHOUSE_OUTLET_TO_HR_NAME[o.code])
    .map((o) => ({
      hrOutletName: WAREHOUSE_OUTLET_TO_HR_NAME[o.code],
      warehouseOutletCode: o.code,
      usageCost: costByOutletId.get(o.id) ?? 0,
    }));
}

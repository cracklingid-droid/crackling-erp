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

// Type StockMovement yang SENGAJA tidak dihitung sbg "biaya pemakaian":
// - TRANSFER_OUT: barang cuma pindah outlet (Surat Jalan), bukan terpakai/
//   hilang di outlet asal - nilainya nanti ikut ke outlet TUJUAN lewat FIFO
//   waktu barang itu betulan dipakai/terjual di sana (movement USAGE-nya).
//   Kalau TRANSFER_OUT ikut dihitung, nilainya kehitung 2x (di outlet asal
//   & outlet tujuan).
// - PRODUCTION_OUT: bahan mentah/gudang berubah jadi produk FG di Central
//   Kitchen - transformasi internal, bukan biaya keluar (nilainya balik
//   lagi lewat PRODUCTION_IN ke stok FG, lalu ikut kehitung waktu FG itu
//   dikirim/dipakai). Permintaan Kevin 2026-09-12: "di central kitchen
//   hanya terjadi perubahan dari produk gudang/mentah menjadi produk FG...
//   biaya karyawan CK tidak akan dibiayakan ke outlet" - jadi biaya
//   pemakaian riil Central Kitchen cuma dari movement selain transformasi
//   & pengiriman (mis. USAGE/ADJUSTMENT beneran, bukan proses/kirim).
const EXCLUDED_USAGE_TYPES = ["TRANSFER_OUT", "PRODUCTION_OUT"];

export type DailyUsageCost = { hrOutletName: string; usageCost: number };

// Versi per-tanggal dari getWarehouseUsageCostByOutlet di atas - definisi
// "biaya pemakaian" SAMA PERSIS (qty<0, dikurangi EXCLUDED_USAGE_TYPES),
// cuma dikelompokkan per hari juga - dipakai Dashboard Harian Cost Center.
export async function getWarehouseUsageCostByOutletDaily(startDate: Date, endDate: Date): Promise<Map<string, DailyUsageCost[]>> {
  const [outlets, movements] = await Promise.all([
    warehouseDb.outlet.findMany(),
    warehouseDb.stockMovement.findMany({
      where: { moveDate: { gte: startDate, lte: endDate }, qty: { lt: 0 }, type: { notIn: EXCLUDED_USAGE_TYPES } },
      select: { outletId: true, totalCost: true, moveDate: true },
    }),
  ]);
  const outletNameById = new Map(
    outlets.filter((o) => WAREHOUSE_OUTLET_TO_HR_NAME[o.code]).map((o) => [o.id, WAREHOUSE_OUTLET_TO_HR_NAME[o.code]])
  );

  const byDate = new Map<string, Map<string, number>>();
  for (const m of movements) {
    const outletName = outletNameById.get(m.outletId);
    if (!outletName) continue;
    const key = m.moveDate.toISOString().slice(0, 10);
    const dayMap = byDate.get(key) ?? new Map<string, number>();
    dayMap.set(outletName, (dayMap.get(outletName) ?? 0) + Math.abs(Number(m.totalCost)));
    byDate.set(key, dayMap);
  }

  const result = new Map<string, DailyUsageCost[]>();
  for (const [date, dayMap] of byDate) {
    result.set(date, Array.from(dayMap.entries()).map(([hrOutletName, usageCost]) => ({ hrOutletName, usageCost })));
  }
  return result;
}

export type UsageDetailLine = { outletName: string; itemName: string; type: string; qty: number; totalCost: number };

// Rincian baris-per-baris di balik 1 angka Biaya Pemakaian (1 tanggal,
// dibatasi ke `outletHrNames` yang sama persis dipakai dashboard - PENTING
// tetap dikirim daftar outlet penjualan (bukan null utk "semua Warehouse")
// waktu filter dashboard "Semua Outlet", supaya totalnya cocok dgn angka
// yang diklik (Joglo/Central Kitchen tidak ikut, sama seperti
// getWarehouseUsageCostByOutletDaily). Permintaan Kevin 2026-09-12.
export async function getWarehouseUsageDetailForDate(date: Date, outletHrNames: string[]): Promise<UsageDetailLine[]> {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  const [outlets, movements] = await Promise.all([
    warehouseDb.outlet.findMany(),
    warehouseDb.stockMovement.findMany({
      where: { moveDate: { gte: date, lt: nextDate }, qty: { lt: 0 }, type: { notIn: EXCLUDED_USAGE_TYPES } },
      select: { outletId: true, itemId: true, type: true, qty: true, totalCost: true },
    }),
  ]);
  const outletNameById = new Map(
    outlets.filter((o) => WAREHOUSE_OUTLET_TO_HR_NAME[o.code]).map((o) => [o.id, WAREHOUSE_OUTLET_TO_HR_NAME[o.code]])
  );

  const filtered = movements.filter((m) => {
    const name = outletNameById.get(m.outletId);
    return !!name && outletHrNames.includes(name);
  });

  const itemIds = Array.from(new Set(filtered.map((m) => m.itemId)));
  const items = itemIds.length > 0 ? await warehouseDb.item.findMany({ where: { id: { in: itemIds } } }) : [];
  const itemNameById = new Map(items.map((i) => [i.id, i.name]));

  return filtered
    .map((m) => ({
      outletName: outletNameById.get(m.outletId)!,
      itemName: itemNameById.get(m.itemId) ?? `Item #${m.itemId}`,
      type: m.type,
      qty: Number(m.qty),
      totalCost: Math.abs(Number(m.totalCost)),
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

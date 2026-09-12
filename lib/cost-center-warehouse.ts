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

// Joglo bukan titik jual (tidak ada Omzet) - dipakai buat kecualikan
// barisnya dari Total Biaya/Gross Profit gabungan. Keputusan Kevin
// 2026-09-12.
export const CENTRAL_KITCHEN_OUTLET_NAME = WAREHOUSE_OUTLET_TO_HR_NAME.JOGLO;

export type WarehouseOutletCost = { hrOutletName: string; warehouseOutletCode: string; usageCost: number };

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

// Biaya pemakaian per outlet dalam 1 rentang tanggal - basisnya SAMA dgn
// definisi "keluar" laporan Pemakaian Harian Warehouse sendiri (qty < 0),
// dikurangi type transformasi/pengiriman di atas supaya tidak dobel hitung
// antara Central Kitchen & outlet penerima.
export async function getWarehouseUsageCostByOutlet(startDate: Date, endDate: Date): Promise<WarehouseOutletCost[]> {
  const [outlets, movements] = await Promise.all([
    warehouseDb.outlet.findMany(),
    warehouseDb.stockMovement.findMany({
      where: { moveDate: { gte: startDate, lte: endDate }, qty: { lt: 0 }, type: { notIn: EXCLUDED_USAGE_TYPES } },
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

export type CentralKitchenTransfer = { hrOutletName: string; count: number; value: number };

// Info transparansi (BUKAN komponen Total Biaya - keputusan Kevin
// 2026-09-12): jumlah & nilai Surat Jalan yang diterbitkan Joglo (Central
// Kitchen) ke tiap outlet dalam 1 rentang tanggal. Nilainya = totalCost
// movement TRANSFER_IN (sourceType "TRANSFER") di outlet penerima - sudah
// otomatis kehitung sbg bagian Biaya Pemakaian outlet itu waktu barangnya
// betulan dipakai, jadi TIDAK dijumlahkan lagi ke Total Biaya di sini.
export async function getCentralKitchenTransfersByOutlet(startDate: Date, endDate: Date): Promise<CentralKitchenTransfer[]> {
  const [outlets, movements] = await Promise.all([
    warehouseDb.outlet.findMany(),
    warehouseDb.stockMovement.findMany({
      where: { moveDate: { gte: startDate, lte: endDate }, type: "TRANSFER_IN", sourceType: "TRANSFER" },
      select: { outletId: true, totalCost: true, sourceId: true },
    }),
  ]);

  const byOutletId = new Map<number, { transferIds: Set<number>; value: number }>();
  for (const m of movements) {
    const entry = byOutletId.get(m.outletId) ?? { transferIds: new Set<number>(), value: 0 };
    entry.transferIds.add(m.sourceId);
    entry.value += Number(m.totalCost);
    byOutletId.set(m.outletId, entry);
  }

  return outlets
    .filter((o) => WAREHOUSE_OUTLET_TO_HR_NAME[o.code] && byOutletId.has(o.id))
    .map((o) => {
      const entry = byOutletId.get(o.id)!;
      return { hrOutletName: WAREHOUSE_OUTLET_TO_HR_NAME[o.code], count: entry.transferIds.size, value: entry.value };
    });
}

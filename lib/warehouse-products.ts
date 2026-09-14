import { warehouseDb } from "./warehouse-db";

// Katalog item Warehouse + harga FIFO - dipakai modul Product Accounting
// (permintaan Kevin 2026-09-14: "list produk skunya apa saja dan harga FIFO
// ketika berbelanja"). Semua BACA SAJA lewat jembatan lib/warehouse-db.ts;
// item baru yang dibuat di Warehouse otomatis muncul di sini tanpa sync
// (query langsung ke tabel Item Warehouse tiap kali dibuka).
//
// Harga FIFO = rata-rata tertimbang unitCost dari batch yang MASIH ADA
// SISA (qtyRemaining > 0) lintas semua outlet - persis nilai yang dipakai
// Warehouse sendiri waktu stok itu dipakai/dijual (lib/fifo.ts). Harga beli
// terakhir = unitCost batch dgn receivedAt paling baru (sumber PURCHASE),
// utk lihat harga pasar terkini walau sisa batch lamanya masih ada.
export type ProductRow = {
  id: number;
  sku: string;
  name: string;
  categoryCode: string;
  unit: string;
  standardCost: number | null;
  fifoCost: number | null;
  lastPurchaseCost: number | null;
  lastPurchaseAt: string | null;
  stockQty: number;
  isActive: boolean;
};

export async function listWarehouseProducts(): Promise<ProductRow[]> {
  const [items, batches] = await Promise.all([
    warehouseDb.item.findMany({ include: { baseUnit: true }, orderBy: { name: "asc" } }),
    warehouseDb.stockBatch.findMany({
      select: { itemId: true, qtyRemaining: true, unitCost: true, receivedAt: true, sourceType: true },
    }),
  ]);

  type Agg = { qty: number; value: number; lastCost: number | null; lastAt: Date | null };
  const agg = new Map<number, Agg>();
  for (const b of batches) {
    const a = agg.get(b.itemId) ?? { qty: 0, value: 0, lastCost: null, lastAt: null };
    const qty = Number(b.qtyRemaining);
    const cost = Number(b.unitCost);
    if (qty > 0) {
      a.qty += qty;
      a.value += qty * cost;
    }
    if (b.sourceType === "PURCHASE" && (!a.lastAt || b.receivedAt > a.lastAt)) {
      a.lastAt = b.receivedAt;
      a.lastCost = cost;
    }
    agg.set(b.itemId, a);
  }

  return items.map((it) => {
    const a = agg.get(it.id);
    return {
      id: it.id,
      sku: it.sku,
      name: it.name,
      categoryCode: it.categoryCode,
      unit: it.baseUnit.code,
      standardCost: it.standardCost === null ? null : Math.round(Number(it.standardCost)),
      fifoCost: a && a.qty > 0 ? Math.round(a.value / a.qty) : null,
      lastPurchaseCost: a?.lastCost === null || a?.lastCost === undefined ? null : Math.round(a.lastCost),
      lastPurchaseAt: a?.lastAt ? a.lastAt.toISOString() : null,
      stockQty: a ? Math.round(a.qty * 100) / 100 : 0,
      isActive: it.isActive,
    };
  });
}

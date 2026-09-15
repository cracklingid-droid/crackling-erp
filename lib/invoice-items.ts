import { prisma } from "./db";
import { listWarehouseProducts } from "./warehouse-products";
import { SELLABLE_SKU_PREFIX } from "./invoicing-config";

// Menu yang bisa dijual lewat Invoicing = SEMUA item Warehouse dgn SKU
// berawalan "ESB" (keputusan Kevin 2026-09-15), lintas kategori apa pun.
// Harga JUAL terpisah dari harga pokok Warehouse - lihat InvoiceItemPrice.
export type InvoiceMenuItem = {
  warehouseItemId: number;
  sku: string;
  name: string;
  unit: string;
  price: number | null; // null = belum diatur, tidak bisa dijual sampai diisi
  isActive: boolean;
};

export async function listSellableMenuItems(): Promise<InvoiceMenuItem[]> {
  const [products, prices] = await Promise.all([listWarehouseProducts(), prisma.invoiceItemPrice.findMany()]);
  const priceByItem = new Map(prices.map((p) => [p.warehouseItemId, p.price]));

  return products
    .filter((p) => p.sku.startsWith(SELLABLE_SKU_PREFIX))
    .map((p) => ({
      warehouseItemId: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      price: priceByItem.get(p.id) ?? null,
      isActive: p.isActive,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

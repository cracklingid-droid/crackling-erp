import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { listWarehouseProducts } from "@/lib/warehouse-products";

// Katalog item Warehouse (live, baca saja) + foto produk yang disimpan di
// sisi ERP (ProductPhoto, key = id Item Warehouse). Item baru cukup dibuat
// di Warehouse - otomatis muncul di sini.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  let products;
  try {
    products = await listWarehouseProducts();
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `Gagal membaca database Warehouse: ${message}` }, { status: 502 });
  }

  const photos = await prisma.productPhoto.findMany({ select: { warehouseItemId: true, url: true } });
  const photoByItem = new Map(photos.map((p) => [p.warehouseItemId, p.url]));

  return NextResponse.json(products.map((p) => ({ ...p, photoUrl: photoByItem.get(p.id) ?? null })));
}

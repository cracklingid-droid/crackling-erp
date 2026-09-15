import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessInvoicing } from "@/lib/current-user";
import { listSellableMenuItems } from "@/lib/invoice-items";

// Atur harga JUAL ke customer per item menu (ESB) - terpisah dari harga
// pokok/FIFO Warehouse. Permintaan tersirat dari "menu dengan kode barang
// ESB semuanya bisa dijual": harga pokok Warehouse bukan harga jual, jadi
// Kevin perlu tempat mengisi harga jualnya sebelum item itu bisa dipakai di
// invoice.
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessInvoicing(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const warehouseItemId = Number(body.warehouseItemId);
  const price = Math.round(Number(body.price));
  if (!Number.isInteger(warehouseItemId)) return NextResponse.json({ error: "Item tidak valid" }, { status: 400 });
  if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Harga harus angka >= 0" }, { status: 400 });

  const items = await listSellableMenuItems();
  const item = items.find((i) => i.warehouseItemId === warehouseItemId);
  if (!item) return NextResponse.json({ error: "Item tidak ditemukan di katalog ESB" }, { status: 404 });

  const saved = await prisma.invoiceItemPrice.upsert({
    where: { warehouseItemId },
    update: { price, sku: item.sku, updatedById: user.id },
    create: { warehouseItemId, sku: item.sku, price, updatedById: user.id },
  });
  return NextResponse.json(saved);
}

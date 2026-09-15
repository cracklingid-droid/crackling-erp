import { NextResponse } from "next/server";
import { getCurrentUser, canAccessInvoicing } from "@/lib/current-user";
import { listSellableMenuItems } from "@/lib/invoice-items";

// Katalog menu yang bisa dijual (item Warehouse SKU "ESB..." + harga jual
// yang sudah diatur) - dipakai picker item saat bikin invoice, dan halaman
// "Harga Jual Menu".
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessInvoicing(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  try {
    const items = await listSellableMenuItems();
    return NextResponse.json(items);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `Gagal membaca database Warehouse: ${message}` }, { status: 502 });
  }
}

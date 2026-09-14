import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

// Foto produk disimpan di ERP (tabel ProductPhoto), key = id Item Warehouse.
// [id] di URL = warehouseItemId, bukan id ProductPhoto.

// Simpan/ganti URL foto (hasil upload client ke Vercel Blob)
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const warehouseItemId = Number(id);
  if (!Number.isInteger(warehouseItemId) || warehouseItemId <= 0) {
    return NextResponse.json({ error: "ID item tidak valid" }, { status: 400 });
  }

  const body = await req.json();
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url.startsWith("https://")) return NextResponse.json({ error: "URL foto tidak valid" }, { status: 400 });

  const photo = await prisma.productPhoto.upsert({
    where: { warehouseItemId },
    update: { url },
    create: { warehouseItemId, url },
  });
  return NextResponse.json(photo);
}

// Hapus foto - cuma baris DB-nya, blob di Vercel dibiarkan (sederhana saja)
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const warehouseItemId = Number(id);
  if (!Number.isInteger(warehouseItemId) || warehouseItemId <= 0) {
    return NextResponse.json({ error: "ID item tidak valid" }, { status: 400 });
  }

  // deleteMany supaya tidak error kalau memang belum ada fotonya
  await prisma.productPhoto.deleteMany({ where: { warehouseItemId } });
  return NextResponse.json({ ok: true });
}

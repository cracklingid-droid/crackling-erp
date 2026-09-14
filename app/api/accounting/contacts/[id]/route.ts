import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

const VALID_TYPES = ["CUSTOMER", "VENDOR", "EMPLOYEE", "OTHER"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await prisma.contact.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Kontak tidak ditemukan" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.type === "string") {
    if (!VALID_TYPES.includes(body.type)) return NextResponse.json({ error: "Tipe kontak tidak valid" }, { status: 400 });
    data.type = body.type;
  }
  // Field opsional: string kosong / null -> null
  if (typeof body.phone === "string" || body.phone === null) data.phone = body.phone?.trim() || null;
  if (typeof body.email === "string" || body.email === null) data.email = body.email?.trim() || null;
  if (typeof body.address === "string" || body.address === null) data.address = body.address?.trim() || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const contact = await prisma.contact.update({ where: { id: existing.id }, data });
  return NextResponse.json(contact);
}

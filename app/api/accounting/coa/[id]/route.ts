import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.subType === "string") data.subType = body.subType.trim() || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.parentId === null || Number.isInteger(body.parentId)) data.parentId = body.parentId;

  const account = await prisma.account.update({ where: { id: Number(id) }, data });
  return NextResponse.json(account);
}

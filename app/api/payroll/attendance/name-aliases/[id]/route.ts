import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrWriteUser } from "@/lib/hr-access";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const { id } = await ctx.params;
  await prisma.attendanceNameAlias.delete({ where: { id: Number(id) } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

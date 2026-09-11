import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { itemFieldForCategory } from "@/lib/payroll-event-notes";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; itemId: string; noteId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id, itemId, noteId } = await ctx.params;
  const period = await prisma.payrollPeriod.findUnique({ where: { id: Number(id) }, select: { status: true } });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });
  if (period.status === "final") {
    return NextResponse.json({ error: "Periode ini sudah difinalisasi, tidak bisa diedit lagi" }, { status: 400 });
  }

  const note = await prisma.payrollEventNote.findUnique({ where: { id: Number(noteId) } });
  if (!note || note.periodId !== Number(id)) {
    return NextResponse.json({ error: "Catatan tidak ditemukan" }, { status: 404 });
  }
  const itemField = itemFieldForCategory(note.category);
  const item = await prisma.payrollItem.findUnique({ where: { id: Number(itemId) } });

  await prisma.$transaction([
    prisma.payrollEventNote.delete({ where: { id: Number(noteId) } }),
    ...(itemField && item
      ? [
          prisma.payrollItem.update({
            where: { id: Number(itemId) },
            data: { [itemField]: Math.max(0, (item[itemField as keyof typeof item] as number) - note.amount) },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}

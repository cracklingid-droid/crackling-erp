import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const questionId = Number(id);
  const body = await req.json();
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const options = Array.isArray(body.options) ? body.options : [];

  if (!text) return NextResponse.json({ error: "Pertanyaan wajib diisi" }, { status: 400 });
  if (options.length < 2) return NextResponse.json({ error: "Minimal 2 opsi jawaban" }, { status: 400 });
  for (const o of options) {
    if (typeof o.label !== "string" || !o.label.trim()) {
      return NextResponse.json({ error: "Setiap opsi wajib punya label" }, { status: 400 });
    }
  }

  const question = await prisma.$transaction(async (tx) => {
    await tx.psychTestQuestion.update({ where: { id: questionId }, data: { text } });
    await tx.psychTestOption.deleteMany({ where: { questionId } });
    await tx.psychTestOption.createMany({
      data: options.map((o: { label: string; score: number }, i: number) => ({
        questionId,
        label: o.label.trim(),
        score: Number.isFinite(o.score) ? Math.round(o.score) : 0,
        order: i,
      })),
    });
    return tx.psychTestQuestion.findUnique({
      where: { id: questionId },
      include: { options: { orderBy: { order: "asc" } } },
    });
  });
  return NextResponse.json(question);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  await prisma.psychTestQuestion.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

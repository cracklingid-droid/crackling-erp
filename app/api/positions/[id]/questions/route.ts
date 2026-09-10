import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const positionId = Number(id);
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

  const count = await prisma.psychTestQuestion.count({ where: { positionId } });
  const question = await prisma.psychTestQuestion.create({
    data: {
      positionId,
      text,
      order: count,
      options: {
        create: options.map((o: { label: string; score: number }, i: number) => ({
          label: o.label.trim(),
          score: Number.isFinite(o.score) ? Math.round(o.score) : 0,
          order: i,
        })),
      },
    },
    include: { options: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(question, { status: 201 });
}

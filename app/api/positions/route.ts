import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrWriteUser } from "@/lib/hr-access";

export async function GET() {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const positions = await prisma.position.findMany({
    include: { _count: { select: { questions: true, jobPostings: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(
    positions.map((p) => ({
      id: p.id,
      name: p.name,
      passingScore: p.passingScore,
      questionCount: p._count.questions,
      jobPostingCount: p._count.jobPostings,
    }))
  );
}

export async function POST(req: Request) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nama posisi wajib diisi" }, { status: 400 });

  const existing = await prisma.position.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ error: "Posisi dengan nama ini sudah ada" }, { status: 400 });

  const passingScore = Number.isFinite(body.passingScore) ? Math.max(0, Math.min(100, body.passingScore)) : 70;
  const position = await prisma.position.create({ data: { name, passingScore } });
  return NextResponse.json(position, { status: 201 });
}

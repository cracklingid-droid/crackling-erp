import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const jobPostingId = Number(body.jobPostingId);
  if (!name || !jobPostingId) {
    return NextResponse.json({ error: "Nama kandidat dan lowongan wajib diisi" }, { status: 400 });
  }

  const candidate = await prisma.$transaction(async (tx) => {
    const c = await tx.candidate.create({
      data: {
        jobPostingId,
        name,
        email: body.email || null,
        phone: body.phone || null,
        source: body.source || null,
        notes: body.notes || null,
        createdById: user.id,
      },
    });
    await tx.candidateStageEvent.create({
      data: { candidateId: c.id, stage: "applied", createdById: user.id },
    });
    return c;
  });

  return NextResponse.json(candidate, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const candidates = await prisma.candidate.findMany({
    where: { jobPosting: { status: "open" } },
    include: {
      jobPosting: { select: { id: true, title: true, status: true } },
      psychTestSubmission: true,
      interviewSlot: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(candidates);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const jobPostingId = Number(body.jobPostingId);
  if (!name || !jobPostingId) {
    return NextResponse.json({ error: "Nama kandidat dan lowongan wajib diisi" }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "Email kandidat wajib diisi supaya bisa menerima hasil psikotest & undangan interview" }, { status: 400 });
  }

  const candidate = await prisma.$transaction(async (tx) => {
    const c = await tx.candidate.create({
      data: {
        jobPostingId,
        name,
        email,
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

const VALID_STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"];

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const candidate = await prisma.candidate.findUnique({
    where: { id: Number(id) },
    include: {
      jobPosting: { include: { position: { select: { id: true, name: true, passingScore: true } } } },
      psychTestSubmission: true,
      interviewSlot: true,
      stageEvents: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } } } },
    },
  });
  if (!candidate) return NextResponse.json({ error: "Kandidat tidak ditemukan" }, { status: 404 });
  return NextResponse.json(candidate);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const candidateId = Number(id);
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if ("email" in body) data.email = body.email || null;
  if ("phone" in body) data.phone = body.phone || null;
  if ("source" in body) data.source = body.source || null;
  if ("notes" in body) data.notes = body.notes || null;

  let stageChanged = false;
  if (typeof body.stage === "string") {
    if (!VALID_STAGES.includes(body.stage)) {
      return NextResponse.json({ error: "Tahap tidak valid" }, { status: 400 });
    }
    data.stage = body.stage;
    stageChanged = true;
  }

  const candidate = await prisma.$transaction(async (tx) => {
    const updated = await tx.candidate.update({ where: { id: candidateId }, data });
    if (stageChanged) {
      await tx.candidateStageEvent.create({
        data: {
          candidateId,
          stage: body.stage,
          note: typeof body.stageNote === "string" ? body.stageNote : null,
          createdById: user.id,
        },
      });
    }
    return updated;
  });

  return NextResponse.json(candidate);
}

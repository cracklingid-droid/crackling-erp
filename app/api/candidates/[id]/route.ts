import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { deleteCvForRejectedCandidate } from "@/lib/delete-cv";
import { STAGE_ORDER, STAGE_ROLLBACK_ERROR } from "@/lib/candidate-stages";

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
  if (typeof body.offerDocumentReady === "boolean") data.offerDocumentReady = body.offerDocumentReady;
  if (typeof body.offerWhatsappSent === "boolean") data.offerWhatsappSent = body.offerWhatsappSent;

  let stageChanged = false;
  if (typeof body.stage === "string") {
    if (!VALID_STAGES.includes(body.stage)) {
      return NextResponse.json({ error: "Tahap tidak valid" }, { status: 400 });
    }

    const current = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { stage: true, offerDocumentReady: true, offerWhatsappSent: true },
    });
    if (!current) return NextResponse.json({ error: "Kandidat tidak ditemukan" }, { status: 404 });

    const currentIdx = STAGE_ORDER.indexOf(current.stage as (typeof STAGE_ORDER)[number]);
    const interviewIdx = STAGE_ORDER.indexOf("interview");
    if (currentIdx >= interviewIdx && (body.stage === "applied" || body.stage === "screening")) {
      return NextResponse.json({ error: STAGE_ROLLBACK_ERROR }, { status: 400 });
    }

    if (body.stage === "hired") {
      const docReady = typeof data.offerDocumentReady === "boolean" ? data.offerDocumentReady : current.offerDocumentReady;
      const waSent = typeof data.offerWhatsappSent === "boolean" ? data.offerWhatsappSent : current.offerWhatsappSent;
      if (!docReady || !waSent) {
        const missing = [];
        if (!docReady) missing.push("Surat Penawaran/Kontrak");
        if (!waSent) missing.push("Konfirmasi WA ke kandidat");
        return NextResponse.json(
          { error: `Selesaikan dulu: ${missing.join(", ")} - sebelum kandidat bisa dipindahkan ke Diterima.` },
          { status: 400 }
        );
      }
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

  if (stageChanged && body.stage === "rejected") {
    await deleteCvForRejectedCandidate(candidateId);
  }

  // Begitu kandidat "Diterima", otomatis buat data karyawan (biodata dicopy
  // dari lamaran) berstatus "onboarding" - HR baru bisa mengaktifkannya
  // setelah kelengkapan data karyawan (NIK, gaji, rekening, dst) diisi.
  // upsert dengan update kosong supaya tidak menimpa data yang sudah
  // dilengkapi HR kalau kandidat sempat keluar-masuk tahap Diterima lagi.
  // Permintaan Kevin 2026-09-10.
  if (stageChanged && body.stage === "hired") {
    const full = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { jobPosting: { select: { title: true } } },
    });
    if (full) {
      await prisma.employee.upsert({
        where: { candidateId },
        update: {},
        create: {
          candidateId,
          name: full.name,
          email: full.email,
          phone: full.phone,
          birthPlace: full.birthPlace,
          birthDate: full.birthDate,
          gender: full.gender,
          address: full.address,
          position: full.jobPosting.title,
          outlet: full.preferredOutlet,
          createdById: user.id,
        },
      });
    }
  }

  return NextResponse.json(candidate);
}

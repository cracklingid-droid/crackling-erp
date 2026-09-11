import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { generateCandidateSlots, formatSlotWIB } from "@/lib/interview-slots";
import { buildInterviewICS } from "@/lib/ics";

const HR_RECIPIENTS = ["hr@cracklingid.com", "recruitment@cracklingid.com"];

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const candidate = await prisma.candidate.findUnique({
    where: { publicToken: token },
    include: { psychTestSubmission: true, interviewSlot: true, jobPosting: true },
  });
  if (!candidate) return NextResponse.json({ error: "Tautan tidak valid" }, { status: 404 });

  if (candidate.interviewSlot) {
    return NextResponse.json({
      status: "booked",
      candidateName: candidate.name,
      jobTitle: candidate.jobPosting.title,
      scheduledAt: candidate.interviewSlot.scheduledAt,
    });
  }

  if (!candidate.psychTestSubmission || !candidate.psychTestSubmission.passed) {
    return NextResponse.json({ error: "Anda belum lolos tahap psikotest" }, { status: 403 });
  }

  const candidateSlots = generateCandidateSlots(14);
  const rangeStart = candidateSlots[0];
  const rangeEnd = candidateSlots[candidateSlots.length - 1];
  const taken = await prisma.interviewSlot.findMany({
    where: { scheduledAt: { gte: rangeStart, lte: rangeEnd } },
    select: { scheduledAt: true },
  });
  const takenSet = new Set(taken.map((t) => t.scheduledAt.getTime()));
  const available = candidateSlots.filter((s) => !takenSet.has(s.getTime()));

  return NextResponse.json({
    status: "pending",
    candidateName: candidate.name,
    jobTitle: candidate.jobPosting.title,
    slots: available.map((s) => s.toISOString()),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const candidate = await prisma.candidate.findUnique({
    where: { publicToken: token },
    include: { psychTestSubmission: true, interviewSlot: true, jobPosting: true },
  });
  if (!candidate) return NextResponse.json({ error: "Tautan tidak valid" }, { status: 404 });
  if (candidate.interviewSlot) return NextResponse.json({ error: "Anda sudah memilih jadwal interview" }, { status: 400 });
  if (!candidate.psychTestSubmission || !candidate.psychTestSubmission.passed) {
    return NextResponse.json({ error: "Anda belum lolos tahap psikotest" }, { status: 403 });
  }

  const body = await req.json();
  const scheduledAt = new Date(body.scheduledAt);
  if (isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Jadwal tidak valid" }, { status: 400 });
  }

  const validSlots = generateCandidateSlots(14);
  const isValid = validSlots.some((s) => s.getTime() === scheduledAt.getTime());
  if (!isValid) {
    return NextResponse.json({ error: "Jadwal yang dipilih di luar jam interview yang tersedia" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.interviewSlot.create({ data: { candidateId: candidate.id, scheduledAt } });
      await tx.candidate.update({ where: { id: candidate.id }, data: { stage: "interview" } });
      await tx.candidateStageEvent.create({
        data: {
          candidateId: candidate.id,
          stage: "interview",
          note: `Otomatis - jadwal interview dipilih pelamar: ${scheduledAt.toISOString()}`,
        },
      });
    });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Slot ini baru saja diambil pelamar lain, silakan pilih waktu lain" }, { status: 409 });
    }
    throw e;
  }

  const { tanggal, jam } = formatSlotWIB(scheduledAt);

  try {
    const organizerEmail = process.env.GMAIL_USER ?? HR_RECIPIENTS[0];
    const attendees = [
      ...HR_RECIPIENTS.filter((e) => e !== organizerEmail).map((email) => ({ email })),
      ...(candidate.email ? [{ email: candidate.email, name: candidate.name }] : []),
    ];
    const ics = buildInterviewICS({
      uid: `interview-${candidate.id}@cracklingid.com`,
      start: scheduledAt,
      summary: `Interview - ${candidate.name} (${candidate.jobPosting.title})`,
      description: `Interview kandidat ${candidate.name} untuk posisi ${candidate.jobPosting.title} di Crackling. Kontak: ${candidate.email ?? "-"} / ${candidate.phone ?? "-"}`,
      organizerEmail,
      attendees,
    });

    await sendMail({
      to: [...HR_RECIPIENTS, candidate.email!].filter(Boolean) as string[],
      subject: `Jadwal Interview - ${candidate.name} (${candidate.jobPosting.title})`,
      html: `
        <p>Interview telah dijadwalkan:</p>
        <ul>
          <li><b>Kandidat:</b> ${candidate.name}</li>
          <li><b>Posisi:</b> ${candidate.jobPosting.title}</li>
          <li><b>Hari/Tanggal:</b> ${tanggal}</li>
          <li><b>Jam:</b> ${jam}</li>
          <li><b>Kontak:</b> ${candidate.email ?? "-"} / ${candidate.phone ?? "-"}</li>
        </ul>
        <p>Undangan kalender terlampir - tinggal klik "Tambah ke Kalender" pada email ini.</p>
        <p>Terima kasih,<br/>Tim HR Crackling</p>
      `,
      icalEvent: { filename: "interview.ics", method: "REQUEST", content: ics },
    });
  } catch (e) {
    console.error("Gagal kirim email konfirmasi interview:", e);
  }

  return NextResponse.json({ ok: true, tanggal, jam });
}

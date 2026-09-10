import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { getPsychTestDeadline } from "@/lib/psychtest-deadline";
import { deleteCvForRejectedCandidate } from "@/lib/delete-cv";
import type { Prisma } from "@prisma/client";

type CandidateWithQuestions = Prisma.CandidateGetPayload<{
  include: {
    jobPosting: { include: { position: { include: { questions: { include: { options: true } } } } } };
  };
}>;

async function finalizeSubmission(
  candidate: CandidateWithQuestions,
  answers: { questionId: number; optionId: number }[],
  origin: string
) {
  const questions = candidate.jobPosting.position.questions;

  let totalScore = 0;
  let maxScore = 0;
  const answerRows: { questionId: number; optionId: number; score: number }[] = [];

  for (const q of questions) {
    const ans = answers.find((a) => a.questionId === q.id);
    const opt = ans ? q.options.find((o) => o.id === ans.optionId) : null;
    maxScore += Math.max(0, ...q.options.map((o) => o.score));
    if (opt) {
      totalScore += opt.score;
      answerRows.push({ questionId: q.id, optionId: opt.id, score: opt.score });
    }
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const passed = percentage >= candidate.jobPosting.position.passingScore;

  await prisma.$transaction(async (tx) => {
    await tx.psychTestSubmission.create({
      data: {
        candidateId: candidate.id,
        totalScore,
        maxScore,
        percentage,
        passed,
        answers: { create: answerRows },
      },
    });
    await tx.candidate.update({
      where: { id: candidate.id },
      data: { stage: passed ? "screening" : "rejected" },
    });
    await tx.candidateStageEvent.create({
      data: {
        candidateId: candidate.id,
        stage: passed ? "screening" : "rejected",
        note:
          answerRows.length < questions.length
            ? `Otomatis - waktu psikotest habis, ${answerRows.length}/${questions.length} soal terjawab, hasil ${percentage}% (ambang lulus ${candidate.jobPosting.position.passingScore}%)`
            : `Otomatis - hasil psikotest ${percentage}% (ambang lulus ${candidate.jobPosting.position.passingScore}%)`,
      },
    });
  });

  if (!passed) {
    await deleteCvForRejectedCandidate(candidate.id);
  }

  try {
    if (passed) {
      await sendMail({
        to: candidate.email!,
        subject: `Selamat, Anda lolos psikotest - ${candidate.jobPosting.title}`,
        html: `
          <p>Halo ${candidate.name},</p>
          <p>Selamat! Anda dinyatakan <b>lolos psikotest</b> untuk posisi <b>${candidate.jobPosting.title}</b> di Crackling.</p>
          <p>Langkah selanjutnya, silakan pilih jadwal interview Anda melalui tautan berikut:</p>
          <p><a href="${origin}/jadwal-interview/${candidate.publicToken}">${origin}/jadwal-interview/${candidate.publicToken}</a></p>
          <p>Terima kasih,<br/>Tim HR Crackling</p>
        `,
      });
    } else {
      await sendMail({
        to: candidate.email!,
        subject: `Update lamaran Anda - ${candidate.jobPosting.title}`,
        html: `
          <p>Halo ${candidate.name},</p>
          <p>Terima kasih telah mengikuti proses seleksi untuk posisi <b>${candidate.jobPosting.title}</b> di Crackling.</p>
          <p>Setelah melalui tahap psikotest, kami mohon maaf belum dapat melanjutkan lamaran Anda ke tahap berikutnya kali ini.</p>
          <p>Kami menyimpan data Anda dan akan menghubungi kembali apabila ada kesempatan yang sesuai di kemudian hari.</p>
          <p>Terima kasih,<br/>Tim HR Crackling</p>
        `,
      });
    }
  } catch (e) {
    console.error("Gagal kirim email hasil psikotest:", e);
  }

  return { passed, percentage };
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const candidate = await prisma.candidate.findUnique({
    where: { publicToken: token },
    include: {
      jobPosting: { include: { position: { include: { questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } } } } },
      psychTestSubmission: true,
    },
  });
  if (!candidate) return NextResponse.json({ error: "Tautan tidak valid" }, { status: 404 });

  if (candidate.psychTestSubmission) {
    return NextResponse.json({
      status: "submitted",
      passed: candidate.psychTestSubmission.passed,
      percentage: candidate.psychTestSubmission.percentage,
    });
  }

  const deadline = getPsychTestDeadline(candidate.createdAt);
  if (new Date() > deadline) {
    const origin = new URL(req.url).origin;
    const result = await finalizeSubmission(candidate, [], origin);
    return NextResponse.json({ status: "submitted", ...result });
  }

  return NextResponse.json({
    status: "pending",
    candidateName: candidate.name,
    positionName: candidate.jobPosting.position.name,
    deadline: deadline.toISOString(),
    questions: candidate.jobPosting.position.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, label: o.label })),
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const candidate = await prisma.candidate.findUnique({
    where: { publicToken: token },
    include: {
      jobPosting: { include: { position: { include: { questions: { include: { options: true } } } } } },
      psychTestSubmission: true,
    },
  });
  if (!candidate) return NextResponse.json({ error: "Tautan tidak valid" }, { status: 404 });
  if (candidate.psychTestSubmission) {
    return NextResponse.json({ error: "Psikotest sudah pernah disubmit" }, { status: 400 });
  }

  const body = await req.json();
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const isAutoSubmit = body.autoSubmit === true;
  const questions = candidate.jobPosting.position.questions;

  if (!isAutoSubmit && answers.length !== questions.length) {
    return NextResponse.json({ error: "Semua pertanyaan wajib dijawab" }, { status: 400 });
  }

  for (const a of answers) {
    const q = questions.find((qq) => qq.id === a.questionId);
    if (!q || !q.options.some((o) => o.id === a.optionId)) {
      return NextResponse.json({ error: "Jawaban tidak valid" }, { status: 400 });
    }
  }

  const origin = new URL(req.url).origin;
  const result = await finalizeSubmission(candidate, answers, origin);
  return NextResponse.json(result);
}

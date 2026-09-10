import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const candidate = await prisma.candidate.findUnique({
    where: { id: Number(id) },
    include: {
      jobPosting: {
        include: {
          position: {
            include: { questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } },
          },
        },
      },
      psychTestSubmission: { include: { answers: true } },
    },
  });
  if (!candidate) return NextResponse.json({ error: "Kandidat tidak ditemukan" }, { status: 404 });
  if (!candidate.psychTestSubmission) {
    return NextResponse.json({ error: "Kandidat belum mengikuti psikotest" }, { status: 404 });
  }

  const answerByQuestion = new Map(candidate.psychTestSubmission.answers.map((a) => [a.questionId, a.optionId]));

  return NextResponse.json({
    candidateName: candidate.name,
    positionName: candidate.jobPosting.position.name,
    jobTitle: candidate.jobPosting.title,
    totalScore: candidate.psychTestSubmission.totalScore,
    maxScore: candidate.psychTestSubmission.maxScore,
    percentage: candidate.psychTestSubmission.percentage,
    passed: candidate.psychTestSubmission.passed,
    passingScore: candidate.jobPosting.position.passingScore,
    submittedAt: candidate.psychTestSubmission.submittedAt,
    questions: candidate.jobPosting.position.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, label: o.label, score: o.score })),
      chosenOptionId: answerByQuestion.get(q.id) ?? null,
    })),
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const postings = await prisma.jobPosting.findMany({
    include: { createdBy: true, candidates: true, position: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    postings.map((p) => ({
      id: p.id,
      title: p.title,
      positionId: p.positionId,
      positionName: p.position.name,
      department: p.department,
      location: p.location,
      employmentType: p.employmentType,
      description: p.description,
      status: p.status,
      createdByName: p.createdBy.name,
      createdAt: p.createdAt,
      candidateCount: p.candidates.length,
      hiredCount: p.candidates.filter((c) => c.stage === "hired").length,
    }))
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const positionId = Number(body.positionId);
  if (!title) return NextResponse.json({ error: "Judul lowongan wajib diisi" }, { status: 400 });
  if (!positionId) return NextResponse.json({ error: "Posisi wajib dipilih" }, { status: 400 });

  const posting = await prisma.jobPosting.create({
    data: {
      title,
      positionId,
      department: body.department || null,
      location: body.location || null,
      employmentType: body.employmentType || null,
      description: body.description || null,
      createdById: user.id,
    },
  });
  return NextResponse.json(posting, { status: 201 });
}

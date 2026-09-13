import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrWriteUser } from "@/lib/hr-access";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const { id } = await ctx.params;
  const posting = await prisma.jobPosting.findUnique({
    where: { id: Number(id) },
    include: {
      createdBy: { select: { id: true, name: true, username: true, role: true } },
      position: true,
      candidates: {
        orderBy: { createdAt: "desc" },
        include: { psychTestSubmission: true, interviewSlot: true },
      },
    },
  });
  if (!posting) return NextResponse.json({ error: "Lowongan tidak ditemukan" }, { status: 404 });
  return NextResponse.json(posting);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const { id } = await ctx.params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.title === "string") data.title = body.title;
  if ("department" in body) data.department = body.department || null;
  if ("location" in body) data.location = body.location || null;
  if ("employmentType" in body) data.employmentType = body.employmentType || null;
  if ("description" in body) data.description = body.description || null;

  const posting = await prisma.jobPosting.update({ where: { id: Number(id) }, data });
  return NextResponse.json(posting);
}

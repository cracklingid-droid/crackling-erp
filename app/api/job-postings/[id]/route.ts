import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const posting = await prisma.jobPosting.findUnique({
    where: { id: Number(id) },
    include: {
      createdBy: { select: { id: true, name: true, username: true, role: true } },
      candidates: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!posting) return NextResponse.json({ error: "Lowongan tidak ditemukan" }, { status: 404 });
  return NextResponse.json(posting);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

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

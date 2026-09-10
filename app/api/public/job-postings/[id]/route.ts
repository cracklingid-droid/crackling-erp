import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Detail satu lowongan terbuka - publik, tanpa login.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const posting = await prisma.jobPosting.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      title: true,
      department: true,
      location: true,
      employmentType: true,
      description: true,
      status: true,
    },
  });
  if (!posting || posting.status !== "open") {
    return NextResponse.json({ error: "Lowongan tidak ditemukan atau sudah ditutup" }, { status: 404 });
  }
  return NextResponse.json(posting);
}

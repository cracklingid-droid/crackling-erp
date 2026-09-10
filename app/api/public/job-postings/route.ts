import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Daftar lowongan terbuka - publik, tanpa login.
export async function GET() {
  const postings = await prisma.jobPosting.findMany({
    where: { status: "open" },
    select: {
      id: true,
      title: true,
      department: true,
      location: true,
      employmentType: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(postings);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

const PAGE_SIZE = 50;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const search = searchParams.get("search")?.trim() ?? "";

  const where = {
    bankAccountId: Number(id),
    ...(search ? { description: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [lines, total] = await Promise.all([
    prisma.bankStatementLine.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.bankStatementLine.count({ where }),
  ]);

  return NextResponse.json({ lines, total, page, pageSize: PAGE_SIZE });
}

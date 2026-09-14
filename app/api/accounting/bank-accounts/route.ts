import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const accounts = await prisma.bankAccount.findMany({
    include: { _count: { select: { statementLines: true } } },
    orderBy: { id: "asc" },
  });

  const result = await Promise.all(
    accounts.map(async (a) => {
      const last = await prisma.bankStatementLine.findFirst({
        where: { bankAccountId: a.id },
        orderBy: { date: "desc" },
      });
      const first = await prisma.bankStatementLine.findFirst({
        where: { bankAccountId: a.id },
        orderBy: { date: "asc" },
      });
      return {
        id: a.id,
        name: a.name,
        bankName: a.bankName,
        lineCount: a._count.statementLines,
        earliestDate: first?.date ?? null,
        latestDate: last?.date ?? null,
        latestBalance: last?.balance ?? null,
      };
    })
  );

  return NextResponse.json(result);
}

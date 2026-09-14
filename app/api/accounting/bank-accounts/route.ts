import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

// Ringkasan per akun bank utk halaman Rekonsiliasi: jumlah mutasi, rentang
// tanggal, saldo terakhir (dari rekening koran), & jumlah mutasi yang BELUM
// dicocokkan (badge "Reconciliations N" ala Jurnal.id, permintaan Kevin
// 2026-09-14).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const accounts = await prisma.bankAccount.findMany({ orderBy: { id: "asc" } });
  const coa = await prisma.account.findMany({ where: { id: { in: accounts.map((a) => a.accountId) } }, select: { id: true, code: true, name: true } });
  const coaById = new Map(coa.map((c) => [c.id, c]));

  const [counts, unmatched, firsts, lasts] = await Promise.all([
    prisma.bankStatementLine.groupBy({ by: ["bankAccountId"], _count: { _all: true } }),
    prisma.bankStatementLine.groupBy({ by: ["bankAccountId"], where: { matchedJournalLineId: null }, _count: { _all: true } }),
    prisma.bankStatementLine.groupBy({ by: ["bankAccountId"], _min: { date: true } }),
    prisma.bankStatementLine.groupBy({ by: ["bankAccountId"], _max: { date: true } }),
  ]);
  const countBy = new Map(counts.map((c) => [c.bankAccountId, c._count._all]));
  const unmatchedBy = new Map(unmatched.map((c) => [c.bankAccountId, c._count._all]));
  const firstBy = new Map(firsts.map((c) => [c.bankAccountId, c._min.date]));
  const lastBy = new Map(lasts.map((c) => [c.bankAccountId, c._max.date]));

  const result = await Promise.all(
    accounts.map(async (a) => {
      const last = await prisma.bankStatementLine.findFirst({ where: { bankAccountId: a.id }, orderBy: [{ date: "desc" }, { id: "desc" }] });
      return {
        id: a.id,
        name: a.name,
        bankName: a.bankName,
        accountId: a.accountId,
        accountCode: coaById.get(a.accountId)?.code ?? null,
        lineCount: countBy.get(a.id) ?? 0,
        unreconciledCount: unmatchedBy.get(a.id) ?? 0,
        earliestDate: firstBy.get(a.id) ?? null,
        latestDate: lastBy.get(a.id) ?? null,
        latestBalance: last?.balance ?? null,
      };
    })
  );

  return NextResponse.json(result);
}

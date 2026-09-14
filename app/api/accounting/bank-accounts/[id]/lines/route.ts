import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

const PAGE_SIZE = 50;

// Mutasi rekening koran 1 akun bank (tab "Bank statements" & daftar kandidat
// di layar pencocokan). status=unmatched|matched|all, + info baris jurnal
// pasangannya kalau sudah recon.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status") ?? "all";

  const where = {
    bankAccountId: Number(id),
    ...(status === "unmatched" ? { matchedJournalLineId: null } : status === "matched" ? { matchedJournalLineId: { not: null } } : {}),
    ...(search ? { description: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [lines, total] = await Promise.all([
    prisma.bankStatementLine.findMany({ where, orderBy: [{ date: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.bankStatementLine.count({ where }),
  ]);

  const matchedIds = lines.map((l) => l.matchedJournalLineId).filter((x): x is number => !!x);
  const journalLines = matchedIds.length
    ? await prisma.journalLine.findMany({
        where: { id: { in: matchedIds } },
        include: { journalEntry: { select: { id: true, memo: true, sourceType: true, date: true } } },
      })
    : [];
  const jlById = new Map(journalLines.map((j) => [j.id, j]));

  return NextResponse.json({
    lines: lines.map((l) => {
      const j = l.matchedJournalLineId ? jlById.get(l.matchedJournalLineId) : null;
      return {
        ...l,
        matchedJournal: j ? { journalLineId: j.id, journalEntryId: j.journalEntry.id, memo: j.journalEntry.memo, sourceType: j.journalEntry.sourceType, date: j.journalEntry.date } : null,
      };
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}

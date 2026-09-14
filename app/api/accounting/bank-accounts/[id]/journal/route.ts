import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

const PAGE_SIZE = 50;

// Tab "Jurnal" per akun bank (ikut tampilan Jurnal.id yang dilampirkan
// Kevin 2026-09-14): semua baris jurnal yang menyentuh akun COA bank ini
// (Dr = uang masuk / Received, Cr = uang keluar / Spent), + status sudah
// dicocokkan ke mutasi bank atau belum. status=unmatched utk daftar
// kandidat di layar pencocokan.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const bank = await prisma.bankAccount.findUnique({ where: { id: Number(id) } });
  if (!bank) return NextResponse.json({ error: "Akun bank tidak ditemukan" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const status = searchParams.get("status") ?? "all";
  const search = searchParams.get("search")?.trim() ?? "";

  const matched = await prisma.bankStatementLine.findMany({
    where: { bankAccountId: bank.id, matchedJournalLineId: { not: null } },
    select: { id: true, matchedJournalLineId: true, date: true, description: true, amount: true },
  });
  const matchedByLineId = new Map(matched.map((m) => [m.matchedJournalLineId!, m]));
  const matchedIds = Array.from(matchedByLineId.keys());

  const where = {
    accountId: bank.accountId,
    ...(status === "unmatched" ? { id: { notIn: matchedIds } } : status === "matched" ? { id: { in: matchedIds } } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: "insensitive" as const } },
            { journalEntry: { memo: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [lines, total] = await Promise.all([
    prisma.journalLine.findMany({
      where,
      include: { journalEntry: { select: { id: true, date: true, memo: true, sourceType: true, sourceId: true, isLocked: true } }, contact: { select: { name: true } } },
      orderBy: [{ journalEntry: { date: "desc" } }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.journalLine.count({ where }),
  ]);

  return NextResponse.json({
    lines: lines.map((l) => {
      const m = matchedByLineId.get(l.id);
      return {
        id: l.id,
        journalEntryId: l.journalEntry.id,
        date: l.journalEntry.date,
        memo: l.journalEntry.memo,
        sourceType: l.journalEntry.sourceType,
        sourceId: l.journalEntry.sourceId,
        isLocked: l.journalEntry.isLocked,
        description: l.description,
        contactName: l.contact?.name ?? null,
        received: l.debit,
        spent: l.credit,
        matchedStatementLine: m ? { id: m.id, date: m.date, description: m.description, amount: m.amount } : null,
      };
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}

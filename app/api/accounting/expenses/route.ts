import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { postJournalEntry, AccountingPostingError } from "@/lib/accounting-ledger";
import { parseDateParam, endOfDay } from "@/lib/accounting-reports";

// Direct Expense = beban langsung yang tidak jadi persediaan (gas, listrik,
// marketing, dst - permintaan Kevin 2026-09-14). 1 bon = 1 record, bisa
// beberapa baris ke akun beban berbeda. Posting: Dr tiap akun beban baris,
// Cr akun Kas/Bank pembayaran - lewat postJournalEntry (bukan insert
// langsung) dlm 1 transaksi bareng record-nya.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const end = parseDateParam(searchParams.get("end")) ?? new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const start =
    parseDateParam(searchParams.get("start")) ??
    (() => {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - 29);
      return d;
    })();

  const expenses = await prisma.directExpense.findMany({
    where: { date: { gte: start, lte: endOfDay(end) } },
    include: { contact: { select: { id: true, name: true } }, lines: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });

  const accountIds = Array.from(new Set(expenses.flatMap((e) => [e.paymentAccountId, ...e.lines.map((l) => l.accountId)])));
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, code: true, name: true } });
  const accById = new Map(accounts.map((a) => [a.id, a]));

  // Baris jurnal yang sudah dicocokkan ke mutasi bank -> record tidak bisa
  // dihapus sebelum unrecon (aturan Jurnal.id, permintaan Kevin).
  const entryIds = expenses.map((e) => e.journalEntryId).filter((x): x is number => !!x);
  const matchedLines = entryIds.length
    ? await prisma.journalLine.findMany({ where: { journalEntryId: { in: entryIds } }, select: { id: true, journalEntryId: true } })
    : [];
  const matchedStatement = matchedLines.length
    ? await prisma.bankStatementLine.findMany({ where: { matchedJournalLineId: { in: matchedLines.map((l) => l.id) } }, select: { matchedJournalLineId: true } })
    : [];
  const matchedLineIds = new Set(matchedStatement.map((m) => m.matchedJournalLineId));
  const reconciledEntryIds = new Set(matchedLines.filter((l) => matchedLineIds.has(l.id)).map((l) => l.journalEntryId));

  return NextResponse.json({
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    expenses: expenses.map((e) => ({
      ...e,
      paymentAccount: accById.get(e.paymentAccountId) ?? null,
      lines: e.lines.map((l) => ({ ...l, account: accById.get(l.accountId) ?? null })),
      isReconciled: e.journalEntryId ? reconciledEntryIds.has(e.journalEntryId) : false,
    })),
    total: expenses.reduce((s, e) => s + e.amount, 0),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const date = parseDateParam(typeof body.date === "string" ? body.date : null);
  const paymentAccountId = Number(body.paymentAccountId);
  const contactId = Number.isInteger(body.contactId) ? (body.contactId as number) : null;
  const outletName = typeof body.outletName === "string" && body.outletName ? body.outletName : null;
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const receiptUrl = typeof body.receiptUrl === "string" && body.receiptUrl.startsWith("https://") ? body.receiptUrl : null;
  const rawLines: { description?: unknown; amount?: unknown; accountId?: unknown }[] = Array.isArray(body.lines) ? body.lines : [];

  if (!date) return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
  if (!Number.isInteger(paymentAccountId)) return NextResponse.json({ error: "Akun pembayaran wajib dipilih" }, { status: 400 });
  if (rawLines.length === 0) return NextResponse.json({ error: "Minimal 1 baris beban" }, { status: 400 });

  const lines = rawLines.map((l) => ({
    description: typeof l.description === "string" ? l.description.trim() : "",
    amount: Math.round(Number(l.amount)),
    accountId: Number(l.accountId),
  }));
  for (const l of lines) {
    if (!l.description) return NextResponse.json({ error: "Keterangan tiap baris wajib diisi" }, { status: 400 });
    if (!Number.isFinite(l.amount) || l.amount <= 0) return NextResponse.json({ error: `Nominal "${l.description}" harus > 0` }, { status: 400 });
    if (!Number.isInteger(l.accountId)) return NextResponse.json({ error: `Akun beban "${l.description}" wajib dipilih` }, { status: 400 });
  }

  const accounts = await prisma.account.findMany({ where: { id: { in: [paymentAccountId, ...lines.map((l) => l.accountId)] } } });
  const accById = new Map(accounts.map((a) => [a.id, a]));
  const payment = accById.get(paymentAccountId);
  if (!payment || payment.type !== "ASSET") return NextResponse.json({ error: "Akun pembayaran harus akun Kas/Bank" }, { status: 400 });
  for (const l of lines) {
    const a = accById.get(l.accountId);
    if (!a || a.type !== "EXPENSE") return NextResponse.json({ error: `Akun utk "${l.description}" harus akun Beban` }, { status: 400 });
  }
  if (contactId !== null && !(await prisma.contact.findUnique({ where: { id: contactId } }))) {
    return NextResponse.json({ error: "Kontak tidak ditemukan" }, { status: 400 });
  }

  const amount = lines.reduce((s, l) => s + l.amount, 0);
  const memo = description ?? lines.map((l) => l.description).join(", ");

  try {
    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.directExpense.create({
        data: { date, contactId, outletName, paymentAccountId, amount, description, receiptUrl, createdById: user.id, lines: { create: lines } },
      });
      const entry = await postJournalEntry(
        {
          date,
          memo: `Direct Expense: ${memo}`,
          sourceType: "DIRECT_EXPENSE",
          sourceId: String(expense.id),
          outletName,
          createdById: user.id,
          lines: [
            ...lines.map((l) => ({ accountId: l.accountId, debit: l.amount, outletName, contactId, description: l.description })),
            { accountId: paymentAccountId, credit: amount, outletName, contactId, description: memo },
          ],
        },
        tx
      );
      return tx.directExpense.update({ where: { id: expense.id }, data: { journalEntryId: entry.id }, include: { lines: true } });
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof AccountingPostingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

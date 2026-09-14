import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { postJournalEntry, AccountingPostingError } from "@/lib/accounting-ledger";
import { OUTLET_ACCOUNTS } from "@/lib/accounting-outlets";

// "Create transaction" dari 1 baris mutasi bank yang belum tercatat (pola
// Jurnal.id yang dilampirkan Kevin 2026-09-14): buat jurnalnya sekaligus
// langsung dicocokkan (recon) ke mutasi itu. 3 mode:
//  - expense    : Direct Expense (Dr akun beban per baris / Cr Bank) - mutasi keluar
//  - ar_receipt : uang penjualan masuk (Dr Bank / Cr AR outlet) - mutasi masuk
//  - journal    : jurnal umum vs 1 akun lawan (mis. transfer antar bank,
//                 setoran modal, biaya admin) - arah ikut tanda mutasi
// Nominal jurnal SELALU = nominal mutasi (tidak bisa diedit di sini) -
// kalau nominalnya beda, itu bukan "catat dari mutasi", tapi transaksi
// biasa yang nanti dicocokkan manual.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const statementLineId = Number(body.statementLineId);
  const mode = body.mode as string;
  if (!Number.isInteger(statementLineId)) return NextResponse.json({ error: "ID mutasi tidak valid" }, { status: 400 });

  const stmt = await prisma.bankStatementLine.findUnique({ where: { id: statementLineId }, include: { bankAccount: true } });
  if (!stmt) return NextResponse.json({ error: "Mutasi bank tidak ditemukan" }, { status: 404 });
  if (stmt.matchedJournalLineId) return NextResponse.json({ error: "Mutasi ini sudah dicocokkan." }, { status: 400 });
  const bankAccountId = stmt.bankAccount.accountId;
  const amount = Math.abs(stmt.amount);
  const isInflow = stmt.amount > 0;
  const memoSuffix = `${stmt.bankAccount.name} ${stmt.date.toISOString().slice(0, 10)}`;
  const outletName = typeof body.outletName === "string" && body.outletName ? body.outletName : null;
  const contactId = Number.isInteger(body.contactId) ? (body.contactId as number) : null;
  const note = typeof body.description === "string" && body.description.trim() ? body.description.trim() : stmt.description;

  try {
    const bankLineId = await prisma.$transaction(async (tx) => {
      if (mode === "expense") {
        if (isInflow) throw new AccountingPostingError("Mutasi masuk tidak bisa dicatat sbg beban.");
        const rawLines: { description?: unknown; amount?: unknown; accountId?: unknown }[] = Array.isArray(body.lines) ? body.lines : [];
        const lines = rawLines.map((l) => ({
          description: typeof l.description === "string" ? l.description.trim() : "",
          amount: Math.round(Number(l.amount)),
          accountId: Number(l.accountId),
        }));
        if (lines.length === 0) throw new AccountingPostingError("Minimal 1 baris beban.");
        for (const l of lines) {
          if (!l.description || !Number.isInteger(l.accountId) || !(l.amount > 0)) throw new AccountingPostingError("Baris beban belum lengkap.");
        }
        const sum = lines.reduce((s, l) => s + l.amount, 0);
        if (sum !== amount) throw new AccountingPostingError(`Total baris Rp${sum.toLocaleString("id-ID")} harus sama dgn mutasi Rp${amount.toLocaleString("id-ID")}.`);
        const accs = await tx.account.findMany({ where: { id: { in: lines.map((l) => l.accountId) } } });
        if (accs.length !== new Set(lines.map((l) => l.accountId)).size || accs.some((a) => a.type !== "EXPENSE")) {
          throw new AccountingPostingError("Semua akun baris harus akun Beban.");
        }
        const expense = await tx.directExpense.create({
          data: { date: stmt.date, contactId, outletName, paymentAccountId: bankAccountId, amount, description: note, createdById: user.id, lines: { create: lines } },
        });
        const entry = await postJournalEntry(
          {
            date: stmt.date,
            memo: `Direct Expense: ${note}`,
            sourceType: "DIRECT_EXPENSE",
            sourceId: String(expense.id),
            outletName,
            createdById: user.id,
            lines: [
              ...lines.map((l) => ({ accountId: l.accountId, debit: l.amount, outletName, contactId, description: l.description })),
              { accountId: bankAccountId, credit: amount, outletName, contactId, description: note },
            ],
          },
          tx
        );
        await tx.directExpense.update({ where: { id: expense.id }, data: { journalEntryId: entry.id } });
        return entry.lines.find((l) => l.accountId === bankAccountId)!.id;
      }

      if (mode === "ar_receipt") {
        if (!isInflow) throw new AccountingPostingError("Mutasi keluar tidak bisa dicatat sbg penerimaan penjualan.");
        const outletAcc = outletName ? OUTLET_ACCOUNTS[outletName] : null;
        if (!outletAcc) throw new AccountingPostingError("Pilih outlet penjualan.");
        const ar = await tx.account.findUnique({ where: { code: outletAcc.arCode } });
        if (!ar) throw new AccountingPostingError("Akun AR outlet belum ada di COA.");
        const entry = await postJournalEntry(
          {
            date: stmt.date,
            memo: `Penerimaan penjualan ${outletAcc.shortLabel} - ${note}`,
            sourceType: "AR_RECEIPT",
            sourceId: `stmt-${stmt.id}`,
            outletName,
            createdById: user.id,
            lines: [
              { accountId: bankAccountId, debit: amount, outletName, description: note },
              { accountId: ar.id, credit: amount, outletName, description: `Pelunasan piutang ${outletAcc.shortLabel}` },
            ],
          },
          tx
        );
        return entry.lines.find((l) => l.accountId === bankAccountId)!.id;
      }

      if (mode === "journal") {
        const counterAccountId = Number(body.counterAccountId);
        if (!Number.isInteger(counterAccountId)) throw new AccountingPostingError("Pilih akun lawan.");
        if (counterAccountId === bankAccountId) throw new AccountingPostingError("Akun lawan tidak boleh akun bank yang sama.");
        const counter = await tx.account.findUnique({ where: { id: counterAccountId } });
        if (!counter) throw new AccountingPostingError("Akun lawan tidak ditemukan.");
        const entry = await postJournalEntry(
          {
            date: stmt.date,
            memo: `${memoSuffix} - ${note}`,
            sourceType: "BANK_ADJUSTMENT",
            sourceId: `stmt-${stmt.id}`,
            outletName,
            createdById: user.id,
            lines: isInflow
              ? [
                  { accountId: bankAccountId, debit: amount, outletName, contactId, description: note },
                  { accountId: counterAccountId, credit: amount, outletName, contactId, description: note },
                ]
              : [
                  { accountId: counterAccountId, debit: amount, outletName, contactId, description: note },
                  { accountId: bankAccountId, credit: amount, outletName, contactId, description: note },
                ],
          },
          tx
        );
        return entry.lines.find((l) => l.accountId === bankAccountId)!.id;
      }

      throw new AccountingPostingError("Mode tidak dikenal.");
    });

    await prisma.bankStatementLine.update({ where: { id: stmt.id }, data: { matchedJournalLineId: bankLineId } });
    return NextResponse.json({ ok: true, journalLineId: bankLineId });
  } catch (e) {
    if (e instanceof AccountingPostingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

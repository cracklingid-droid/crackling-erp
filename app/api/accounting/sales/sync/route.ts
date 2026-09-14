import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { fetchAllDailySalesTotals } from "@/lib/sales-daily-sheet";
import { OUTLET_ACCOUNTS } from "@/lib/accounting-outlets";
import { replaceJournalEntry, AccountingPostingError } from "@/lib/accounting-ledger";
import { reconciledLineIdsForEntry, parseDateParam } from "@/lib/accounting-reports";

// Sheet berisi 1 tahun penuh x 2 outlet - posting jurnal ratusan hari bisa
// lama, naikkan batas waktu spt sync-sales Cost Center.
export const maxDuration = 60;

const CONCURRENCY = 8;

// Sync Record Sales dari tab "Daily" sheet POS -> SalesRecord per outlet per
// hari + jurnal Dr AR outlet / Cr Sales outlet (contoh eksplisit Kevin
// 2026-09-14: "AR - Crackling Serpong / Sales - Crackling Serpong").
// Idempoten & AMAN diulang: hari yang totalnya tidak berubah dilewati
// (jurnalnya TIDAK dibuat ulang - kalau dibuat ulang, baris jurnal yang
// sudah dicocokkan ke mutasi bank bakal putus); hari yang berubah tapi
// jurnalnya sudah direkonsiliasi juga dilewati + ditandai (harus unrecon
// dulu, ikut aturan Jurnal.id yang diminta Kevin).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const start = parseDateParam(typeof body.start === "string" ? body.start : null);
  const end = parseDateParam(typeof body.end === "string" ? body.end : null);
  const today = new Date().toISOString().slice(0, 10);

  let rows;
  try {
    rows = await fetchAllDailySalesTotals();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil data sheet" }, { status: 502 });
  }

  const accounts = await prisma.account.findMany({ where: { code: { in: Object.values(OUTLET_ACCOUNTS).flatMap((a) => [a.arCode, a.salesCode]) } } });
  const idByCode = new Map(accounts.map((a) => [a.code, a.id]));

  const targets = rows.filter((r) => {
    if (r.date > today) return false;
    if (start && r.date < start.toISOString().slice(0, 10)) return false;
    if (end && r.date > end.toISOString().slice(0, 10)) return false;
    return !!OUTLET_ACCOUNTS[r.outletName];
  });

  const summary = { created: 0, updated: 0, unchanged: 0, skippedReconciled: 0, skippedLocked: 0, errors: [] as string[] };

  async function processOne(r: (typeof targets)[number]) {
    const acc = OUTLET_ACCOUNTS[r.outletName];
    const arId = idByCode.get(acc.arCode);
    const salesId = idByCode.get(acc.salesCode);
    if (!arId || !salesId) {
      summary.errors.push(`${r.outletName}: akun AR/Sales belum ada di COA (jalankan scripts/seed-coa.ts)`);
      return;
    }
    const date = new Date(`${r.date}T00:00:00.000Z`);
    const existing = await prisma.salesRecord.findUnique({ where: { outletName_date: { outletName: r.outletName, date } } });
    if (existing && existing.total === r.total && existing.journalEntryId) {
      summary.unchanged++;
      return;
    }
    if (existing?.journalEntryId) {
      const matched = await reconciledLineIdsForEntry(existing.journalEntryId);
      if (matched.length > 0) {
        summary.skippedReconciled++;
        return;
      }
    }
    try {
      const entry = await replaceJournalEntry({
        date,
        memo: `Penjualan ${acc.shortLabel} ${r.date}`,
        sourceType: "RECORD_SALES",
        sourceId: `${r.outletName}|${r.date}`,
        outletName: r.outletName,
        createdById: user!.id,
        lines: [
          { accountId: arId, debit: r.total, outletName: r.outletName, description: `Piutang penjualan ${r.date}` },
          { accountId: salesId, credit: r.total, outletName: r.outletName, description: `Penjualan ${r.date}` },
        ],
      });
      await prisma.salesRecord.upsert({
        where: { outletName_date: { outletName: r.outletName, date } },
        update: { total: r.total, source: "SHEET_IMPORT", journalEntryId: entry.id },
        create: { outletName: r.outletName, date, total: r.total, source: "SHEET_IMPORT", journalEntryId: entry.id },
      });
      if (existing) summary.updated++;
      else summary.created++;
    } catch (e) {
      if (e instanceof AccountingPostingError && e.message.includes("dikunci")) summary.skippedLocked++;
      else summary.errors.push(`${r.outletName} ${r.date}: ${e instanceof Error ? e.message : "gagal"}`);
    }
  }

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(targets.slice(i, i + CONCURRENCY).map(processOne));
  }

  return NextResponse.json({ ok: true, totalRows: targets.length, ...summary, syncedAt: new Date().toISOString() });
}

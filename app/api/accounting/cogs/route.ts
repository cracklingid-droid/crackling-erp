import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { parseDateParam, endOfDay } from "@/lib/accounting-reports";
import { COGS_EXPENSE_CODE } from "@/lib/accounting-cogs";

// Daftar jurnal HPP (sourceType COGS_SYNC) dlm rentang tanggal + total per
// outlet - dipakai halaman COGS. Default 30 hari terakhir.
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
  const outlet = searchParams.get("outlet");

  const cogsAcc = await prisma.account.findUnique({ where: { code: COGS_EXPENSE_CODE } });
  const entries = await prisma.journalEntry.findMany({
    where: { sourceType: "COGS_SYNC", date: { gte: start, lte: endOfDay(end) }, ...(outlet ? { outletName: outlet } : {}) },
    include: { lines: true },
    orderBy: [{ date: "desc" }, { outletName: "asc" }],
  });

  const rows = entries.map((e) => ({
    id: e.id,
    date: e.date,
    outletName: e.outletName,
    amount: e.lines.find((l) => l.accountId === cogsAcc?.id)?.debit ?? 0,
    isLocked: e.isLocked,
  }));

  const byOutlet = new Map<string, { total: number; days: number }>();
  for (const r of rows) {
    const key = r.outletName ?? "-";
    const s = byOutlet.get(key) ?? { total: 0, days: 0 };
    s.total += r.amount;
    s.days += 1;
    byOutlet.set(key, s);
  }

  return NextResponse.json({
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    rows,
    totals: Array.from(byOutlet.entries()).map(([outletName, s]) => ({ outletName, ...s })),
    grandTotal: rows.reduce((s, r) => s + r.amount, 0),
  });
}

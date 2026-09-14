import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { parseDateParam, endOfDay } from "@/lib/accounting-reports";

// Daftar Record Sales per outlet per hari (hasil sync tab "Daily" sheet
// POS) + total per outlet dlm rentang tanggal - dipakai halaman Record
// Sales. Default 30 hari terakhir.
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

  const records = await prisma.salesRecord.findMany({
    where: { date: { gte: start, lte: endOfDay(end) }, ...(outlet ? { outletName: outlet } : {}) },
    orderBy: [{ date: "desc" }, { outletName: "asc" }],
  });

  const byOutlet = new Map<string, { total: number; days: number }>();
  for (const r of records) {
    const s = byOutlet.get(r.outletName) ?? { total: 0, days: 0 };
    s.total += r.total;
    s.days += 1;
    byOutlet.set(r.outletName, s);
  }

  const lastSynced = await prisma.salesRecord.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });

  return NextResponse.json({
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    records,
    totals: Array.from(byOutlet.entries()).map(([outletName, s]) => ({ outletName, ...s })),
    grandTotal: records.reduce((s, r) => s + r.total, 0),
    lastSyncedAt: lastSynced?.createdAt ?? null,
  });
}

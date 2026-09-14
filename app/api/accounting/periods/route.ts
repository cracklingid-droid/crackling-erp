import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

const YM = /^\d{4}-\d{2}$/;

function monthRange(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)) };
}

// Penguncian periode bulanan (pola draft/final Payroll): periode terkunci
// menolak jurnal baru (cek di postJournalEntry) & entry di dalamnya diberi
// isLocked=true supaya sync/replace & hapus ikut ditolak. Bisa dibuka lagi
// (unlock) oleh owner/developer kalau memang perlu koreksi.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const [periods, entries] = await Promise.all([
    prisma.accountingPeriod.findMany({ orderBy: { yearMonth: "desc" } }),
    prisma.journalEntry.findMany({ select: { date: true } }),
  ]);
  const countBy = new Map<string, number>();
  for (const e of entries) {
    const ym = e.date.toISOString().slice(0, 7);
    countBy.set(ym, (countBy.get(ym) ?? 0) + 1);
  }
  const months = new Set([...countBy.keys(), ...periods.map((p) => p.yearMonth)]);
  const lockBy = new Map(periods.map((p) => [p.yearMonth, p]));
  return NextResponse.json(
    Array.from(months)
      .sort()
      .reverse()
      .map((ym) => ({ yearMonth: ym, entryCount: countBy.get(ym) ?? 0, isLocked: lockBy.get(ym)?.isLocked ?? false, lockedAt: lockBy.get(ym)?.lockedAt ?? null }))
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const yearMonth = typeof body.yearMonth === "string" ? body.yearMonth : "";
  const lock = body.lock !== false;
  if (!YM.test(yearMonth)) return NextResponse.json({ error: "yearMonth tidak valid" }, { status: 400 });

  const { start, end } = monthRange(yearMonth);
  await prisma.$transaction([
    prisma.accountingPeriod.upsert({
      where: { yearMonth },
      update: { isLocked: lock, lockedAt: lock ? new Date() : null },
      create: { yearMonth, isLocked: lock, lockedAt: lock ? new Date() : null },
    }),
    prisma.journalEntry.updateMany({ where: { date: { gte: start, lte: end } }, data: { isLocked: lock } }),
  ]);
  return NextResponse.json({ ok: true, yearMonth, isLocked: lock });
}

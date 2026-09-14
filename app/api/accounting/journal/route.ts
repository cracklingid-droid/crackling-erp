import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { parseDateParam, endOfDay } from "@/lib/accounting-reports";
import { postJournalEntry, AccountingPostingError } from "@/lib/accounting-ledger";

const PAGE_SIZE = 40;

// Jurnal manual / saldo awal - satu-satunya cara input jurnal bebas (mis.
// saldo awal kas/persediaan/aset/modal waktu buku besar mulai, koreksi,
// setoran modal). Tetap lewat postJournalEntry (balance & lock dicek).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const date = parseDateParam(typeof body.date === "string" ? body.date : null);
  const memo = typeof body.memo === "string" ? body.memo.trim() : "";
  const sourceType = body.sourceType === "OPENING_BALANCE" ? "OPENING_BALANCE" : "MANUAL";
  const outletName = typeof body.outletName === "string" && body.outletName ? body.outletName : null;
  const rawLines: { accountId?: unknown; debit?: unknown; credit?: unknown; description?: unknown }[] = Array.isArray(body.lines) ? body.lines : [];

  if (!date) return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
  if (!memo) return NextResponse.json({ error: "Keterangan jurnal wajib diisi" }, { status: 400 });

  const lines = rawLines.map((l) => ({
    accountId: Number(l.accountId),
    debit: Math.round(Number(l.debit) || 0),
    credit: Math.round(Number(l.credit) || 0),
    description: typeof l.description === "string" && l.description.trim() ? l.description.trim() : null,
  }));
  if (lines.some((l) => !Number.isInteger(l.accountId))) return NextResponse.json({ error: "Semua baris harus pilih akun" }, { status: 400 });
  const accounts = await prisma.account.findMany({ where: { id: { in: lines.map((l) => l.accountId) } }, select: { id: true } });
  if (accounts.length !== new Set(lines.map((l) => l.accountId)).size) return NextResponse.json({ error: "Ada akun yang tidak ditemukan" }, { status: 400 });

  try {
    const entry = await postJournalEntry({ date, memo, sourceType, sourceId: null, outletName, createdById: user.id, lines });
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    if (e instanceof AccountingPostingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

// Jurnal Umum - daftar semua JournalEntry (+ baris) dlm rentang tanggal,
// filter sourceType/akun/cari memo. Dasar audit: semua modul lain cuma
// "pintu masuk", angkanya berakhir di sini.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const end = parseDateParam(searchParams.get("end")) ?? today;
  const start = parseDateParam(searchParams.get("start")) ?? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const sourceType = searchParams.get("sourceType") || null;
  const accountId = Number(searchParams.get("accountId")) || null;
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const where = {
    date: { gte: start, lte: endOfDay(end) },
    ...(sourceType ? { sourceType } : {}),
    ...(accountId ? { lines: { some: { accountId } } } : {}),
    ...(search ? { memo: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { account: { select: { code: true, name: true } } }, orderBy: [{ debit: "desc" }, { id: "asc" }] }, createdBy: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.journalEntry.count({ where }),
  ]);

  return NextResponse.json({ entries, total, page, pageSize: PAGE_SIZE, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
}

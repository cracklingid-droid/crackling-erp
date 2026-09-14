import { NextResponse } from "next/server";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { syncCogs } from "@/lib/accounting-cogs";
import { parseDateParam, endOfDay } from "@/lib/accounting-reports";

export const maxDuration = 60;

// Sync HPP dari Warehouse utk rentang tanggal (maks 366 hari, sama batas
// Cost Center). Baca database Warehouse bisa gagal (koneksi/jembatan) -
// dibalas 502 dgn pesan jelas, bukan 500 kosong.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const start = parseDateParam(typeof body.start === "string" ? body.start : null);
  const end = parseDateParam(typeof body.end === "string" ? body.end : null);
  if (!start || !end || start > end) return NextResponse.json({ error: "Rentang tanggal tidak valid" }, { status: 400 });
  if ((end.getTime() - start.getTime()) / 86400000 > 366) return NextResponse.json({ error: "Rentang maksimal 366 hari" }, { status: 400 });

  try {
    const summary = await syncCogs({ start, end: endOfDay(end), createdById: user.id });
    return NextResponse.json({ ok: true, ...summary, syncedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal sync HPP dari Warehouse" }, { status: 502 });
  }
}

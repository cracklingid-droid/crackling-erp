import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, hasFullAccess } from "@/lib/current-user";
import { fetchAllDailySales } from "@/lib/sales-sheet";

// Google Sheets-nya sekarang sudah berisi data 1 tahun kalender penuh (Jan-
// Des) per outlet - ukuran CSV & jumlah baris jadi besar, upsert satu-satu
// bisa >15 detik dan gampang kena timeout default Vercel. maxDuration
// dinaikkan + upsert dijalankan paralel per-batch. Permintaan Kevin
// 2026-09-12 (perlu sync 1 Jan - 31 Des, sebelumnya gagal krn timeout).
export const maxDuration = 60;

const UPSERT_BATCH_SIZE = 25;

// Tarik ulang omzet dari Google Sheets & timpa (upsert) DailySales - manual
// (tombol "Sync Sekarang"), bukan cron. Owner/developer saja (bukan
// "manager" - dia cuma boleh lihat Cost Center, bukan trigger sync).
// Permintaan Kevin 2026-09-12.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!hasFullAccess(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  let rows;
  try {
    rows = await fetchAllDailySales();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil data sheet" }, { status: 502 });
  }

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    await Promise.all(
      batch.map((row) =>
        prisma.dailySales.upsert({
          where: { outletName_date: { outletName: row.outletName, date: new Date(row.date) } },
          update: { totalOmzet: row.totalOmzet, syncedAt: new Date() },
          create: { outletName: row.outletName, date: new Date(row.date), totalOmzet: row.totalOmzet },
        })
      )
    );
  }

  const byOutlet = new Map<string, number>();
  for (const r of rows) byOutlet.set(r.outletName, (byOutlet.get(r.outletName) ?? 0) + 1);

  return NextResponse.json({
    ok: true,
    totalRows: rows.length,
    byOutlet: Array.from(byOutlet.entries()).map(([outletName, days]) => ({ outletName, days })),
    syncedAt: new Date().toISOString(),
  });
}

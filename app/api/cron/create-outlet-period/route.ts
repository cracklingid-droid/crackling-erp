import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextOutletPeriodRange } from "@/lib/payroll-outlet-schedule";
import { createNextOutletPeriod } from "@/lib/payroll-outlet-auto";

export const maxDuration = 60;

// Dipanggil Vercel Cron tiap hari (lihat vercel.json) - otomatis membuat
// periode Payroll Outlet berikutnya begitu tanggal mulainya sudah tiba,
// TANPA menunggu HR klik "Buat Periode Berikutnya" manual. Aman
// diotomatisasi penuh krn jadwal & tanggalnya sudah dikunci sepenuhnya
// (lib/payroll-outlet-schedule.ts, keputusan Kevin 2026-09-12) - tidak ada
// keputusan manusia yang perlu diambil di langkah ini.
//
// Field yang bergantung absensi (gaji pokok, uang makan, lembur, dst) tetap
// Rp0 sampai HR upload absen dari mesin - begitu diupload, otomatis
// terhitung ulang sendiri (lihat recalcOverlappingOutletPeriods di
// app/api/payroll/attendance/import/route.ts, sudah ada sebelumnya). Upload
// absen TIDAK bisa diotomatisasi lebih jauh dari sini krn sumbernya file
// export mesin fisik, bukan data yang bisa dihasilkan sistem sendiri.
//
// Loop (maks 12x) supaya kalau cron sempat tidak jalan beberapa periode,
// begitu jalan lagi langsung mengejar semua periode yang seharusnya sudah
// ada, bukan cuma 1 per hari. Permintaan Kevin 2026-09-12 ("kenapa biaya
// gaji belum muncul - buat semua otomatisasinya").
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const createdPeriods: string[] = [];
  let lastReason: string | null = null;

  for (let i = 0; i < 12; i++) {
    const lastPeriod = await prisma.payrollPeriod.findFirst({
      where: { category: "outlet" },
      orderBy: { endDate: "desc" },
    });
    if (!lastPeriod) {
      lastReason = "Belum ada periode outlet sebelumnya";
      break;
    }

    const range = nextOutletPeriodRange(lastPeriod.endDate);
    if (today.getTime() < range.start.getTime()) {
      lastReason = `Belum waktunya - periode berikutnya mulai ${range.start.toISOString().slice(0, 10)}`;
      break;
    }

    const result = await createNextOutletPeriod(null);
    if (!result.created) {
      lastReason = result.reason;
      break;
    }
    createdPeriods.push(result.period.label);
  }

  return NextResponse.json({ createdPeriods, lastReason });
}

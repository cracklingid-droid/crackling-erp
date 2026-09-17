// Import absensi karyawan Kantor dari "Laporan Kehadiran Versi 1 (Vertikal)
// Periode 25 Agu 2026 - 12 Sep 2026.xlsx" (link Kevin 2026-09-13, "upload
// data absen karyawan kantor") - sumbernya sistem HR pihak ketiga (format
// "Rekap Kehadiran Harian" per-blok-karyawan, BEDA TOTAL dari format mesin
// fingerprint outlet), jadi ditulis manual di sini (bukan lewat upload
// generik /hr/payroll/absensi yang cuma kenal format mesin fingerprint) -
// datanya ditranskrip presisi dari isi file, dicocokkan ke ringkasan resmi
// baris "REKAP KEHADIRAN" di file yang sama (jumlah hari hadir cocok
// persis: Calvin 17, Candra 13, Sulthan 13 - lihat komentar per-employee).
//
// CATATAN PENTING utk Kevin:
// 1) Yeromona & Harry TIDAK ADA di laporan ini (cuma 3 dari 5 karyawan
//    kantor) - kemungkinan tidak pakai sistem absensi App ini, perlu
//    ditanyakan bagaimana absensi mereka dicatat.
// 2) Calvin 31 Agu->2 Sep: jam kerja tercatat TIDAK WAJAR (~49 jam nonstop,
//    Masuk 31 Agu 09:01 - Keluar baru 2 Sep 10:04) - kemungkinan lupa
//    clock-out di tengah, BUKAN benar-benar kerja 2 hari nonstop. Tetap
//    diimpor apa adanya (sesuai sumber), TAPI perlu dicek manual sebelum
//    dipakai hitung lembur beneran - akan menghasilkan angka lembur sangat
//    besar & salah kalau tidak dikoreksi.
// 3) Jadwal kerja Calvin TERNYATA gantian 2 pola (08:00-20:00 & 10:00-22:00
//    tergantung hari) - field Employee.scheduleStart/scheduleEnd cuma
//    menampung 1 pola tetap, jadi SENGAJA dikosongkan (bukan diisi asal
//    salah satu) - deteksi "Terlambat" otomatis sistem tidak akan aktif utk
//    Calvin sampai ini dibahas lebih lanjut. Candra & Sulthan pola tetap
//    (09:00-18:00) - jadwal mereka diisi.
import { prisma } from "../lib/db";

// jam lokal Jakarta disimpan di komponen UTC Date (konvensi yang sudah
// dipakai di seluruh lib/attendance-*.ts - lihat lib/attendance-parse.ts
// cellToString).
function t(dateStr: string, h: number, m: number): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m, 0));
}

type Row = { date: string; inH: number; inM: number; out: [string, number, number] | null };

const CALVIN: Row[] = [
  { date: "2026-08-25", inH: 10, inM: 17, out: ["2026-08-25", 22, 7] },
  { date: "2026-08-27", inH: 10, inM: 4, out: ["2026-08-27", 22, 2] },
  { date: "2026-08-28", inH: 8, inM: 50, out: ["2026-08-29", 9, 49] },
  { date: "2026-08-29", inH: 9, inM: 49, out: null }, // clock-out tidak lengkap (asli)
  { date: "2026-08-30", inH: 22, inM: 2, out: ["2026-08-31", 9, 1] },
  { date: "2026-08-31", inH: 9, inM: 1, out: ["2026-09-02", 10, 4] }, // ANOMALI - lihat catatan di atas
  { date: "2026-09-02", inH: 10, inM: 5, out: ["2026-09-02", 22, 2] },
  { date: "2026-09-03", inH: 10, inM: 20, out: ["2026-09-03", 22, 2] },
  { date: "2026-09-04", inH: 8, inM: 4, out: ["2026-09-05", 10, 27] },
  { date: "2026-09-05", inH: 10, inM: 27, out: ["2026-09-05", 22, 1] },
  { date: "2026-09-06", inH: 10, inM: 7, out: ["2026-09-06", 22, 0] },
  { date: "2026-09-07", inH: 10, inM: 15, out: ["2026-09-07", 22, 3] },
  { date: "2026-09-08", inH: 10, inM: 9, out: ["2026-09-08", 22, 2] },
  { date: "2026-09-09", inH: 9, inM: 14, out: ["2026-09-09", 22, 5] },
  { date: "2026-09-10", inH: 10, inM: 23, out: ["2026-09-11", 7, 29] },
  { date: "2026-09-11", inH: 7, inM: 29, out: ["2026-09-12", 10, 21] },
  { date: "2026-09-12", inH: 10, inM: 21, out: ["2026-09-13", 10, 11] },
];

const CANDRA: Row[] = [
  { date: "2026-08-26", inH: 9, inM: 2, out: ["2026-08-26", 18, 16] },
  { date: "2026-08-27", inH: 9, inM: 0, out: ["2026-08-27", 18, 24] },
  { date: "2026-08-28", inH: 8, inM: 26, out: ["2026-08-28", 18, 21] },
  { date: "2026-08-31", inH: 8, inM: 20, out: ["2026-08-31", 18, 11] },
  { date: "2026-09-01", inH: 8, inM: 50, out: ["2026-09-01", 18, 41] },
  { date: "2026-09-02", inH: 9, inM: 4, out: ["2026-09-02", 18, 37] },
  { date: "2026-09-03", inH: 8, inM: 44, out: ["2026-09-03", 18, 2] },
  { date: "2026-09-04", inH: 8, inM: 27, out: ["2026-09-04", 19, 37] },
  { date: "2026-09-07", inH: 8, inM: 24, out: ["2026-09-07", 18, 56] },
  { date: "2026-09-08", inH: 8, inM: 50, out: ["2026-09-08", 18, 7] },
  { date: "2026-09-09", inH: 8, inM: 48, out: ["2026-09-09", 20, 4] },
  { date: "2026-09-10", inH: 8, inM: 28, out: ["2026-09-10", 18, 15] },
  { date: "2026-09-11", inH: 8, inM: 49, out: ["2026-09-11", 18, 8] },
];

const SULTHAN: Row[] = [
  { date: "2026-08-26", inH: 8, inM: 24, out: ["2026-08-26", 18, 44] },
  { date: "2026-08-27", inH: 9, inM: 0, out: ["2026-08-27", 18, 1] },
  { date: "2026-08-28", inH: 8, inM: 25, out: ["2026-08-28", 18, 3] },
  { date: "2026-08-31", inH: 8, inM: 22, out: ["2026-08-31", 18, 1] },
  { date: "2026-09-01", inH: 9, inM: 2, out: ["2026-09-01", 18, 3] },
  { date: "2026-09-02", inH: 8, inM: 32, out: ["2026-09-02", 18, 0] },
  { date: "2026-09-03", inH: 8, inM: 18, out: ["2026-09-03", 18, 0] },
  { date: "2026-09-04", inH: 8, inM: 14, out: ["2026-09-04", 18, 8] },
  { date: "2026-09-07", inH: 8, inM: 50, out: ["2026-09-07", 18, 1] },
  { date: "2026-09-08", inH: 8, inM: 21, out: ["2026-09-08", 18, 0] },
  { date: "2026-09-09", inH: 8, inM: 39, out: ["2026-09-09", 18, 0] },
  { date: "2026-09-10", inH: 9, inM: 43, out: ["2026-09-10", 18, 1] },
  { date: "2026-09-11", inH: 8, inM: 24, out: ["2026-09-11", 18, 0] },
];

async function importRows(employeeName: string, rows: Row[]) {
  const emp = await prisma.employee.findFirst({ where: { name: employeeName, outlet: "Kantor" } });
  if (!emp) throw new Error(`Employee "${employeeName}" (Kantor) tidak ditemukan`);

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const clockIn = t(r.date, r.inH, r.inM);
    const clockOut = r.out ? t(r.out[0], r.out[1], r.out[2]) : null;
    const workedHours = clockOut ? (clockOut.getTime() - clockIn.getTime()) / 3600000 : null;
    if (workedHours !== null && workedHours > 16) {
      console.log(`  [PERIKSA] ${employeeName} ${r.date}: durasi kerja ${workedHours.toFixed(1)} jam (tidak wajar, lihat catatan file script)`);
    }
    const date = t(r.date, 0, 0);
    const existing = await prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: emp.id, date } } });
    if (existing) {
      await prisma.attendanceRecord.update({ where: { id: existing.id }, data: { clockIn, clockOut } });
      updated++;
    } else {
      await prisma.attendanceRecord.create({ data: { employeeId: emp.id, date, clockIn, clockOut } });
      created++;
    }
  }
  console.log(`${employeeName}: ${created} dibuat, ${updated} diperbarui (total ${rows.length} hari hadir)`);
}

async function main() {
  console.log("=== Import absensi Kantor 25 Agu - 12 Sep 2026 ===\n");
  await importRows("Calvin Natadihardja", CALVIN);
  await importRows("Candra", CANDRA);
  await importRows("Sulthan", SULTHAN);

  // Jadwal kerja tetap - dipakai sistem utk deteksi otomatis "Terlambat"
  // (Payroll Kantor). Calvin SENGAJA tidak diisi (2 pola gantian, lihat
  // catatan atas).
  const candra = await prisma.employee.findFirstOrThrow({ where: { name: "Candra", outlet: "Kantor" } });
  await prisma.employee.update({ where: { id: candra.id }, data: { scheduleStart: "09:00", scheduleEnd: "18:00" } });
  const sulthan = await prisma.employee.findFirstOrThrow({ where: { name: "Sulthan", outlet: "Kantor" } });
  await prisma.employee.update({ where: { id: sulthan.id }, data: { scheduleStart: "09:00", scheduleEnd: "18:00" } });
  console.log("\nJadwal kerja Candra & Sulthan diisi 09:00-18:00.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

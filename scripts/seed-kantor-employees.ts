// Isi 5 karyawan Kantor nyata (permintaan Kevin 2026-09-13), diambil &
// diverifikasi dari spreadsheet referensi "2608 rekap gaji FINAL.xlsx"
// (sheet SSOD/Recap/Hitungan). Status "active" (bukan "onboarding") krn
// mereka karyawan aktif yang sudah digaji tiap bulan, bukan kandidat baru.
// Biodata lain (KTP, tanggal lahir, alamat, jabatan, tanggal join) sengaja
// dikosongkan - dilengkapi HR belakangan lewat badge "Kelengkapan" yang
// sudah ada di Database Karyawan.
//
// Catatan BPJS Calvin: sheet "Hitungan" & "Recap" beda angka utk bulan ini
// (Hitungan expected 167.692/355.508, Recap 0/kosong) - dikonfirmasi Kevin
// 2026-09-13 utk PAKAI angka Hitungan. Setoran ke BPJS Calvin TETAP
// dikosongkan (null) krn total Pengurang di Recap (415.314,67) sudah pas
// terdiri dari Keterlambatan+Potongan saja, tanpa baris Setoran ke BPJS
// bulan itu - bukan berarti rate-nya 0 permanen, HR bisa isi kalau perlu.
import { prisma } from "../lib/db";

const EMPLOYEES = [
  {
    name: "Yeromona",
    baseSalary: 3_200_000,
    bankName: "BCA",
    bankAccountNumber: "4768095025",
    bankAccountHolder: "Yeromona Harkasih",
    kantorBpjsAllowance: 69_231,
    kantorBpjsEmployerObligation: 146_770,
    kantorBpjsRemittance: 216_001,
  },
  {
    name: "Calvin Natadihardja",
    baseSalary: 5_729_876,
    dailyMealRate: 84_079,
    kantorLateRate: 21_020,
    kantorIncompleteClockRate: 10_510,
    kantorBpjsAllowance: 167_692,
    kantorBpjsEmployerObligation: 355_508,
    bankName: "BCA",
    bankAccountNumber: "7570528721",
    bankAccountHolder: "Calvin Natadihardja",
  },
  {
    name: "Candra",
    baseSalary: 3_500_000,
    dailyMealRate: 50_000,
    kantorOvertimeRate: 25_000,
    kantorLateRate: 12_500,
    kantorFuelRatePerKm: 1_000,
    bankName: "BCA",
    bankAccountNumber: "4380498133",
    bankAccountHolder: "Candra",
  },
  {
    name: "Harry",
    baseSalary: 3_200_000,
    dailyMealRate: 50_000,
    kantorOvertimeRate: 25_000,
    kantorLateRate: 12_500,
  },
  {
    name: "Sulthan",
    baseSalary: 4_600_000,
    dailyMealRate: 50_000,
    kantorOvertimeRate: 25_000,
    kantorLateRate: 12_500,
    kantorFuelRatePerKm: 1_000,
  },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const developer = await prisma.hrUser.findUnique({ where: { username: "developer" } });
  if (!developer) throw new Error("HrUser 'developer' tidak ditemukan");

  for (const e of EMPLOYEES) {
    const exists = await prisma.employee.findFirst({ where: { name: e.name, outlet: "Kantor" } });
    if (exists) {
      console.log(`Lewati (sudah ada, id=${exists.id}): ${e.name}`);
      continue;
    }
    console.log(dryRun ? "[DRY RUN] akan dibuat:" : "Membuat:", e.name, JSON.stringify(e));
    if (dryRun) continue;
    const created = await prisma.employee.create({
      data: { ...e, outlet: "Kantor", status: "active", createdById: developer.id },
    });
    console.log(`  -> dibuat id=${created.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

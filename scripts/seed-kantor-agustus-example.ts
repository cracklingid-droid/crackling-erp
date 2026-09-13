// Buat periode Payroll Kantor "Agustus 2026" berisi CONTOH NYATA persis dari
// spreadsheet referensi Kevin "2608 rekap gaji FINAL.xlsx" (sheet Recap,
// nilai literal - bukan hasil hitung ulang sistem) - permintaan Kevin
// 2026-09-13: "masukin juga seluruh contoh di bulan 8 yang dipakai untuk
// belajar modul agar kita bisa lihat contoh".
//
// Komponen uang (bonus, gaji pokok, dst) diambil LANGSUNG dari sel literal
// Recap (diverifikasi total Penghasilan/Pengurang/THP-nya cocok - lihat
// scratchpad/kantor_agustus_recap.json). Field "quantity" referensi (hari
// hadir, jml telat, jam lembur, KM) DITURUNKAN dari Rupiah / rate karyawan
// yang sudah tersimpan di Employee (bukan dibaca ulang dari Hitungan yang
// banyak sel formulanya tidak ke-cache di file .xlsx) - supaya konsisten
// dgn kartu rate yang sudah ada di sistem.
//
// CATATAN PENTING utk Kevin (jangan dihapus tanpa baca dulu):
// 1) BPJS Calvin di periode historis INI sengaja Rp0/Rp0 (Tunjangan/
//    Kewajiban) - PERSIS sesuai sheet Recap asli bulan itu (dikonfirmasi
//    total Penghasilan Calvin cocok pas TANPA BPJS). Ini BEDA dari rate
//    Employee Calvin yg SEKARANG tersimpan (167.692/355.508, keputusan
//    Kevin sebelumnya utk periode SETERUSNYA) - historis Agustus ini tidak
//    diubah retroaktif, cuma contoh apa adanya.
// 2) Reimburse Bensin Candra (Rp99.000) & Sulthan (Rp56.000) di sheet
//    Recap TERNYATA ikut dijumlah ke Take Home Pay asli mereka (THP literal
//    = komponen lain + reimburse) - BEDA dari desain sistem sekarang yang
//    sengaja memisahkan Reimburse Bensin DI LUAR Take Home Pay. Field
//    fuelKm/fuelReimbursement tetap diisi terpisah sesuai desain saat ini;
//    kalau ternyata Reimburse memang seharusnya SELALU ikut THP, sistem
//    perlu disesuaikan - PERLU KONFIRMASI KEVIN, belum diubah sepihak.
import { prisma } from "../lib/db";
import { fieldsForCategory, computeNetPay } from "../lib/payroll-fields";

const PERIOD_START = new Date("2026-07-26T00:00:00.000Z");
const PERIOD_END = new Date("2026-08-24T00:00:00.000Z");
const PERIOD_LABEL = "Gaji Kantor Agustus 2026 (Contoh)";

const RECAP: Record<
  string,
  {
    bonus: number;
    baseSalary: number;
    bonusSales: number;
    overtimePay: number;
    mealAllowance: number;
    bpjsAllowance: number;
    bpjsEmployerObligation: number;
    pph21Deduction: number;
    lateDeduction: number;
    potongan: number;
    incompleteClockInDeduction: number;
    incompleteClockOutDeduction: number;
    bpjsRemittance: number;
    fuelReimbursement: number;
  }
> = {
  Yeromona: {
    bonus: 0, baseSalary: 3200000, bonusSales: 1545480, overtimePay: 0, mealAllowance: 0,
    bpjsAllowance: 69231, bpjsEmployerObligation: 146770, pph21Deduction: 0, lateDeduction: 0,
    potongan: 0, incompleteClockInDeduction: 0, incompleteClockOutDeduction: 0, bpjsRemittance: 216001, fuelReimbursement: 0,
  },
  "Calvin Natadihardja": {
    bonus: 0, baseSalary: 5729876, bonusSales: 0, overtimePay: 0, mealAllowance: 2186045,
    bpjsAllowance: 0, bpjsEmployerObligation: 0, pph21Deduction: 0, lateDeduction: 336315,
    potongan: 79000, incompleteClockInDeduction: 0, incompleteClockOutDeduction: 0, bpjsRemittance: 0, fuelReimbursement: 0,
  },
  Candra: {
    bonus: 0, baseSalary: 3500000, bonusSales: 0, overtimePay: 0, mealAllowance: 1100000,
    bpjsAllowance: 0, bpjsEmployerObligation: 0, pph21Deduction: 0, lateDeduction: 50000,
    potongan: 0, incompleteClockInDeduction: 0, incompleteClockOutDeduction: 0, bpjsRemittance: 0, fuelReimbursement: 99000,
  },
  Harry: {
    bonus: 0, baseSalary: 3200000, bonusSales: 0, overtimePay: 0, mealAllowance: 1150000,
    bpjsAllowance: 0, bpjsEmployerObligation: 0, pph21Deduction: 0, lateDeduction: 37500,
    potongan: 0, incompleteClockInDeduction: 0, incompleteClockOutDeduction: 0, bpjsRemittance: 0, fuelReimbursement: 0,
  },
  Sulthan: {
    bonus: 0, baseSalary: 4600000, bonusSales: 0, overtimePay: 100000, mealAllowance: 1000000,
    bpjsAllowance: 0, bpjsEmployerObligation: 0, pph21Deduction: 0, lateDeduction: 0,
    potongan: 0, incompleteClockInDeduction: 0, incompleteClockOutDeduction: 0, bpjsRemittance: 0, fuelReimbursement: 56000,
  },
};

function round(n: number) {
  return Math.round(n);
}

const THP_RECAP: Record<string, number> = {
  Yeromona: 4745480,
  "Calvin Natadihardja": 7500606.67,
  Candra: 4649000,
  Harry: 4312500,
  Sulthan: 5756000,
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const fields = fieldsForCategory("kantor");
  console.log("=== Cek THP sistem vs THP Recap asli (fuel sengaja di luar THP sistem) ===");
  for (const [name, r] of Object.entries(RECAP)) {
    const systemThp = computeNetPay(
      {
        bonus: r.bonus, baseSalary: r.baseSalary, overtimePay: r.overtimePay, mealAllowance: r.mealAllowance,
        pph21Deduction: r.pph21Deduction, lateDeduction: r.lateDeduction, loanDeduction: 0,
        bonusSales: r.bonusSales, bpjsAllowance: r.bpjsAllowance, bpjsEmployerObligation: r.bpjsEmployerObligation,
        incompleteClockInDeduction: r.incompleteClockInDeduction, incompleteClockOutDeduction: r.incompleteClockOutDeduction,
        bpjsRemittance: r.bpjsRemittance, otherAdjustment: r.potongan > 0 ? -r.potongan : 0,
      },
      fields
    );
    const diff = round(systemThp) - round(THP_RECAP[name]);
    console.log(`${name}: sistem=${round(systemThp)} | recap=${THP_RECAP[name]} | selisih=${diff}${diff !== 0 ? "  <- beda = reimburse bensin (di luar THP by design)" : ""}`);
  }
  if (dryRun) {
    console.log("\n[DRY RUN] tidak menulis ke database.");
    return;
  }

  const developer = await prisma.hrUser.findUnique({ where: { username: "developer" } });
  if (!developer) throw new Error("HrUser 'developer' tidak ditemukan");

  const existing = await prisma.payrollPeriod.findFirst({ where: { label: PERIOD_LABEL, category: "kantor" } });
  if (existing) {
    console.log(`Periode "${PERIOD_LABEL}" sudah ada (id=${existing.id}) - lewati, tidak membuat dobel.`);
    return;
  }

  const employees = await prisma.employee.findMany({ where: { outlet: "Kantor", name: { in: Object.keys(RECAP) } } });
  if (employees.length !== Object.keys(RECAP).length) {
    throw new Error(`Jumlah karyawan kantor ditemukan (${employees.length}) tidak sama dgn data Recap (${Object.keys(RECAP).length}) - cek nama.`);
  }

  const period = await prisma.payrollPeriod.create({
    data: { label: PERIOD_LABEL, category: "kantor", startDate: PERIOD_START, endDate: PERIOD_END, createdById: developer.id, status: "final" },
  });
  console.log(`Periode dibuat: #${period.id} ${PERIOD_LABEL}`);

  for (const emp of employees) {
    const r = RECAP[emp.name];
    const daysPresent = emp.dailyMealRate ? round(r.mealAllowance / emp.dailyMealRate) : 0;
    const lateCount = emp.kantorLateRate ? round(r.lateDeduction / emp.kantorLateRate) : 0;
    const overtimeMinutes = emp.kantorOvertimeRate ? round((r.overtimePay / emp.kantorOvertimeRate) * 60) : 0;
    const incompleteClockInCount = emp.kantorIncompleteClockRate ? round(r.incompleteClockInDeduction / emp.kantorIncompleteClockRate) : 0;
    const incompleteClockOutCount = emp.kantorIncompleteClockRate ? round(r.incompleteClockOutDeduction / emp.kantorIncompleteClockRate) : 0;
    const fuelKm = emp.kantorFuelRatePerKm ? round(r.fuelReimbursement / emp.kantorFuelRatePerKm) : 0;

    const item = await prisma.payrollItem.create({
      data: {
        periodId: period.id,
        employeeId: emp.id,
        daysPresent,
        overtimeMinutes,
        baseSalary: r.baseSalary,
        bonus: r.bonus,
        bonusSales: r.bonusSales,
        overtimePay: r.overtimePay,
        mealAllowance: round(r.mealAllowance),
        bpjsAllowance: r.bpjsAllowance,
        bpjsEmployerObligation: r.bpjsEmployerObligation,
        pph21Deduction: r.pph21Deduction,
        lateCount,
        lateDeduction: r.lateDeduction,
        incompleteClockInCount,
        incompleteClockInDeduction: r.incompleteClockInDeduction,
        incompleteClockOutCount,
        incompleteClockOutDeduction: r.incompleteClockOutDeduction,
        bpjsRemittance: r.bpjsRemittance,
        otherAdjustment: r.potongan > 0 ? -r.potongan : 0,
        fuelKm,
        fuelReimbursement: r.fuelReimbursement,
        note: "Contoh historis dari spreadsheet Kevin (Agustus 2026) - lihat catatan di scripts/seed-kantor-agustus-example.ts",
      },
    });
    console.log(`  ${emp.name}: item #${item.id} dibuat (hadir=${daysPresent}, telat=${lateCount}x, lembur=${overtimeMinutes}min, KM=${fuelKm})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

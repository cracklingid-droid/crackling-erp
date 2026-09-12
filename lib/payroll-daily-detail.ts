import { OUTLET_PRORATE_STANDARD_DAYS, calcOutletOvertimeRate } from "./payroll-config";
import { labelForCategory } from "./payroll-event-notes";

// Pecah 1 PayrollItem (kategori outlet) jadi baris per-tanggal - "Sheet 1"
// yang diminta Kevin 2026-09-12 ("detail perhitungan, tanggal bekerja
// berdasarkan cutoff kehadiran, gaji pokok harian, transport & uang makan
// harian, semua komponen uang masuk & keluar"), dipakai bareng oleh tab
// "Detail Harian" (halaman periode), halaman /rincian (print PDF), dan
// export Excel - SATU sumber kebenaran spy Sheet 1 & Sheet 2 (rekap
// bulanan) selalu cocok totalnya.
//
// Catatan penting: BPJS Kesehatan/Ketenagakerjaan, PPh21, Kasbon, Bayar/
// Kembali Deposit, Bonus, Service Charge & Penyesuaian Lain SENGAJA TIDAK
// muncul di sini - field-field itu tidak (dan tidak bisa) tercatat per
// tanggal kejadian di data yang ada (cuma input manual per-periode), jadi
// tetap cuma tampil di rekap bulanan (Sheet 2). Ditegaskan ke Kevin lewat
// catatan di UI, bukan diasumsikan/dikarang tanggalnya.

export type DailyDetailEmployeeInput = {
  daysPresent: number;
  baseSalary: number;
  partTimePay: number;
  overtimePay: number;
  incidentDeduction: number;
  warningLetterDeduction: number;
  lateDeduction: number;
  employee: {
    baseSalary: number | null;
    dailyMealRate: number | null;
    dailyTransportRate: number | null;
    dailyBaseRate: number | null;
  };
};

export type DailyDetailNote = { date: string | Date; category: string; amount: number; note: string | null };
export type DailyDetailAttendance = { date: string | Date; clockIn: string | Date | null; clockOut: string | Date | null };

export type DailyDetailRow = {
  date: string;
  hadir: boolean;
  clockIn: string | null;
  clockOut: string | null;
  overtimeMinutes: number;
  gajiPokok: number;
  gajiPartTime: number;
  uangMakan: number;
  uangTransport: number;
  lembur: number;
  potonganKejadian: number;
  potonganSP: number;
  potonganTelat: number;
  keterangan: string;
  masuk: number;
  keluar: number;
  net: number;
};

export type DailyDetailAdjustment = { label: string; amount: number };

export type DailyDetailResult = {
  rows: DailyDetailRow[];
  adjustments: DailyDetailAdjustment[];
  totalFromDaily: number;
};

function dateKey(d: string | Date): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

function timeUTC(d: string | Date | null): string | null {
  if (!d) return null;
  const s = typeof d === "string" ? d : d.toISOString();
  return s.slice(11, 16);
}

function listDatesBetween(startISO: string | Date, endISO: string | Date): string[] {
  const dates: string[] = [];
  const cur = new Date(dateKey(startISO));
  const end = new Date(dateKey(endISO));
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export function computeEmployeeDailyDetail(
  item: DailyDetailEmployeeInput,
  periodStart: string | Date,
  periodEnd: string | Date,
  notes: DailyDetailNote[],
  records: DailyDetailAttendance[]
): DailyDetailResult {
  const dailyMealRate = item.employee.dailyMealRate ?? 0;
  const dailyTransportRate = item.employee.dailyTransportRate ?? 0;
  const dailyBaseRate = item.employee.dailyBaseRate ?? 0;
  const rawDailyBaseSalary = (item.employee.baseSalary ?? 0) / OUTLET_PRORATE_STANDARD_DAYS;
  const overtimeRate = calcOutletOvertimeRate(dailyMealRate);

  let sumRoundedBase = 0;
  let sumRoundedOvertime = 0;
  let sumKejadian = 0;
  let sumSP = 0;
  let sumTelat = 0;

  const rows: DailyDetailRow[] = listDatesBetween(periodStart, periodEnd).map((d) => {
    const record = records.find((r) => dateKey(r.date) === d) ?? null;
    const hadir = !!record;
    const dayNotes = notes.filter((n) => dateKey(n.date) === d);
    const kejadian = dayNotes.filter((n) => n.category === "kejadian").reduce((s, n) => s + n.amount, 0);
    const sp = dayNotes.filter((n) => n.category === "sp").reduce((s, n) => s + n.amount, 0);
    const telat = dayNotes.filter((n) => n.category === "keterlambatan").reduce((s, n) => s + n.amount, 0);
    sumKejadian += kejadian;
    sumSP += sp;
    sumTelat += telat;

    let overtimeMinutes = 0;
    let rawLembur = 0;
    let gajiPokok = 0;
    let gajiPartTime = 0;
    let uangMakan = 0;
    let uangTransport = 0;

    if (hadir) {
      gajiPokok = rawDailyBaseSalary;
      gajiPartTime = dailyBaseRate;
      uangMakan = dailyMealRate;
      uangTransport = dailyTransportRate;
      if (record?.clockIn && record?.clockOut) {
        const inMs = new Date(record.clockIn).getTime();
        const outMs = new Date(record.clockOut).getTime();
        overtimeMinutes = Math.max(0, Math.round((outMs - inMs) / 60000 - 8 * 60));
      }
      rawLembur = overtimeRate * (overtimeMinutes / 60);
    }

    // Akumulasi dari nilai yang SUDAH dibulatkan per hari (bukan dari
    // angka mentah) - supaya total baris + penyesuaian selalu persis sama
    // dgn yang ditampilkan per baris, tidak selisih Rp1 gara-gara efek
    // pembulatan independen tiap hari (mis. 2 hari sama-sama "x,5" yang
    // keduanya dibulatkan ke atas).
    const roundedGajiPokok = Math.round(gajiPokok);
    const roundedLembur = Math.round(rawLembur);
    sumRoundedBase += roundedGajiPokok;
    sumRoundedOvertime += roundedLembur;

    const masuk = roundedGajiPokok + Math.round(gajiPartTime) + Math.round(uangMakan) + Math.round(uangTransport) + roundedLembur;
    const keluar = kejadian + sp + telat;

    return {
      date: d,
      hadir,
      clockIn: timeUTC(record?.clockIn ?? null),
      clockOut: timeUTC(record?.clockOut ?? null),
      overtimeMinutes,
      gajiPokok: roundedGajiPokok,
      gajiPartTime: Math.round(gajiPartTime),
      uangMakan: Math.round(uangMakan),
      uangTransport: Math.round(uangTransport),
      lembur: roundedLembur,
      potonganKejadian: kejadian,
      potonganSP: sp,
      potonganTelat: telat,
      keterangan: dayNotes.map((n) => `${labelForCategory(n.category)}${n.note ? ` - ${n.note}` : ""}`).join("; "),
      masuk,
      keluar,
      net: masuk - keluar,
    };
  });

  const adjustments: DailyDetailAdjustment[] = [];
  const baseDiff = item.baseSalary - sumRoundedBase;
  if (baseDiff !== 0) {
    adjustments.push({ label: "Penyesuaian Gaji Pokok (plafon gaji penuh, hari hadir > 24 hari tidak dihitung 2x)", amount: baseDiff });
  }
  const overtimeDiff = item.overtimePay - sumRoundedOvertime;
  if (overtimeDiff !== 0) {
    adjustments.push({ label: "Penyesuaian pembulatan Lembur", amount: overtimeDiff });
  }
  const kejadianDiff = item.incidentDeduction - sumKejadian;
  if (kejadianDiff !== 0) {
    adjustments.push({ label: "Penyesuaian Pengurangan Kejadian (diedit manual di luar catatan tanggal)", amount: kejadianDiff });
  }
  const spDiff = item.warningLetterDeduction - sumSP;
  if (spDiff !== 0) {
    adjustments.push({ label: "Penyesuaian Potongan SP (diedit manual di luar catatan tanggal)", amount: spDiff });
  }
  const telatDiff = item.lateDeduction - sumTelat;
  if (telatDiff !== 0) {
    adjustments.push({ label: "Penyesuaian Potongan Telat (diedit manual di luar catatan tanggal)", amount: telatDiff });
  }

  const totalFromDaily = rows.reduce((s, r) => s + r.net, 0) + adjustments.reduce((s, a) => s + a.amount, 0);

  return { rows, adjustments, totalFromDaily };
}

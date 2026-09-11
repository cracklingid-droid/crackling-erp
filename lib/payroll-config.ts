// Nilai default untuk perhitungan gaji otomatis - SEMUANYA cuma "saran awal"
// yang bisa diedit HR per periode/per karyawan, bukan aturan final. Angka
// BPJS & rumus lembur di bawah ini pakai acuan umum yang sering dipakai,
// tapi persentase & batas atas BPJS berubah-ubah mengikuti peraturan
// pemerintah - WAJIB dicek ulang sebelum dipakai resmi. PPh21 sengaja tidak
// dihitung otomatis (butuh status PTKP per karyawan yang belum ada di
// sistem) - selalu diisi manual dulu. Permintaan Kevin 2026-09-11.

// Standar hari kerja per bulan (Kepmenaker 102/2004) - dipakai utk hitung
// rate per jam dari gaji pokok: rate/jam = gaji pokok / (hari kerja x 8 jam).
export const STANDARD_WORK_HOURS_PER_MONTH = 173;

// Pengali lembur per jam dari rate/jam normal - default 1.5x utk semua jam
// lembur (simplifikasi; aturan resmi punya tingkatan 1.5x jam pertama, 2x
// jam berikutnya/hari libur - sesuaikan kalau kebijakan Crackling beda).
export const OVERTIME_MULTIPLIER = 1.5;

// Uang makan per hari hadir, dalam rupiah - default 0 (belum diisi) supaya
// tidak mengada-ada angka sebelum Kevin konfirmasi nominalnya.
export const DEFAULT_DAILY_MEAL_ALLOWANCE = 0;

// BPJS Kesehatan: potongan karyawan 1% dari gaji, dibatasi gaji maks
// Rp12.000.000 (acuan umum per aturan terakhir yang berlaku luas - CEK ULANG).
export const BPJS_KESEHATAN_EMPLOYEE_RATE = 0.01;
export const BPJS_KESEHATAN_SALARY_CAP = 12_000_000;

// BPJS Ketenagakerjaan (potongan karyawan): JHT 2% + JP 1% (JP dibatasi
// gaji maks - angka batas ini juga berubah tiap tahun, CEK ULANG).
export const BPJS_JHT_EMPLOYEE_RATE = 0.02;
export const BPJS_JP_EMPLOYEE_RATE = 0.01;
export const BPJS_JP_SALARY_CAP = 10_042_300;

export function calcHourlyRate(baseSalary: number): number {
  return baseSalary / STANDARD_WORK_HOURS_PER_MONTH;
}

export function calcOvertimePay(baseSalary: number, overtimeMinutes: number): number {
  const hourlyRate = calcHourlyRate(baseSalary);
  return Math.round(hourlyRate * OVERTIME_MULTIPLIER * (overtimeMinutes / 60));
}

export function calcBpjsKesehatan(baseSalary: number): number {
  const capped = Math.min(baseSalary, BPJS_KESEHATAN_SALARY_CAP);
  return Math.round(capped * BPJS_KESEHATAN_EMPLOYEE_RATE);
}

export function calcBpjsKetenagakerjaan(baseSalary: number): number {
  const jht = Math.round(baseSalary * BPJS_JHT_EMPLOYEE_RATE);
  const jpBase = Math.min(baseSalary, BPJS_JP_SALARY_CAP);
  const jp = Math.round(jpBase * BPJS_JP_EMPLOYEE_RATE);
  return jht + jp;
}

// 3 outlet tetap yang dipakai di seluruh sistem (form lamaran, Database
// Karyawan) - karyawan dgn outlet salah satu dari ini masuk kalkulator
// Payroll "outlet", selain itu (kosong/"Kantor"/dll) masuk "kantor".
export const OUTLET_NAMES = ["Joglo (Central Kitchen)", "Gading Serpong", "Kelapa Gading"];

export function employeeCategory(outlet: string | null): "outlet" | "kantor" {
  return outlet && OUTLET_NAMES.includes(outlet) ? "outlet" : "kantor";
}

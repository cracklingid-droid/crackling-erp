import * as XLSX from "xlsx";
import { toLocalDateString } from "./date-utils";
import type { AttendanceGroup } from "./attendance-parse";

// Parser khusus utk format laporan mesin fingerprint/absensi Kevin (contoh:
// "Lapora Kehadiran.xls") - BUKAN tabel flat 1 baris = 1 scan seperti file
// absensi pada umumnya, tapi laporan per-karyawan dalam blok² (3 karyawan
// per sheet, blok 15 kolom lebar), dengan 3 sesi per hari (Pagi/Siang/
// Lembur) yang masing² punya Jam Masuk & Jam Keluar sendiri. Sheet lain
// ("Pengaturan Shift...", "Analisa Kehadiran") diabaikan - cuma dipakai utk
// deteksi format, bukan sumber data absensi (biar konsisten sama arsitektur
// AttendanceRecord per-tanggal yang sudah ada, bukan pakai angka rekap
// mentah dari mesin). Permintaan Kevin 2026-09-11.
const BLOCK_WIDTH = 15;
const MASUK_COLS = [1, 2, 6, 7, 10, 11]; // offset relatif dari awal blok (Pagi/Siang/Lembur Jam Masuk)
const KELUAR_COLS = [3, 4, 5, 8, 9, 12, 13]; // offset relatif (Pagi/Siang/Lembur Jam Keluar)
const DETAIL_SHEET_MARKER = "Catatan Kehadiran Karyawan";

type SheetGrid = unknown[][];

function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return "";
  return String(v).trim();
}

function cellTimeOfDay(v: unknown): { h: number; m: number; s: number } | null {
  if (v instanceof Date) return { h: v.getUTCHours(), m: v.getUTCMinutes(), s: v.getUTCSeconds() };
  const text = cellText(v);
  const m = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]), s: Number(m[3] ?? "0") };
}

function parsePeriodStart(text: string): Date | null {
  const m = text.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

function sheetToGrid(sheet: XLSX.WorkSheet): SheetGrid {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
}

function isDetailSheet(grid: SheetGrid): boolean {
  return grid.slice(0, 5).some((row) => row.some((v) => cellText(v).includes(DETAIL_SHEET_MARKER)));
}

function findRow(grid: SheetGrid, maxRow: number, predicate: (row: unknown[]) => boolean): number {
  for (let i = 0; i < Math.min(maxRow, grid.length); i++) {
    if (predicate(grid[i])) return i;
  }
  return -1;
}

// Ekstrak absensi 1 blok karyawan (lebar BLOCK_WIDTH kolom) mulai dari
// kolom `base`. Return null kalau blok ini kosong/tidak ditemukan (dipakai
// utk tahu kapan berhenti nyoba blok berikutnya di sheet yang sama).
function extractBlock(grid: SheetGrid, base: number): AttendanceGroup[] | null {
  const infoRow = findRow(grid, 10, (row) => cellText(row[base]) === "Dept" && cellText(row[base + 8]) === "Nama");
  if (infoRow === -1) return null;
  const employeeName = cellText(grid[infoRow][base + 9]);
  if (!employeeName) return null;

  const periodRow = findRow(grid, 10, (row) => cellText(row[base]) === "Tanggal");
  const periodStart = periodRow !== -1 ? parsePeriodStart(cellText(grid[periodRow][base + 1])) : null;
  if (!periodStart) return null;

  const titleRow = findRow(grid, 15, (row) => cellText(row[base]).includes("Catatan Kehadiran"));
  if (titleRow === -1) return null;
  const dataStart = titleRow + 3; // judul, header sesi (Pagi/Siang/Lembur), header Jam Masuk/Keluar

  const groups: AttendanceGroup[] = [];
  for (let r = dataStart; r < grid.length; r++) {
    const row = grid[r];
    if (!row || cellText(row[base]) === "") break; // kolom tanggal kosong = sudah lewat data bulan ini

    const masukTimes = MASUK_COLS.map((c) => cellTimeOfDay(row[base + c])).filter((t): t is NonNullable<typeof t> => t != null);
    const keluarTimes = KELUAR_COLS.map((c) => cellTimeOfDay(row[base + c])).filter((t): t is NonNullable<typeof t> => t != null);
    if (masukTimes.length === 0 && keluarTimes.length === 0) continue; // tidak hadir hari itu

    const date = new Date(periodStart);
    date.setDate(date.getDate() + (r - dataStart));

    const toDate = (t: { h: number; m: number; s: number }) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), t.h, t.m, t.s);
    const allTimes = [...masukTimes, ...keluarTimes].map(toDate).sort((a, b) => a.getTime() - b.getTime());
    if (allTimes.length === 0) continue;

    groups.push({
      employeeName,
      date: toLocalDateString(date),
      clockIn: allTimes[0],
      clockOut: allTimes[allTimes.length - 1],
    });
  }
  return groups;
}

export function looksLikeAttendanceMachineReport(buffer: Buffer): boolean {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    return workbook.SheetNames.some((name) => isDetailSheet(sheetToGrid(workbook.Sheets[name])));
  } catch {
    return false;
  }
}

export type MachineReportResult = {
  groups: AttendanceGroup[];
  employeeNames: string[];
  periodStart: string | null;
  periodEnd: string | null;
};

export function parseAttendanceMachineReport(buffer: Buffer): MachineReportResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const groups: AttendanceGroup[] = [];
  const names = new Set<string>();
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  for (const sheetName of workbook.SheetNames) {
    const grid = sheetToGrid(workbook.Sheets[sheetName]);
    if (!isDetailSheet(grid)) continue;

    const periodTextRow = findRow(grid, 5, (row) => row.some((v) => cellText(v).includes("Tanggal Kehadiran:")));
    if (periodTextRow !== -1) {
      const text = grid[periodTextRow].map(cellText).find((v) => v.includes("Tanggal Kehadiran:")) ?? "";
      const m = text.match(/(\d{1,2}-\d{1,2}-\d{4})~(\d{1,2}-\d{1,2}-\d{4})/);
      if (m) {
        periodStart ??= toLocalDateString(parsePeriodStart(m[1])!);
        periodEnd = toLocalDateString(parsePeriodStart(m[2])!);
      }
    }

    const maxCols = grid.reduce((max, row) => Math.max(max, row.length), 0);
    for (let base = 0; base < maxCols; base += BLOCK_WIDTH) {
      const blockGroups = extractBlock(grid, base);
      if (blockGroups === null) break;
      for (const g of blockGroups) {
        groups.push(g);
        names.add(g.employeeName);
      }
    }
  }

  return { groups, employeeNames: Array.from(names), periodStart, periodEnd };
}

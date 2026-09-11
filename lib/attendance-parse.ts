import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { Readable } from "stream";
import { toLocalDateString } from "./date-utils";

// Baca file absensi (xls/xlsx/csv) jadi array baris (tiap baris = array
// string per kolom, sudah termasuk baris header). Dipakai baik utk preview
// kolom (HR pilih kolom mana = nama/tanggal/jam) maupun saat commit import.
// Mesin fingerprint/absensi banyak yang masih export format Excel lama
// (.xls, beda struktur total dari .xlsx) - exceljs cuma bisa baca .xlsx/csv,
// makanya .xls dibaca pakai library terpisah (xlsx/SheetJS). Permintaan
// Kevin 2026-09-11 (upload "Lapora Kehadiran.xls" gagal sebelumnya).
export async function parseAttendanceFile(buffer: Buffer, filename: string): Promise<string[][]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xls")) {
    return parseLegacyXls(buffer);
  }

  const workbook = new ExcelJS.Workbook();
  if (lower.endsWith(".csv")) {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    // exceljs's bundled types dan @types/node versi baru punya definisi
    // Buffer yang sedikit beda bentuk (generic ArrayBufferLike) - keduanya
    // sama-sama Buffer asli di runtime, cast ini cuma buat lewatin cek TS.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("File tidak punya sheet/data yang bisa dibaca");

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values = row.values as ExcelJS.CellValue[];
    rows.push(values.slice(1).map(cellToString));
  });
  return rows;
}

function parseLegacyXls(buffer: Buffer): string[][] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new Error("File .xls tidak bisa dibaca - kemungkinan rusak atau bukan file Excel yang valid");
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("File tidak punya sheet/data yang bisa dibaca");
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  return raw.map((row) => row.map(cellToString));
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    // exceljs menyimpan "jam dinding" sel tanggal Excel di komponen UTC
    // Date-nya (dokumentasi resmi exceljs), bukan di komponen lokal. Format
    // manual tanpa akhiran "Z" spy nanti di-parse ulang sbg waktu lokal apa
    // adanya (mis. 08:00 di Excel tetap jadi jam 08:00, bukan digeser+7 jam
    // gara-gara dikira UTC).
    const y = v.getUTCFullYear();
    const mo = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    const h = String(v.getUTCHours()).padStart(2, "0");
    const mi = String(v.getUTCMinutes()).padStart(2, "0");
    const s = String(v.getUTCSeconds()).padStart(2, "0");
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  }
  if (typeof v === "object") {
    if ("text" in v && v.text != null) return String(v.text);
    if ("result" in v && (v as { result?: unknown }).result != null) return String((v as { result: unknown }).result);
    return "";
  }
  return String(v).trim();
}

// Coba parse tanggal/waktu dari string dgn beberapa format umum - export
// absensi dari berbagai merk mesin fingerprint formatnya beda-beda, jadi ini
// best-effort. Baris yang gagal diparse dilewati & dihitung di ringkasan
// import, bukan bikin gagal semua (permintaan implisit: jangan diam-diam
// salah, tapi juga jangan berhenti total krn 1 baris rusak).
function parseDateTime(raw: string): Date | null {
  if (!raw) return null;
  const direct = new Date(raw);
  if (!isNaN(direct.getTime())) return direct;
  const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(year, Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

function parseTimeOfDay(raw: string): { h: number; m: number; s: number } | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]), s: Number(m[3] ?? "0") };
}

export type AttendanceMapping =
  | { mode: "combined"; nameColIndex: number; datetimeColIndex: number }
  | { mode: "separate"; nameColIndex: number; dateColIndex: number; clockInColIndex: number; clockOutColIndex: number | null };

export type AttendanceGroup = {
  employeeName: string;
  date: string; // YYYY-MM-DD
  clockIn: Date;
  clockOut: Date;
};

export function buildAttendanceGroups(
  rows: string[][],
  headerRowIndex: number,
  mapping: AttendanceMapping
): { groups: AttendanceGroup[]; skipped: number; totalRows: number } {
  const dataRows = rows.slice(headerRowIndex + 1);
  const perKey = new Map<string, { employeeName: string; date: string; times: Date[] }>();
  let skipped = 0;

  for (const row of dataRows) {
    const name = row[mapping.nameColIndex]?.trim();
    if (!name) continue;

    const found: Date[] = [];

    if (mapping.mode === "combined") {
      const dt = parseDateTime(row[mapping.datetimeColIndex] ?? "");
      if (dt) found.push(dt);
    } else {
      const dateBase = parseDateTime(row[mapping.dateColIndex] ?? "");
      if (dateBase) {
        const timeCols = [mapping.clockInColIndex, mapping.clockOutColIndex].filter(
          (i): i is number => i != null
        );
        for (const colIdx of timeCols) {
          const raw = row[colIdx] ?? "";
          const t = parseTimeOfDay(raw) ?? (() => {
            const full = parseDateTime(raw);
            return full ? { h: full.getHours(), m: full.getMinutes(), s: full.getSeconds() } : null;
          })();
          if (t) {
            found.push(new Date(dateBase.getFullYear(), dateBase.getMonth(), dateBase.getDate(), t.h, t.m, t.s));
          }
        }
      }
    }

    if (found.length === 0) {
      skipped++;
      continue;
    }

    const dateKey = toLocalDateString(found[0]);
    const key = `${name}|${dateKey}`;
    const existing = perKey.get(key);
    if (existing) {
      existing.times.push(...found);
    } else {
      perKey.set(key, { employeeName: name, date: dateKey, times: [...found] });
    }
  }

  const groups: AttendanceGroup[] = Array.from(perKey.values()).map((g) => {
    const sorted = [...g.times].sort((a, b) => a.getTime() - b.getTime());
    return { employeeName: g.employeeName, date: g.date, clockIn: sorted[0], clockOut: sorted[sorted.length - 1] };
  });

  return { groups, skipped, totalRows: dataRows.length };
}

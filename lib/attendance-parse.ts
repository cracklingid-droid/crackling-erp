import ExcelJS from "exceljs";
import { Readable } from "stream";

// Baca file absensi (xlsx/csv) jadi array baris (tiap baris = array string per
// kolom, sudah termasuk baris header). Dipakai baik utk preview kolom
// (HR pilih kolom mana = nama/tanggal/jam) maupun saat commit import.
export async function parseAttendanceFile(buffer: Buffer, filename: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  if (filename.toLowerCase().endsWith(".csv")) {
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

function cellToString(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
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

    const dateKey = found[0].toISOString().slice(0, 10);
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

import { prisma } from "./db";
import { dateKey } from "./roster";
import { getDefaultPeriodRange } from "./payroll-period-cycle";
import {
  SINGLE_SCAN_CUTOFF_HOUR,
  type AttendanceIssueType,
  type IssueResolutionStatus,
} from "./attendance-issue-types";

export type AttendanceIssue = {
  employeeId: number;
  employeeName: string;
  outlet: string | null;
  date: string; // YYYY-MM-DD
  type: AttendanceIssueType;
  clockIn: string | null; // HH:MM
  clockOut: string | null;
  resolution: {
    status: IssueResolutionStatus;
    note: string | null;
    resolvedByName: string | null;
    resolvedAt: string;
  } | null;
};

// Jam absensi disimpan sbg "jam dinding" di komponen UTC (konvensi seluruh
// sistem, lihat lib/payroll-daily-detail.ts).
function timeUTC(d: Date | null): string | null {
  return d ? d.toISOString().slice(11, 16) : null;
}

// Tentukan masalah 1 baris absensi. Import selalu mengisi clockIn & clockOut
// (scan pertama & terakhir), jadi scan tunggal muncul sbg jam yang kembar,
// bukan null - null tetap ditangani utk jaga-jaga data lama/input lain.
export function classifyAttendanceRecord(r: { clockIn: Date | null; clockOut: Date | null }): AttendanceIssueType | null {
  if (r.clockIn && r.clockOut) {
    if (r.clockIn.getTime() !== r.clockOut.getTime()) return null;
    return r.clockIn.getUTCHours() < SINGLE_SCAN_CUTOFF_HOUR ? "lupa_tap_out" : "lupa_tap_in";
  }
  if (r.clockIn) return "lupa_tap_out";
  if (r.clockOut) return "lupa_tap_in";
  return null;
}

// Rentang default lonceng & halaman daftar: awal periode gaji SEBELUMNYA s.d.
// hari ini - bukan cuma periode berjalan, supaya masalah periode lalu yang
// gajinya belum dibayar (gajian tgl 25, periode ganti tgl 21) tidak hilang
// dari lonceng begitu siklus baru mulai.
export function defaultIssueWindow(now: Date = new Date()): { start: Date; end: Date } {
  const current = getDefaultPeriodRange(now);
  const start = new Date(current.start.getFullYear(), current.start.getMonth() - 1, 21);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start, end };
}

// Daftar absen bermasalah karyawan aktif dalam 1 rentang tanggal:
// - lupa tap in/out: dari scan tunggal (lihat classifyAttendanceRecord)
// - tidak absen: Roster Kerja bilang "masuk" tapi tidak ada scan sama sekali.
//   Cuma dicek utk tanggal yang data absen OUTLET-nya sudah pernah diupload
//   (antara tanggal absensi pertama & terakhir outlet itu) - tiap outlet
//   punya mesin & jadwal upload sendiri, tanpa batas ini semua tanggal yang
//   filenya belum diupload bakal dianggap bolos.
// Masalah yang sudah ditandai HR (izin/sakit/cuti/diabaikan) disembunyikan,
// kecuali includeResolved.
export async function findAttendanceIssues(
  start: Date,
  end: Date,
  { includeResolved = false }: { includeResolved?: boolean } = {}
): Promise<AttendanceIssue[]> {
  const employees = await prisma.employee.findMany({
    where: { status: "active" },
    select: { id: true, name: true, outlet: true },
  });
  if (employees.length === 0) return [];
  const empById = new Map(employees.map((e) => [e.id, e]));
  const ids = employees.map((e) => e.id);

  const [records, rosterEntries, coverage, resolutions] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { employeeId: { in: ids }, date: { gte: start, lte: end } },
      select: { employeeId: true, date: true, clockIn: true, clockOut: true },
    }),
    prisma.rosterEntry.findMany({
      where: { employeeId: { in: ids }, isWorking: true, date: { gte: start, lte: end } },
      select: { employeeId: true, date: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["employeeId"],
      where: { employeeId: { in: ids } },
      _min: { date: true },
      _max: { date: true },
    }),
    prisma.attendanceIssueResolution.findMany({
      where: { employeeId: { in: ids }, date: { gte: start, lte: end } },
      include: { resolvedBy: { select: { name: true } } },
    }),
  ]);

  const outletCoverage = new Map<string, { min: number; max: number }>();
  for (const c of coverage) {
    const outlet = empById.get(c.employeeId)?.outlet;
    if (!outlet || !c._min.date || !c._max.date) continue;
    const min = c._min.date.getTime();
    const max = c._max.date.getTime();
    const cur = outletCoverage.get(outlet);
    outletCoverage.set(outlet, cur ? { min: Math.min(cur.min, min), max: Math.max(cur.max, max) } : { min, max });
  }

  const resolutionByKey = new Map(resolutions.map((r) => [`${r.employeeId}|${dateKey(r.date)}|${r.issueType}`, r]));
  const issues: AttendanceIssue[] = [];

  function addIssue(employeeId: number, date: Date, type: AttendanceIssueType, clockIn: string | null, clockOut: string | null) {
    const emp = empById.get(employeeId);
    if (!emp) return;
    const key = dateKey(date);
    const res = resolutionByKey.get(`${employeeId}|${key}|${type}`);
    if (res && !includeResolved) return;
    issues.push({
      employeeId,
      employeeName: emp.name,
      outlet: emp.outlet,
      date: key,
      type,
      clockIn,
      clockOut,
      resolution: res
        ? {
            status: res.status as IssueResolutionStatus,
            note: res.note,
            resolvedByName: res.resolvedBy?.name ?? null,
            resolvedAt: res.createdAt.toISOString(),
          }
        : null,
    });
  }

  const present = new Set<string>();
  for (const r of records) {
    present.add(`${r.employeeId}|${dateKey(r.date)}`);
    const type = classifyAttendanceRecord(r);
    if (type) addIssue(r.employeeId, r.date, type, timeUTC(r.clockIn), timeUTC(r.clockOut));
  }

  for (const entry of rosterEntries) {
    if (present.has(`${entry.employeeId}|${dateKey(entry.date)}`)) continue;
    const outlet = empById.get(entry.employeeId)?.outlet;
    const cov = outlet ? outletCoverage.get(outlet) : undefined;
    const t = entry.date.getTime();
    if (!cov || t < cov.min || t > cov.max) continue;
    addIssue(entry.employeeId, entry.date, "tidak_absen", null, null);
  }

  issues.sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));
  return issues;
}

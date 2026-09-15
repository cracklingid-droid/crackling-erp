import { NextResponse } from "next/server";
import { requireHrWriteUser } from "@/lib/hr-access";
import { defaultIssueWindow, findAttendanceIssues } from "@/lib/attendance-issues";
import { dateKey } from "@/lib/roster";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Daftar "Absen Perlu Dicek" (lupa tap in/out & tidak absen menurut Roster)
// - halaman /hr/payroll/absensi/masalah. Tanpa start/end = rentang default
// lonceng (awal periode gaji sebelumnya s.d. hari ini).
export async function GET(req: Request) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const url = new URL(req.url);
  const fallback = defaultIssueWindow();
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const start = startParam && DATE_RE.test(startParam) ? new Date(startParam) : fallback.start;
  const end = endParam && DATE_RE.test(endParam) ? new Date(endParam) : fallback.end;
  if (start > end) {
    return NextResponse.json({ error: "Tanggal mulai harus sebelum tanggal akhir" }, { status: 400 });
  }
  const includeResolved = url.searchParams.get("includeResolved") === "1";

  const issues = await findAttendanceIssues(start, end, { includeResolved });
  return NextResponse.json({ start: dateKey(start), end: dateKey(end), issues });
}

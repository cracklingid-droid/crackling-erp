import { NextResponse } from "next/server";
import { requireHrWriteUser } from "@/lib/hr-access";
import { defaultIssueWindow, findAttendanceIssues } from "@/lib/attendance-issues";

// Angka di lonceng header - jumlah absen bermasalah yang belum ditangani HR.
export async function GET() {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const { start, end } = defaultIssueWindow();
  const issues = await findAttendanceIssues(start, end);
  return NextResponse.json({ count: issues.length });
}

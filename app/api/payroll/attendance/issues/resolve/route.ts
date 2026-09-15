import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrWriteUser } from "@/lib/hr-access";
import { ATTENDANCE_ISSUE_TYPES, ISSUE_RESOLUTION_STATUSES } from "@/lib/attendance-issue-types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseKey(employeeIdRaw: unknown, dateRaw: unknown, issueTypeRaw: unknown) {
  const employeeId = Number(employeeIdRaw);
  const date = typeof dateRaw === "string" && DATE_RE.test(dateRaw) ? new Date(dateRaw) : null;
  const issueType = (ATTENDANCE_ISSUE_TYPES as readonly string[]).includes(String(issueTypeRaw)) ? String(issueTypeRaw) : null;
  if (!employeeId || !date || isNaN(date.getTime()) || !issueType) return null;
  return { employeeId, date, issueType };
}

// Tandai 1 masalah absen sbg izin/sakit/cuti/diabaikan (bukan diselesaikan
// dgn isi jam manual) - masalah hilang dari lonceng. Permintaan 2026-09-15.
export async function POST(req: Request) {
  const { user, error } = await requireHrWriteUser();
  if (error) return error;

  const body = await req.json();
  const key = parseKey(body.employeeId, body.date, body.issueType);
  if (!key) {
    return NextResponse.json({ error: "Data masalah absen tidak valid" }, { status: 400 });
  }
  const status = String(body.status);
  if (!(ISSUE_RESOLUTION_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  const resolution = await prisma.attendanceIssueResolution.upsert({
    where: { employeeId_date_issueType: key },
    update: { status, note, resolvedById: user.id },
    create: { ...key, status, note, resolvedById: user.id },
  });
  return NextResponse.json(resolution);
}

// Batalkan tanda di atas (masalah muncul lagi di lonceng).
export async function DELETE(req: Request) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const key = parseKey(searchParams.get("employeeId"), searchParams.get("date"), searchParams.get("issueType"));
  if (!key) {
    return NextResponse.json({ error: "Data masalah absen tidak valid" }, { status: 400 });
  }
  await prisma.attendanceIssueResolution.deleteMany({ where: key });
  return NextResponse.json({ ok: true });
}

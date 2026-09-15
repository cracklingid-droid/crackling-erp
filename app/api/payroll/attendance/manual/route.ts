import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrWriteUser } from "@/lib/hr-access";
import { recalcOverlappingOutletPeriods } from "@/lib/attendance-recalc";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Isi/koreksi absen manual oleh HR dari halaman Absen Perlu Dicek (karyawan
// lupa tap in/out atau tidak scan sama sekali) - permintaan 2026-09-15.
// Jam disimpan sbg jam dinding di komponen UTC (konvensi seluruh sistem).
// Baris ditandai manualAt/manualById supaya upload ulang file mesin yang
// sama TIDAK menimpa koreksi ini (lihat import route).
export async function POST(req: Request) {
  const { user, error } = await requireHrWriteUser();
  if (error) return error;

  const body = await req.json();
  const employeeId = Number(body.employeeId);
  const dateMatch = typeof body.date === "string" ? DATE_RE.exec(body.date) : null;
  const inMatch = typeof body.clockIn === "string" ? TIME_RE.exec(body.clockIn) : null;
  const outMatch = typeof body.clockOut === "string" ? TIME_RE.exec(body.clockOut) : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (!employeeId || !dateMatch) {
    return NextResponse.json({ error: "Karyawan atau tanggal tidak valid" }, { status: 400 });
  }
  if (!inMatch || !outMatch) {
    return NextResponse.json({ error: "Jam masuk & jam pulang wajib diisi (format JJ:MM)" }, { status: 400 });
  }

  const [y, mo, d] = [Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])];
  const date = new Date(Date.UTC(y, mo, d));
  if (date.getUTCMonth() !== mo || date.getUTCDate() !== d) {
    return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
  }
  const clockIn = new Date(Date.UTC(y, mo, d, Number(inMatch[1]), Number(inMatch[2])));
  const clockOut = new Date(Date.UTC(y, mo, d, Number(outMatch[1]), Number(outMatch[2])));
  if (clockOut <= clockIn) {
    return NextResponse.json({ error: "Jam pulang harus setelah jam masuk" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) {
    return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
  }

  const manual = { clockIn, clockOut, manualById: user.id, manualNote: note, manualAt: new Date() };
  await prisma.$transaction([
    prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: manual,
      create: { employeeId, date, ...manual },
    }),
    // Tanda izin/sakit/diabaikan sebelumnya utk tanggal ini tidak relevan
    // lagi begitu jam absennya diisi.
    prisma.attendanceIssueResolution.deleteMany({ where: { employeeId, date } }),
  ]);

  const recalculatedPeriods = await recalcOverlappingOutletPeriods([date]);
  const finalPeriods = await prisma.payrollPeriod.findMany({
    where: { status: "final", startDate: { lte: date }, endDate: { gte: date } },
    select: { label: true },
  });

  return NextResponse.json({ ok: true, recalculatedPeriods, finalPeriods: finalPeriods.map((p) => p.label) });
}

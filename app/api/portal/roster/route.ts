import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentEmployee } from "@/lib/current-employee";
import { getWeekDates, dateKey } from "@/lib/roster";

// Roster milik sendiri (bukan seluruh outlet) - lebih privat drpd link
// publik /roster/[slug] yang menampilkan semua karyawan 1 outlet.
// Permintaan Kevin 2026-09-12.
export async function GET(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const anchorParam = searchParams.get("weekStart");
  const anchor = anchorParam ? new Date(anchorParam) : new Date();
  const days = getWeekDates(anchor);

  const entries = await prisma.rosterEntry.findMany({
    where: { employeeId: employee.id, date: { gte: days[0], lte: days[6] } },
    select: { date: true, isWorking: true },
  });

  return NextResponse.json({
    outlet: employee.outlet,
    days: days.map(dateKey),
    entries: entries.map((e) => ({ date: dateKey(e.date), isWorking: e.isWorking })),
  });
}

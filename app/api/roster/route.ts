import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getWeekDates, dateKey, ROSTER_OUTLETS } from "@/lib/roster";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const outlet = searchParams.get("outlet") ?? "";
  if (!ROSTER_OUTLETS.includes(outlet)) {
    return NextResponse.json({ error: "Outlet tidak valid" }, { status: 400 });
  }
  const anchorParam = searchParams.get("weekStart");
  const anchor = anchorParam ? new Date(anchorParam) : new Date();
  const days = getWeekDates(anchor);

  const employees = await prisma.employee.findMany({
    where: { outlet, status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const entries = await prisma.rosterEntry.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: days[0], lte: days[6] },
    },
    select: { employeeId: true, date: true, isWorking: true },
  });

  return NextResponse.json({
    outlet,
    days: days.map(dateKey),
    employees,
    entries: entries.map((e) => ({ employeeId: e.employeeId, date: dateKey(e.date), isWorking: e.isWorking })),
  });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const employeeId = Number(body.employeeId);
  const date = typeof body.date === "string" ? new Date(body.date) : null;
  if (!employeeId || !date || isNaN(date.getTime())) {
    return NextResponse.json({ error: "employeeId/date tidak valid" }, { status: 400 });
  }

  if (body.isWorking === null) {
    await prisma.rosterEntry.deleteMany({ where: { employeeId, date } });
    return NextResponse.json({ ok: true });
  }

  if (typeof body.isWorking !== "boolean") {
    return NextResponse.json({ error: "isWorking harus boolean atau null" }, { status: 400 });
  }

  const entry = await prisma.rosterEntry.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { isWorking: body.isWorking, createdById: user.id },
    create: { employeeId, date, isWorking: body.isWorking, createdById: user.id },
  });
  return NextResponse.json(entry);
}

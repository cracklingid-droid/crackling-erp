import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWeekDates, dateKey, slugToOutlet } from "@/lib/roster";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const outlet = slugToOutlet(slug);
  if (!outlet) return NextResponse.json({ error: "Link roster tidak valid" }, { status: 404 });

  const { searchParams } = new URL(req.url);
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: Number(id) },
    include: {
      items: {
        include: { employee: { select: { id: true, name: true, position: true, outlet: true } } },
        orderBy: { employee: { name: "asc" } },
      },
    },
  });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });
  return NextResponse.json(period);
}

const VALID_STATUS = ["draft", "final"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.label === "string") data.label = body.label.trim();
  if (typeof body.status === "string") {
    if (!VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
    }
    data.status = body.status;
  }

  const period = await prisma.payrollPeriod.update({ where: { id: Number(id) }, data });
  return NextResponse.json(period);
}

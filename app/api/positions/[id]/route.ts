import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const position = await prisma.position.findUnique({
    where: { id: Number(id) },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!position) return NextResponse.json({ error: "Posisi tidak ditemukan" }, { status: 404 });
  return NextResponse.json(position);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (Number.isFinite(body.passingScore)) data.passingScore = Math.max(0, Math.min(100, body.passingScore));
  if (typeof body.requiresKitchenTerms === "boolean") data.requiresKitchenTerms = body.requiresKitchenTerms;
  if (typeof body.isOfficePosition === "boolean") data.isOfficePosition = body.isOfficePosition;

  const position = await prisma.position.update({ where: { id: Number(id) }, data });
  return NextResponse.json(position);
}

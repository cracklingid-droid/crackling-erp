import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

// Catatan atas Laporan Keuangan (CALK) per bulan - teks bebas, v1 ditulis
// manual (lihat plan). GET ?yearMonth=YYYY-MM, PUT {yearMonth, content}.
const YM = /^\d{4}-\d{2}$/;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const yearMonth = new URL(req.url).searchParams.get("yearMonth") ?? "";
  if (!YM.test(yearMonth)) return NextResponse.json({ error: "yearMonth tidak valid" }, { status: 400 });
  const note = await prisma.accountingNote.findUnique({ where: { yearMonth } });
  return NextResponse.json({ yearMonth, content: note?.content ?? "", updatedAt: note?.updatedAt ?? null });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const yearMonth = typeof body.yearMonth === "string" ? body.yearMonth : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!YM.test(yearMonth)) return NextResponse.json({ error: "yearMonth tidak valid" }, { status: 400 });

  const note = await prisma.accountingNote.upsert({ where: { yearMonth }, update: { content }, create: { yearMonth, content } });
  return NextResponse.json(note);
}

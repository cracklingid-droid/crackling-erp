import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { itemFieldForCategory } from "@/lib/payroll-event-notes";

// Catat kejadian/telat/SP di tanggal tertentu - otomatis menambah field
// potongan terkait di PayrollItem (mis. kejadian -> incidentDeduction),
// SEKALIGUS tersimpan sbg baris rincian tanggal di halaman Rincian
// Perhitungan. Permintaan Kevin 2026-09-11.
export async function POST(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id, itemId } = await ctx.params;
  const period = await prisma.payrollPeriod.findUnique({ where: { id: Number(id) }, select: { status: true } });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });
  if (period.status === "final") {
    return NextResponse.json({ error: "Periode ini sudah difinalisasi, tidak bisa diedit lagi" }, { status: 400 });
  }

  const body = await req.json();
  const date = body.date ? new Date(body.date) : null;
  const category = typeof body.category === "string" ? body.category : "";
  const amount = Number(body.amount);
  const note = typeof body.note === "string" ? body.note.trim() || null : null;
  const itemField = itemFieldForCategory(category);

  if (!date || isNaN(date.getTime()) || !itemField || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Tanggal, kategori, dan jumlah wajib diisi dengan benar" }, { status: 400 });
  }

  const item = await prisma.payrollItem.findUnique({ where: { id: Number(itemId) } });
  if (!item || item.periodId !== Number(id)) {
    return NextResponse.json({ error: "Data periode gaji tidak ditemukan" }, { status: 404 });
  }

  const [eventNote] = await prisma.$transaction([
    prisma.payrollEventNote.create({
      data: { periodId: Number(id), employeeId: item.employeeId, date, category, amount, note, createdById: user.id },
    }),
    prisma.payrollItem.update({
      where: { id: Number(itemId) },
      data: { [itemField]: { increment: amount } },
    }),
  ]);

  return NextResponse.json(eventNote, { status: 201 });
}

import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : "";
  const type = typeof body.type === "string" ? body.type : "";
  if (!fileUrl || !type) {
    return NextResponse.json({ error: "Data dokumen tidak lengkap" }, { status: 400 });
  }

  const doc = await prisma.employeeDocument.create({
    data: {
      employeeId: Number(id),
      type,
      fileUrl,
      fileName: body.fileName || null,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
    },
  });
  return NextResponse.json(doc, { status: 201 });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const docId = Number(body.documentId);
  if (!docId) return NextResponse.json({ error: "ID dokumen wajib diisi" }, { status: 400 });

  const doc = await prisma.employeeDocument.findUnique({ where: { id: docId } });
  if (doc) {
    try {
      await del(doc.fileUrl);
    } catch (e) {
      console.error(`Gagal hapus dokumen #${docId} dari Blob storage:`, e);
    }
  }
  await prisma.employeeDocument.delete({ where: { id: docId } });
  return NextResponse.json({ ok: true });
}

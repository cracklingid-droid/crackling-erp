import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const employees = await prisma.employee.findMany({
    include: { documents: { select: { type: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(employees);
}

// Tambah karyawan manual - untuk karyawan lama yang tidak lewat pipeline
// Rekrutmen. Cukup nama dulu, sisa data dilengkapi di halaman detail.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nama karyawan wajib diisi" }, { status: 400 });

  const employee = await prisma.employee.create({
    data: {
      name,
      email: body.email || null,
      phone: body.phone || null,
      createdById: user.id,
    },
  });
  return NextResponse.json(employee, { status: 201 });
}

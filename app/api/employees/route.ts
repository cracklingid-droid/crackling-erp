import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrReadUser, requireHrWriteUser } from "@/lib/hr-access";
import { hasHrWriteAccess } from "@/lib/roles";
import { employeeCategory } from "@/lib/payroll-config";

export async function GET() {
  const { user, error } = await requireHrReadUser();
  if (error) return error;

  const employees = await prisma.employee.findMany({
    include: { documents: { select: { type: true } } },
    orderBy: { createdAt: "desc" },
  });

  // "manager" cuma boleh lihat Database Karyawan Resto (view-only,
  // permintaan Kevin 2026-09-13) - Kantor disaring keluar sebelum dikirim.
  const scoped = hasHrWriteAccess(user) ? employees : employees.filter((e) => employeeCategory(e.outlet) === "outlet");
  return NextResponse.json(scoped);
}

// Tambah karyawan manual - untuk karyawan lama yang tidak lewat pipeline
// Rekrutmen. Cukup nama dulu, sisa data dilengkapi di halaman detail.
export async function POST(req: Request) {
  const { user, error } = await requireHrWriteUser();
  if (error) return error;

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

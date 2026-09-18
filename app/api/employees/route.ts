import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrReadUser, requireHrWriteUser } from "@/lib/hr-access";
import { hasHrWriteAccess } from "@/lib/roles";
import { OUTLET_NAMES } from "@/lib/payroll-config";

export async function GET() {
  const { user, error } = await requireHrReadUser();
  if (error) return error;

  // "manager" cuma boleh lihat Database Karyawan Resto (view-only,
  // permintaan Kevin 2026-09-13) - disaring lewat WHERE di query, bukan
  // fetch semua kolom+baris dulu baru filter di JS (pola rapuh: perubahan
  // response di masa depan bisa lupa filter & bocorkan PII karyawan Kantor
  // ke manager - ditemukan saat audit 2026-09-18, sama bentuknya dgn bug
  // nyata yang pernah ada di Crackling Warehouse).
  //
  // select eksplisit jg sengaja dipersempit ke field yang benar2 dipakai
  // halaman list (lihat type Employee di app/(app)/hr/karyawan/page.tsx) -
  // field sensitif lain (gaji, deposit, rate payroll, portalPasswordEnc,
  // dst) TIDAK ikut terkirim ke browser utk halaman ini.
  const employees = await prisma.employee.findMany({
    where: hasHrWriteAccess(user) ? undefined : { outlet: { in: OUTLET_NAMES } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      employeeCode: true,
      position: true,
      outlet: true,
      employmentStatus: true,
      status: true,
      photoUrl: true,
      ktpNumber: true,
      address: true,
      birthDate: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
      npwp: true,
      bpjsKesehatanNumber: true,
      bpjsKetenagakerjaanNumber: true,
      documents: { select: { type: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(employees);
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

// Sinkron kontak tipe EMPLOYEE dari tabel Employee HR - permintaan Kevin
// 2026-09-15 ("masukan semua daftar kontak karyawan, ikuti juga statusnya
// masih bekerja atau tidak"). Idempoten by employeeId: nama/telepon/email
// diperbarui, isActive ikut Employee.status (resigned = nonaktif; onboarding
// & active = aktif). Kontak EMPLOYEE yang dibuat manual (tanpa employeeId)
// tidak disentuh.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, phone: true, email: true, status: true, position: true, outlet: true },
    orderBy: { name: "asc" },
  });

  let created = 0;
  let updated = 0;
  let active = 0;
  let inactive = 0;
  for (const e of employees) {
    const isActive = e.status !== "resigned";
    if (isActive) active++;
    else inactive++;
    const data = {
      name: e.name,
      type: "EMPLOYEE",
      phone: e.phone ?? null,
      email: e.email ?? null,
      address: [e.position, e.outlet].filter(Boolean).join(" - ") || null,
      isActive,
    };
    const existing = await prisma.contact.findUnique({ where: { employeeId: e.id } });
    if (existing) {
      await prisma.contact.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.contact.create({ data: { ...data, employeeId: e.id } });
      created++;
    }
  }

  return NextResponse.json({ ok: true, total: employees.length, created, updated, active, inactive });
}

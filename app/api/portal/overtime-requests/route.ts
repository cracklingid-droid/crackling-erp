import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentEmployee } from "@/lib/current-employee";
import { isSpvPosition } from "@/lib/roles";

// Pengajuan Lembur SPV (Portal Karyawan) - permintaan Kevin 2026-09-14:
// "jika posisi spv ada menu bisa mengajukan lembur. wajib melampirkan foto
// ... approval manager dan hr". Sifatnya cuma catatan administratif (BUKAN
// input yang mengubah perhitungan lembur payroll - itu tetap manual/
// otomatis dari absensi seperti sebelumnya).
export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const requests = await prisma.overtimeRequest.findMany({
    where: { employeeId: employee.id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(requests);
}

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!isSpvPosition(employee.position)) {
    return NextResponse.json({ error: "Fitur Lembur hanya utk posisi SPV" }, { status: 403 });
  }

  const body = await req.json();
  const { date, reason, photoUrl } = body as { date?: string; reason?: string; photoUrl?: string };

  if (!date) return NextResponse.json({ error: "Tanggal wajib diisi" }, { status: 400 });
  if (!reason || !reason.trim()) return NextResponse.json({ error: "Keterangan alasan wajib diisi" }, { status: 400 });
  // Foto wajib - bukan opsional. Permintaan eksplisit Kevin: "foto ini
  // dilampirkan sifatnya wajib".
  if (!photoUrl) return NextResponse.json({ error: "Foto pekerjaan wajib dilampirkan" }, { status: 400 });

  const created = await prisma.overtimeRequest.create({
    data: {
      employeeId: employee.id,
      date: new Date(date),
      reason: reason.trim(),
      photoUrl,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

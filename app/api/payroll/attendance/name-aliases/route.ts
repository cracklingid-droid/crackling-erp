import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { normalizeName } from "@/lib/attendance-name-match";

// Daftar alias nama mesin absensi -> karyawan yang sudah dikonfirmasi HR -
// dipakai halaman kelola alias (permintaan Kevin 2026-09-12) & referensi
// saat mencocokkan upload absensi berikutnya (lihat parse & import route).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const aliases = await prisma.attendanceNameAlias.findMany({
    include: { employee: { select: { id: true, name: true, outlet: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(aliases);
}

// Simpan konfirmasi HR bahwa 1 nama dari mesin absen = 1 karyawan tertentu
// - dipanggil dari preview upload absensi (saat HR klik "Ya, ini dia" di
// saran pencocokan) maupun dari halaman kelola alias (tambah manual).
// Upsert by machineName (normalized) supaya kalau HR salah pilih & benerin
// lagi, tidak numpuk alias ganda utk nama mesin yang sama.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const machineNameRaw = typeof body.machineName === "string" ? body.machineName : "";
  const employeeId = Number(body.employeeId);
  const machineName = normalizeName(machineNameRaw);
  if (!machineName || !Number.isFinite(employeeId)) {
    return NextResponse.json({ error: "Nama mesin absen dan karyawan wajib diisi" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

  const alias = await prisma.attendanceNameAlias.upsert({
    where: { machineName },
    update: { employeeId, createdById: user.id },
    create: { machineName, employeeId, createdById: user.id },
    include: { employee: { select: { id: true, name: true, outlet: true } } },
  });
  return NextResponse.json(alias, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

// Daftar kontrak & dokumen karyawan yang segera (atau sudah) jatuh tempo -
// ditampilkan sbg kartu di Database Karyawan. Sengaja cuma daftar di
// dashboard (bukan email otomatis) sesuai keputusan Kevin 2026-09-12.
const WINDOW_DAYS = 30;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const until = new Date();
  until.setDate(until.getDate() + WINDOW_DAYS);

  const [contracts, documents] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "active", contractEndDate: { lte: until } },
      select: { id: true, name: true, outlet: true, position: true, contractEndDate: true },
      orderBy: { contractEndDate: "asc" },
    }),
    prisma.employeeDocument.findMany({
      where: { expiryDate: { lte: until }, employee: { status: "active" } },
      select: {
        id: true,
        type: true,
        expiryDate: true,
        employeeId: true,
        employee: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    }),
  ]);

  return NextResponse.json({ contracts, documents });
}

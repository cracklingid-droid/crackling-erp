import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/current-employee";

// Profil read-only utk Portal Karyawan - sengaja cuma field biodata umum
// (bukan gaji/bank/NPWP/dst) walaupun Employee-nya sendiri yang login,
// supaya tidak ada risiko field lain kebuka ke depan tanpa sengaja kalau
// model Employee nambah field baru. Permintaan Kevin 2026-09-12 (portal
// baru sebatas "lihat saja").
export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  return NextResponse.json({
    name: employee.name,
    employeeCode: employee.employeeCode,
    photoUrl: employee.photoUrl,
    email: employee.email,
    phone: employee.phone,
    birthPlace: employee.birthPlace,
    birthDate: employee.birthDate,
    gender: employee.gender,
    address: employee.address,
    position: employee.position,
    outlet: employee.outlet,
    employmentStatus: employee.employmentStatus,
    joinDate: employee.joinDate,
    status: employee.status,
  });
}

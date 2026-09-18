import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentEmployee } from "@/lib/current-employee";
import { encryptPortalPassword } from "@/lib/portal-password-crypto";

// Dipakai baik utk kewajiban ganti password pertama kali (portalPasswordEnc
// masih null) maupun ganti password susulan kapan pun - keduanya karyawan
// yang sama, jadi tidak perlu endpoint terpisah. Permintaan Kevin 2026-09-18.
export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const newPassword = typeof body.newPassword === "string" ? body.newPassword.trim() : "";
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: { portalPasswordEnc: encryptPortalPassword(newPassword) },
  });
  return NextResponse.json({ ok: true });
}

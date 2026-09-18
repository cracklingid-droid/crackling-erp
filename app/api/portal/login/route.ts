import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createEmployeeSessionToken, COOKIE_NAME, MAX_AGE_SECONDS } from "@/lib/employee-session";
import { derivePortalPassword, canUsePortal } from "@/lib/employee-portal";
import { decryptPortalPassword } from "@/lib/portal-password-crypto";

export async function POST(req: Request) {
  const body = await req.json();
  const username = typeof body.username === "string" ? body.username.trim().toUpperCase() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";
  if (!username || !password) {
    return NextResponse.json({ error: "ID dan password wajib diisi" }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { employeeCode: { equals: username, mode: "insensitive" } },
  });
  // Karyawan resign otomatis kehilangan akses portal - tidak boleh
  // bergantung pada HR mencentang checklist offboarding manual dulu.
  // Permintaan Kevin 2026-09-17.
  if (!employee || employee.status === "resigned" || !canUsePortal(employee)) {
    return NextResponse.json({ error: "ID atau password salah" }, { status: 401 });
  }

  // Kalau karyawan sudah pernah ganti password sendiri (portalPasswordEnc
  // terisi), itu yang berlaku - password default (kode+tahun lahir) tidak
  // bisa dipakai lagi login kecuali HR reset. Perbandingan password custom
  // case-sensitive (beda dari default, yang sengaja case-insensitive spy
  // gampang diketik). Permintaan Kevin 2026-09-18.
  let ok: boolean;
  if (employee.portalPasswordEnc) {
    const current = decryptPortalPassword(employee.portalPasswordEnc);
    ok = current !== null && password === current;
  } else {
    const expected = derivePortalPassword(employee.employeeCode!, employee.birthDate!);
    ok = password.toUpperCase() === expected.toUpperCase();
  }
  if (!ok) {
    return NextResponse.json({ error: "ID atau password salah" }, { status: 401 });
  }

  const token = createEmployeeSessionToken({ employeeId: employee.id, employeeCode: employee.employeeCode!, name: employee.name });
  const res = NextResponse.json({
    id: employee.id,
    name: employee.name,
    employeeCode: employee.employeeCode,
    mustResetPassword: !employee.portalPasswordEnc,
  });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return res;
}

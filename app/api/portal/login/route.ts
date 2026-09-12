import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createEmployeeSessionToken, COOKIE_NAME, MAX_AGE_SECONDS } from "@/lib/employee-session";
import { derivePortalPassword, canUsePortal } from "@/lib/employee-portal";

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
  if (!employee || !canUsePortal(employee)) {
    return NextResponse.json({ error: "ID atau password salah" }, { status: 401 });
  }

  const expected = derivePortalPassword(employee.employeeCode!, employee.birthDate!);
  if (password.toUpperCase() !== expected.toUpperCase()) {
    return NextResponse.json({ error: "ID atau password salah" }, { status: 401 });
  }

  const token = createEmployeeSessionToken({ employeeId: employee.id, employeeCode: employee.employeeCode!, name: employee.name });
  const res = NextResponse.json({ id: employee.id, name: employee.name, employeeCode: employee.employeeCode });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return res;
}

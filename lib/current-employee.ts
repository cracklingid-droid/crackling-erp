import { prisma } from "./db";
import { getEmployeeSession } from "./employee-session";

export async function getCurrentEmployee() {
  const session = await getEmployeeSession();
  if (!session) return null;
  const employee = await prisma.employee.findUnique({ where: { id: session.employeeId } });
  // Session portal cookie berlaku 30 hari - kalau karyawan resign SETELAH
  // login, sesi lamanya harus langsung mati juga, bukan cuma diblokir saat
  // login berikutnya. Permintaan Kevin 2026-09-17.
  if (!employee || employee.status === "resigned") return null;
  return employee;
}

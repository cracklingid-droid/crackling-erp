import { prisma } from "./db";
import { getEmployeeSession } from "./employee-session";

export async function getCurrentEmployee() {
  const session = await getEmployeeSession();
  if (!session) return null;
  const employee = await prisma.employee.findUnique({ where: { id: session.employeeId } });
  if (!employee) return null;
  return employee;
}

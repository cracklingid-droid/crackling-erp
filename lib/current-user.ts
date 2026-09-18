import { prisma } from "./db";
import { getSession } from "./session";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.hrUser.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  return user;
}

export { hasFullAccess, canAccessCostCenter } from "./roles";

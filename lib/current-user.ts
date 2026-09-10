import { prisma } from "./db";
import { getSession } from "./session";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.hrUser.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  return user;
}

// owner & developer selalu akses penuh ke semua modul HR.
export function hasFullAccess(user: { role: string }): boolean {
  return user.role === "owner" || user.role === "developer";
}

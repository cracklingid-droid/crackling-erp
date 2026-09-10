import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function ensureUser(username: string, name: string, plainPassword: string, role: string) {
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  await prisma.hrUser.upsert({
    where: { username },
    update: { name, passwordHash, role },
    create: { name, username, passwordHash, role },
  });
}

async function main() {
  // owner & developer selalu punya akun di sini juga (permintaan Kevin
  // 2026-09-10) - akses penuh ke semua modul HR. hr_manager akun kerja
  // sehari-hari buat urus rekrutmen dst.
  await ensureUser("owner", "Owner", "erpOwner026", "owner");
  await ensureUser("developer", "Developer", "erpDev026", "developer");
  await ensureUser("hr_manager", "HR Manager", "erpHr026", "hr_manager");

  console.log("Seed HR selesai. Login:");
  console.log("  owner / erpOwner026        - akses penuh");
  console.log("  developer / erpDev026      - akses penuh (testing)");
  console.log("  hr_manager / erpHr026      - kerja harian HR (rekrutmen dst)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { prefixForOutlet } from "@/lib/employee-code";

// Saran kode ID karyawan berikutnya utk 1 outlet (GS-0001 dst) - dihitung
// dari kode tertinggi yang sudah dipakai, bukan direservasi di sini (baru
// benar-benar dipakai kalau HR simpan). Permintaan Kevin 2026-09-12.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const url = new URL(req.url);
  const outlet = url.searchParams.get("outlet");
  const prefix = prefixForOutlet(outlet);
  if (!prefix) {
    return NextResponse.json({ error: "Outlet ini belum punya prefiks kode ID otomatis" }, { status: 400 });
  }

  const existing = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: `${prefix}-` } },
    select: { employeeCode: true },
  });
  let max = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  for (const e of existing) {
    const m = e.employeeCode?.match(pattern);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const code = `${prefix}-${String(max + 1).padStart(4, "0")}`;
  return NextResponse.json({ code });
}

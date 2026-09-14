import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

const VALID_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });
  return NextResponse.json(accounts);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  const subType = typeof body.subType === "string" && body.subType.trim() ? body.subType.trim() : null;
  const parentId = Number.isInteger(body.parentId) ? body.parentId : null;

  if (!code) return NextResponse.json({ error: "Kode akun wajib diisi" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Nama akun wajib diisi" }, { status: 400 });
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Tipe akun tidak valid" }, { status: 400 });

  const existing = await prisma.account.findUnique({ where: { code } });
  if (existing) return NextResponse.json({ error: `Kode akun "${code}" sudah dipakai` }, { status: 400 });

  const account = await prisma.account.create({ data: { code, name, type, subType, parentId } });
  return NextResponse.json(account, { status: 201 });
}

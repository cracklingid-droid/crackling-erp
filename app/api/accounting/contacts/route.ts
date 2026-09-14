import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

const VALID_TYPES = ["CUSTOMER", "VENDOR", "EMPLOYEE", "OTHER"];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const includeInactive = searchParams.get("includeInactive") === "1";

  // Default hanya kontak aktif; ?includeInactive=1 utk tampilkan semua
  const contacts = await prisma.contact.findMany({
    where: {
      ...(type && VALID_TYPES.includes(type) ? { type } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(contacts);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  const address = typeof body.address === "string" && body.address.trim() ? body.address.trim() : null;

  if (!name) return NextResponse.json({ error: "Nama kontak wajib diisi" }, { status: 400 });
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Tipe kontak tidak valid" }, { status: 400 });

  const contact = await prisma.contact.create({ data: { name, type, phone, email, address } });
  return NextResponse.json(contact, { status: 201 });
}

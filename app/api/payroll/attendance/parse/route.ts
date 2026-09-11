import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { parseAttendanceFile } from "@/lib/attendance-parse";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseAttendanceFile(buffer, file.name);
    if (rows.length === 0) {
      return NextResponse.json({ error: "File kosong atau tidak terbaca" }, { status: 400 });
    }
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal membaca file" }, { status: 400 });
  }
}

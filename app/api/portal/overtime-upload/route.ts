import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentEmployee } from "@/lib/current-employee";
import { isSpvPosition } from "@/lib/roles";

const MAX_SIZE = 15 * 1024 * 1024; // 15MB - cukup utk foto dari HP
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Token generation client-direct-upload ke Vercel Blob khusus foto wajib
// lampiran Pengajuan Lembur (Portal Karyawan) - pola sama dgn
// app/api/employees/upload-document/route.ts (versi HR), tapi digerbangi
// sesi Employee + wajib posisi SPV, bukan requireHrWriteUser. Permintaan
// Kevin 2026-09-14.
export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!isSpvPosition(employee.position)) {
    return NextResponse.json({ error: "Fitur Lembur hanya utk posisi SPV" }, { status: 403 });
  }

  const body = (await req.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_SIZE,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal upload foto" }, { status: 400 });
  }
}

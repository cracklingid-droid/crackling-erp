import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentEmployee } from "@/lib/current-employee";

const MAX_SIZE = 15 * 1024 * 1024; // 15MB - cukup utk foto selfie dari HP
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Token generation client-direct-upload ke Vercel Blob khusus foto selfie
// absen mandiri (Portal Karyawan) - pola sama dgn
// app/api/portal/overtime-upload/route.ts, tapi terbuka utk SEMUA karyawan
// aktif (bukan cuma posisi SPV). Permintaan Kevin 2026-09-17.
export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });

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

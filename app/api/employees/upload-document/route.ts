import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/current-user";

const MAX_SIZE = 15 * 1024 * 1024; // 15MB - cukup untuk scan/foto KTP, ijazah, kontrak
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// Token generation untuk client-direct-upload ke Vercel Blob, pola sama
// dengan upload CV publik - file tidak lewat function serverless kita.
// Ini endpoint HR (butuh login), bukan publik.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

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
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal upload dokumen" }, { status: 400 });
  }
}

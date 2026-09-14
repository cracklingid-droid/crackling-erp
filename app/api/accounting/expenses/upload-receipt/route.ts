import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const PATH_PREFIX = "expense-receipts/";

// Token utk client-direct-upload foto bon Direct Expense ke Vercel Blob
// (jejak audit tiap beban) - pola sama dgn upload foto produk/dokumen
// karyawan. Cek akses di onBeforeGenerateToken krn endpoint ini juga
// dipanggil balik Vercel (webhook) tanpa sesi user.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user || !canAccessAccounting(user)) throw new Error("Tidak punya akses");
        if (!pathname.startsWith(PATH_PREFIX)) throw new Error("Path bon tidak valid");
        return { allowedContentTypes: ALLOWED_TYPES, maximumSizeInBytes: MAX_SIZE, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal upload bon" }, { status: 400 });
  }
}

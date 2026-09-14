import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB - cukup utk foto produk dari HP
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const PATH_PREFIX = "product-photos/";

// Token generation utk client-direct-upload foto produk ke Vercel Blob, pola
// sama dgn upload dokumen karyawan - file tidak lewat function serverless kita.
// Cek akses ditaruh di onBeforeGenerateToken (bukan di atas) krn endpoint ini
// juga dipanggil balik oleh Vercel (webhook upload-completed) tanpa sesi user.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getCurrentUser();
        if (!user || !canAccessAccounting(user)) throw new Error("Tidak punya akses");
        if (!pathname.startsWith(PATH_PREFIX)) throw new Error("Path foto tidak valid");

        // clientPayload = id Item Warehouse (string), disimpan ke tokenPayload
        // utk jejak saja - URL final disimpan client lewat PUT .../[id]/photo.
        const warehouseItemId = Number(clientPayload);
        if (!Number.isInteger(warehouseItemId) || warehouseItemId <= 0) throw new Error("ID item tidak valid");

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ warehouseItemId }),
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal upload foto" }, { status: 400 });
  }
}

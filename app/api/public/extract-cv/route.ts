import { NextResponse } from "next/server";
import { extractCvText } from "@/lib/cv-parse";
import { extractContactInfo } from "@/lib/cv-extract-fields";

const MAX_TEXT_PREVIEW = 20000;
const MAX_FETCH_SIZE = 25 * 1024 * 1024; // sama dgn batas upload-cv

// Dipanggil terpisah dari client setelah upload CV selesai (langsung ke
// Vercel Blob) - route ini mengambil file dari Blob lalu ekstrak teksnya,
// tidak terkena batas ukuran body request masuk karena file tidak dikirim
// lewat sini, hanya URL-nya. Permintaan Kevin 2026-09-10.
//
// Route ini publik (tanpa login) - `url` HARUS divalidasi hanya boleh Blob
// storage kita sendiri, bukan `https://` bebas. Tanpa ini route jadi SSRF:
// siapa pun bisa menyuruh server kita fetch URL https apa pun (internal
// atau eksternal) & baca sebagian hasilnya lewat textPreview. Ditemukan &
// diperbaiki 2026-09-18 (audit keamanan menyeluruh).
function isAllowedCvUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const url = typeof body.url === "string" ? body.url : "";
  if (!isAllowedCvUrl(url)) {
    return NextResponse.json({ error: "URL CV tidak valid" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const fileRes = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
    if (!fileRes.ok) {
      return NextResponse.json({ error: "Gagal mengambil file CV" }, { status: 400 });
    }
    const contentLength = Number(fileRes.headers.get("content-length") || 0);
    if (contentLength > MAX_FETCH_SIZE) {
      return NextResponse.json({ error: "File CV terlalu besar" }, { status: 400 });
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    if (buffer.byteLength > MAX_FETCH_SIZE) {
      return NextResponse.json({ error: "File CV terlalu besar" }, { status: 400 });
    }
    const mimeType = typeof body.contentType === "string" ? body.contentType : fileRes.headers.get("content-type") || "";
    const fullText = await extractCvText(buffer, mimeType);
    const { email, phone } = extractContactInfo(fullText);

    return NextResponse.json({
      textPreview: fullText.slice(0, MAX_TEXT_PREVIEW),
      extractedEmail: email,
      extractedPhone: phone,
    });
  } catch (e) {
    console.error("Gagal ekstrak CV:", e);
    return NextResponse.json({ textPreview: "", extractedEmail: null, extractedPhone: null });
  }
}

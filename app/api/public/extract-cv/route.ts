import { NextResponse } from "next/server";
import { extractCvText } from "@/lib/cv-parse";
import { extractContactInfo } from "@/lib/cv-extract-fields";

const MAX_TEXT_PREVIEW = 20000;

// Dipanggil terpisah dari client setelah upload CV selesai (langsung ke
// Vercel Blob) - route ini mengambil file dari Blob lalu ekstrak teksnya,
// tidak terkena batas ukuran body request masuk karena file tidak dikirim
// lewat sini, hanya URL-nya. Permintaan Kevin 2026-09-10.
export async function POST(req: Request) {
  const body = await req.json();
  const url = typeof body.url === "string" ? body.url : "";
  if (!url || !url.startsWith("https://")) {
    return NextResponse.json({ error: "URL CV tidak valid" }, { status: 400 });
  }

  try {
    const fileRes = await fetch(url);
    if (!fileRes.ok) {
      return NextResponse.json({ error: "Gagal mengambil file CV" }, { status: 400 });
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
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

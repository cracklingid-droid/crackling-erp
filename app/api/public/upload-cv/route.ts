import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { extractCvText } from "@/lib/cv-parse";
import { extractContactInfo } from "@/lib/cv-extract-fields";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_PREVIEW = 20000;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File CV wajib disertakan" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ukuran file maksimum 5MB" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Format file harus PDF, DOC, atau DOCX" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const blob = await put(`cv/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const fullText = await extractCvText(buffer, file.type);
  const { email, phone } = extractContactInfo(fullText);

  return NextResponse.json({
    url: blob.url,
    name: file.name,
    textPreview: fullText.slice(0, MAX_TEXT_PREVIEW),
    extractedEmail: email,
    extractedPhone: phone,
  });
}

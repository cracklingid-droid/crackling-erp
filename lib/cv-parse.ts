import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

// Ekstraksi teks dari CV PDF/DOCX untuk preview & deteksi kontak sederhana
// (regex, tanpa AI - permintaan Kevin 2026-09-10 supaya tidak perlu API key
// tambahan). Format .doc lama tidak didukung, dikembalikan string kosong.
export async function extractCvText(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf") {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text || "";
    }
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    }
    return "";
  } catch (e) {
    console.error("Gagal ekstrak teks CV:", e);
    return "";
  }
}

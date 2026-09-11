import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import Anthropic from "@anthropic-ai/sdk";

// AI bantu deteksi struktur kolom file absensi (nama/tanggal/jam masuk-
// pulang) secara otomatis, supaya HR tidak perlu pilih manual tiap upload -
// permintaan Kevin 2026-09-11. Hasilnya cuma SARAN yang mengisi form
// pemetaan kolom yang sudah ada, HR tetap wajib cek & bisa ubah sebelum
// klik Import - tidak ada data yang langsung masuk tanpa review HR.
const SYSTEM_PROMPT = `Kamu membantu tim HR restoran membaca file export absensi dari mesin fingerprint/absensi digital. Formatnya bisa macam-macam tergantung merk mesin - kadang tanggal & jam masuk/pulang di kolom terpisah, kadang digabung jadi satu kolom datetime per baris scan (raw log, banyak baris per hari per karyawan).

Tugasmu: baca contoh baris data yang diberikan, lalu tentukan struktur kolomnya. Balas HANYA dengan JSON valid, tanpa markdown code fence, tanpa penjelasan tambahan, persis format ini:
{"headerRowIndex": <index baris header, 0 kalau baris pertama sudah header>, "mode": "separate" atau "combined", "nameColIndex": <index kolom nama karyawan>, "dateColIndex": <index kolom tanggal, null kalau mode combined>, "clockInColIndex": <index kolom jam masuk, null kalau mode combined>, "clockOutColIndex": <index kolom jam pulang, null kalau tidak ada/mode combined>, "datetimeColIndex": <index kolom tanggal+jam gabungan, null kalau mode separate>, "confidence": "tinggi" atau "sedang" atau "rendah", "note": "<catatan singkat kalau ada yang meragukan, kosongkan string kalau yakin>"}

Index kolom mulai dari 0. Kalau tidak yakin sama sekali strukturnya, tetap balas JSON dengan tebakan terbaikmu dan confidence "rendah" plus catatan di note.`;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY belum diset di environment variables" }, { status: 500 });
  }

  const body = await req.json();
  const rows: string[][] = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada data untuk dianalisa" }, { status: 400 });
  }

  const sample = rows
    .slice(0, 15)
    .map((r, i) => `Baris ${i}: ${JSON.stringify(r)}`)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Contoh isi file (${rows.length} baris total, ini ${Math.min(15, rows.length)} baris pertama):\n\n${sample}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = (textBlock?.type === "text" ? textBlock.text : "").trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Respons AI tidak bisa dibaca, silakan pilih kolom manual" }, { status: 502 });
    }

    const p = parsed as Record<string, unknown>;
    const maxCol = (rows[0]?.length ?? 1) - 1;
    const clamp = (v: unknown): number | null => {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < 0 || n > maxCol) return null;
      return Math.round(n);
    };

    const suggestion = {
      headerRowIndex: clamp(p.headerRowIndex) ?? 0,
      mode: p.mode === "combined" ? "combined" : "separate",
      nameColIndex: clamp(p.nameColIndex),
      dateColIndex: clamp(p.dateColIndex),
      clockInColIndex: clamp(p.clockInColIndex),
      clockOutColIndex: clamp(p.clockOutColIndex),
      datetimeColIndex: clamp(p.datetimeColIndex),
      confidence: typeof p.confidence === "string" ? p.confidence : "rendah",
      note: typeof p.note === "string" ? p.note : "",
    };

    return NextResponse.json(suggestion);
  } catch (e) {
    console.error("Gagal deteksi kolom absensi via AI:", e);
    return NextResponse.json({ error: "Deteksi otomatis gagal, silakan pilih kolom manual" }, { status: 502 });
  }
}

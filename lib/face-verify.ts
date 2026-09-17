import Anthropic from "@anthropic-ai/sdk";

// Verifikasi wajah selfie absen (cegah titip absen) + deteksi masker - pola
// pemanggilan Claude vision sama persis dgn app/api/accounting/expenses/
// scan/route.ts (scan bon) yang sudah ada: tool_choice paksa 1 tool
// terstruktur, model claude-sonnet-5. Permintaan Kevin 2026-09-17: "bisa
// scan wajah agar tidak bisa titip absen" + "tidak memperbolehkan memakai
// masker ketika absen, akan otomatis ditolak".
const MASK_HINT = "kacamata dan hijab/kerudung yang TIDAK menutup hidung & mulut TIDAK dihitung sebagai masker";

const ENROLL_TOOL = {
  name: "record_face_check",
  description: "Catat hasil pemeriksaan foto selfie pendaftaran wajah karyawan.",
  input_schema: {
    type: "object" as const,
    properties: {
      faceVisible: { type: "boolean", description: "Wajah manusia terlihat jelas & tidak terhalang" },
      wearingMask: { type: "boolean", description: `Wajah tertutup masker/face covering di hidung & mulut (${MASK_HINT})` },
      reason: { type: "string", description: "Penjelasan singkat dalam Bahasa Indonesia" },
    },
    required: ["faceVisible", "wearingMask", "reason"],
  },
};

const VERIFY_TOOL = {
  name: "record_face_verification",
  description: "Catat hasil verifikasi wajah selfie absen dibandingkan foto acuan terdaftar.",
  input_schema: {
    type: "object" as const,
    properties: {
      faceVisible: { type: "boolean", description: "Wajah di foto absen (Foto 2) terlihat jelas & tidak terhalang" },
      wearingMask: { type: "boolean", description: `Foto absen (Foto 2) memakai masker/face covering di hidung & mulut (${MASK_HINT})` },
      sameFace: { type: "boolean", description: "Orang di Foto 2 adalah orang yang sama dengan Foto 1, walau beda sudut/pencahayaan/ekspresi" },
      confidence: { type: "string", enum: ["tinggi", "sedang", "rendah"], description: "Seberapa yakin kesimpulan sameFace" },
      reason: { type: "string", description: "Penjelasan singkat dalam Bahasa Indonesia" },
    },
    required: ["faceVisible", "wearingMask", "sameFace", "confidence", "reason"],
  },
};

export type EnrollCheck = { faceVisible: boolean; wearingMask: boolean; reason: string };
export type VerifyCheck = {
  faceVisible: boolean;
  wearingMask: boolean;
  sameFace: boolean;
  confidence: "tinggi" | "sedang" | "rendah";
  reason: string;
};

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Gagal mengambil foto utk diperiksa");
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

function requireApiKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Fitur verifikasi wajah belum aktif (ANTHROPIC_API_KEY belum diset di server).");
  }
  return process.env.ANTHROPIC_API_KEY;
}

// Dipakai saat karyawan mendaftarkan wajah pertama kali (Employee.
// faceReferenceUrl masih kosong) - cuma cek wajah jelas & tanpa masker,
// belum ada foto acuan utk dibandingkan.
export async function checkFaceForEnrollment(photoUrl: string): Promise<EnrollCheck> {
  const apiKey = requireApiKey();
  const data = await fetchAsBase64(photoUrl);
  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    tools: [ENROLL_TOOL],
    tool_choice: { type: "tool", name: "record_face_check" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
          {
            type: "text",
            text: "Ini foto selfie pendaftaran wajah karyawan utk sistem absensi kantor. Periksa apakah wajah terlihat jelas dan apakah memakai masker.",
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Tidak bisa memeriksa foto ini.");
  return toolUse.input as EnrollCheck;
}

// Dipakai tiap kali absen masuk/pulang - bandingkan selfie absen dgn foto
// acuan yang sudah terdaftar (Employee.faceReferenceUrl), sekalian cek
// masker. Kalau panggilan API gagal (error dilempar ke pemanggil), rute
// pemanggil WAJIB menolak absen (fail closed) - jangan pernah meloloskan
// absen begitu saja hanya karena verifikasinya gagal jalan.
export async function verifyFaceForAttendance(referenceUrl: string, candidateUrl: string): Promise<VerifyCheck> {
  const apiKey = requireApiKey();
  const [refData, candData] = await Promise.all([fetchAsBase64(referenceUrl), fetchAsBase64(candidateUrl)]);
  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    tools: [VERIFY_TOOL],
    tool_choice: { type: "tool", name: "record_face_verification" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Foto 1 (foto acuan wajah yang sudah terdaftar):" },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: refData } },
          { type: "text", text: "Foto 2 (selfie absen barusan):" },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: candData } },
          {
            type: "text",
            text: "Ini verifikasi identitas utk sistem absensi karyawan (cegah titip absen - orang lain absen menggantikan). Bandingkan wajah di Foto 2 dengan Foto 1, dan periksa apakah Foto 2 memakai masker.",
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Tidak bisa memeriksa foto ini.");
  return toolUse.input as VerifyCheck;
}

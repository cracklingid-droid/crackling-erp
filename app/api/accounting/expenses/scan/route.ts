import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

// Baca bon Direct Expense pakai Claude - pola sama persis dgn scan-bon
// Belanja di Crackling Warehouse (permintaan Kevin 2026-09-14: "ada optik
// dari claude mirip seperti belanja di modul crackling warehouse"). Bedanya:
// yang dicocokkan bukan SKU barang, tapi AKUN BEBAN di COA (gas, listrik,
// marketing, dst) - tiap baris bon disarankan akunnya, user tetap bisa
// ubah sebelum simpan. Foto bisa >10 detik dibaca, naikkan batas waktu.
export const maxDuration = 45;

const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const EXTRACT_TOOL = {
  name: "record_expense_receipt",
  description: "Catat hasil baca bon/nota pengeluaran dalam format terstruktur.",
  input_schema: {
    type: "object" as const,
    properties: {
      vendorName: { type: ["string", "null"], description: "Nama toko/vendor/penerima di bon, kalau ada" },
      receiptDate: { type: ["string", "null"], description: "Tanggal di bon, format YYYY-MM-DD, kalau ada" },
      totalAmount: { type: ["number", "null"], description: "Total yang dibayar (Rupiah) sesuai bon, kalau tertulis" },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "Keterangan baris persis seperti di bon" },
            amount: { type: "number", description: "Total harga baris ini dalam Rupiah (qty x harga kalau perlu)" },
            suggestedAccountCode: {
              type: ["string", "null"],
              description: "Kode akun beban dari daftar COA yang paling cocok utk baris ini, null kalau tidak yakin",
            },
          },
          required: ["description", "amount", "suggestedAccountCode"],
        },
      },
    },
    required: ["lines"],
  },
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Fitur baca bon belum aktif (ANTHROPIC_API_KEY belum diset di server)." }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Foto bon tidak ditemukan" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Format file harus JPG, PNG, WEBP, atau HEIC" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Ukuran foto maksimal 8MB" }, { status: 400 });

  const expenseAccounts = await prisma.account.findMany({
    where: { type: "EXPENSE", isActive: true, parentId: { not: null } },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
  const coaText = expenseAccounts.map((a) => `${a.code} | ${a.name}`).join("\n");

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "record_expense_receipt" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: file.type as "image/jpeg", data: base64 } },
            {
              type: "text",
              text:
                "Ini foto bon/nota pengeluaran operasional restoran (Rupiah) - mis. beli gas, tagihan listrik, biaya " +
                "marketing, perlengkapan. Baca setiap baris (keterangan + total harga baris; kalau cuma ada harga satuan " +
                "dan qty, kalikan). Kalau bon cuma punya 1 total tanpa rincian, buat 1 baris saja. Untuk tiap baris pilih " +
                "kode akun beban yang paling cocok dari daftar COA berikut, kalau tidak yakin biarkan null - jangan menebak " +
                "asal.\n\nDaftar akun beban (Kode | Nama):\n" +
                coaText,
            },
          ],
        },
      ],
    });
  } catch (e) {
    console.error("Anthropic API error:", e);
    return NextResponse.json({ error: "Gagal membaca bon (layanan AI bermasalah), coba lagi." }, { status: 500 });
  }

  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return NextResponse.json({ error: "Tidak bisa membaca isi bon dari foto ini." }, { status: 422 });

  const result = toolUse.input as {
    vendorName: string | null;
    receiptDate: string | null;
    totalAmount: number | null;
    lines: { description: string; amount: number; suggestedAccountCode: string | null }[];
  };
  const validCodes = new Set(expenseAccounts.map((a) => a.code));

  return NextResponse.json({
    vendorName: result.vendorName,
    receiptDate: result.receiptDate,
    totalAmount: result.totalAmount === null ? null : Math.round(result.totalAmount),
    lines: result.lines.map((l) => ({
      description: l.description,
      amount: Math.round(l.amount),
      suggestedAccountCode: l.suggestedAccountCode && validCodes.has(l.suggestedAccountCode) ? l.suggestedAccountCode : null,
    })),
  });
}

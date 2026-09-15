import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { parseCsv } from "@/lib/sales-sheet";

// Upload mutasi bank (CSV / XLSX) utk 1 akun bank - permintaan Kevin
// 2026-09-15. 2 langkah, tanpa file sementara di server:
//  1. multipart {file} -> parse + deteksi kolom otomatis -> balas PREVIEW
//     (baris ternormalisasi {date, description, amount, balance} + mapping
//     kolom + tanda duplikat vs data yang sudah ada). Belum menulis apa pun.
//  2. JSON {rows} -> simpan (createMany), baris duplikat dilewati lagi di
//     server supaya upload ulang file yang sama aman.
// Format yang dikenali: tab "Bank Statement 2026 - Final" Kevin (Date |
// Nama Bank | Description | ... | Receive | Spent | Balance), export bank
// umum (Tanggal/Keterangan/Debit/Kredit/Saldo atau Date/Description/
// Amount/Balance), angka "1,500,000.00" (AS) maupun "1.500.000,00" (ID).
export const maxDuration = 60;

const MAX_SIZE = 10 * 1024 * 1024;

type Row = { date: string; description: string; amount: number; balance: number | null };
type Mapping = { date: string; description: string; amount?: string; credit?: string; debit?: string; balance?: string; dateFormat: "auto" | "dmy" | "mdy" };

const H = {
  date: ["sales date", "tanggal", "tgl", "date", "transaction date", "posting date", "tanggal transaksi"],
  description: ["description", "keterangan", "uraian", "remark", "remarks", "memo", "narasi", "transaksi", "detail"],
  amount: ["amount", "jumlah", "mutasi", "nominal", "nilai"],
  credit: ["receive", "received", "credit", "kredit", "cr", "masuk", "uang masuk", "dana masuk", "in"],
  debit: ["spent", "debit", "db", "keluar", "uang keluar", "dana keluar", "out"],
  balance: ["balance", "saldo", "saldo akhir", "running balance"],
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function findCol(headers: string[], names: string[]): string | undefined {
  const normed = headers.map(norm);
  for (const n of names) {
    const i = normed.findIndex((h) => h === n);
    if (i >= 0) return headers[i];
  }
  for (const n of names) {
    const i = normed.findIndex((h) => h.includes(n) && n.length >= 4);
    if (i >= 0) return headers[i];
  }
  return undefined;
}

function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/rp\.?/i, "").replace(/\s/g, "");
  if (!s || s === "-") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

function excelSerialToIso(n: number): string {
  const ms = Math.round((n - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

function parseDate(v: unknown, fmt: Mapping["dateFormat"]): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return v > 20000 && v < 80000 ? excelSerialToIso(v) : null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3];
    const dmy = fmt === "dmy" || (fmt === "auto" && a > 12) ? true : fmt === "mdy" || (fmt === "auto" && b > 12) ? false : true;
    const d = dmy ? a : b;
    const mo = dmy ? b : a;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

async function readTable(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let grid: unknown[][] = [];
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("Sheet pertama kosong");
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: unknown[] = [];
      for (let c = 1; c <= row.cellCount; c++) {
        const cell = row.getCell(c);
        const v = cell.value;
        if (v && typeof v === "object" && "result" in (v as object)) vals.push((v as { result: unknown }).result);
        else if (v && typeof v === "object" && "richText" in (v as object)) vals.push((v as { richText: { text: string }[] }).richText.map((t) => t.text).join(""));
        else vals.push(v);
      }
      grid.push(vals);
    });
  } else {
    const text = buf.toString("utf8").replace(/^﻿/, "");
    grid = parseCsv(text);
  }
  // Baris header = baris pertama yang punya >= 2 sel teks & mengandung
  // kolom tanggal/keterangan yang dikenali (lewati judul laporan di atasnya).
  let headerIdx = grid.findIndex((r) => {
    const cells = r.map((c) => (c === null || c === undefined ? "" : String(c)));
    return cells.filter((c) => c.trim()).length >= 2 && !!findCol(cells, H.date) && (!!findCol(cells, H.description) || !!findCol(cells, H.amount) || !!findCol(cells, H.credit));
  });
  if (headerIdx < 0) headerIdx = 0;
  const headers = (grid[headerIdx] ?? []).map((c, i) => (c === null || c === undefined || String(c).trim() === "" ? `Kolom ${i + 1}` : String(c).trim()));
  const rows = grid.slice(headerIdx + 1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  return { headers, rows };
}

function normalize(rows: Record<string, unknown>[], map: Mapping): { rows: Row[]; skipped: number } {
  const out: Row[] = [];
  let skipped = 0;
  for (const r of rows) {
    const date = parseDate(r[map.date], map.dateFormat);
    const description = String(r[map.description] ?? "").trim();
    let amount: number | null = null;
    if (map.amount) amount = parseMoney(r[map.amount]);
    else {
      const cr = map.credit ? parseMoney(r[map.credit]) ?? 0 : 0;
      const db = map.debit ? parseMoney(r[map.debit]) ?? 0 : 0;
      amount = cr - Math.abs(db);
      if (cr === 0 && db === 0) amount = null;
    }
    const balance = map.balance ? parseMoney(r[map.balance]) : null;
    if (!date || amount === null || amount === 0) {
      if (date || description) skipped++;
      continue;
    }
    out.push({ date, description: description || "(tanpa keterangan)", amount: Math.round(amount), balance: balance === null ? null : Math.round(balance) });
  }
  return { rows: out, skipped };
}

async function markDuplicates(bankAccountId: number, rows: Row[]) {
  if (rows.length === 0) return rows.map(() => false);
  const dates = rows.map((r) => r.date).sort();
  const existing = await prisma.bankStatementLine.findMany({
    where: { bankAccountId, date: { gte: new Date(`${dates[0]}T00:00:00.000Z`), lte: new Date(`${dates[dates.length - 1]}T23:59:59.999Z`) } },
    select: { date: true, description: true, amount: true },
  });
  const keys = new Set(existing.map((e) => `${e.date.toISOString().slice(0, 10)}|${e.amount}|${e.description.trim()}`));
  return rows.map((r) => keys.has(`${r.date}|${r.amount}|${r.description.trim()}`));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const bank = await prisma.bankAccount.findUnique({ where: { id: Number(id) } });
  if (!bank) return NextResponse.json({ error: "Akun bank tidak ditemukan" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";

  // Langkah 2: simpan baris hasil preview yang sudah dikonfirmasi.
  if (contentType.includes("application/json")) {
    const body = await req.json();
    const rows: Row[] = Array.isArray(body.rows) ? body.rows : [];
    const clean = rows
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) && Number.isFinite(Number(r.amount)) && Number(r.amount) !== 0)
      .map((r) => ({ date: String(r.date), description: String(r.description ?? "").trim() || "(tanpa keterangan)", amount: Math.round(Number(r.amount)), balance: r.balance === null || r.balance === undefined ? null : Math.round(Number(r.balance)) }));
    const dup = await markDuplicates(bank.id, clean);
    const toInsert = clean.filter((_, i) => !dup[i]);
    if (toInsert.length > 0) {
      await prisma.bankStatementLine.createMany({
        data: toInsert.map((r) => ({ bankAccountId: bank.id, date: new Date(`${r.date}T00:00:00.000Z`), description: r.description, amount: r.amount, balance: r.balance })),
      });
    }
    return NextResponse.json({ ok: true, inserted: toInsert.length, skippedDuplicates: clean.length - toInsert.length });
  }

  // Langkah 1: parse file -> preview.
  const form = await req.formData();
  const file = form.get("file");
  const dateFormat = (String(form.get("dateFormat") ?? "auto") as Mapping["dateFormat"]) || "auto";
  if (!(file instanceof File)) return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Ukuran file maksimal 10MB" }, { status: 400 });

  let table;
  try {
    table = await readTable(file);
  } catch (e) {
    return NextResponse.json({ error: `Gagal membaca file: ${e instanceof Error ? e.message : "format tidak dikenali"}` }, { status: 400 });
  }
  const { headers, rows } = table;
  const overrides = (() => {
    try {
      return JSON.parse(String(form.get("mapping") ?? "{}"));
    } catch {
      return {};
    }
  })() as Partial<Mapping>;

  const dateCol = overrides.date ?? findCol(headers, H.date);
  const descCol = overrides.description ?? findCol(headers, H.description);
  const amountCol = overrides.amount ?? (overrides.credit || overrides.debit ? undefined : findCol(headers, H.amount));
  const creditCol = overrides.credit ?? (amountCol ? undefined : findCol(headers, H.credit));
  const debitCol = overrides.debit ?? (amountCol ? undefined : findCol(headers, H.debit));
  const balanceCol = overrides.balance ?? findCol(headers, H.balance);
  if (!dateCol || !descCol || (!amountCol && !creditCol && !debitCol)) {
    return NextResponse.json(
      { error: "Kolom tanggal / keterangan / nominal tidak terdeteksi - pilih kolomnya manual.", headers, sample: rows.slice(0, 5) },
      { status: 422 }
    );
  }
  const mapping: Mapping = { date: dateCol, description: descCol, amount: amountCol, credit: creditCol, debit: debitCol, balance: balanceCol, dateFormat };
  const normalized = normalize(rows, mapping);
  const dup = await markDuplicates(bank.id, normalized.rows);
  return NextResponse.json({
    headers,
    mapping,
    total: normalized.rows.length,
    skipped: normalized.skipped,
    duplicates: dup.filter(Boolean).length,
    rows: normalized.rows.map((r, i) => ({ ...r, duplicate: dup[i] })),
  });
}

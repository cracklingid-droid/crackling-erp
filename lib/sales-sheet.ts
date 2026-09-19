import * as XLSX from "xlsx";

// Baca sheet "Sales Recapitulation Detail Report" (export POS asli, dibagikan
// Kevin 2026-09-12) - beda dari sheet "Daily Qty Per Menu" yang dipakai
// laporan COGS Warehouse (itu cuma qty per menu, sheet ini transaksi
// lengkap dgn kolom Rupiah). Live fetch tiap kali "Sync Sekarang" diklik,
// tidak ada auto-refresh terjadwal (keputusan Kevin 2026-09-12).
// "Omzet" = kolom "Total" (Subtotal + Service Charge 5%) per keputusan
// Kevin - BUKAN Nett Sales/Subtotal saja.
export const SALES_SHEETS: { fileId: string; hrOutletName: string }[] = [
  { fileId: "1ixyKHwthFWyEX7uIsODR6-IGLv9claaunedRr-mhXRA", hrOutletName: "Gading Serpong" },
  { fileId: "1uDMslx7Y2T4xEb1mSaErclBFOrq6IU0GEKiLmgvyjOQ", hrOutletName: "Kelapa Gading" },
];

// Parser CSV penuh (bukan per-baris) - field di sheet ini (mis. "Menu
// Notes") bisa berisi newline literal di dalam tanda kutip, beda dari
// sheet "Daily Qty Per Menu" yang cukup di-split per baris dulu.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\r") {
        // skip
      } else if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

export type DailySalesRow = { outletName: string; date: string; totalOmzet: number };

async function fetchSheetDailyTotals(fileId: string, hrOutletName: string): Promise<DailySalesRow[]> {
  const url = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv&gid=0`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gagal ambil sheet penjualan ${hrOutletName}: HTTP ${res.status}`);
  const text = (await res.text()).replace(/^﻿/, "");

  const rows = parseCsv(text);
  const header = rows[1] ?? []; // baris 0 = judul laporan, baris 1 = header kolom sungguhan
  const dateIdx = header.indexOf("Sales Date");
  const totalIdx = header.indexOf("Total");
  if (dateIdx === -1 || totalIdx === -1) {
    throw new Error(`Format sheet penjualan ${hrOutletName} tidak dikenali (kolom Sales Date/Total tidak ketemu)`);
  }

  const byDate = new Map<string, number>();
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;
    const date = row[dateIdx];
    if (!date) continue;
    const total = Number((row[totalIdx] || "0").replace(/,/g, ""));
    if (Number.isNaN(total)) continue;
    byDate.set(date, (byDate.get(date) ?? 0) + total);
  }

  return Array.from(byDate.entries()).map(([date, totalOmzet]) => ({ outletName: hrOutletName, date, totalOmzet }));
}

// Fatgai: beda format dari GS/KG - BUKAN export POS "Sales Recapitulation",
// tapi sheet "Settlement" di database Fatgai (Google Sheets, dibagikan Kevin
// 2026-09-19). Omzet = kolom B "Total Sales (POPCORN)", 1 baris per hari
// (kolom A = tanggal serial Excel). Diambil sbg xlsx (gid sheet tidak
// diketahui) & dibaca pakai SheetJS. Baris tanpa angka di kolom B (hari
// belum diisi / tanggal ke depan) dilewati, bukan dianggap Rp0.
const FATGAI_SETTLEMENT = {
  url: "https://docs.google.com/spreadsheets/d/1RpUnmPBow0-v51IYpUvv4O4GwRlh7DOw/export?format=xlsx",
  sheetName: "Settlement",
  hrOutletName: "Fatgai",
};

async function fetchFatgaiDailySales(): Promise<DailySalesRow[]> {
  const { url, sheetName, hrOutletName } = FATGAI_SETTLEMENT;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gagal ambil sheet penjualan ${hrOutletName}: HTTP ${res.status}`);
  if ((res.headers.get("content-type") ?? "").includes("text/html")) {
    throw new Error(`Sheet penjualan ${hrOutletName} tidak bisa diakses publik lagi (sharing mungkin diubah jadi terbatas)`);
  }
  const workbook = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" tidak ditemukan di file penjualan ${hrOutletName} (nama sheet mungkin berubah)`);

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const header = String(grid[0]?.[1] ?? "").toLowerCase();
  if (!header.includes("sales")) {
    throw new Error(`Format sheet penjualan ${hrOutletName} berubah: kolom B seharusnya "Total Sales" tapi terbaca "${String(grid[0]?.[1] ?? "")}"`);
  }

  const rows: DailySalesRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const serial = grid[r]?.[0];
    const total = grid[r]?.[1];
    if (typeof serial !== "number" || typeof total !== "number" || !Number.isFinite(total)) continue;
    const p = XLSX.SSF.parse_date_code(serial);
    if (!p) continue;
    const date = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
    rows.push({ outletName: hrOutletName, date, totalOmzet: Math.round(total) });
  }
  return rows;
}

// GS/KG wajib berhasil (error dilempar seperti biasa). Fatgai dipisah: kalau
// sumbernya gagal, GS/KG tetap tersinkron & pesan gagalnya dikembalikan
// sbg warning supaya kelihatan di UI, tidak diam-diam hilang.
export async function fetchAllDailySales(): Promise<{ rows: DailySalesRow[]; warnings: string[] }> {
  const [main, fatgai] = await Promise.all([
    Promise.all(SALES_SHEETS.map((s) => fetchSheetDailyTotals(s.fileId, s.hrOutletName))),
    fetchFatgaiDailySales().then(
      (rows) => ({ rows, warning: null as string | null }),
      (e: unknown) => ({ rows: [] as DailySalesRow[], warning: e instanceof Error ? e.message : "Gagal ambil sheet penjualan Fatgai" })
    ),
  ]);
  return { rows: [...main.flat(), ...fatgai.rows], warnings: fatgai.warning ? [fatgai.warning] : [] };
}

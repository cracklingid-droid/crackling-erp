// Baca sheet "Sales Recapitulation Detail Report" (export POS asli, dibagikan
// Kevin 2026-09-12) - beda dari sheet "Daily Qty Per Menu" yang dipakai
// laporan COGS Warehouse (itu cuma qty per menu, sheet ini transaksi
// lengkap dgn kolom Rupiah). Live fetch tiap kali "Sync Sekarang" diklik,
// tidak ada auto-refresh terjadwal (keputusan Kevin 2026-09-12).
// "Omzet" = kolom "Total" (Subtotal + Service Charge 5%) per keputusan
// Kevin - BUKAN Nett Sales/Subtotal saja.
const SALES_SHEETS: { fileId: string; hrOutletName: string }[] = [
  { fileId: "1ixyKHwthFWyEX7uIsODR6-IGLv9claaunedRr-mhXRA", hrOutletName: "Gading Serpong" },
  { fileId: "1uDMslx7Y2T4xEb1mSaErclBFOrq6IU0GEKiLmgvyjOQ", hrOutletName: "Kelapa Gading" },
];

// Parser CSV penuh (bukan per-baris) - field di sheet ini (mis. "Menu
// Notes") bisa berisi newline literal di dalam tanda kutip, beda dari
// sheet "Daily Qty Per Menu" yang cukup di-split per baris dulu.
function parseCsv(text: string): string[][] {
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

export async function fetchAllDailySales(): Promise<DailySalesRow[]> {
  const results = await Promise.all(SALES_SHEETS.map((s) => fetchSheetDailyTotals(s.fileId, s.hrOutletName)));
  return results.flat();
}

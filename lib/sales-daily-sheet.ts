import { parseCsv, SALES_SHEETS } from "./sales-sheet";

// Baca tab "Daily" dari 2 sheet POS (file yang sama dgn lib/sales-sheet.ts,
// beda tab) - 1 baris per tanggal, kolom "Sales Date" (MM/DD/YYYY, urutan
// AS) & "Total Sales" (total omzet hari itu, termasuk pajak/service charge),
// sisanya rincian per metode bayar (QRIS BCA, GOFOOD, dst - set kolomnya
// BEDA per outlet). Dipakai modul Record Sales Accounting utk jurnal harian
// Dr AR outlet / Cr Sales outlet. Permintaan Kevin 2026-09-14 ("baca sheet
// daily agar bisa melihat berapa total sales harian").
//
// gid tab "Daily" sama di kedua file (dikloning dari 1 template) - dicek
// live 2026-09-14. Baris masa depan sudah ada tapi 0 semua, baris 0 dilewati
// (tidak ada yang perlu dijurnal).
export const DAILY_TAB_GID = "698927505";

export type DailySalesTotal = {
  outletName: string;
  date: string; // YYYY-MM-DD
  total: number; // Rupiah bulat
  breakdown: Record<string, number>; // per metode bayar, hanya yang > 0
};

const NON_PAYMENT_COLUMNS = new Set(["Sales Date", "Total Sales", "DIFF", "Total Cash In"]);

function parseMoney(s: string | undefined): number {
  const n = Number((s ?? "0").replace(/,/g, "").trim());
  return Number.isNaN(n) ? 0 : n;
}

function usDateToIso(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

async function fetchDailyTab(fileId: string, outletName: string): Promise<DailySalesTotal[]> {
  const url = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv&gid=${DAILY_TAB_GID}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gagal ambil tab Daily ${outletName}: HTTP ${res.status}`);
  const text = (await res.text()).replace(/^﻿/, "");
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  const dateIdx = header.indexOf("Sales Date");
  const totalIdx = header.indexOf("Total Sales");
  if (dateIdx === -1 || totalIdx === -1) {
    throw new Error(`Format tab Daily ${outletName} tidak dikenali (kolom Sales Date/Total Sales tidak ketemu)`);
  }

  const out: DailySalesTotal[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;
    const date = usDateToIso(row[dateIdx] ?? "");
    if (!date) continue;
    const total = Math.round(parseMoney(row[totalIdx]));
    if (total <= 0) continue;
    const breakdown: Record<string, number> = {};
    header.forEach((col, i) => {
      if (NON_PAYMENT_COLUMNS.has(col) || !col) return;
      const v = Math.round(parseMoney(row[i]));
      if (v > 0) breakdown[col] = v;
    });
    out.push({ outletName, date, total, breakdown });
  }
  return out;
}

export async function fetchAllDailySalesTotals(): Promise<DailySalesTotal[]> {
  const results = await Promise.all(SALES_SHEETS.map((s) => fetchDailyTab(s.fileId, s.hrOutletName)));
  return results.flat();
}

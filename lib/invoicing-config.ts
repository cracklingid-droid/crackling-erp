// Cabang yang boleh menerbitkan invoice (permintaan Kevin 2026-09-15: "semua
// cabang" termasuk Joglo & Kantor, BEDA dari SELLING_OUTLET_NAMES di
// lib/accounting-outlets.ts yang sengaja cuma 3 outlet titik jual POS harian
// - Invoicing dipakai jg utk penjualan ad-hoc/korporat dari Joglo/Kantor).
// arCode/salesCode merujuk akun COA yang dibuat scripts/seed-coa.ts.
export type InvoiceBranch = { code: string; name: string; arCode: string; salesCode: string };

export const INVOICE_BRANCHES: InvoiceBranch[] = [
  { code: "GS", name: "Gading Serpong", arCode: "1-1100-01", salesCode: "4-1000-01" },
  { code: "KG", name: "Kelapa Gading", arCode: "1-1100-02", salesCode: "4-1000-02" },
  { code: "FTG", name: "Fatgai", arCode: "1-1100-03", salesCode: "4-1000-03" },
  { code: "JGL", name: "Joglo (Central Kitchen)", arCode: "1-1100-04", salesCode: "4-1000-04" },
  { code: "KTR", name: "Kantor", arCode: "1-1100-05", salesCode: "4-1000-05" },
];

export function invoiceBranchByCode(code: string): InvoiceBranch | undefined {
  return INVOICE_BRANCHES.find((b) => b.code === code);
}

// Akun kliring Midtrans (dari scripts/seed-coa.ts) - dipakai sbg sisi debit
// jurnal pelunasan otomatis via webhook Midtrans (tidak ada pilihan bank
// interaktif krn webhook jalan tanpa staff, lihat app/api/invoicing/webhook/midtrans).
export const MIDTRANS_CLEARING_ACCOUNT_CODE = "1-1015";

// Prefix SKU Warehouse yang boleh dijual lewat Invoicing (keputusan Kevin
// 2026-09-15: "menu dengan kode barang ESB semuanya bisa dijual") - filter
// di lib/invoice-items.ts.
export const SELLABLE_SKU_PREFIX = "ESB";

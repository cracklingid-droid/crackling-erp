// Pemetaan outlet penjualan -> akun COA AR & Sales per outlet (kode dari
// scripts/seed-coa.ts). Nama outlet = nama HR (lib/payroll-config.ts
// OUTLET_NAMES / DailySales.outletName) supaya 1 identitas outlet dipakai
// di Cost Center, Record Sales, & rekonsiliasi. Joglo (Central Kitchen)
// SENGAJA tidak ada - bukan titik jual.
export const OUTLET_ACCOUNTS: Record<string, { arCode: string; salesCode: string; shortLabel: string }> = {
  "Gading Serpong": { arCode: "1-1100-01", salesCode: "4-1000-01", shortLabel: "Crackling Serpong" },
  "Kelapa Gading": { arCode: "1-1100-02", salesCode: "4-1000-02", shortLabel: "Crackling Kelapa Gading" },
  Fatgai: { arCode: "1-1100-03", salesCode: "4-1000-03", shortLabel: "Crackling Fatgai" },
};

export const SELLING_OUTLET_NAMES = Object.keys(OUTLET_ACCOUNTS);

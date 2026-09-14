import { prisma } from "../lib/db";

// Template Chart of Accounts standar utk bisnis F&B Indonesia - titik awal
// modul Accounting (permintaan Kevin 2026-09-14, "buatkan template standar
// dulu"). Bisa diedit/ditambah kapan saja lewat modul COA di UI - ini cuma
// bootstrap awal. Idempoten (upsert by code), aman dijalankan ulang.
type SeedAccount = { code: string; name: string; type: string; subType?: string; parentCode?: string };

const ACCOUNTS: SeedAccount[] = [
  // ASET
  { code: "1-0000", name: "ASET", type: "ASSET" },
  { code: "1-1000", name: "Kas", type: "ASSET", subType: "Aset Lancar", parentCode: "1-0000" },
  { code: "1-1010", name: "Bank", type: "ASSET", subType: "Aset Lancar", parentCode: "1-0000" },
  { code: "1-1100", name: "Piutang Usaha", type: "ASSET", subType: "Aset Lancar", parentCode: "1-0000" },
  { code: "1-1200", name: "Persediaan", type: "ASSET", subType: "Aset Lancar", parentCode: "1-0000" },
  { code: "1-1900", name: "Uang Muka & Aset Lancar Lainnya", type: "ASSET", subType: "Aset Lancar", parentCode: "1-0000" },
  { code: "1-2000", name: "Aset Tetap", type: "ASSET", subType: "Aset Tetap", parentCode: "1-0000" },
  { code: "1-2900", name: "Akumulasi Penyusutan Aset Tetap", type: "ASSET", subType: "Aset Tetap", parentCode: "1-0000" },

  // LIABILITAS
  { code: "2-0000", name: "LIABILITAS", type: "LIABILITY" },
  { code: "2-1000", name: "Utang Usaha", type: "LIABILITY", subType: "Liabilitas Jangka Pendek", parentCode: "2-0000" },
  { code: "2-1100", name: "Utang Bank", type: "LIABILITY", subType: "Liabilitas Jangka Pendek", parentCode: "2-0000" },
  { code: "2-1900", name: "Utang Lainnya", type: "LIABILITY", subType: "Liabilitas Jangka Pendek", parentCode: "2-0000" },

  // EKUITAS
  { code: "3-0000", name: "EKUITAS", type: "EQUITY" },
  { code: "3-1000", name: "Modal Pemilik", type: "EQUITY", parentCode: "3-0000" },
  { code: "3-2000", name: "Laba Ditahan", type: "EQUITY", parentCode: "3-0000" },

  // PENDAPATAN
  { code: "4-0000", name: "PENDAPATAN", type: "REVENUE" },
  { code: "4-1000", name: "Pendapatan Penjualan", type: "REVENUE", parentCode: "4-0000" },

  // BEBAN POKOK PENJUALAN
  { code: "5-0000", name: "BEBAN POKOK PENJUALAN", type: "EXPENSE" },
  { code: "5-1000", name: "Beban Pokok Penjualan (HPP)", type: "EXPENSE", subType: "HPP", parentCode: "5-0000" },

  // BEBAN OPERASIONAL
  { code: "6-0000", name: "BEBAN OPERASIONAL", type: "EXPENSE" },
  { code: "6-1000", name: "Beban Gaji & Tunjangan", type: "EXPENSE", subType: "Beban Operasional", parentCode: "6-0000" },
  { code: "6-1100", name: "Beban Sewa", type: "EXPENSE", subType: "Beban Operasional", parentCode: "6-0000" },
  { code: "6-1200", name: "Beban Listrik & Air", type: "EXPENSE", subType: "Beban Operasional", parentCode: "6-0000" },
  { code: "6-1300", name: "Beban Penyusutan", type: "EXPENSE", subType: "Beban Operasional", parentCode: "6-0000" },
  { code: "6-1400", name: "Beban Perlengkapan & Kemasan", type: "EXPENSE", subType: "Beban Operasional", parentCode: "6-0000" },
  { code: "6-1500", name: "Beban Pemasaran", type: "EXPENSE", subType: "Beban Operasional", parentCode: "6-0000" },
  { code: "6-1900", name: "Beban Operasional Lainnya", type: "EXPENSE", subType: "Beban Operasional", parentCode: "6-0000" },
];

async function main() {
  const codeToId = new Map<string, number>();

  // 2 pass: buat semua akun dulu (tanpa parentId), baru sambungkan parentId -
  // supaya urutan definisi ACCOUNTS di atas tidak harus parent-sebelum-anak.
  for (const a of ACCOUNTS) {
    const acc = await prisma.account.upsert({
      where: { code: a.code },
      update: { name: a.name, type: a.type, subType: a.subType ?? null },
      create: { code: a.code, name: a.name, type: a.type, subType: a.subType ?? null },
    });
    codeToId.set(a.code, acc.id);
  }

  for (const a of ACCOUNTS) {
    if (!a.parentCode) continue;
    const parentId = codeToId.get(a.parentCode);
    const id = codeToId.get(a.code);
    if (!parentId || !id) continue;
    await prisma.account.update({ where: { id }, data: { parentId } });
  }

  console.log(`Seed COA selesai: ${ACCOUNTS.length} akun.`);
}

main().finally(() => prisma.$disconnect());

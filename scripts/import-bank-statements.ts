import fs from "fs";
import path from "path";
import { prisma } from "../lib/db";

// Impor mutasi bank riil dari "Bank Statement 2026 - Final" (Google Sheet
// Kevin) - permintaan Kevin 2026-09-14 ("isi seluruh mutasi bank... semua
// bank lengkap, dimulai dari 1 Januari"). Data sudah diekstrak & divalidasi
// (running balance tiap tab dicocokkan ke "Saldo Akhir" summary sheet -
// 13/15 cocok persis, 2 sisanya ada diskontinuitas balance di sumbernya
// sendiri, ditandai transparan ke Kevin, bukan ditutup-tutupi) ke
// scripts/bank-import-data/*.json oleh agent riset terpisah. Idempoten per
// akun: skip kalau BankAccount itu SUDAH punya baris (aman dijalankan ulang
// tanpa dobel impor).
const DATA_DIR = path.join(__dirname, "bank-import-data");

type BankMeta = { file: string; name: string; bankName: string };

const BANKS: BankMeta[] = [
  { file: "bca-kevin-887-8870759925.json", name: "Bank Kevin Giovanni BCA 887 (8870759925)", bankName: "BCA" },
  { file: "bca-eric-6250313011.json", name: "Bank BCA - Eric Jonsen Feilansius (6250313011)", bankName: "BCA" },
  { file: "bca-sgb-8870721707.json", name: "Bank BCA - PT Santap Gembira Bersama 8870721707", bankName: "BCA" },
  { file: "bca-sgb-8870688823.json", name: "Bank BCA - PT Santap Gembira Bersama 8870688823", bankName: "BCA" },
  { file: "mandiri-sgb-1550077668898.json", name: "Bank Mandiri - Santap Gembira 1550077668898", bankName: "Mandiri" },
  { file: "bri-sgb-039601001406569.json", name: "Bank BRI - Santap Gembira 039601001406569", bankName: "BRI" },
  { file: "bca-petty-cash-yeromona-5390930951.json", name: "Bank BCA - Petty Cash Yeromona 5390930951", bankName: "BCA" },
  { file: "bank-paper.json", name: "Bank Paper", bankName: "Paper" },
  { file: "flip-sgb.json", name: "FLIP - SANTAP GEMBIRA BERSAMA", bankName: "FLIP" },
  { file: "superbank-kevin.json", name: "Superbank - Kevin Giovanni", bankName: "Superbank" },
  { file: "bca-sbb-3980300128.json", name: "Bank BCA - Santap Bersukacita Bersama 3980300128", bankName: "BCA" },
  { file: "mandiri-sbb-1640006130977.json", name: "Bank Mandiri - Santap Bersukacita Bersama 1640006130977", bankName: "Mandiri" },
  { file: "bri-sbb-039601001407565.json", name: "Bank BRI - Santap Bersukacita Bersama 039601001407565", bankName: "BRI" },
  { file: "bca-kevin-761-7615420298.json", name: "Bank Kevin Giovanni BCA 761 (7615420298)", bankName: "BCA" },
  // Ditemukan sbg tab ke-15 di spreadsheet, BUKAN bagian dari 14 akun yang
  // Kevin sebut awalnya ("Needs Review" di summary sheet) - tetap diimpor
  // (data lengkap & valid) tapi WAJIB ditandai transparan ke Kevin.
  { file: "mekaripay-crackling.json", name: "MekariPay - Crackling (Company ID 721172)", bankName: "MekariPay" },
];

type Row = { date: string; description: string; amount: number; balance: number };

async function main() {
  const bankParent = await prisma.account.findUniqueOrThrow({ where: { code: "1-1010" } });

  let n = 1;
  for (const meta of BANKS) {
    const filePath = path.join(DATA_DIR, meta.file);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP (file tidak ada): ${meta.file}`);
      continue;
    }
    const rows: Row[] = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const code = `1-1010-${String(n).padStart(2, "0")}`;
    n++;
    const account = await prisma.account.upsert({
      where: { code },
      update: { name: meta.name, parentId: bankParent.id },
      create: { code, name: meta.name, type: "ASSET", subType: "Aset Lancar", parentId: bankParent.id },
    });

    let bankAccount = await prisma.bankAccount.findFirst({ where: { name: meta.name } });
    if (!bankAccount) {
      bankAccount = await prisma.bankAccount.create({
        data: { name: meta.name, accountId: account.id, bankName: meta.bankName },
      });
    }

    const existingCount = await prisma.bankStatementLine.count({ where: { bankAccountId: bankAccount.id } });
    if (existingCount > 0) {
      console.log(`SKIP (sudah ada ${existingCount} baris): ${meta.name}`);
      continue;
    }

    const data = rows.map((r) => ({
      bankAccountId: bankAccount!.id,
      date: new Date(r.date),
      description: r.description || "(tanpa keterangan)",
      amount: Math.round(r.amount),
      balance: Math.round(r.balance),
    }));

    // Batch insert - ribuan baris per akun, createMany jauh lebih cepat drpd
    // create satu-satu (createMany tidak perlu di-parallel-batch spt
    // sync-sales Cost Center krn ini 1 statement SQL, bukan N request HTTP
    // terpisah).
    await prisma.bankStatementLine.createMany({ data });

    const last = rows[rows.length - 1];
    console.log(`OK: ${meta.name} (${code}) - ${rows.length} baris, saldo akhir sumber Rp${last?.balance.toLocaleString("id-ID") ?? "-"}`);
  }
}

main().finally(() => prisma.$disconnect());

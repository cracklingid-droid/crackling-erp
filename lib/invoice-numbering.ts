import type { Prisma } from "@prisma/client";

// Nomor invoice format: INV/<branchCode>/<yyMM>/<seq 4 digit>, mis.
// "INV/GS/2609/0001" - reset ke 0001 tiap bulan per cabang (permintaan Kevin
// 2026-09-15: "nomor invoice mengikuti cabang masing-masing"). Counter
// disimpan di InvoiceCounter (key = `${branchCode}:${yyMM}`), di-increment
// ATOMIK dlm transaksi yg sama dgn insert Invoice (WAJIB dipanggil di dalam
// prisma.$transaction milik pemanggil) supaya 2 invoice yg dibuat nyaris
// bersamaan tidak pernah dapat nomor yang sama.
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, branchCode: string, date: Date): Promise<string> {
  const yyMM = `${String(date.getUTCFullYear()).slice(2)}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const key = `${branchCode}:${yyMM}`;

  const counter = await tx.invoiceCounter.upsert({
    where: { key },
    update: { lastSeq: { increment: 1 } },
    create: { key, lastSeq: 1 },
  });

  return `INV/${branchCode}/${yyMM}/${String(counter.lastSeq).padStart(4, "0")}`;
}

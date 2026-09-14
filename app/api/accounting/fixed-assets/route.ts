import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { postJournalEntry, AccountingPostingError } from "@/lib/accounting-ledger";
import { monthlyDepreciation } from "@/lib/accounting-fixed-assets";

function parseDateOnly(s: unknown): Date | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const assets = await prisma.fixedAsset.findMany({
    include: { depreciationEntries: { select: { yearMonth: true, amount: true } } },
    orderBy: [{ acquisitionDate: "desc" }, { id: "desc" }],
  });

  const accountIds = new Set<number>();
  for (const a of assets) {
    accountIds.add(a.assetAccountId);
    accountIds.add(a.accumDepreciationAccountId);
    accountIds.add(a.depreciationExpenseAccountId);
  }
  const accounts = await prisma.account.findMany({
    where: { id: { in: [...accountIds] } },
    select: { id: true, code: true, name: true },
  });
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const result = assets.map(({ depreciationEntries, ...a }) => {
    const accumulatedDepreciation = depreciationEntries.reduce((sum, d) => sum + d.amount, 0);
    const lastDepreciatedMonth = depreciationEntries.reduce<string | null>(
      (max, d) => (max === null || d.yearMonth > max ? d.yearMonth : max),
      null
    );
    return {
      ...a,
      assetAccount: accountById.get(a.assetAccountId) ?? null,
      accumDepreciationAccount: accountById.get(a.accumDepreciationAccountId) ?? null,
      depreciationExpenseAccount: accountById.get(a.depreciationExpenseAccountId) ?? null,
      monthlyDepreciation: monthlyDepreciation(a),
      accumulatedDepreciation,
      bookValue: a.acquisitionCost - accumulatedDepreciation,
      lastDepreciatedMonth,
      depreciationCount: depreciationEntries.length,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const acquisitionDate = parseDateOnly(body.acquisitionDate);
  const acquisitionCost = Number.isInteger(body.acquisitionCost) ? body.acquisitionCost : 0;
  const usefulLifeMonths = Number.isInteger(body.usefulLifeMonths) ? body.usefulLifeMonths : 0;
  const residualValue = body.residualValue === undefined ? 0 : Number.isInteger(body.residualValue) ? body.residualValue : -1;
  const assetAccountId = Number.isInteger(body.assetAccountId) ? body.assetAccountId : null;
  const accumDepreciationAccountId = Number.isInteger(body.accumDepreciationAccountId) ? body.accumDepreciationAccountId : null;
  const depreciationExpenseAccountId = Number.isInteger(body.depreciationExpenseAccountId) ? body.depreciationExpenseAccountId : null;
  const postAcquisition = body.postAcquisition === true;
  const paymentAccountId = Number.isInteger(body.paymentAccountId) ? body.paymentAccountId : null;

  if (!name) return NextResponse.json({ error: "Nama aset wajib diisi" }, { status: 400 });
  if (!category) return NextResponse.json({ error: "Kategori wajib diisi" }, { status: 400 });
  if (!acquisitionDate) return NextResponse.json({ error: "Tanggal perolehan tidak valid (format YYYY-MM-DD)" }, { status: 400 });
  if (acquisitionCost <= 0) return NextResponse.json({ error: "Harga perolehan harus lebih dari 0" }, { status: 400 });
  if (usefulLifeMonths < 1) return NextResponse.json({ error: "Umur ekonomis minimal 1 bulan" }, { status: 400 });
  if (residualValue < 0) return NextResponse.json({ error: "Nilai residu tidak boleh negatif" }, { status: 400 });
  if (residualValue >= acquisitionCost) return NextResponse.json({ error: "Nilai residu harus lebih kecil dari harga perolehan" }, { status: 400 });
  if (!assetAccountId || !accumDepreciationAccountId || !depreciationExpenseAccountId) {
    return NextResponse.json({ error: "Akun aset, akumulasi penyusutan, dan beban penyusutan wajib dipilih" }, { status: 400 });
  }
  if (postAcquisition && !paymentAccountId) {
    return NextResponse.json({ error: "Akun pembayaran wajib dipilih kalau jurnal perolehan dicatat" }, { status: 400 });
  }

  const ids = [assetAccountId, accumDepreciationAccountId, depreciationExpenseAccountId, ...(paymentAccountId ? [paymentAccountId] : [])];
  const accounts = await prisma.account.findMany({ where: { id: { in: ids } } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const assetAcc = byId.get(assetAccountId);
  const accumAcc = byId.get(accumDepreciationAccountId);
  const expenseAcc = byId.get(depreciationExpenseAccountId);
  if (!assetAcc || !accumAcc || !expenseAcc) return NextResponse.json({ error: "Ada akun yang tidak ditemukan di COA" }, { status: 400 });
  if (assetAcc.type !== "ASSET") return NextResponse.json({ error: `Akun aset "${assetAcc.code}" harus bertipe Aset` }, { status: 400 });
  if (accumAcc.type !== "ASSET") return NextResponse.json({ error: `Akun akumulasi "${accumAcc.code}" harus bertipe Aset (kontra)` }, { status: 400 });
  if (expenseAcc.type !== "EXPENSE") return NextResponse.json({ error: `Akun beban penyusutan "${expenseAcc.code}" harus bertipe Beban` }, { status: 400 });
  if (paymentAccountId && !byId.get(paymentAccountId)) return NextResponse.json({ error: "Akun pembayaran tidak ditemukan di COA" }, { status: 400 });

  try {
    // Simpan aset + (opsional) jurnal perolehan sbg 1 unit atomik.
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.fixedAsset.create({
        data: {
          name,
          category,
          acquisitionDate,
          acquisitionCost,
          usefulLifeMonths,
          residualValue,
          assetAccountId,
          accumDepreciationAccountId,
          depreciationExpenseAccountId,
        },
      });
      if (postAcquisition && paymentAccountId) {
        await postJournalEntry(
          {
            date: acquisitionDate,
            memo: `Perolehan aset tetap ${name}`,
            sourceType: "FIXED_ASSET_ACQUISITION",
            sourceId: String(created.id),
            createdById: user.id,
            lines: [
              { accountId: assetAccountId, debit: acquisitionCost, description: name },
              { accountId: paymentAccountId, credit: acquisitionCost, description: name },
            ],
          },
          tx
        );
      }
      return created;
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (e) {
    if (e instanceof AccountingPostingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

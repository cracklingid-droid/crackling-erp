import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { replaceJournalEntry, AccountingPostingError } from "@/lib/accounting-ledger";

// Field yang cuma boleh diubah selama BELUM ada posting penyusutan - kalau
// sudah ada, akumulasi & jurnal lama jadi tidak konsisten.
const LOCKED_AFTER_DEPRECIATION = ["acquisitionCost", "acquisitionDate", "assetAccountId", "accumDepreciationAccountId", "depreciationExpenseAccountId"];

function parseDateOnly(s: unknown): Date | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const assetId = Number(id);
  if (!Number.isInteger(assetId)) return NextResponse.json({ error: "ID aset tidak valid" }, { status: 400 });

  const asset = await prisma.fixedAsset.findUnique({
    where: { id: assetId },
    include: { _count: { select: { depreciationEntries: true } } },
  });
  if (!asset) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });

  const body = await req.json();
  const hasDepreciation = asset._count.depreciationEntries > 0;
  if (hasDepreciation && LOCKED_AFTER_DEPRECIATION.some((k) => body[k] !== undefined)) {
    return NextResponse.json(
      { error: "Harga perolehan, tanggal perolehan, dan akun tidak bisa diubah setelah ada posting penyusutan" },
      { status: 400 }
    );
  }

  const data: {
    name?: string;
    category?: string;
    isActive?: boolean;
    residualValue?: number;
    usefulLifeMonths?: number;
    acquisitionCost?: number;
    acquisitionDate?: Date;
    assetAccountId?: number;
    accumDepreciationAccountId?: number;
    depreciationExpenseAccountId?: number;
  } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "Nama aset wajib diisi" }, { status: 400 });
    data.name = body.name.trim();
  }
  if (body.category !== undefined) {
    if (typeof body.category !== "string" || !body.category.trim()) return NextResponse.json({ error: "Kategori wajib diisi" }, { status: 400 });
    data.category = body.category.trim();
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.residualValue !== undefined) {
    if (!Number.isInteger(body.residualValue) || body.residualValue < 0) return NextResponse.json({ error: "Nilai residu tidak boleh negatif" }, { status: 400 });
    data.residualValue = body.residualValue;
  }
  if (body.usefulLifeMonths !== undefined) {
    if (!Number.isInteger(body.usefulLifeMonths) || body.usefulLifeMonths < 1) return NextResponse.json({ error: "Umur ekonomis minimal 1 bulan" }, { status: 400 });
    data.usefulLifeMonths = body.usefulLifeMonths;
  }
  if (body.acquisitionCost !== undefined) {
    if (!Number.isInteger(body.acquisitionCost) || body.acquisitionCost <= 0) return NextResponse.json({ error: "Harga perolehan harus lebih dari 0" }, { status: 400 });
    data.acquisitionCost = body.acquisitionCost;
  }
  if (body.acquisitionDate !== undefined) {
    const d = parseDateOnly(body.acquisitionDate);
    if (!d) return NextResponse.json({ error: "Tanggal perolehan tidak valid (format YYYY-MM-DD)" }, { status: 400 });
    data.acquisitionDate = d;
  }

  // Validasi akun (kalau ada yang dikirim): harus ada di COA + tipe cocok.
  const accountFields = [
    { key: "assetAccountId", type: "ASSET", label: "Akun aset" },
    { key: "accumDepreciationAccountId", type: "ASSET", label: "Akun akumulasi penyusutan" },
    { key: "depreciationExpenseAccountId", type: "EXPENSE", label: "Akun beban penyusutan" },
  ] as const;
  const requestedAccountIds = accountFields.filter((f) => body[f.key] !== undefined).map((f) => body[f.key]);
  if (requestedAccountIds.length > 0) {
    if (!requestedAccountIds.every((v) => Number.isInteger(v))) return NextResponse.json({ error: "ID akun tidak valid" }, { status: 400 });
    const accounts = await prisma.account.findMany({ where: { id: { in: requestedAccountIds } } });
    const byId = new Map(accounts.map((a) => [a.id, a]));
    for (const f of accountFields) {
      if (body[f.key] === undefined) continue;
      const acc = byId.get(body[f.key]);
      if (!acc) return NextResponse.json({ error: `${f.label} tidak ditemukan di COA` }, { status: 400 });
      if (acc.type !== f.type) return NextResponse.json({ error: `${f.label} "${acc.code}" tipenya tidak cocok` }, { status: 400 });
      data[f.key] = acc.id;
    }
  }

  const effectiveCost = data.acquisitionCost ?? asset.acquisitionCost;
  const effectiveResidual = data.residualValue ?? asset.residualValue;
  if (effectiveResidual >= effectiveCost) return NextResponse.json({ error: "Nilai residu harus lebih kecil dari harga perolehan" }, { status: 400 });

  try {
    // Kalau harga/tanggal/akun aset berubah & jurnal perolehannya sudah pernah
    // dicatat, posting ulang jurnal itu (akun pembayaran diambil dari baris
    // kredit entry lama) supaya buku besar ikut berubah.
    const acquisitionChanged = data.acquisitionCost !== undefined || data.acquisitionDate !== undefined || data.assetAccountId !== undefined || data.name !== undefined;
    if (acquisitionChanged) {
      const existing = await prisma.journalEntry.findFirst({
        where: { sourceType: "FIXED_ASSET_ACQUISITION", sourceId: String(asset.id) },
        include: { lines: true },
      });
      const paymentLine = existing?.lines.find((l) => l.credit > 0);
      if (existing && paymentLine) {
        const newName = data.name ?? asset.name;
        await replaceJournalEntry({
          date: data.acquisitionDate ?? asset.acquisitionDate,
          memo: `Perolehan aset tetap ${newName}`,
          sourceType: "FIXED_ASSET_ACQUISITION",
          sourceId: String(asset.id),
          createdById: user.id,
          lines: [
            { accountId: data.assetAccountId ?? asset.assetAccountId, debit: effectiveCost, description: newName },
            { accountId: paymentLine.accountId, credit: effectiveCost, description: newName },
          ],
        });
      }
    }

    const updated = await prisma.fixedAsset.update({ where: { id: asset.id }, data });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof AccountingPostingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

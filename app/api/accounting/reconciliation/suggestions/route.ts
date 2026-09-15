import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

// Rekomendasi transfer antar bank / top-up petty cash (permintaan Kevin
// 2026-09-15): cari pasangan mutasi BELUM recon di 2 akun bank berbeda
// dgn nominal sama, arah berlawanan (keluar di A, masuk di B), tanggal
// selisih <= 3 hari. Skor: hari sama +2, <=3 hari +1, ada kata kunci
// (petty cash/pb/transfer/topup/pindah/setor) +1, keterangan menyebut nama
// bank/akun lawan +1. Tiap mutasi cuma dipasangkan sekali (greedy dari skor
// tertinggi). Hasilnya cuma SARAN - dicatat jadi jurnal transfer lewat
// POST /api/accounting/reconciliation/transfer sesudah Kevin klik.
const KEYWORDS = ["petty cash", "pettycash", "petty", " pb ", "transfer", "trsf", "topup", "top up", "pindah", "setor", "kas kecil"];
const MAX_DAY_DIFF = 3;

export type TransferSuggestion = {
  fromLineId: number;
  toLineId: number;
  amount: number;
  date: string;
  dayDiff: number;
  score: number;
  confidence: "tinggi" | "sedang" | "rendah";
  from: { bankAccountId: number; bankName: string; date: string; description: string };
  to: { bankAccountId: number; bankName: string; date: string; description: string };
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const bankAccountId = Number(searchParams.get("bankAccountId")) || null;
  const limit = Math.min(500, Number(searchParams.get("limit")) || 200);

  const [banks, lines] = await Promise.all([
    prisma.bankAccount.findMany({ select: { id: true, name: true, accountNumber: true, bankName: true } }),
    prisma.bankStatementLine.findMany({
      where: { matchedJournalLineId: null, amount: { not: 0 } },
      select: { id: true, bankAccountId: true, date: true, description: true, amount: true },
      orderBy: { date: "asc" },
    }),
  ]);
  const bankById = new Map(banks.map((b) => [b.id, b]));
  const bankTokens = new Map(
    banks.map((b) => {
      const tokens = new Set<string>();
      const m = b.name.match(/\d{6,}/g);
      for (const t of m ?? []) tokens.add(t.slice(-6));
      b.name
        .toLowerCase()
        .replace(/[()\-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !["bank", "santap", "gembira", "bersama", "bersukacita"].includes(w))
        .forEach((w) => tokens.add(w));
      return [b.id, tokens];
    })
  );

  const byAmount = new Map<number, { out: typeof lines; in: typeof lines }>();
  for (const l of lines) {
    const key = Math.abs(l.amount);
    const g = byAmount.get(key) ?? { out: [], in: [] };
    if (l.amount < 0) g.out.push(l);
    else g.in.push(l);
    byAmount.set(key, g);
  }

  type Cand = TransferSuggestion;
  const cands: Cand[] = [];
  for (const [amount, g] of byAmount) {
    if (g.out.length === 0 || g.in.length === 0) continue;
    for (const o of g.out) {
      for (const i of g.in) {
        if (o.bankAccountId === i.bankAccountId) continue;
        const dayDiff = Math.abs(Math.round((i.date.getTime() - o.date.getTime()) / 86400000));
        if (dayDiff > MAX_DAY_DIFF) continue;
        let score = dayDiff === 0 ? 2 : 1;
        const desc = `${o.description} ${i.description}`.toLowerCase();
        if (KEYWORDS.some((k) => desc.includes(k))) score += 1;
        const toTokens = bankTokens.get(i.bankAccountId) ?? new Set<string>();
        const fromTokens = bankTokens.get(o.bankAccountId) ?? new Set<string>();
        if ([...toTokens].some((t) => o.description.toLowerCase().includes(t)) || [...fromTokens].some((t) => i.description.toLowerCase().includes(t))) score += 1;
        const fb = bankById.get(o.bankAccountId)!;
        const tb = bankById.get(i.bankAccountId)!;
        cands.push({
          fromLineId: o.id,
          toLineId: i.id,
          amount,
          date: o.date.toISOString().slice(0, 10),
          dayDiff,
          score,
          confidence: score >= 4 ? "tinggi" : score >= 3 ? "sedang" : "rendah",
          from: { bankAccountId: fb.id, bankName: fb.name, date: o.date.toISOString().slice(0, 10), description: o.description },
          to: { bankAccountId: tb.id, bankName: tb.name, date: i.date.toISOString().slice(0, 10), description: i.description },
        });
      }
    }
  }

  cands.sort((a, b) => b.score - a.score || a.dayDiff - b.dayDiff || b.amount - a.amount);
  const used = new Set<number>();
  const picked: Cand[] = [];
  for (const c of cands) {
    if (used.has(c.fromLineId) || used.has(c.toLineId)) continue;
    if (bankAccountId && c.from.bankAccountId !== bankAccountId && c.to.bankAccountId !== bankAccountId) continue;
    used.add(c.fromLineId);
    used.add(c.toLineId);
    picked.push(c);
  }
  picked.sort((a, b) => b.date.localeCompare(a.date) || b.score - a.score);

  return NextResponse.json({ total: picked.length, suggestions: picked.slice(0, limit) });
}

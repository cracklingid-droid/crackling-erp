import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { getAccountBalances, netIncome, parseDateParam, endOfDay, type AccountBalance } from "@/lib/accounting-reports";

// Laporan keuangan DITURUNKAN dari buku besar (JournalLine) tiap kali
// diminta - tidak ada saldo tersimpan. type=pl (Laba Rugi, rentang tanggal),
// bs (Neraca, per tanggal asOf - akumulasi sejak awal buku), cf (Arus Kas
// metode LANGSUNG: mutasi riil akun Kas/Bank dikelompokkan per akun lawan,
// v1 - lihat plan). outlet opsional utk P&L per outlet.
//
// Neraca: Laba/Rugi berjalan (REVENUE-EXPENSE sejak awal buku s/d asOf)
// ditambahkan ke sisi Ekuitas sbg "Laba Berjalan" supaya Aset = Liabilitas
// + Ekuitas selalu balance walau belum ada jurnal tutup buku.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "pl";
  const outlet = searchParams.get("outlet") || null;
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const end = parseDateParam(searchParams.get("end")) ?? today;
  const start = parseDateParam(searchParams.get("start")) ?? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  const firstEntry = await prisma.journalEntry.findFirst({ orderBy: { date: "asc" }, select: { date: true } });
  const hasOpening = !!(await prisma.journalEntry.findFirst({ where: { sourceType: "OPENING_BALANCE" }, select: { id: true } }));

  if (type === "pl") {
    const balances = (await getAccountBalances({ start, end: endOfDay(end), outletName: outlet })).filter((b) => b.type === "REVENUE" || b.type === "EXPENSE");
    return NextResponse.json({
      type,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      outlet,
      revenue: group(balances.filter((b) => b.type === "REVENUE")),
      cogs: group(balances.filter((b) => b.type === "EXPENSE" && b.code.startsWith("5-"))),
      expenses: group(balances.filter((b) => b.type === "EXPENSE" && !b.code.startsWith("5-"))),
      netIncome: netIncome(balances),
      ledgerStart: firstEntry?.date ?? null,
    });
  }

  // Laba Rugi side-by-side (permintaan Kevin 2026-09-15): mode=period ->
  // 1 kolom per bulan (periods=2026-07,2026-08,...), mode=outlet -> 1 kolom
  // per outlet + Konsolidasi utk rentang start..end. Persentase (% dari
  // pendapatan kolom itu) dihitung di client dari totals.
  if (type === "pl_compare") {
    const mode = searchParams.get("mode") === "outlet" ? "outlet" : "period";
    const columns: { key: string; label: string; start: Date; end: Date; outlet: string | null }[] = [];
    if (mode === "period") {
      const periods = (searchParams.get("periods") ?? "").split(",").map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}$/.test(s)).slice(0, 12);
      if (periods.length === 0) return NextResponse.json({ error: "periods wajib diisi (YYYY-MM,...)" }, { status: 400 });
      for (const ym of periods) {
        const [y, m] = ym.split("-").map(Number);
        const s = new Date(Date.UTC(y, m - 1, 1));
        const e = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        columns.push({ key: ym, label: s.toLocaleDateString("id-ID", { month: "short", year: "numeric", timeZone: "UTC" }), start: s, end: e, outlet });
      }
    } else {
      const outlets = ["Gading Serpong", "Kelapa Gading", "Fatgai", "Joglo (Central Kitchen)"];
      for (const o of outlets) columns.push({ key: o, label: o, start, end: endOfDay(end), outlet: o });
      columns.push({ key: "__all", label: "Konsolidasi", start, end: endOfDay(end), outlet: null });
    }

    const perColumn = await Promise.all(columns.map((c) => getAccountBalances({ start: c.start, end: c.end, outletName: c.outlet })));
    type CmpRow = { code: string; name: string; values: number[] };
    const rowsByCode = new Map<string, CmpRow & { type: string }>();
    perColumn.forEach((balances, ci) => {
      for (const b of balances) {
        if (b.type !== "REVENUE" && b.type !== "EXPENSE") continue;
        const row = rowsByCode.get(b.code) ?? { code: b.code, name: b.name, type: b.type, values: new Array(columns.length).fill(0) };
        row.values[ci] = b.balance;
        rowsByCode.set(b.code, row);
      }
    });
    const rows = Array.from(rowsByCode.values()).filter((r) => r.values.some((v) => v !== 0)).sort((a, b) => a.code.localeCompare(b.code));
    const pick = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).map(({ code, name, values }) => ({ code, name, values }));
    const revenue = pick((r) => r.type === "REVENUE");
    const cogs = pick((r) => r.type === "EXPENSE" && r.code.startsWith("5-"));
    const expenses = pick((r) => r.type === "EXPENSE" && !r.code.startsWith("5-"));
    const sum = (rs: CmpRow[]) => columns.map((_, ci) => rs.reduce((s, r) => s + r.values[ci], 0));
    const tRev = sum(revenue);
    const tCogs = sum(cogs);
    const tExp = sum(expenses);
    return NextResponse.json({
      type,
      mode,
      columns: columns.map((c) => ({ key: c.key, label: c.label, start: c.start.toISOString().slice(0, 10), end: c.end.toISOString().slice(0, 10) })),
      sections: { revenue, cogs, expenses },
      totals: {
        revenue: tRev,
        cogs: tCogs,
        grossProfit: tRev.map((v, i) => v - tCogs[i]),
        expenses: tExp,
        netIncome: tRev.map((v, i) => v - tCogs[i] - tExp[i]),
      },
      ledgerStart: firstEntry?.date ?? null,
    });
  }

  if (type === "bs") {
    const balances = await getAccountBalances({ start: null, end: endOfDay(end), outletName: outlet });
    const income = netIncome(balances);
    const assets = group(balances.filter((b) => b.type === "ASSET"));
    const liabilities = group(balances.filter((b) => b.type === "LIABILITY"));
    const equity = group(balances.filter((b) => b.type === "EQUITY"));
    return NextResponse.json({
      type,
      asOf: end.toISOString().slice(0, 10),
      outlet,
      assets,
      liabilities,
      equity,
      currentEarnings: income,
      totalAssets: assets.total,
      totalLiabilitiesEquity: liabilities.total + equity.total + income,
      ledgerStart: firstEntry?.date ?? null,
      hasOpeningBalance: hasOpening,
    });
  }

  if (type === "cf") {
    const cashAccounts = await prisma.account.findMany({ where: { type: "ASSET", code: { startsWith: "1-10" } }, select: { id: true } });
    const cashIds = new Set(cashAccounts.map((a) => a.id));
    const entries = await prisma.journalEntry.findMany({
      where: { date: { gte: start, lte: endOfDay(end) }, lines: { some: { accountId: { in: Array.from(cashIds) } } }, ...(outlet ? { outletName: outlet } : {}) },
      include: { lines: { include: { account: { select: { code: true, name: true, type: true } } } } },
    });
    // Per entry: net kas = sum(debit-credit) baris kas; dialokasikan ke akun
    // lawan (non-kas) proporsional - utk entry sederhana 2 baris hasilnya
    // persis nilai baris lawan.
    const byCounter = new Map<string, { code: string; name: string; type: string; amount: number }>();
    let opening = 0;
    let inflow = 0;
    let outflow = 0;
    for (const e of entries) {
      const cashNet = e.lines.filter((l) => cashIds.has(l.accountId)).reduce((s, l) => s + l.debit - l.credit, 0);
      if (cashNet === 0) continue;
      const counters = e.lines.filter((l) => !cashIds.has(l.accountId));
      const counterTotal = counters.reduce((s, l) => s + Math.abs(l.debit - l.credit), 0) || 1;
      for (const l of counters) {
        const share = Math.round((cashNet * Math.abs(l.debit - l.credit)) / counterTotal);
        const c = byCounter.get(l.account.code) ?? { code: l.account.code, name: l.account.name, type: l.account.type, amount: 0 };
        c.amount += share;
        byCounter.set(l.account.code, c);
      }
      if (cashNet > 0) inflow += cashNet;
      else outflow += -cashNet;
    }
    const before = await prisma.journalLine.findMany({ where: { accountId: { in: Array.from(cashIds) }, journalEntry: { date: { lt: start }, ...(outlet ? { outletName: outlet } : {}) } }, select: { debit: true, credit: true } });
    opening = before.reduce((s, l) => s + l.debit - l.credit, 0);
    const rows = Array.from(byCounter.values()).sort((a, b) => a.code.localeCompare(b.code));
    const section = (pred: (r: (typeof rows)[number]) => boolean) => {
      const items = rows.filter(pred);
      return { items, total: items.reduce((s, r) => s + r.amount, 0) };
    };
    const operating = section((r) => r.type === "REVENUE" || r.type === "EXPENSE" || r.code.startsWith("1-11") || r.code.startsWith("1-12") || r.code.startsWith("2-1"));
    const investing = section((r) => r.code.startsWith("1-2"));
    const financing = section((r) => r.type === "EQUITY" || r.code.startsWith("2-11"));
    const classified = new Set([...operating.items, ...investing.items, ...financing.items].map((r) => r.code));
    const other = section((r) => !classified.has(r.code));
    return NextResponse.json({
      type,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      outlet,
      openingCash: opening,
      operating,
      investing,
      financing,
      other,
      netChange: inflow - outflow,
      closingCash: opening + inflow - outflow,
      ledgerStart: firstEntry?.date ?? null,
    });
  }

  return NextResponse.json({ error: "type tidak dikenal" }, { status: 400 });
}

function group(items: AccountBalance[]) {
  // Akun induk (kode xx-0000 / punya anak) tidak dijumlah dua kali: total =
  // jumlah akun yang benar-benar punya mutasi (saldo != 0), induk tampil
  // sbg header saja.
  const rows = items.filter((b) => b.balance !== 0 || b.debit !== 0 || b.credit !== 0);
  return { items: rows, total: rows.reduce((s, r) => s + r.balance, 0) };
}

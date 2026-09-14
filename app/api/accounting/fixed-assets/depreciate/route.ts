import { NextResponse } from "next/server";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { AccountingPostingError } from "@/lib/accounting-ledger";
import { runDepreciation } from "@/lib/accounting-fixed-assets";

// Posting penyusutan bulanan semua aset aktif - idempoten, aman diklik ulang
// utk bulan yang sama.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const yearMonth = typeof body.yearMonth === "string" ? body.yearMonth.trim() : "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
    return NextResponse.json({ error: "Bulan tidak valid (format YYYY-MM)" }, { status: 400 });
  }

  try {
    const summary = await runDepreciation({ yearMonth, createdById: user.id });
    return NextResponse.json(summary);
  } catch (e) {
    if (e instanceof AccountingPostingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

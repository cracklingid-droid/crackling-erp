"use client";

import Link from "next/link";
import { BookOpen, ArrowRight, Users, Package, Landmark, ShoppingCart, Receipt, Scale, FileBarChart } from "lucide-react";

const MODULES: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  ready: boolean;
}[] = [
  { href: "/accounting/coa", icon: <BookOpen className="h-5 w-5" />, title: "Chart of Accounts", description: "Daftar akun (COA) - dasar semua jurnal.", ready: true },
  { href: "/accounting/contacts", icon: <Users className="h-5 w-5" />, title: "Contact", description: "Customer, Vendor, Karyawan & kontak lainnya.", ready: false },
  { href: "/accounting/products", icon: <Package className="h-5 w-5" />, title: "Product", description: "Referensi katalog item dari Warehouse.", ready: false },
  { href: "/accounting/fixed-assets", icon: <Landmark className="h-5 w-5" />, title: "Fixed Asset", description: "Daftar aset tetap & depresiasi garis lurus.", ready: false },
  { href: "/accounting/sales", icon: <ShoppingCart className="h-5 w-5" />, title: "Record Sales", description: "Omzet harian per produk (dari POS).", ready: false },
  { href: "/accounting/expenses", icon: <Receipt className="h-5 w-5" />, title: "Direct Expense", description: "Pencatatan beban langsung.", ready: false },
  { href: "/accounting/reconciliation", icon: <Scale className="h-5 w-5" />, title: "Rekonsiliasi", description: "Mutasi bank per akun - 15 akun, ribuan baris.", ready: true },
  { href: "/accounting/reports", icon: <FileBarChart className="h-5 w-5" />, title: "Laporan", description: "P&L, Neraca, Arus Kas & Notes.", ready: false },
];

export default function AccountingHomePage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Accounting</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Pembukuan double-entry Crackling. Modul dibangun bertahap - yang belum siap ditandai &quot;Segera&quot;.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) =>
          m.ready ? (
            <Link key={m.href} href={m.href} className="group">
              <ModuleCardBody {...m} />
            </Link>
          ) : (
            <div key={m.href} className="opacity-60 cursor-not-allowed" title="Segera hadir">
              <ModuleCardBody {...m} />
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ModuleCardBody({ icon, title, description, ready }: { icon: React.ReactNode; title: string; description: string; ready: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-out group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-tile-4 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
        {icon}
      </div>
      <h2 className="text-base font-heading font-semibold mt-2.5">{title}</h2>
      <p className="text-muted-foreground text-sm mt-1">{description}</p>
      <div className="flex items-center gap-1 text-sm font-medium mt-4 pt-3 border-t">
        {ready ? (
          <span className="flex items-center gap-1 text-primary">
            Buka <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Segera hadir</span>
        )}
      </div>
    </div>
  );
}

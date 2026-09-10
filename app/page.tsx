import Link from "next/link";
import { Users, Warehouse, ArrowRight, LucideIcon } from "lucide-react";

const cardClass =
  "group block h-full rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5";

function ModuleCard({
  icon: Icon,
  title,
  desc,
  tile,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  tile: string;
}) {
  return (
    <>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3 ${tile}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-heading font-semibold mt-4">{title}</h2>
      <p className="text-muted-foreground text-sm mt-1.5">{desc}</p>
      <div className="flex items-center gap-1 text-sm font-medium text-primary mt-4">
        Buka <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </>
  );
}

export default function Home() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-medium text-primary mb-1.5">Selamat datang di</p>
          <h1 className="text-4xl font-heading font-semibold tracking-tight">Crackling ERP</h1>
          <p className="text-muted-foreground mt-2 text-sm">Pilih aplikasi yang ingin dibuka.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/hr" className={cardClass}>
            <ModuleCard
              icon={Users}
              title="Human Resource"
              desc="Rekrutmen, onboarding, data karyawan, dan proses HR lainnya."
              tile="icon-tile-1"
            />
          </Link>
          {/* Bukan halaman internal - langsung redirect ke aplikasi Crackling
              Warehouse yang sudah berjalan terpisah (permintaan Kevin 2026-09-10). */}
          <a href="https://crackling-warehouse.vercel.app/" className={cardClass}>
            <ModuleCard
              icon={Warehouse}
              title="Crackling Warehouse"
              desc="Inventory, belanja, surat jalan, dan laporan stok tiap outlet."
              tile="icon-tile-2"
            />
          </a>
        </div>
      </div>
    </div>
  );
}

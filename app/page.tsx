import { Users, Warehouse, PiggyBank } from "lucide-react";
import { ModuleCard } from "./components/ModuleCard";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-medium text-primary mb-1.5">Selamat datang di</p>
          <h1 className="text-4xl font-heading font-semibold tracking-tight">Crackling ERP</h1>
          <p className="text-muted-foreground mt-2 text-sm">Pilih aplikasi yang ingin dibuka.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            href="/hr"
            icon={<Users className="h-5 w-5" />}
            iconClass="icon-tile-1"
            title="Human Resource"
            description="Rekrutmen, onboarding, data karyawan, dan proses HR lainnya."
          />
          {/* Bukan halaman internal - langsung redirect ke aplikasi Crackling
              Warehouse yang sudah berjalan terpisah (permintaan Kevin 2026-09-10). */}
          <ModuleCard
            href="https://crackling-warehouse.vercel.app/"
            external
            icon={<Warehouse className="h-5 w-5" />}
            iconClass="icon-tile-2"
            title="Crackling Warehouse"
            description="Inventory, belanja, surat jalan, dan laporan stok tiap outlet."
          />
          {/* Akses: owner/developer/manager - halaman itu sendiri yang menolak
              role lain (403), kartu ini tetap tampil ke semua sesuai pola
              kartu lain di halaman ini. Permintaan Kevin 2026-09-12. */}
          <ModuleCard
            href="/cost-center"
            icon={<PiggyBank className="h-5 w-5" />}
            iconClass="icon-tile-3"
            title="Cost Center"
            description="Biaya gaji, pemakaian stok, dan Gross Profit per outlet."
          />
        </div>
      </div>
    </div>
  );
}

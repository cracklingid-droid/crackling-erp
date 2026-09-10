import Link from "next/link";
import { UserPlus, ArrowRight } from "lucide-react";

export default function HrHomePage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Human Resource</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">Pilih modul di bawah untuk mulai kerja.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/hr/rekrutmen" className="group">
          <div className="h-full rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-tile-1 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
              <UserPlus className="h-5 w-5" />
            </div>
            <h2 className="text-base font-heading font-semibold mt-2.5">Rekrutmen</h2>
            <p className="text-muted-foreground text-sm mt-1">Lowongan pekerjaan & pipeline kandidat.</p>
            <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3">
              Buka <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

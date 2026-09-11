import Link from "next/link";
import { ArrowLeft, ArrowRight, Upload, Store, Building2, ClipboardList } from "lucide-react";

export default function PayrollHomePage() {
  return (
    <div className="max-w-5xl">
      <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Human Resource
      </Link>
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Payroll</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">Upload absensi, lalu hitung gaji outlet dan gaji kantor secara terpisah.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/hr/payroll/absensi" className="group">
          <div className="h-full rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-tile-3 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
              <Upload className="h-5 w-5" />
            </div>
            <h2 className="text-base font-heading font-semibold mt-2.5">Upload Data Absen</h2>
            <p className="text-muted-foreground text-sm mt-1">Import rekap absensi dari mesin fingerprint untuk dasar hitung gaji.</p>
            <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3">
              Buka <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
        <Link href="/hr/payroll/rekap-absensi" className="group">
          <div className="h-full rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-tile-1 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
              <ClipboardList className="h-5 w-5" />
            </div>
            <h2 className="text-base font-heading font-semibold mt-2.5">Rekap Absensi</h2>
            <p className="text-muted-foreground text-sm mt-1">Lihat ringkasan hari hadir & jam kerja per karyawan per periode.</p>
            <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3">
              Buka <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
        <Link href="/hr/payroll/outlet" className="group">
          <div className="h-full rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-tile-2 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
              <Store className="h-5 w-5" />
            </div>
            <h2 className="text-base font-heading font-semibold mt-2.5">Perhitungan Gaji Outlet</h2>
            <p className="text-muted-foreground text-sm mt-1">Gaji pokok + uang makan/lembur dari absensi untuk karyawan outlet.</p>
            <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3">
              Buka <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
        <Link href="/hr/payroll/kantor" className="group">
          <div className="h-full rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-tile-4 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
              <Building2 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-heading font-semibold mt-2.5">Perhitungan Gaji Kantor</h2>
            <p className="text-muted-foreground text-sm mt-1">Gaji tetap + uang makan, lembur & reimbursement transport.</p>
            <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3">
              Buka <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

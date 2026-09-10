import Link from "next/link";
import { ArrowLeft, Hammer } from "lucide-react";

// Placeholder - modul HR (rekrutmen, onboarding, dst) belum dibangun.
// Dibuat dulu supaya menu "Human Resource" di hub sudah bisa diklik
// (permintaan Kevin 2026-09-10), isinya menyusul bertahap.
export default function HrPage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl icon-tile-1 mb-5">
        <Hammer className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-heading font-semibold">Human Resource</h1>
      <p className="text-muted-foreground text-sm mt-2 max-w-sm">
        Modul ini masih dalam pembangunan - rekrutmen, onboarding, dan data karyawan akan menyusul di sini.
      </p>
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary mt-6 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Crackling ERP
      </Link>
    </div>
  );
}

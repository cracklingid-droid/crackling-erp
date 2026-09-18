"use client";

import Link from "next/link";
import { ArrowLeft, Upload, Store, Building2, ClipboardList } from "lucide-react";
import { useAuthContext } from "../../../components/AuthContext";
import { ModuleCard } from "../../../components/ModuleCard";

export default function PayrollHomePage() {
  const { user } = useAuthContext();
  // "manager" cuma boleh lihat Perhitungan Gaji Outlet (view-only) -
  // Upload Absen, Rekap Absensi & Gaji Kantor disembunyikan total.
  // Permintaan Kevin 2026-09-13.
  const readOnly = user?.role === "manager";

  return (
    <div className="max-w-5xl">
      <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Human Resource
      </Link>
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Payroll</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {readOnly ? "Lihat perhitungan & slip gaji outlet." : "Upload absensi, lalu hitung gaji outlet dan gaji kantor secara terpisah."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {!readOnly && (
          <ModuleCard
            href="/hr/payroll/absensi"
            icon={<Upload className="h-5 w-5" />}
            iconClass="icon-tile-3"
            title="Upload Data Absen"
            description="Import rekap absensi dari mesin fingerprint untuk dasar hitung gaji."
          />
        )}
        {!readOnly && (
          <ModuleCard
            href="/hr/payroll/rekap-absensi"
            icon={<ClipboardList className="h-5 w-5" />}
            iconClass="icon-tile-1"
            title="Rekap Absensi"
            description="Lihat ringkasan hari hadir & jam kerja per karyawan per periode."
          />
        )}
        <ModuleCard
          href="/hr/payroll/outlet"
          icon={<Store className="h-5 w-5" />}
          iconClass="icon-tile-2"
          title="Perhitungan Gaji Outlet"
          description="Gaji pokok + uang makan/lembur dari absensi untuk karyawan outlet."
        />
        {!readOnly && (
          <ModuleCard
            href="/hr/payroll/kantor"
            icon={<Building2 className="h-5 w-5" />}
            iconClass="icon-tile-4"
            title="Perhitungan Gaji Kantor"
            description="Gaji tetap + uang makan, lembur, keterlambatan & BPJS kantor."
          />
        )}
      </div>
    </div>
  );
}

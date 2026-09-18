"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { OUTLET_SLUGS } from "@/lib/roster";
import { ModuleCard } from "@/app/components/ModuleCard";

export default function RosterHomePage() {
  return (
    <div className="max-w-3xl">
      <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Human Resource
      </Link>
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Roster Kerja</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Atur jadwal masuk/libur karyawan per outlet per minggu. Tiap outlet punya link publik yang bisa dibagikan ke
          karyawan, tanpa perlu login.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(OUTLET_SLUGS).map(([outlet, slug]) => (
          <ModuleCard key={slug} href={`/hr/roster/${slug}`} icon={<CalendarDays className="h-5 w-5" />} iconClass="icon-tile-2" title={outlet} />
        ))}
      </div>
    </div>
  );
}

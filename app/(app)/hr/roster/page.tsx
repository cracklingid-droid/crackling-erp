"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { OUTLET_SLUGS } from "@/lib/roster";

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
          <Link key={slug} href={`/hr/roster/${slug}`} className="group">
            <Card className="h-full transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <CardContent className="pt-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-tile-2 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <h2 className="text-base font-heading font-semibold mt-2.5">{outlet}</h2>
                <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3">
                  Atur Roster <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

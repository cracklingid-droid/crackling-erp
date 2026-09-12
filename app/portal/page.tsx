"use client";

import Link from "next/link";
import { usePortalContext } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, CalendarDays, Receipt } from "lucide-react";

const MENU = [
  { href: "/portal/profil", label: "Profil Saya", desc: "Lihat biodata & data kepegawaian", icon: User },
  { href: "/portal/roster", label: "Roster Kerja", desc: "Jadwal masuk/libur mingguan", icon: CalendarDays },
  { href: "/portal/slip-gaji", label: "Slip Gaji", desc: "Riwayat & download slip gaji", icon: Receipt },
];

export default function PortalHomePage() {
  const { employee } = usePortalContext();

  return (
    <div className="max-w-2xl grid gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Halo, {employee?.name}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {[employee?.position, employee?.outlet].filter(Boolean).join(" · ") || "Selamat datang di Portal Karyawan"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {MENU.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full hover:border-primary/40 transition-colors">
              <CardHeader className="gap-2">
                <m.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{m.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

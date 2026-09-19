"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "../components/AuthContext";
import { AppSidebar } from "../components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

// Di tablet (768-1023px) sidebar penuh (256px) memakan sepertiga layar -
// tabel Payroll/Database Karyawan cuma sisa 2-3 kolom. Ciutkan ke rail ikon
// otomatis SEKALI saat pertama buka, kecuali user sudah pernah memilih
// sendiri (cookie sidebar_state ada). Tetap bisa dibuka lewat tombol.
// Perbaikan UI menyeluruh 2026-09-19.
function AutoCollapseOnTablet() {
  const { setOpen, isMobile } = useSidebar();
  useEffect(() => {
    if (isMobile) return;
    const hasPreference = document.cookie.split("; ").some((c) => c.startsWith("sidebar_state="));
    if (!hasPreference && window.innerWidth < 1024) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// Layout ERP: sidebar kiri yang bisa diciutkan (pola sama persis dgn
// Crackling Warehouse) + header tipis berisi tombol ciut/buka & nama modul.
// Permintaan Kevin 2026-09-15 - dulu navigasi ada di TopBar horizontal.
function moduleTitle(pathname: string): string {
  if (pathname.startsWith("/cost-center")) return "Cost Center";
  if (pathname.startsWith("/lembur")) return "Lembur";
  if (pathname.startsWith("/hr")) return "Human Resource";
  return "Crackling ERP";
}

function Header() {
  const pathname = usePathname();
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <span className="text-sm font-medium text-muted-foreground">{moduleTitle(pathname ?? "")}</span>
    </header>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AutoCollapseOnTablet />
        <AppSidebar />
        <SidebarInset>
          <Header />
          {/* min-w-0 wajib - flex item di SidebarInset (flex-col); tanpa ini
              halaman bertabel lebar memaksa scroll horizontal di level
              browser (bug berulang yang sama di Warehouse). */}
          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}

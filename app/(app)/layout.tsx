"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "../components/AuthContext";
import { AppSidebar } from "../components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

// Layout ERP: sidebar kiri yang bisa diciutkan (pola sama persis dgn
// Crackling Warehouse) + header tipis berisi tombol ciut/buka & nama modul.
// Permintaan Kevin 2026-09-15 - dulu navigasi ada di TopBar horizontal.
function moduleTitle(pathname: string): string {
  if (pathname.startsWith("/accounting")) return "Accounting";
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

"use client";

import Link from "next/link";
import { AuthProvider, useAuthContext } from "../components/AuthContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, LogOut, Home, PiggyBank } from "lucide-react";
import { canAccessCostCenter } from "@/lib/roles";

// Role yang aksesnya lebih dari 1 modul (HR + Warehouse, dst) - butuh jalan
// pintas balik ke halaman pilih modul. Role HR biasa (hr_manager/hr_staff)
// cuma pernah pakai modul HR jadi tidak perlu tombol ini. Permintaan Kevin
// 2026-09-11.
const MULTI_MODULE_ROLES = ["owner", "developer"];

function TopBar() {
  const { user, logout } = useAuthContext();
  const showHomeButton = !!user && MULTI_MODULE_ROLES.includes(user.role);
  const showCostCenter = !!user && canAccessCostCenter(user);
  // Role "manager" cuma boleh akses Cost Center (lihat app/(app)/hr/layout.tsx)
  // jadi logo-nya langsung ke sana, bukan ke /hr yang bakal langsung dilempar balik.
  const homeHref = user?.role === "manager" ? "/cost-center" : "/hr";
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
      <Link href={homeHref} className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-[10px] font-heading font-bold">
          CE
        </div>
        <span className="font-heading font-semibold text-sm tracking-wide hidden sm:inline">Crackling ERP · HR</span>
      </Link>
      {showHomeButton && (
        <Button variant="ghost" size="sm" className="gap-1.5" render={<a href="/" />}>
          <Home className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Pilih Modul</span>
        </Button>
      )}
      {showCostCenter && (
        <Button variant="ghost" size="sm" className="gap-1.5" render={<Link href="/cost-center" />}>
          <PiggyBank className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Cost Center</span>
        </Button>
      )}
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">{user?.name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{user?.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={logout}>
              <LogOut /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col overflow-x-hidden">
        <TopBar />
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </AuthProvider>
  );
}

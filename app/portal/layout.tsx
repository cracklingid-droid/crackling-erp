"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalAuth, type PortalEmployee } from "../components/usePortalAuth";
import { EmployeeAvatar } from "../components/EmployeeAvatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const PortalCtx = createContext<{ employee: PortalEmployee | null; logout: () => void }>({
  employee: null,
  logout: () => {},
});

export function usePortalContext() {
  return useContext(PortalCtx);
}

const NAV_ITEMS = [
  { href: "/portal", label: "Beranda" },
  { href: "/portal/profil", label: "Profil" },
  { href: "/portal/roster", label: "Roster" },
  { href: "/portal/slip-gaji", label: "Slip Gaji" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/portal/login";
  const { employee, loading, logout } = usePortalAuth(!isLoginPage);

  if (isLoginPage) return children;

  if (loading || !employee) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground">Memuat...</div>;
  }

  return (
    <PortalCtx.Provider value={{ employee, logout }}>
      <div className="flex min-h-screen flex-col overflow-x-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-[10px] font-heading font-bold">
              CE
            </div>
            <span className="font-heading font-semibold text-sm tracking-wide hidden sm:inline">Portal Karyawan</span>
          </div>
          <nav className="ml-4 hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  pathname === item.href ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <EmployeeAvatar photoUrl={employee.photoUrl} name={employee.name} size={28} />
            <span className="text-sm hidden sm:inline">{employee.name}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </header>
        <nav className="flex sm:hidden items-center gap-1 border-b px-2 py-1.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname === item.href ? "bg-muted font-medium" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </PortalCtx.Provider>
  );
}

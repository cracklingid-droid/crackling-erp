"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutGrid,
  UserPlus,
  Users,
  Wallet,
  CalendarDays,
  Clock3,
  PiggyBank,
  BookOpen,
  Contact,
  Package,
  Landmark,
  ShoppingCart,
  Boxes,
  Receipt,
  Scale,
  FileBarChart,
  Warehouse,
  LogOut,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuthContext } from "./AuthContext";
import { canAccessCostCenter, canAccessAccounting, canViewOvertimeRequests, hasFullAccess } from "@/lib/roles";

// Sidebar kiri ERP - pola SAMA dgn Crackling Warehouse (Sidebar
// collapsible="icon": bisa diciutkan jadi rail ikon spy ruang kerja lebih
// lebar). Permintaan Kevin 2026-09-15 ("UI seperti di modul warehouse,
// semua tampilan di sebelah kiri, bisa disempitkan"). Menu difilter per
// role - ini cuma UX, proteksi sebenarnya tetap di tiap API route & layout
// guard (hr/layout.tsx, accounting/layout.tsx).
type NavItem = { href: string; label: string; icon: typeof Users; external?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const WAREHOUSE_URL = "https://crackling-warehouse.vercel.app/";

function buildGroups(role: string | undefined): NavGroup[] {
  if (!role) return [];
  const user = { role };
  const isManager = role === "manager";
  const isHr = role === "hr_manager" || role === "hr_staff";
  const full = hasFullAccess(user);

  const groups: NavGroup[] = [];

  if (full) {
    groups.push({ label: "", items: [{ href: "/", label: "Pilih Modul", icon: LayoutGrid }] });
  }

  if (full || isHr || isManager) {
    const hr: NavItem[] = [];
    if (!isManager) hr.push({ href: "/hr/rekrutmen", label: "Rekrutmen", icon: UserPlus });
    hr.push({ href: "/hr/karyawan", label: "Database Karyawan", icon: Users });
    hr.push({ href: "/hr/payroll", label: "Payroll", icon: Wallet });
    if (!isManager) hr.push({ href: "/hr/roster", label: "Roster Kerja", icon: CalendarDays });
    if (canViewOvertimeRequests(user)) hr.push({ href: "/lembur", label: "Lembur", icon: Clock3 });
    groups.push({ label: "Human Resource", items: hr });
  }

  if (canAccessCostCenter(user)) {
    groups.push({ label: "Cost Center", items: [{ href: "/cost-center", label: "Dashboard Harian", icon: PiggyBank }] });
  }

  if (canAccessAccounting(user)) {
    groups.push({
      label: "Accounting",
      items: [
        { href: "/accounting/sales", label: "Record Sales", icon: ShoppingCart },
        { href: "/accounting/cogs", label: "COGS (HPP)", icon: Boxes },
        { href: "/accounting/expenses", label: "Direct Expense", icon: Receipt },
        { href: "/accounting/reconciliation", label: "Rekonsiliasi", icon: Scale },
        { href: "/accounting/reports", label: "Laporan", icon: FileBarChart },
        { href: "/accounting/coa", label: "Chart of Accounts", icon: BookOpen },
        { href: "/accounting/contacts", label: "Contact", icon: Contact },
        { href: "/accounting/products", label: "Product", icon: Package },
        { href: "/accounting/fixed-assets", label: "Fixed Asset", icon: Landmark },
      ],
    });
  }

  if (full) {
    groups.push({ label: "Aplikasi Lain", items: [{ href: WAREHOUSE_URL, label: "Crackling Warehouse", icon: Warehouse, external: true }] });
  }

  return groups;
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthContext();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const groups = buildGroups(user?.role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-heading font-bold tracking-wide shadow-sm">
            CE
          </div>
          <span className="font-heading font-semibold text-sm tracking-wide group-data-[collapsible=icon]:hidden">Crackling ERP</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group, gi) => (
          <SidebarGroup key={group.label || gi}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={item.external ? <a href={item.href} /> : <Link href={item.href} />}
                      isActive={!item.external && isActivePath(pathname, item.href)}
                      tooltip={item.label}
                      className="relative transition-all duration-200 ease-out hover:translate-x-0.5 data-[active]:font-medium data-[active]:before:absolute data-[active]:before:-left-2 data-[active]:before:top-1/2 data-[active]:before:h-4 data-[active]:before:-translate-y-1/2 data-[active]:before:rounded-full data-[active]:before:bg-sidebar-primary data-[active]:before:w-1"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">{user?.name?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-medium">{user?.name}</span>
              <span className="text-xs text-muted-foreground">{user?.role}</span>
            </div>
            <ChevronsUpDown className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={logout}>
              <LogOut />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleSidebar} tooltip={isCollapsed ? "Buka menu" : "Ciutkan menu"} className="text-muted-foreground hover:text-foreground">
              {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              <span>Ciutkan menu</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

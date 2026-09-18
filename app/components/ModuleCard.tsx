import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Kartu navigasi "buka modul/sub-halaman" - dipakai di homepage, HR home,
// Payroll home, & Roster home. Sebelumnya markup ini di-copy-paste beda-
// beda di tiap halaman (radius, padding, bahkan primitive card beda-beda),
// disatukan jadi 1 komponen supaya fungsi yang sama benar2 tampil sama di
// seluruh aplikasi. Perbaikan UI menyeluruh 2026-09-19.
export function ModuleCard({
  href,
  external,
  icon,
  iconClass,
  title,
  description,
  children,
}: {
  href: string;
  external?: boolean;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const inner = (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass} transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3`}>
        {icon}
      </div>
      <h2 className="text-base font-heading font-semibold mt-2.5">{title}</h2>
      {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
      {children && <div className="mt-4 border-t pt-3">{children}</div>}
      <div className={`flex items-center gap-1 text-sm font-medium text-primary ${children ? "mt-4" : "mt-3"}`}>
        Buka <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </div>
  );

  if (external) {
    return (
      <a href={href} className="group">
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className="group">
      {inner}
    </Link>
  );
}

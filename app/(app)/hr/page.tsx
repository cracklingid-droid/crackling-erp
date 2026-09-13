"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, ArrowRight, Users, Wallet, CalendarDays, Store, Building2 } from "lucide-react";
import { useAuthContext } from "../../components/AuthContext";
import { employeeCategory } from "@/lib/payroll-config";
import { fieldsForCategory, computeNetPay } from "@/lib/payroll-fields";
import { ROSTER_OUTLETS } from "@/lib/roster";
import { Skeleton } from "@/components/ui/skeleton";

type Employee = { outlet: string | null; status: string };
type JobPosting = { status: string; candidateCount: number };
type Period = { id: number; label: string; status: string; startDate: string };
type PayrollStat = { label: string; status: string; itemCount: number; totalNetPay: number };

function formatRupiahShort(n: number): string {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  if (n >= 1_000) return `Rp${Math.round(n / 1_000)}rb`;
  return `Rp${n.toLocaleString("id-ID")}`;
}

async function loadPayrollStat(category: "outlet" | "kantor"): Promise<PayrollStat | null> {
  const periodsRes = await fetch(`/api/payroll/periods?category=${category}`);
  if (!periodsRes.ok) return null;
  const periods: Period[] = await periodsRes.json();
  if (periods.length === 0) return null;
  const latest = periods[0]; // sudah urut terbaru duluan (orderBy startDate desc)
  const detailRes = await fetch(`/api/payroll/periods/${latest.id}`);
  if (!detailRes.ok) return null;
  const detail = await detailRes.json();
  const fields = fieldsForCategory(category);
  const totalNetPay = (detail.items as Record<string, number>[]).reduce((s, it) => s + computeNetPay(it, fields), 0);
  return { label: latest.label, status: latest.status, itemCount: detail.items.length, totalNetPay };
}

export default function HrHomePage() {
  const { user } = useAuthContext();
  // "manager" cuma boleh lihat Database Karyawan & Payroll (resto, view-
  // only) - Rekrutmen & Roster disembunyikan total. Permintaan Kevin
  // 2026-09-13.
  const readOnly = user?.role === "manager";

  const [employees, setEmployees] = useState<Employee[] | undefined>(undefined);
  const [jobPostings, setJobPostings] = useState<JobPosting[] | undefined>(undefined);
  const [outletPayroll, setOutletPayroll] = useState<PayrollStat | null | undefined>(undefined);
  const [kantorPayroll, setKantorPayroll] = useState<PayrollStat | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEmployees);
    loadPayrollStat("outlet").then(setOutletPayroll);
    if (!readOnly) {
      fetch("/api/job-postings")
        .then((r) => (r.ok ? r.json() : []))
        .then(setJobPostings);
      loadPayrollStat("kantor").then(setKantorPayroll);
    }
  }, [readOnly]);

  const restoEmployees = employees?.filter((e) => employeeCategory(e.outlet) === "outlet");
  const kantorEmployees = employees?.filter((e) => employeeCategory(e.outlet) === "kantor");
  const restoActive = restoEmployees?.filter((e) => e.status === "active").length;
  const restoOnboarding = restoEmployees?.filter((e) => e.status === "onboarding").length;
  const kantorActive = kantorEmployees?.filter((e) => e.status === "active").length;
  const openPostings = jobPostings?.filter((p) => p.status === "open");
  const pipelineCandidates = openPostings?.reduce((s, p) => s + p.candidateCount, 0);

  return (
    <div className="max-w-5xl">
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Human Resource</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">Pilih modul di bawah untuk mulai kerja.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!readOnly && (
          <ModuleCard
            href="/hr/rekrutmen"
            icon={<UserPlus className="h-5 w-5" />}
            iconClass="icon-tile-1"
            title="Rekrutmen"
            description="Lowongan pekerjaan & pipeline kandidat."
          >
            {openPostings === undefined ? (
              <StatSkeleton />
            ) : openPostings.length === 0 ? (
              <StatLine value="0" label="lowongan dibuka" muted />
            ) : (
              <StatLine value={String(openPostings.length)} label={`lowongan dibuka · ${pipelineCandidates} kandidat di pipeline`} />
            )}
          </ModuleCard>
        )}

        <ModuleCard
          href="/hr/karyawan"
          icon={<Users className="h-5 w-5" />}
          iconClass="icon-tile-2"
          title="Database Karyawan"
          description={readOnly ? "Biodata & kepegawaian karyawan resto (lihat saja)." : "Biodata, kepegawaian, gaji & dokumen karyawan."}
        >
          {restoActive === undefined ? (
            <StatSkeleton />
          ) : (
            <StatLine
              value={String(readOnly ? restoActive : restoActive + (kantorActive ?? 0))}
              label={
                readOnly
                  ? `karyawan resto aktif${restoOnboarding ? ` · ${restoOnboarding} perlu dilengkapi` : ""}`
                  : `karyawan aktif (${restoActive} resto, ${kantorActive ?? 0} kantor)`
              }
            />
          )}
        </ModuleCard>

        <ModuleCard
          href="/hr/payroll"
          icon={<Wallet className="h-5 w-5" />}
          iconClass="icon-tile-5"
          title="Payroll"
          description={readOnly ? "Perhitungan & slip gaji outlet (lihat saja)." : "Absensi & perhitungan gaji outlet/kantor."}
        >
          <div className="grid gap-2">
            <PayrollStatLine icon={<Store className="h-3.5 w-3.5" />} label="Outlet" stat={outletPayroll} />
            {!readOnly && <PayrollStatLine icon={<Building2 className="h-3.5 w-3.5" />} label="Kantor" stat={kantorPayroll} />}
          </div>
        </ModuleCard>

        {!readOnly && (
          <ModuleCard
            href="/hr/roster"
            icon={<CalendarDays className="h-5 w-5" />}
            iconClass="icon-tile-3"
            title="Roster Kerja"
            description="Jadwal masuk/libur mingguan per outlet, bisa dilihat karyawan."
          >
            <StatLine value={String(ROSTER_OUTLETS.length)} label="outlet dijadwalkan" />
          </ModuleCard>
        )}
      </div>
    </div>
  );
}

function ModuleCard({
  href,
  icon,
  iconClass,
  title,
  description,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group">
      <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass} transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3`}>
          {icon}
        </div>
        <h2 className="text-base font-heading font-semibold mt-2.5">{title}</h2>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
        <div className="mt-4 border-t pt-3">{children}</div>
        <div className="flex items-center gap-1 text-sm font-medium text-primary mt-4">
          Buka <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

function StatLine({ value, label, muted }: { value: string; label: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-2xl font-heading font-semibold tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function StatSkeleton() {
  return <Skeleton className="h-7 w-32" />;
}

function PayrollStatLine({ icon, label, stat }: { icon: React.ReactNode; label: string; stat: PayrollStat | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        {icon} {label}
      </span>
      {stat === undefined ? (
        <Skeleton className="h-4 w-28" />
      ) : stat === null ? (
        <span className="text-muted-foreground text-xs">belum ada periode</span>
      ) : (
        <span className="text-right tabular-nums">
          <span className="font-medium">{formatRupiahShort(stat.totalNetPay)}</span>{" "}
          <span className="text-xs text-muted-foreground">
            · {stat.itemCount} org · {stat.status === "final" ? "Final" : "Draft"}
          </span>
        </span>
      )}
    </div>
  );
}

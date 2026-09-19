"use client";

import { useEffect, useState } from "react";
import { readJson, errorMessage } from "@/lib/fetch-json";
import { LoadingState } from "@/app/components/LoadingState";
import { ErrorState } from "@/app/components/ErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeAvatar } from "@/app/components/EmployeeAvatar";
import { EMPLOYEE_STATUS_LABEL, employmentStatusLabel } from "@/lib/employee-status";

type Profile = {
  name: string;
  employeeCode: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  position: string | null;
  outlet: string | null;
  employmentStatus: string | null;
  joinDate: string | null;
  status: string;
};

const STATUS_LABEL = EMPLOYEE_STATUS_LABEL;

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "-"}</span>
    </div>
  );
}

export default function PortalProfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function load() {
    setLoadError(null);
    fetch("/api/portal/profile")
      .then(readJson)
      .then(setProfile)
      .catch((e) => setLoadError(errorMessage(e, "Gagal memuat profil.")));
  }
  useEffect(load, []);

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (!profile) return <LoadingState />;

  return (
    <div className="max-w-2xl grid gap-6">
      <div className="flex items-center gap-3">
        <EmployeeAvatar photoUrl={profile.photoUrl} name={profile.name} size={56} />
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">{profile.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {profile.employeeCode ?? "-"} · {STATUS_LABEL[profile.status] ?? profile.status}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Biodata</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" value={profile.email ?? ""} />
          <Field label="No. HP" value={profile.phone ?? ""} />
          <Field label="Tempat, Tanggal Lahir" value={[profile.birthPlace, fmtDate(profile.birthDate)].filter(Boolean).join(", ")} />
          <Field label="Jenis Kelamin" value={profile.gender === "L" ? "Laki-laki" : profile.gender === "P" ? "Perempuan" : ""} />
          <Field label="Alamat" value={profile.address ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Data Kepegawaian</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Jabatan" value={profile.position ?? ""} />
          <Field label="Outlet / Cabang" value={profile.outlet ?? ""} />
          <Field label="Status Kepegawaian" value={profile.employmentStatus ? employmentStatusLabel(profile.employmentStatus) : ""} />
          <Field label="Tanggal Mulai Kerja" value={fmtDate(profile.joinDate)} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Data ini cuma bisa dilihat, kalau ada yang perlu diperbaiki hubungi HR.
      </p>
    </div>
  );
}

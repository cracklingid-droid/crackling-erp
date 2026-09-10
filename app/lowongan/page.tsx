"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Briefcase } from "lucide-react";

type Posting = {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  description: string | null;
};

export default function LowonganPage() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/job-postings")
      .then((r) => r.json())
      .then(setPostings)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 md:py-16">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-heading font-bold">
            CE
          </div>
          <span className="font-heading font-semibold tracking-wide">Crackling</span>
        </div>
        <h1 className="text-3xl font-heading font-semibold tracking-tight mt-4">Lowongan Pekerjaan</h1>
        <p className="text-muted-foreground mt-1">Bergabung bersama tim Crackling. Pilih posisi yang sesuai untuk melamar.</p>

        <div className="grid gap-3 mt-8">
          {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {!loading && postings.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada lowongan yang dibuka saat ini. Silakan cek kembali nanti.</p>
          )}
          {postings.map((p) => (
            <Link key={p.id} href={`/lowongan/${p.id}`}>
              <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-heading font-semibold">{p.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {[p.department, p.location, p.employmentType].filter(Boolean).join(" · ") || "-"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

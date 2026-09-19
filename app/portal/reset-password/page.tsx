"use client";

import { useEffect, useState } from "react";
import { LoadingState } from "@/app/components/LoadingState";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, KeyRound } from "lucide-react";

// Wajib diisi begitu karyawan login pakai password default (kode+tahun
// lahir) pertama kali - lihat usePortalAuth (redirect ke sini) & layout
// (dirender polos, tanpa nav, spy tidak bisa "kabur"). Permintaan Kevin
// 2026-09-18.
export default function PortalResetPasswordPage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/portal/me")
      .then(async (r) => {
        if (r.status === 401) {
          router.push("/portal/login");
          return;
        }
        const data = await r.json();
        if (!data.employee?.mustResetPassword) {
          router.push("/portal");
          return;
        }
        setName(data.employee.name);
      })
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError("Password baru minimal 6 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/portal/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        router.push("/portal");
      } else {
        const data = await res.json();
        setError(data.error ?? "Gagal menyimpan password baru");
      }
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <LoadingState variant="screen" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/20 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-center text-lg">Ganti Password</CardTitle>
          <CardDescription className="text-center">
            {name ? `Halo ${name}, ` : ""}sebelum lanjut, buat password baru untuk akun Portal Karyawan Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="newPassword">Password Baru</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
                minLength={6}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirmPassword">Ulangi Password Baru</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">Minimal 6 karakter. Simpan baik-baik - kalau lupa, minta bantuan HR.</p>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan &amp; Lanjutkan
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

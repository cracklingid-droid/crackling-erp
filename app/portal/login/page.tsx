"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function PortalLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/portal/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/portal");
    } else {
      const data = await res.json();
      setError(data.error ?? "Login gagal");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/20 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-heading font-bold text-lg shadow-md">
            CE
          </div>
          <CardTitle className="text-center text-lg">Portal Karyawan</CardTitle>
          <CardDescription className="text-center">Crackling F&amp;B - lihat profil, roster &amp; slip gaji Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="username">ID Karyawan</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="mis. GS-0001" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">Password = ID Karyawan + tahun lahir. Tanya HR kalau lupa.</p>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Masuk
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

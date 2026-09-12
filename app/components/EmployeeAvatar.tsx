function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Foto profil karyawan (Vercel Blob) dgn fallback inisial nama - dipakai di
// Database Karyawan (list) & halaman detail. Permintaan Kevin 2026-09-12.
export function EmployeeAvatar({ photoUrl, name, size = 32 }: { photoUrl: string | null; name: string; size?: number }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}
